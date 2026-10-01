"""Inspect real Gradio schemas and run queued Hugging Face Space jobs."""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import time
from concurrent.futures import TimeoutError as FutureTimeout


class GenerationError(RuntimeError):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def safe_error(error: Exception) -> str:
    message = str(error)
    token = os.environ.get("HF_TOKEN")
    if token:
        message = message.replace(token, "[REDACTED]")
    message = re.sub(r"hf_[A-Za-z0-9]+", "[REDACTED]", message)
    message = re.sub(r"(?i)(authorization|token|signature)([=: ]+)[^\s&,]+", r"\1\2[REDACTED]", message)
    return message[:1600]


def error_code(error: Exception) -> str:
    if isinstance(error, GenerationError):
        return error.code
    if isinstance(error, ImportError):
        return "missing_dependency"
    text = safe_error(error).lower()
    for terms, code in [
        (("quota", "rate limit", "429"), "quota_or_rate_limit"),
        (("401", "403", "authentication", "sign in", "log in", "invalid token"), "authentication_required_or_failed"),
        (("zerogpu", "gpu", "cuda"), "gpu_unavailable"),
        (("timed out", "timeout"), "queue_or_network_timeout"),
        (("api_name", "endpoint", "schema"), "unsupported_api_schema"),
        (("download",), "download_failure"),
        (("space", "503", "502", "404", "connect", "10013"), "space_unavailable"),
    ]:
        if any(term in text for term in terms):
            return code
    return "generation_failure"


class SpaceSession:
    def __init__(self, space_id: str, directory: Path, timeout: float):
        from gradio_client import Client
        if not re.fullmatch(r"[\w.-]+/[\w.-]+", space_id):
            raise GenerationError("invalid_space_id", "Use a Hugging Face owner/space identifier.")
        self.space_id = space_id
        self.directory = directory
        self.timeout = timeout
        directory.mkdir(parents=True, exist_ok=True)
        self.client = Client(
            space_id, token=os.environ.get("HF_TOKEN") or False,
            verbose=False, analytics_enabled=False,
            download_files=directory / "downloads",
            httpx_kwargs={"timeout": 60.0},
        )
        self.schema = self.client.view_api(print_info=False, return_format="dict")
        if not isinstance(self.schema, dict):
            raise GenerationError("unsupported_api_schema", "Space did not expose a usable API schema.")
        self.endpoints = self.schema.get("named_endpoints", {})
        (directory / "api-schema.json").write_text(json.dumps(self.schema, indent=2), encoding="utf-8")

    def require(self, endpoint: str, parameter_names: set[str]):
        if endpoint not in self.endpoints:
            raise GenerationError("api_endpoint_not_found", f"{self.space_id} does not expose {endpoint}.")
        params = self.endpoints[endpoint]["parameters"]
        actual = {p["parameter_name"] for p in params}
        missing = parameter_names - actual
        required = {p["parameter_name"] for p in params if not p.get("parameter_has_default")}
        if missing or required - parameter_names:
            raise GenerationError("unsupported_api_schema", f"{endpoint}: unexpected parameter contract; inspect saved api-schema.json.")

    def call(self, endpoint: str, **kwargs):
        self.require(endpoint, set(kwargs))
        job = self.client.submit(api_name=endpoint, **kwargs)
        deadline = time.monotonic() + self.timeout
        print(f"{self.space_id}: queued {endpoint}", flush=True)
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                job.cancel()
                raise GenerationError("queue_timeout", f"{endpoint} exceeded {self.timeout:g} seconds; cancellation requested.")
            try:
                return job.result(timeout=min(20, remaining))
            except FutureTimeout:
                if job.done():
                    return job.result()
                status = job.status()
                print(f"{self.space_id}: {status.code.name}; queue position {status.rank}", flush=True)

    def close(self):
        self.client.close()


def local_files(value):
    """Flatten Gradio's downloaded outputs without treating server paths as local."""
    if isinstance(value, str):
        path = Path(value)
        if not value.startswith(("http:", "https:")) and path.is_file():
            yield path
    elif isinstance(value, dict):
        for child in value.values():
            yield from local_files(child)
    elif isinstance(value, (tuple, list)):
        for child in value:
            yield from local_files(child)


def select_mesh(result) -> Path:
    files = list(dict.fromkeys(local_files(result)))
    for suffix in (".glb", ".gltf", ".obj", ".ply", ".stl", ".fbx"):
        for path in files:
            if path.suffix.lower() == suffix and path.stat().st_size > 0:
                return path
    raise GenerationError("invalid_output_file", "Space returned no nonempty downloaded mesh. Raw outputs are preserved in the run folder.")
