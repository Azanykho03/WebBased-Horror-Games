"""Generate flashlight arms or a key with the existing ghost Space adapters."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import sys

# Import the established reference/security helpers without changing the ghost CLI.
from generate_ghost import ROOT, digest, preserve_reference, write_json
from providers.common import GenerationError, error_code, safe_error

ASSETS = {
    "flashlight-arms": ("player/arms/flashlight-arms", "flashlight_arms.glb"),
    "flashlight": ("items/flashlight", "flashlight.glb"),
    "arm": ("player/arms/right-arm", "right_arm.glb"),
    "key": ("items/keys", "key.glb"),
}


def cached_source(report_path, references, chosen, asset_type):
    """Resume only a recorded raw mesh made from the same reference inputs."""
    metadata = json.loads(report_path.read_text(encoding="utf-8-sig"))
    if metadata.get("asset_type") != asset_type:
        raise ValueError("Cached run is for another asset type")
    expected = sorted(metadata.get("reference_sha256", {}).values())
    if expected != sorted(digest(p) for p in references):
        raise ValueError("Cached run reference hashes differ; refusing to substitute another design")
    if metadata.get("generation_input_sha256") != digest(chosen):
        raise ValueError("Cached generation input differs from the selected image")
    for attempt in reversed(metadata.get("attempts", [])):
        if attempt.get("raw_asset"):
            raw = Path(attempt["raw_asset"])
            raw = raw if raw.is_absolute() else ROOT / raw
            if raw.is_file() and raw.stat().st_size:
                return metadata, attempt, raw
    if metadata.get("raw_source") and metadata.get("asset_directory"):
        directory = Path(metadata["asset_directory"])
        directory = directory if directory.is_absolute() else ROOT / directory
        raw = directory / metadata["raw_source"]
        if raw.is_file() and raw.stat().st_size:
            return metadata, {"generator": metadata["generator"]}, raw
    raise ValueError("Cached run has no preserved raw mesh; inspect its downloads before regenerating")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--type", required=True, choices=ASSETS)
    parser.add_argument("--image", required=True, type=Path, action="append")
    parser.add_argument("--prepared-image", type=Path, help="Optional coherent input prepared from the references")
    parser.add_argument("--reference-strategy", help="Explain how a prepared image uses the originals")
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--resume-run", type=Path, help="Existing generation-info.json; reuse its raw mesh without a GPU call")
    parser.add_argument("--fallback-from", type=Path, help="TRELLIS report rejected in visual review; retain its source and try TripoSR")
    parser.add_argument("--fallback-reason", help="Specific visual defect in the rejected TRELLIS mesh")
    parser.add_argument("--trellis-space", default=os.environ.get("HF_3D_SPACE_ID") or "trellis-community/TRELLIS")
    parser.add_argument("--triposr-space", default=os.environ.get("HF_TRIPOSR_SPACE_ID") or "stabilityai/TripoSR")
    parser.add_argument("--timeout", type=float, default=600)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--texture-size", type=int, choices=[512, 1024, 2048], default=2048)
    parser.add_argument("--mesh-simplify", type=float, default=0.9, help="TRELLIS fraction removed, 0 to less than 1")
    parser.add_argument("--size", type=float, help="Longest dimension in metres; key 0.12, flashlight arms 0.5")
    parser.add_argument("--source-up", choices=["x", "y", "z"], default="y")
    parser.add_argument("--rotate", type=float, nargs=3, default=(0, 0, 0), metavar=("X", "Y", "Z"))
    parser.add_argument("--pivot", choices=["center", "base"], default="center")
    parser.add_argument("--replace", action="store_true", help="Archive an existing successful asset before replacement")
    args = parser.parse_args(argv)
    if args.fallback_from and (args.resume_run or not args.fallback_reason):
        parser.error("--fallback-from requires --fallback-reason and cannot be combined with --resume-run")
    if args.timeout <= 0 or not 0 <= args.mesh_simplify < 1 or (args.size is not None and args.size <= 0):
        parser.error("Invalid timeout, mesh simplification or size")
    if args.prepared_image and not args.reference_strategy:
        parser.error("--prepared-image requires --reference-strategy to record how all references were used")
    folder, filename = ASSETS[args.type]
    output = (args.output_dir or ROOT / "public/assets/models" / folder).resolve()
    final = output / filename
    if final.exists() and not args.replace:
        parser.error(f"{filename} exists; use --replace to archive it, or choose a different --output-dir")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ")
    run = ROOT / ".cache/3d-generation/runs" / f"{args.type}-{stamp}"
    run.mkdir(parents=True)
    (output / "source").mkdir(parents=True, exist_ok=True)
    (output / "textures").mkdir(exist_ok=True)
    info = {"status": "running", "asset_type": args.type, "started_at": stamp,
            "generator": None, "fallback_used": False, "rigged": False,
            "animated": False, "babylon_ready": False, "attempts": [],
            "asset_directory": output.relative_to(ROOT).as_posix() if output.is_relative_to(ROOT) else str(output),
            "run_directory": run.relative_to(ROOT).as_posix()}

    def save():
        write_json(run / "generation-info.json", info)
        # Never overwrite the metadata of a successful asset on a failed rerun.
        if final.exists() and info["status"] == "running":
            return
        name = "last-failure.json" if final.exists() and info["status"] != "complete" else "generation-info.json"
        write_json(output / name, info)

    try:
        from providers import trellis_provider, triposr_provider
        from utils.mesh import inspect_glb, prepare_asset_mesh, extract_embedded_textures
        refs = [preserve_reference(p, output / "source", f"reference-{i+1}") for i, p in enumerate(args.image)]
        chosen = preserve_reference(args.prepared_image, output / "source", "prepared-reference") if args.prepared_image else refs[0]
        strategy = args.reference_strategy if args.prepared_image else (
            "Direct reconstruction from the first reference; provider preprocesses its background. " +
            ("Additional references are preserved for review, not independently conditioned by the single-image adapters." if len(refs) > 1 else "All supplied references used."))
        info.update({"references_used": [p.relative_to(output).as_posix() for p in refs],
                     "reference_original_names": [p.name for p in args.image],
                     "reference_sha256": {p.name: digest(p) for p in refs},
                     "generation_input": chosen.relative_to(output).as_posix(),
                     "generation_input_sha256": digest(chosen), "reference_strategy": strategy,
                     "seed": args.seed, "texture_size_requested": args.texture_size,
                     "mesh_simplify_requested": args.mesh_simplify})
        print("Reference strategy:", strategy, flush=True)
        save()
        raw, selected_name, fallback = None, None, False
        if args.resume_run:
            previous, attempt, raw = cached_source(args.resume_run, refs, chosen, args.type)
            selected_name = attempt["generator"]
            fallback = selected_name != "TRELLIS"
            info.update({"attempts": previous["attempts"], "resumed_from": str(args.resume_run),
                         "reference_strategy": previous.get("reference_strategy", strategy)})
            for field in ("seed", "texture_size_requested", "mesh_simplify_requested"):
                if field in previous:
                    info[field] = previous[field]
            info["provider_details"] = previous.get("provider_details") or {
                k: previous[k] for k in ("model", "model_revision", "license", "device", "torch_version", "resolution", "chunk_size", "cpu_isosurface", "network_access") if k in previous}
            print("Reusing preserved", selected_name, "mesh:", raw, flush=True)
        else:
            if args.fallback_from:
                previous, attempt, rejected = cached_source(args.fallback_from, refs, chosen, args.type)
                if attempt["generator"] != "TRELLIS":
                    raise ValueError("Visual fallback must refer to a preserved TRELLIS generation")
                info["attempts"] = [*previous["attempts"]]
                info["attempts"][-1] = {**info["attempts"][-1], "status": "rejected",
                    "error_code": "visual_quality_failed", "reason": args.fallback_reason}
                info["rejected_run"] = str(args.fallback_from)
                save()
            for index, (name, provider, space) in enumerate([
                ("TRELLIS", trellis_provider, args.trellis_space),
                ("TripoSR", triposr_provider, args.triposr_space),
            ]):
                if args.fallback_from and name == "TRELLIS":
                    continue
                attempt = {"generator": name, "space_id": space, "status": "running"}
                info["attempts"].append(attempt)
                save()
                print(f"Attempting {name}: {space}", flush=True)
                try:
                    options = {"timeout": args.timeout, "seed": args.seed, "texture_size": args.texture_size}
                    if name == "TRELLIS":
                        options["mesh_simplify"] = args.mesh_simplify
                    raw = provider.generate(chosen, run / name.lower(), space, **options)
                    selected_name, fallback = name, bool(index)
                    attempt.update({"status": "generated", "raw_asset": raw.relative_to(ROOT).as_posix()})
                    save()  # Persist before any conversion; a resume must not repeat a successful GPU job.
                    if raw.suffix.lower() == ".glb":
                        inspect_glb(raw)
                    break
                except Exception as error:
                    raw = None
                    attempt.update({"status": "failed", "error_code": error_code(error), "reason": safe_error(error)})
                    save()
                    print(f"{name} failed [{attempt['error_code']}]: {attempt['reason']}", flush=True)
        if raw is None:
            raise GenerationError("providers_failed", "TRELLIS and TripoSR failed; see attempts in generation-info.json")
        # Preserve the raw model and its resources, including non-GLB sidecars.
        raw_hash = digest(raw)
        existing_raw = next((p for p in (output / "source").glob(f"generated-*/{raw.name}")
                             if digest(p) == raw_hash), None)
        preserved = existing_raw.parent if existing_raw else output / "source" / f"generated-{stamp}"
        if existing_raw is None:
            shutil.copytree(raw.parent, preserved)
        info["raw_source"] = (preserved / raw.name).relative_to(output).as_posix()
        info["raw_sha256"] = raw_hash
        info.update({"generator": selected_name, "fallback_used": fallback})
        save()
        prepared = run / filename
        validation = prepare_asset_mesh(raw, prepared, asset_type=args.type, size=args.size,
                                        source_up=args.source_up, rotation=args.rotate, pivot=args.pivot)
        if final.exists():
            archive = output / "source" / ("previous-" + stamp)
            archive.mkdir()
            shutil.copy2(final, archive / filename)
            if (output / "generation-info.json").exists():
                shutil.copy2(output / "generation-info.json", archive / "generation-info.json")
        temporary = final.with_suffix(".glb.tmp")
        shutil.copy2(prepared, temporary)
        temporary.replace(final)
        texture_files = extract_embedded_textures(final, output / "textures")
        info.update({"status": "complete", "output": filename, "output_sha256": digest(final),
                     "texture_files": ["textures/" + p for p in texture_files],
                     "file_size_bytes": final.stat().st_size, "textures": validation["textures"],
                     "rigged": validation["rigged"], "animated": validation["animated"], "validation": validation,
                     "notes": ["Structural checks passed. Visual review and runtime validation are still required."]})
        if args.type == "flashlight-arms":
            info["notes"].append("Static hand/forearm and flashlight mesh. No skeleton or animation; deformation needs topology cleanup, rigging and weight painting.")
        save()
        print("3D GENERATION COMPLETE:", final, flush=True)
        return 0
    except Exception as error:
        info.update({"status": "failed", "error_code": error_code(error), "reason": safe_error(error),
                     "next_step": "Resume this report if a raw_asset was saved; otherwise resolve the reported provider/dependency failure"})
        save()
        print("3D GENERATION FAILED:", safe_error(error), flush=True)
        print("Report:", run / "generation-info.json", flush=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
