"""Extract small runtime surface maps from the supplied GLBs; never rebuild the house.

Run with Python + Pillow + numpy. The unchanged source GLBs live beside the
inspection record and are excluded from the Vite production asset allowlist.
"""
from pathlib import Path
import hashlib
import io
import itertools
import json
import struct

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[2]
HOUSE = ROOT / "public/assets/models/environments/haunted-house"
SOURCE = HOUSE / "source/interior-references"
OUTPUT = HOUSE / "textures/reference"
OUTPUT.mkdir(parents=True, exist_ok=True)


def read_glb(name):
    raw = (SOURCE / name).read_bytes()
    assert raw[:4] == b"glTF" and struct.unpack_from("<I", raw, 4)[0] == 2
    length = struct.unpack_from("<I", raw, 12)[0]
    gltf = json.loads(raw[20:20 + length])
    binary = raw[28 + length:]
    images = []
    for image in gltf["images"]:
        view = gltf["bufferViews"][image["bufferView"]]
        start = view.get("byteOffset", 0)
        images.append(Image.open(io.BytesIO(binary[start:start + view["byteLength"]])).convert("RGB"))
    return gltf, images, hashlib.sha256(raw).hexdigest()


def inspect(name, gltf, images, digest):
    def matrix(node):
        if "matrix" in node:
            return np.array(node["matrix"]).reshape(4, 4).T
        x, y, z, w = node.get("rotation", [0, 0, 0, 1])
        m = np.array([[1-2*y*y-2*z*z, 2*x*y-2*z*w, 2*x*z+2*y*w, 0],
                      [2*x*y+2*z*w, 1-2*x*x-2*z*z, 2*y*z-2*x*w, 0],
                      [2*x*z-2*y*w, 2*y*z+2*x*w, 1-2*x*x-2*y*y, 0], [0, 0, 0, 1.]])
        m[:3, :3] = m[:3, :3] @ np.diag(node.get("scale", [1, 1, 1]))
        m[:3, 3] = node.get("translation", [0, 0, 0])
        return m

    meshes = []

    def walk(index, parent):
        node = gltf["nodes"][index]
        transform = parent @ matrix(node)
        if "mesh" in node:
            mesh = gltf["meshes"][node["mesh"]]
            points = []
            for primitive in mesh["primitives"]:
                a = gltf["accessors"][primitive["attributes"]["POSITION"]]
                points.extend((transform @ [*v, 1])[:3] for v in itertools.product(*zip(a["min"], a["max"])))
            meshes.append({"node": index, "mesh": node["mesh"], "name": mesh.get("name"),
                           "materials": [p.get("material") for p in mesh["primitives"]],
                           "min": np.min(points, axis=0).round(5).tolist(),
                           "max": np.max(points, axis=0).round(5).tolist()})
        for child in node.get("children", []):
            walk(child, transform)

    for node in gltf["scenes"][gltf.get("scene", 0)]["nodes"]:
        walk(node, np.eye(4))
    return {"file": name, "sha256": digest, "asset": gltf["asset"],
            "nodes": len(gltf["nodes"]), "meshes": len(gltf["meshes"]),
            "triangles": sum(gltf["accessors"][p["indices"]]["count"] // 3 for m in gltf["meshes"] for p in m["primitives"]),
            "animations": len(gltf.get("animations", [])), "materials": gltf["materials"],
            "images": [im.size for im in images], "geometry": meshes}


def save(image, name, size, saturation=1, brightness=1):
    image = image.resize(size, Image.Resampling.LANCZOS)
    image = ImageEnhance.Color(image).enhance(saturation)
    image = ImageEnhance.Brightness(image).enhance(brightness)
    image.save(OUTPUT / (name + ".jpg"), quality=88, optimize=True)
    return image


def normal(image, name, strength):
    # Shallow micro relief from the source grain, with wrapped edge gradients.
    height = np.asarray(image.convert("L").resize((256, 256)).filter(ImageFilter.GaussianBlur(.5)), dtype=float) / 255
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * strength
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * strength
    vector = np.stack([-dx, dy, np.ones_like(dx)], axis=2)
    vector /= np.linalg.norm(vector, axis=2, keepdims=True)
    Image.fromarray(np.uint8((vector + 1) * 127.5)).save(OUTPUT / (name + "-normal.png"), optimize=True)


house, hi, hh = read_glb("haunted_house.glb")
hall, ci, ch = read_glb("scary_interiorHallway.glb")
# Image 8 also contains tiny fixture UV islands below y=224. Crop those out.
plaster = hi[8].crop((0, 0, 512, 224))
tile = Image.new("RGB", (512, 448)); tile.paste(plaster); tile.paste(ImageOps.flip(plaster), (0, 224))
plaster = save(tile, "house-plaster", (512, 512), .6, .94)
timber = save(hi[6].transpose(Image.Transpose.ROTATE_90), "house-timber", (512, 512), .72, 1.12)
save(hi[11].crop((0, 16, 256, 242)), "house-panels", (256, 256), .7, 1.14)
save(hi[5], "house-tile", (256, 256), .6, .92)
save(hi[10], "house-rug", (512, 512), .65, .86)
# A clean rectangular wall island in the hallway's baked Base atlas, excluding
# doors, piers, floors and black UV padding. Matching normal-map crop preserves
# the original paper creases; never tile the entire scene atlas on a wall.
crop = (850, 110, 1035, 890)
save(ci[0].crop(crop), "hall-paper", (256, 1024), .32, .83)
ci[2].crop(crop).resize((128, 512), Image.Resampling.LANCZOS).save(OUTPUT / "hall-paper-normal.png", optimize=True)
normal(plaster, "house-plaster", 1.4)
normal(timber, "house-timber", 2.8)
report = {"sources": [inspect("haunted_house.glb", house, hi, hh), inspect("scary_interiorHallway.glb", hall, ci, ch)],
          "derivatives": {"house-plaster": "House image 8; fixture islands excluded, mirrored vertical seam", "house-timber": "House image 6; rotated grain, desaturated", "house-panels": "House image 11; lower timber band cropped", "house-tile": "House image 5", "house-rug": "House image 10", "hall-paper": {"sourceImages": [0, 2], "cropPixels": crop}},
          "runtimeBytes": sum(p.stat().st_size for p in OUTPUT.iterdir() if p.suffix in (".jpg", ".png"))}
(SOURCE / "inspection.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(f"Prepared {len(list(OUTPUT.iterdir()))} shared maps: {report['runtimeBytes']:,} bytes")
