#!/usr/bin/env python3
"""Normalize a transparent expression sprite to the shared production canvas."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


CANVAS_SIZE = (512, 1280)
SILHOUETTE_HEIGHT = 1152


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = Image.open(args.input).convert("RGBA")
    bbox = source.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError(f"{args.input} has no visible pixels")

    subject = source.crop(bbox)
    scale = SILHOUETTE_HEIGHT / subject.height
    resized_size = (
        max(1, round(subject.width * scale)),
        SILHOUETTE_HEIGHT,
    )
    if resized_size[0] > CANVAS_SIZE[0]:
        width_scale = CANVAS_SIZE[0] / resized_size[0]
        resized_size = (
            CANVAS_SIZE[0],
            max(1, round(resized_size[1] * width_scale)),
        )

    # Resize in premultiplied-alpha mode so transparent pixels cannot create
    # dark or chroma-colored fringes around hair and lace.
    subject = subject.convert("RGBa").resize(
        resized_size, Image.Resampling.LANCZOS
    ).convert("RGBA")
    offset = (
        (CANVAS_SIZE[0] - resized_size[0]) // 2,
        (CANVAS_SIZE[1] - resized_size[1]) // 2,
    )

    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    canvas.alpha_composite(subject, offset)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.out, optimize=True)
    print(
        f"{args.out.name}: {source.size} bbox {bbox} -> "
        f"{resized_size} at {offset}"
    )


if __name__ == "__main__":
    main()
