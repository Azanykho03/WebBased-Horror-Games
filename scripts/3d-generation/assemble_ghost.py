"""Fit a directly reconstructed head to an existing static ghost body.

This preserves each generated texture and deliberately does not claim welded,
deformation-ready topology or a rig. Fit parameters require visual inspection.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import trimesh

from utils.mesh import inspect_glb


def assemble(body, head, output, *, cut_y=1.59, head_bottom=1.54, head_x=-0.01, head_z=0.10, head_height=0.31, yaw=0):
    body_scene = trimesh.load_scene(body, process=False)
    head_scene = trimesh.load_scene(head, process=False)
    assembled = trimesh.Scene()
    for node in body_scene.graph.nodes_geometry:
        matrix, name = body_scene.graph[node]
        mesh = body_scene.geometry[name].copy()
        mesh.apply_transform(matrix)
        # Keep the body, long hair below the neck, and original materials/UVs.
        mesh.update_faces(np.all(mesh.vertices[mesh.faces, 1] <= cut_y, axis=1))
        mesh.remove_unreferenced_vertices()
        assembled.add_geometry(mesh, node_name="Ghost_body", geom_name="Ghost_body")
    bounds = head_scene.bounds
    head_scene.apply_translation([-bounds[:, 0].mean(), -bounds[0, 1], -bounds[:, 2].mean()])
    head_scene.apply_scale(head_height / (bounds[1, 1] - bounds[0, 1]))
    head_scene.apply_transform(trimesh.transformations.rotation_matrix(np.radians(yaw), [0, 1, 0]))
    head_scene.apply_translation([head_x, head_bottom, head_z])
    for node in head_scene.graph.nodes_geometry:
        matrix, name = head_scene.graph[node]
        mesh = head_scene.geometry[name].copy()
        mesh.apply_transform(matrix)
        assembled.add_geometry(mesh, node_name="Ghost_head", geom_name="Ghost_head")
    output.parent.mkdir(parents=True, exist_ok=True)
    assembled.export(output, file_type="glb")
    validation = inspect_glb(output)
    fit = dict(cut_y=cut_y, head_bottom=head_bottom, head_x=head_x, head_z=head_z, head_height=head_height, yaw=yaw)
    return {"validation": validation, "fit": fit, "topology": "separate overlapping textured head and body; not welded or rigged"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--body", type=Path, required=True)
    parser.add_argument("--head", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cut-y", type=float, default=1.59)
    parser.add_argument("--head-bottom", type=float, default=1.54)
    parser.add_argument("--head-x", type=float, default=-0.01)
    parser.add_argument("--head-z", type=float, default=0.10)
    parser.add_argument("--head-height", type=float, default=0.31)
    parser.add_argument("--yaw", type=float, default=0)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Choose a new output file; assembly never overwrites an existing asset.")
    report = assemble(args.body, args.head, args.output, cut_y=args.cut_y, head_bottom=args.head_bottom, head_x=args.head_x, head_z=args.head_z, head_height=args.head_height, yaw=args.yaw)
    args.output.with_suffix(".assembly.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
