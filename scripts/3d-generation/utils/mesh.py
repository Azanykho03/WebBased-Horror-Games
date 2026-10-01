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


def prepare_asset_mesh(source: Path, target: Path, *, asset_type, size=None,
                       source_up="y", rotation=(0, 0, 0), pivot="center") -> dict:
    """Prepare props without applying the ghost's height/anatomy assumptions.

    Native GLBs keep their binary chunk (including textures) byte-for-byte. A
    parent node supplies the metre scale and pivot; existing node transforms stay
    intact. This avoids a lossy texture re-encode or accidental transform baking.
    """
    if asset_type not in {"key", "flashlight-arms"}:
        raise ValueError("Unsupported asset type")
    size = size if size is not None else (0.12 if asset_type == "key" else 0.5)
    if not np.isfinite(size) or size <= 0 or not np.isfinite(rotation).all():
        raise ValueError("Size must be positive and rotations must be finite")
    if source_up not in {"x", "y", "z"} or pivot not in {"center", "base"}:
        raise ValueError("Invalid source-up axis or pivot")
    target.parent.mkdir(parents=True, exist_ok=True)
    native = source.suffix.lower() == ".glb"
    if native:
        inspect_glb(source)
        data = source.read_bytes()
    else:
        try:
            data = trimesh.load_scene(source, process=False).export(file_type="glb")
        except Exception as error:
            raise GenerationError("conversion_failure", f"Cannot convert {source.suffix}; raw output preserved. Blender may be required: {error}") from error
    position, document, binary = 12, None, b""
    while position < len(data):
        length, kind = struct.unpack_from("<II", data, position)
        chunk = data[position + 8:position + 8 + length]
        if kind == 0x4E4F534A:
            document = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        position += 8 + length
    if not document or not document.get("scenes"):
        raise GenerationError("invalid_output_file", "Mesh has no scene")
    # Use the loaded scene's world-space bounds, including all existing parents.
    scene = trimesh.load_scene(io.BytesIO(data), file_type="glb", process=False)
    orient = np.eye(4)
    if source_up == "z":
        orient = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])
    elif source_up == "x":
        orient = trimesh.transformations.rotation_matrix(np.pi / 2, [0, 0, 1])
    orient = trimesh.transformations.euler_matrix(*np.radians(rotation)) @ orient
    scene.apply_transform(orient)
    bounds = scene.bounds
    if bounds is None or not np.isfinite(bounds).all() or scene.extents.max() <= 1e-8:
        raise GenerationError("invalid_output_file", "Mesh has no finite nonzero bounds")
    origin = bounds.mean(axis=0)
    if pivot == "base":
        origin[1] = bounds[0, 1]
    scale = size / scene.extents.max()
    transform = np.diag([scale, scale, scale, 1.0]) @ trimesh.transformations.translation_matrix(-origin) @ orient
    nodes = document.setdefault("nodes", [])
    # trimesh reserves "world" for its synthetic scene base. A source node with
    # that name under a new parent disconnects the parent in trimesh's graph.
    # Rename only the display label; indices, hierarchy and geometry stay intact.
    renamed_nodes = []
    for index, node in enumerate(nodes):
        if node.get("name") == "world":
            node["name"] = f"AssetSourceWorld_{index}"
            renamed_nodes.append(index)
    for item in document["scenes"]:
        children = list(item.get("nodes", []))
        if children:
            item["nodes"] = [len(nodes)]
            nodes.append({"name": "Key" if asset_type == "key" else "FlashlightArms",
                          "children": children, "matrix": transform.flatten(order="F").tolist()})
    changes = []
    for material in document.get("materials", []):
        pbr = material.setdefault("pbrMetallicRoughness", {})
        # TRELLIS supplies one color atlas, not a physically measured metal map.
        if "metallicRoughnessTexture" not in pbr:
            pbr["metallicFactor"] = 0.65 if asset_type == "key" else 0.0
            pbr["roughnessFactor"] = 0.72 if asset_type == "key" else 0.58
            changes.append({"material": material.get("name", "unnamed"),
                            "metallicFactor": pbr["metallicFactor"], "roughnessFactor": pbr["roughnessFactor"]})
    document.setdefault("asset", {})["generator"] = "Ghost-aligned asset preparation; original mesh and texture binary preserved" if native else "Ghost-aligned asset conversion via trimesh"
    encoded = json.dumps(document, separators=(",", ":")).encode("utf-8")
    encoded += b" " * (-len(encoded) % 4)
    body = struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
    if binary:
        binary += b"\0" * (-len(binary) % 4)
        body += struct.pack("<II", len(binary), 0x004E4942) + binary
    target.write_bytes(struct.pack("<4sII", b"glTF", 2, 12 + len(body)) + body)
    report = inspect_glb(target)
    actual = np.ptp(np.array(report["bounds_metres"]), axis=0).max()
    if not np.isclose(actual, size, rtol=1e-5, atol=1e-7):
        raise GenerationError("validation_failure", "Exported world-space bounds do not match the requested size")
    report.update({"up_axis": "Y", "source_up_axis": source_up.upper(),
                   "rotation_degrees_xyz": list(rotation), "longest_dimension_metres": float(actual),
                   "pivot": "centre of mesh bounds" if pivot == "center" else "bottom centre of mesh bounds",
                   "normalization_matrix": transform.tolist(), "material_changes": changes,
                   "renamed_reserved_world_nodes": renamed_nodes,
                   "native_glb_binary_preserved": native, "conversion_performed": not native})
    return report


def extract_embedded_textures(source: Path, directory: Path) -> list[str]:
    """Save texture bytes for later editing while retaining them in the GLB."""
    data = source.read_bytes()
    position, document, binary = 12, None, b""
    while position < len(data):
        size, kind = struct.unpack_from("<II", data, position)
        chunk = data[position + 8:position + 8 + size]
        if kind == 0x4E4F534A:
            document = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        position += 8 + size
    directory.mkdir(parents=True, exist_ok=True)
    paths = []
    for i, item in enumerate(document.get("images", [])):
        if "bufferView" not in item:
            continue
        extension = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}.get(item.get("mimeType"))
        if extension is None:
            continue
        view = document["bufferViews"][item["bufferView"]]
        offset = view.get("byteOffset", 0)
        content = binary[offset:offset + view["byteLength"]]
        target = directory / f"image-{i}{extension}"
        if target.exists() and target.read_bytes() != content:
            import hashlib
            target = directory / f"image-{i}-{hashlib.sha256(content).hexdigest()[:12]}{extension}"
        target.write_bytes(content)
        paths.append(target.name)
    return paths
