"""Offline checks for format rejection, material retention and safe reference handling."""
import os
import json
import struct
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np
from PIL import Image
import trimesh
from generate_ghost import preserve_reference
from generate_asset import cached_source
from providers.common import GenerationError, safe_error, SpaceSession
from utils.mesh import inspect_glb, prepare_mesh, prepare_asset_mesh


class WorkflowTests(unittest.TestCase):
    def test_texture_survives_conversion_and_y_up_normalization(self):
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            mesh = trimesh.creation.box(extents=[0.5, 0.4, 2.0])
            mesh.visual = trimesh.visual.TextureVisuals(
                uv=np.zeros((len(mesh.vertices), 2)),
                material=trimesh.visual.material.PBRMaterial(baseColorTexture=Image.new("RGB", (8, 8), "red")),
            )
            mesh.export(directory / "source.glb")
            report = prepare_mesh(directory / "source.glb", directory / "result.glb", height=1.85)
            self.assertTrue(report["textures"])
            self.assertEqual(report["image_sizes"], [[8, 8]])
            self.assertEqual(report["source_up_axis"], "Z")
            output_scene = trimesh.load_scene(directory / "result.glb", process=False)
            self.assertTrue(all(g.visual.material.metallicFactor == 0 for g in output_scene.geometry.values()))
            self.assertAlmostEqual(report["bounds_metres"][0][1], 0, places=6)
            self.assertAlmostEqual(report["bounds_metres"][1][1], 1.85, places=6)

    def test_rejects_html_and_truncated_glb(self):
        with tempfile.TemporaryDirectory() as name:
            path = Path(name) / "bad.glb"
            path.write_bytes(b"<html>service unavailable</html>")
            with self.assertRaises(GenerationError):
                inspect_glb(path)
            trimesh.creation.box().export(path)
            path.write_bytes(path.read_bytes()[:-12])
            with self.assertRaises(GenerationError):
                inspect_glb(path)

    def test_changed_reference_keeps_previous_copy(self):
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            (directory / "out").mkdir()
            original = directory / "in.png"
            Image.new("RGB", (8, 8), "red").save(original)
            old = preserve_reference(original, directory / "out", "face")
            previous = old.read_bytes()
            Image.new("RGB", (8, 8), "blue").save(original)
            new = preserve_reference(original, directory / "out", "face")
            self.assertNotEqual(old, new)
            self.assertEqual(old.read_bytes(), previous)

    def test_schema_change_fails_before_submission(self):
        session = object.__new__(SpaceSession)
        session.space_id = "test/space"
        session.endpoints = {"/run": {"parameters": [{"parameter_name": "unexpected", "parameter_has_default": False}]}}
        with self.assertRaises(GenerationError):
            session.require("/run", {"image"})

    def test_secret_redaction(self):
        with patch.dict(os.environ, {"HF_TOKEN": "test-secret-value"}):
            message = safe_error(RuntimeError("authentication test-secret-value hf_example123 token=secret"))
        self.assertNotIn("test-secret-value", message)
        self.assertNotIn("hf_example123", message)
        self.assertNotIn("token=secret", message)

    def test_prop_normalization_preserves_texture_bytes_and_world_scale(self):
        # A TRELLIS root named 'world' collided with trimesh's synthetic base
        # frame, causing its bounds check to silently ignore our parent matrix.
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            source, target = directory / "source.glb", directory / "key.glb"
            mesh = trimesh.creation.box(extents=[2.0, 0.8, 0.1])
            mesh.visual = trimesh.visual.TextureVisuals(
                uv=np.zeros((len(mesh.vertices), 2)),
                material=trimesh.visual.material.PBRMaterial(baseColorTexture=Image.new("RGB", (8, 8), "red")),
            )
            scene = trimesh.Scene(mesh)
            scene.apply_translation([2, 3, 4])
            scene.export(source)
            report = prepare_asset_mesh(source, target, asset_type="key")
            self.assertAlmostEqual(np.ptp(report["bounds_metres"], axis=0).max(), .12)
            np.testing.assert_allclose(np.mean(report["bounds_metres"], axis=0), [0, 0, 0], atol=1e-6)
            self.assertTrue(report["textures"])
            self.assertTrue(report["renamed_reserved_world_nodes"])
            def binary(path):
                data = path.read_bytes()
                json_size = struct.unpack_from("<I", data, 12)[0]
                return data[28 + json_size:]
            self.assertEqual(binary(source), binary(target))

    def test_arm_pivot_rotation_and_existing_parent_transform(self):
        with tempfile.TemporaryDirectory() as name:
            source, target = Path(name) / "source.glb", Path(name) / "arms.glb"
            scene = trimesh.Scene(trimesh.creation.box(extents=[.2, .3, 1]))
            scene.apply_translation([1, 2, 3])
            scene.export(source)
            report = prepare_asset_mesh(source, target, asset_type="flashlight-arms", size=.55,
                                        source_up="z", rotation=(0, 90, 0), pivot="base")
            self.assertAlmostEqual(report["bounds_metres"][0][1], 0, places=6)
            self.assertAlmostEqual(np.ptp(report["bounds_metres"], axis=0).max(), .55)
            self.assertFalse(report["rigged"])

    def test_resume_refuses_a_different_reference_even_with_same_filename(self):
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            ref, report = directory / "ref.png", directory / "generation-info.json"
            Image.new("RGB", (8, 8), "blue").save(ref)
            report.write_text(json.dumps({"asset_type": "key", "reference_sha256": {"ref.png": "different"}}))
            with self.assertRaisesRegex(ValueError, "hashes differ"):
                cached_source(report, [ref], ref, "key")


if __name__ == "__main__":
    unittest.main()
