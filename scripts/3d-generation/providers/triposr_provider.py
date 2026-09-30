"""TripoSR fallback; endpoints are checked against each Space's live schema."""
from gradio_client import handle_file
from .common import SpaceSession, select_mesh


def generate(image, directory, space_id, *, timeout=600, seed=42, texture_size=2048):
    session = SpaceSession(space_id, directory, timeout)
    try:
        # These names come from stabilityai/TripoSR's published app.py.
        session.require("/preprocess", {"input_image", "do_remove_background", "foreground_ratio"})
        session.require("/generate", {"image", "mc_resolution"})
        processed = session.call(
            "/preprocess", input_image=handle_file(str(image)),
            do_remove_background=True, foreground_ratio=0.85,
        )
        result = session.call("/generate", image=handle_file(str(processed)), mc_resolution=256)
        return select_mesh(result)
    finally:
        session.close()
