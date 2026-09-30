"""Generate only a ghost asset through free Hugging Face Spaces, TRELLIS first."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, data):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def preserve_reference(source, directory, stem):
    from PIL import Image
    source = source.expanduser().resolve()
    if not source.is_file():
        raise ValueError(f"Reference image does not exist: {source}")
    with Image.open(source) as image:
        if image.format not in {"PNG", "JPEG", "WEBP"}:
            raise ValueError("Unsupported image format; use PNG, JPEG or WebP.")
        image.verify()
    destination = directory / (stem + source.suffix.lower())
    if destination.exists() and digest(destination) != digest(source):
        destination = directory / (stem + "-" + digest(source)[:12] + source.suffix.lower())
    if source != destination:
        shutil.copy2(source, destination)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--face", type=Path, required=True)
    parser.add_argument("--body", type=Path, required=True)
    parser.add_argument("--prepared-image", type=Path, help="Full-body image prepared from BOTH references. Optional; otherwise body is used and face limitation is reported.")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "public/assets/models/enemies/ghost")
    parser.add_argument("--trellis-space", default=os.environ.get("HF_3D_SPACE_ID") or "trellis-community/TRELLIS")
    parser.add_argument("--triposr-space", default=os.environ.get("HF_TRIPOSR_SPACE_ID") or "stabilityai/TripoSR")
    parser.add_argument("--timeout", type=float, default=600, help="Maximum seconds per queued endpoint.")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--texture-size", type=int, choices=[512, 1024, 2048], default=2048)
    parser.add_argument("--height", type=float, default=1.85, help="Target height in metres.")
    parser.add_argument("--source-up", choices=["auto", "x", "y", "z"], default="auto")
    parser.add_argument("--replace", action="store_true", help="Archive an existing final asset before replacing it.")
    args = parser.parse_args()
    if args.height <= 0 or args.timeout <= 0:
        parser.error("--height and --timeout must be positive")
    output = args.output_dir.resolve()
    final = output / "ghost.glb"
    if final.exists() and not args.replace:
        parser.error("ghost.glb exists. Use --replace to archive it before replacement.")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ")
    run = ROOT / ".cache/3d-generation/runs" / stamp
    run.mkdir(parents=True, exist_ok=False)
    (output / "source").mkdir(parents=True, exist_ok=True)
    (output / "textures").mkdir(exist_ok=True)
    metadata = {"status": "running", "started_at": stamp, "generator": None, "fallback_used": False,
                "output": None, "rigged": False, "animated": False, "babylon_ready": False, "attempts": []}
    try:
        from providers import trellis_provider, triposr_provider
        from providers.common import safe_error, error_code
        from utils.mesh import prepare_mesh
        face = preserve_reference(args.face, output / "source", "ghost-face-reference")
        body = preserve_reference(args.body, output / "source", "ghost-body-reference")
        chosen = preserve_reference(args.prepared_image, output / "source", "ghost-combined-reference") if args.prepared_image else body
        metadata.update({"face_reference": str(face.relative_to(output)), "body_reference": str(body.relative_to(output)),
                         "face_sha256": digest(face), "body_sha256": digest(body), "generation_input": str(chosen.relative_to(output)),
                         "generation_input_sha256": digest(chosen), "seed": args.seed, "texture_size_requested": args.texture_size,
                         "reference_strategy": "prepared full-body composite of both references" if args.prepared_image else "body-only reconstruction; face preserved for manual review, not independently conditioned"})
        print("Reference strategy:", metadata["reference_strategy"], flush=True)
        for index, (name, provider, space) in enumerate([
            ("TRELLIS", trellis_provider, args.trellis_space), ("TripoSR", triposr_provider, args.triposr_space),
        ]):
            attempt = {"generator": name, "space_id": space, "status": "running"}
            metadata["attempts"].append(attempt)
            write_json(run / "generation-info.json", metadata)
            print(f"Attempting {name}: {space}", flush=True)
            try:
                raw = provider.generate(chosen, run / name.lower(), space, timeout=args.timeout, seed=args.seed, texture_size=args.texture_size)
                # Keep provider files, supporting resources, video and schema in the run folder.
                attempt["raw_asset"] = str(raw.relative_to(ROOT)) if raw.is_relative_to(ROOT) else str(raw)
                prepared = run / "ghost.glb"
                validation = prepare_mesh(raw, prepared, height=args.height, source_up=args.source_up)
                if final.exists():
                    archive = output / "source" / ("previous-ghost-" + stamp + ".glb")
                    shutil.copy2(final, archive)
                if (output / "generation-info.json").exists():
                    shutil.copy2(output / "generation-info.json", run / "previous-generation-info.json")
                shutil.copy2(prepared, final)
                attempt["status"] = "complete"
                metadata.update({"status": "complete", "generator": name, "fallback_used": bool(index), "output": "ghost.glb",
                                 "rigged": validation["rigged"], "animated": validation["animated"], "validation": validation,
                                 "babylon_ready": False, "notes": ["Mesh checks passed; visual review of orientation, facial likeness and texture quality is required before calling it Babylon-ready."]})
                break
            except Exception as error:
                attempt.update({"status": "failed", "error_code": error_code(error), "reason": safe_error(error)})
                print(f"{name} failed [{attempt['error_code']}]: {attempt['reason']}", flush=True)
        else:
            metadata["status"] = "failed"
        write_json(run / "generation-info.json", metadata)
        # Failed reruns must not replace a previous successful asset's metadata.
        report_name = "generation-info.json" if not final.exists() or metadata["status"] == "complete" else "last-failure.json"
        write_json(output / report_name, metadata)
        print("3D GENERATION " + ("COMPLETE" if metadata["status"] == "complete" else "FAILED"))
        print("Report:", output / report_name)
        return 0 if metadata["status"] == "complete" else 1
    except Exception as error:
        from providers.common import safe_error
        metadata.update({"status": "failed", "reason": safe_error(error)})
        write_json(run / "generation-info.json", metadata)
        write_json(output / ("last-failure.json" if final.exists() else "generation-info.json"), metadata)
        print("3D GENERATION FAILED:", safe_error(error))
        print("Dependencies: python -m pip install -r scripts/3d-generation/requirements.txt")
        return 1


if __name__ == "__main__":
    sys.exit(main())
