"""Offline TripoSR fallback using the project's existing cached model/runtime.

Run with .cache/3d-generation/triposr-local/venv/Scripts/python.exe. Requires a
report recording failed TRELLIS and TripoSR Space attempts for this same image.
No package installation, model download, credentials or remote service calls.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import types

from generate_ghost import ROOT, digest, write_json
from providers.common import safe_error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--resume-failures", type=Path, required=True)
    parser.add_argument("--output-run", type=Path, help="Reuse this directory to resume saved inference/mesh stages")
    parser.add_argument("--resolution", type=int, default=192)
    parser.add_argument("--texture-size", type=int, default=2048)
    parser.add_argument("--chunk-size", type=int, default=4096)
    args = parser.parse_args()
    if not 64 <= args.resolution <= 256 or args.texture_size not in (512, 1024, 2048) or args.chunk_size <= 0:
        parser.error("Unsupported mesh/texture resolution or chunk size")
    previous = json.loads(args.resume_failures.read_text(encoding="utf-8-sig"))
    if previous.get("generation_input_sha256") != digest(args.image):
        parser.error("Input does not match the recorded failed provider attempts")
    failures = {a["generator"] for a in previous.get("attempts", []) if a.get("status") == "failed"}
    if not {"TRELLIS", "TripoSR"}.issubset(failures):
        parser.error("Attempt TRELLIS and the TripoSR Space first, then supply their failure report")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ")
    run = (args.output_run or ROOT / ".cache/3d-generation/runs" / f"{previous['asset_type']}-local-{stamp}").resolve()
    run.mkdir(parents=True, exist_ok=True)
    report = run / "generation-info.json"
    if report.exists():
        existing = json.loads(report.read_text())
        if existing.get("generation_input_sha256") != digest(args.image):
            parser.error("Output run contains a different reference")
        if existing.get("resolution") != args.resolution or existing.get("texture_size_requested") != args.texture_size:
            parser.error("Use the same resolutions when resuming a local run")
    info = {**previous, "status": "running", "generator": "TripoSR (local)",
            "fallback_used": True, "started_at": stamp, "resumed_failures_from": str(args.resume_failures),
            "run_directory": str(run.relative_to(ROOT)), "resolution": args.resolution,
            "texture_size_requested": args.texture_size, "chunk_size": args.chunk_size,
            "model": "stabilityai/TripoSR", "license": "MIT", "network_access": False,
            "output": None, "babylon_ready": False, "rigged": False, "animated": False}
    for key in ("reason", "error_code", "next_step"):
        info.pop(key, None)
    attempt = {"generator": "TripoSR (local)", "model": "stabilityai/TripoSR", "status": "running"}
    info["attempts"] = [*previous["attempts"], attempt]
    write_json(report, info)
    try:
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
        os.environ["HF_HOME"] = str(ROOT / ".cache/huggingface")
        vendor = ROOT / ".cache/3d-generation/triposr-local/vendor"
        if not (vendor / "tsr/system.py").is_file():
            raise RuntimeError("Existing local TripoSR source is missing; see README for optional fallback requirements")
        sys.path.insert(0, str(vendor))
        import numpy as np
        import torch
        import trimesh
        from PIL import Image
        from skimage.measure import marching_cubes

        # The existing Windows runtime lacks torchmcubes. Use the same density
        # field with skimage's CPU extractor, matching upstream's coordinate order.
        shim = types.ModuleType("torchmcubes")
        def cpu_marching_cubes(field, level):
            vertices, faces, _, _ = marching_cubes(field.detach().cpu().numpy(), level=level)
            return torch.from_numpy(vertices[:, [2, 1, 0]].copy()), torch.from_numpy(faces.astype(np.int64).copy())
        shim.marching_cubes = cpu_marching_cubes
        sys.modules["torchmcubes"] = shim
        from tsr.system import TSR
        from tsr.utils import resize_foreground
        from tsr.bake_texture import make_atlas, rasterize_position_atlas

        weights_root = ROOT / ".cache/huggingface/hub/models--stabilityai--TripoSR"
        revision = (weights_root / "refs/main").read_text().strip()
        weights = weights_root / "snapshots" / revision
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        info.update({"torch_version": torch.__version__, "device": torch.cuda.get_device_name(0) if device.startswith("cuda") else "CPU",
                     "model_revision": revision, "cpu_isosurface": "scikit-image marching_cubes; upstream coordinate order retained"})
        print("Loading cached TripoSR on", info["device"], flush=True)
        model = TSR.from_pretrained(str(weights), config_name="config.yaml", weight_name="model.ckpt").to(device).eval()
        model.renderer.set_chunk_size(args.chunk_size)
        state_path = run / "scene-code.pt"
        if state_path.exists():
            codes = torch.load(state_path, map_location=device, weights_only=True)
            print("Reusing saved inference state", flush=True)
        else:
            with Image.open(args.image) as opened:
                if opened.mode != "RGBA" or opened.getextrema()[3][0] == 255:
                    raise ValueError("Local fallback needs a prepared transparent RGBA reference")
                # Official TripoSR foreground sizing and neutral-background input.
                rgba = np.array(resize_foreground(opened, .85)).astype(np.float32) / 255
            rgb = rgba[..., :3] * rgba[..., 3:4] + .5 * (1 - rgba[..., 3:4])
            processed = Image.fromarray((rgb * 255).astype(np.uint8))
            processed.save(run / "input.png")
            print("Running image-to-3D inference", flush=True)
            with torch.no_grad():
                codes = model([processed], device=device)
            torch.save(codes.detach().cpu(), state_path)
        info["saved_inference_state"] = state_path.relative_to(ROOT).as_posix()
        write_json(report, info)
        mesh_path = run / "untextured.ply"
        if mesh_path.exists():
            mesh = trimesh.load(mesh_path, process=False)
        else:
            print("Extracting mesh at resolution", args.resolution, flush=True)
            mesh = model.extract_mesh(codes, False, resolution=args.resolution)[0]
            mesh.fix_normals(multibody=True)
            mesh.export(mesh_path)
        print("Baking", args.texture_size, "pixel texture for", len(mesh.faces), "triangles", flush=True)
        padding = max(2, round(args.texture_size / 256))
        atlas = make_atlas(mesh, args.texture_size, padding)
        positions = rasterize_position_atlas(mesh, atlas["vmapping"], atlas["indices"], atlas["uvs"], args.texture_size, padding)
        valid = positions[..., 3].reshape(-1) > 0
        samples = positions[..., :3].reshape(-1, 3)[valid]
        colors = np.zeros((args.texture_size * args.texture_size, 3), dtype=np.float32)
        indices = np.flatnonzero(valid)
        with torch.no_grad():
            for start in range(0, len(samples), args.chunk_size):
                points = torch.tensor(samples[start:start + args.chunk_size], device=device)
                values = model.renderer.query_triplane(model.decoder, points, codes[0])["color"].cpu().numpy()
                colors[indices[start:start + args.chunk_size]] = values
        texture = Image.fromarray((np.clip(colors.reshape(args.texture_size, args.texture_size, 3), 0, 1) * 255).astype(np.uint8)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        texture.save(run / "texture.png")
        textured = trimesh.Trimesh(vertices=mesh.vertices[atlas["vmapping"]], faces=atlas["indices"],
                                  vertex_normals=mesh.vertex_normals[atlas["vmapping"]], process=False)
        textured.visual = trimesh.visual.TextureVisuals(uv=atlas["uvs"], material=trimesh.visual.material.PBRMaterial(
            name="FlashlightArmSurface", baseColorTexture=texture, metallicFactor=0.0, roughnessFactor=.58))
        # TripoSR coordinates are Z-up; normalization is applied by generate_asset.
        raw = run / "triposr.glb"
        textured.export(raw)
        attempt.update({"status": "generated", "raw_asset": raw.relative_to(ROOT).as_posix()})
        info.update({"status": "generated", "triangles": len(textured.faces), "vertices": len(textured.vertices),
                     "textures": True, "raw_sha256": digest(raw), "source_up": "z",
                     "next_step": "Run generate_asset.py --resume-run on this report with the same original/prepared images, --source-up z, and --replace"})
        write_json(report, info)
        print("LOCAL GENERATION COMPLETE:", raw, flush=True)
        print("Report:", report, flush=True)
        return 0
    except Exception as error:
        attempt.update({"status": "failed", "reason": safe_error(error)})
        info.update({"status": "failed", "reason": safe_error(error),
                     "next_step": "Resolve error and rerun with this --output-run to reuse saved inference/mesh stages"})
        write_json(report, info)
        print("LOCAL GENERATION FAILED:", type(error).__name__, safe_error(error), flush=True)
        print("Report:", report, flush=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
