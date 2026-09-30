"""Generate a detailed head directly from the face reference; retain the body asset."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from generate_ghost import ROOT, write_json, digest
from providers.trellis_provider import generate
from providers.common import safe_error, error_code
from utils.mesh import prepare_mesh


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--face", type=Path, required=True)
    parser.add_argument("--space", default="trellis-community/TRELLIS")
    parser.add_argument("--timeout", type=float, default=480)
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ")
    run = ROOT / ".cache/3d-generation/face-runs" / stamp
    run.mkdir(parents=True)
    metadata = {"purpose": "direct face-reference head detail", "face_sha256": digest(args.face),
                "generator": "TRELLIS", "space_id": args.space, "seed": 42, "mesh_simplify": 0.9, "texture_size": 2048}
    try:
        raw = generate(args.face.resolve(), run, args.space, timeout=args.timeout, seed=42, texture_size=2048, mesh_simplify=0.9)
        metadata["raw_asset"] = str(raw.relative_to(ROOT))
        metadata["validation"] = prepare_mesh(raw, run / "head.glb", height=0.31, source_up="y")
        metadata["status"] = "complete"
        metadata["output"] = str((run / "head.glb").relative_to(ROOT))
        write_json(run / "face-generation-info.json", metadata)
        print(json.dumps(metadata, indent=2))
        return 0
    except Exception as error:
        metadata.update({"status": "failed", "error_code": error_code(error), "reason": safe_error(error)})
        write_json(run / "face-generation-info.json", metadata)
        print(json.dumps(metadata, indent=2))
        return 1


if __name__ == "__main__":
    sys.exit(main())
