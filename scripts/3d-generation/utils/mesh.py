"""Conservative mesh conversion, metre scale, and basic self-contained GLB checks."""
from __future__ import annotations

import io
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image
import trimesh

from providers.common import GenerationError


def inspect_glb(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise GenerationError("invalid_output_file", "Output is not a GLB file.")
    magic, version, length = struct.unpack_from("<4sII", data)
    if version != 2 or length != len(data):
        raise GenerationError("invalid_output_file", "GLB header or length is invalid.")
    position, document, binary = 12, None, b""
    while position < len(data):
        if position + 8 > len(data):
            raise GenerationError("invalid_output_file", "Truncated GLB chunk header.")
        size, kind = struct.unpack_from("<II", data, position)
        position += 8
        chunk = data[position:position + size]
        if len(chunk) != size or size % 4:
            raise GenerationError("invalid_output_file", "Truncated or misaligned GLB chunk.")
        if kind == 0x4E4F534A:
            document = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        position += size
    if not document or not document.get("meshes"):
        raise GenerationError("invalid_output_file", "GLB contains no mesh.")
    for resource in document.get("buffers", []) + document.get("images", []):
        if resource.get("uri") and not resource["uri"].startswith("data:"):
            raise GenerationError("broken_external_path", "GLB contains an external resource reference.")
    for view in document.get("bufferViews", []):
        if view.get("buffer", 0) != 0 or view.get("byteOffset", 0) + view["byteLength"] > len(binary):
            raise GenerationError("invalid_output_file", "GLB buffer view exceeds its binary chunk.")
    image_sizes = []
    for item in document.get("images", []):
        if "bufferView" in item:
            view = document["bufferViews"][item["bufferView"]]
            offset = view.get("byteOffset", 0)
            with Image.open(io.BytesIO(binary[offset:offset + view["byteLength"]])) as image:
                image.load()
                image_sizes.append(list(image.size))
    scene = trimesh.load_scene(path, process=False)
    meshes = [g for g in scene.geometry.values() if isinstance(g, trimesh.Trimesh)]
    if not meshes or sum(len(g.faces) for g in meshes) == 0:
        raise GenerationError("invalid_output_file", "Mesh is empty or contains no triangles.")
    for mesh in meshes:
        if not np.isfinite(mesh.vertices).all() or mesh.faces.min() < 0 or mesh.faces.max() >= len(mesh.vertices):
            raise GenerationError("invalid_output_file", "Invalid vertices or triangle indices.")
    return {
        "format": "GLB 2.0", "file_size_bytes": len(data),
        "triangles": sum(len(g.faces) for g in meshes),
        "vertices": sum(len(g.vertices) for g in meshes),
        "mesh_count": len(meshes), "materials": len(document.get("materials", [])),
        "textures": bool(document.get("textures")), "embedded_images": len(document.get("images", [])),
        "image_sizes": image_sizes, "rigged": bool(document.get("skins")),
        "animated": bool(document.get("animations")),
        "bounds_metres": scene.bounds.tolist(),
        "uvs": all(getattr(g.visual, "uv", None) is not None for g in meshes),
        "external_paths": False, "validation": "basic structural, embedded-image and mesh checks; not Khronos conformance",
    }


def prepare_mesh(source: Path, target: Path, *, height=1.85, source_up="auto") -> dict:
    try:
        scene = trimesh.load_scene(source, process=False)
    except Exception as error:
        raise GenerationError("conversion_failure", f"Could not load {source.suffix}. Raw asset preserved; Blender may be needed: {error}") from error
    if not scene.geometry or scene.bounds is None or not np.isfinite(scene.bounds).all():
        raise GenerationError("invalid_output_file", "No finite mesh bounds.")
    material_fixes = []
    for name, geometry in scene.geometry.items():
        material = getattr(geometry.visual, "material", None)
        if isinstance(material, trimesh.visual.material.PBRMaterial) and material.metallicFactor is None:
            # glTF's omitted metallicFactor defaults to 1. Skin, cloth and hair
            # in this ghost have no metal, so explicitly prevent a metallic look.
            material.metallicFactor = 0.0
            material_fixes.append(f"{name}: set omitted metallicFactor to 0 for skin/cloth/hair")
    if source_up == "auto":
        axis = int(np.argmax(scene.extents))
        # Valid for an upright full-body humanoid. Visual review is still required.
        source_up = "xyz"[axis]
    if source_up == "z":
        scene.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
    elif source_up == "x":
        scene.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 0, 1]))
    bounds = scene.bounds
    extent = bounds[1, 1] - bounds[0, 1]
    if extent <= 1e-8:
        raise GenerationError("invalid_output_file", "Mesh has zero height.")
    scene.apply_translation([-bounds[:, 0].mean(), -bounds[0, 1], -bounds[:, 2].mean()])
    scene.apply_scale(height / extent)
    target.parent.mkdir(parents=True, exist_ok=True)
    scene.export(target, file_type="glb")
    report = inspect_glb(target)
    report.update({"up_axis": "Y", "source_up_axis": source_up.upper(), "height_metres": height, "pivot": "ground, centre of horizontal bounds", "material_fixes": material_fixes})
    return report
