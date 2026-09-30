"""Adapter for the inspected trellis-community/TRELLIS Gradio contract."""
from gradio_client import handle_file
from .common import SpaceSession, select_mesh


def generate(image, directory, space_id, *, timeout=600, seed=42, texture_size=2048, mesh_simplify=0.95):
    session = SpaceSession(space_id, directory, timeout)
    try:
        # This Space stores a server-side directory in the Gradio session.
        session.require("/start_session", set())
        session.require("/preprocess_image", {"image"})
        session.require("/generate_and_extract_glb", {
            "image", "multiimages", "seed", "ss_guidance_strength", "ss_sampling_steps",
            "slat_guidance_strength", "slat_sampling_steps", "multiimage_algo", "mesh_simplify", "texture_size",
        })
        session.call("/start_session")
        processed = session.call("/preprocess_image", image=handle_file(str(image)))
        result = session.call(
            "/generate_and_extract_glb", image=handle_file(str(processed)), multiimages=[],
            seed=seed, ss_guidance_strength=7.5, ss_sampling_steps=12,
            slat_guidance_strength=3.0, slat_sampling_steps=12,
            multiimage_algo="stochastic", mesh_simplify=mesh_simplify, texture_size=texture_size,
        )
        return select_mesh(result)
    finally:
        session.close()
