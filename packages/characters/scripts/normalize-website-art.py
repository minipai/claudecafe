#!/usr/bin/env python3

from pathlib import Path

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[3]
CAST_ROOT = REPO_ROOT / "packages" / "characters"
MASTERS = REPO_ROOT / "art-masters"
WEB_ROOT = REPO_ROOT / "apps" / "website" / "src" / "assets" / "maids"


def drawing(*parts: str) -> Path:
    """A drawing from the masters beside the repo.

    The pencil portraits these are built from are workshop material, not part
    of the cast the apps ship, so they live in art-masters/ and never in git.
    Without that folder there is nothing to normalize — hence the plain error
    rather than a lower-quality fallback."""
    master = MASTERS.joinpath(*parts).with_suffix(".png")
    if not master.exists():
        raise SystemExit(f"missing master: {master}")
    return master

CANVAS_SIZE = (1024, 1920)
OUTPUT_CROP = (0, 0, 864, 1760)
AVATAR_CROP = (226, 32, 610, 416)
AVATAR_SIZE = (128, 128)
COMMON_CSS = {"x": -150, "y": -20, "height": 1700}
TARGET_HEAD = {"center_x": 220, "top": 58, "bottom": 291}

# These are the approved source drawings and the CSS geometry used to display
# them before normalization. Baking that geometry into a shared canvas keeps
# the approved composition while allowing every character to share one rule.
CHARACTERS = {
    "kanae": {
        "source": drawing("kanae", "reference", "portrait-pencil"),
        "css": {"x": -210, "y": 20, "height": 1500},
        "head": {"center_x": 228, "top": 58, "bottom": 291},
    },
    "kokona": {
        "source": drawing("kokona", "reference", "portrait-pencil"),
        "css": {"x": -150, "y": -68, "height": 1715},
        "head": {"center_x": 238, "top": 58, "bottom": 285},
        "scale_adjust": 0.92,
    },
    "kotone": {
        "source": drawing("kotone", "reference", "portrait-pencil"),
        "css": {"x": -70, "y": 20, "height": 1500},
        "head": {"center_x": 252, "top": 58, "bottom": 299},
    },
    "kuroko": {
        "source": drawing("kuroko", "reference", "portrait-pencil"),
        "css": {"x": -242, "y": -3, "height": 1690},
        "head": {"center_x": 208, "top": 40, "bottom": 305},
    },
    "kurumi": {
        "source": drawing("kurumi", "reference", "portrait-pencil"),
        "css": {"x": -250, "y": 20, "height": 1500},
        "head": {"center_x": 200, "top": 58, "bottom": 335},
    },
}


def normalize(name: str, config: dict[str, object]) -> None:
    source_path = config["source"]
    old_css = config["css"]
    old_head = config["head"]
    assert isinstance(source_path, Path)
    assert isinstance(old_css, dict)
    assert isinstance(old_head, dict)

    source = Image.open(source_path).convert("RGBA")
    common_scale = COMMON_CSS["height"] / CANVAS_SIZE[1]
    old_scale = old_css["height"] / source.height
    baked_scale = old_scale / common_scale

    resized_size = (
        round(source.width * baked_scale),
        round(source.height * baked_scale),
    )
    resized = source.resize(resized_size, Image.Resampling.LANCZOS)

    offset = (
        round((old_css["x"] - COMMON_CSS["x"]) / common_scale),
        round((old_css["y"] - COMMON_CSS["y"]) / common_scale),
    )
    baked_canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    baked_canvas.alpha_composite(resized, offset)

    target_head_height = TARGET_HEAD["bottom"] - TARGET_HEAD["top"]
    old_head_height = old_head["bottom"] - old_head["top"]
    head_scale = target_head_height / old_head_height
    head_scale *= config.get("scale_adjust", 1.0)

    scaled_canvas_size = (
        round(CANVAS_SIZE[0] * head_scale),
        round(CANVAS_SIZE[1] * head_scale),
    )
    scaled_canvas = baked_canvas.resize(
        scaled_canvas_size, Image.Resampling.LANCZOS
    )

    current_anchor = (
        (old_head["center_x"] - COMMON_CSS["x"]) / common_scale,
        (old_head["top"] - COMMON_CSS["y"]) / common_scale,
    )
    target_anchor = (
        (TARGET_HEAD["center_x"] - COMMON_CSS["x"]) / common_scale,
        (TARGET_HEAD["top"] - COMMON_CSS["y"]) / common_scale,
    )
    aligned_offset = (
        round(target_anchor[0] - current_anchor[0] * head_scale),
        round(target_anchor[1] - current_anchor[1] * head_scale),
    )

    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    canvas.alpha_composite(scaled_canvas, aligned_offset)

    output = canvas.crop(OUTPUT_CROP)
    output_path = CAST_ROOT / name / "portraits" / "standing.webp"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output.save(output_path, quality=88, method=6)
    output.save(WEB_ROOT / f"maid-{name}.webp", quality=88, method=6)

    avatar = output.crop(AVATAR_CROP).resize(
        AVATAR_SIZE, Image.Resampling.LANCZOS
    )
    avatar_path = CAST_ROOT / name / "portraits" / "avatar.webp"
    avatar.save(avatar_path, quality=90, method=6)
    avatar.save(WEB_ROOT / f"avatar-{name}.webp", quality=90, method=6)

    alpha_bbox = output.getchannel("A").getbbox()
    print(
        f"{name}: {source.size} -> {resized_size} at {offset}; "
        f"head scale {head_scale:.3f} at {aligned_offset}; "
        f"output {output.size}; alpha bbox {alpha_bbox}; "
        f"avatar {avatar.size}"
    )


def main() -> None:
    for name, config in CHARACTERS.items():
        normalize(name, config)


if __name__ == "__main__":
    main()
