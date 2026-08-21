"""Lift a generated sprite off the flat white it was drawn on.

Two things have to happen and neither does the other's job.

**The outline** is flood-filled inward from the border. Thresholding cannot do
it: her socks measure 253,253,253 against a 253,250,253 background, so no
colour rule can tell the two apart. Being outside her is what makes a pixel
background, not being white.

**The gaps she encloses** — under an arm on her hip, inside the crook of an
elbow, between her legs — the flood cannot reach, so they stay as flat white
patches that only show up once she is standing on a transparent window. Those
need a matte from something that knows a person from a background; pass one in
with `--matte` (BiRefNet's mask does the job). The two are combined by taking
whichever says transparent, so the flood keeps the crisp outer edge and its
freedom from halo while the matte opens the holes.

Without a matte only the outline is cut, which is fine for a pose with no gaps
in it and wrong for every other one — so pass one.
"""
import argparse
from collections import deque

import numpy as np
from PIL import Image, ImageFilter


def outline(art, tolerance=32):
    """Everything reachable from the border without crossing her."""
    px = np.asarray(art).astype(np.int16)
    h, w, _ = px.shape
    near = np.abs(px - px[0, 0]).max(axis=2) <= tolerance
    outside = np.zeros((h, w), bool)
    queue = deque()

    def enter(y, x):
        if near[y, x] and not outside[y, x]:
            outside[y, x] = True
            queue.append((y, x))

    for x in range(w):
        enter(0, x)
        enter(h - 1, x)
    for y in range(h):
        enter(y, 0)
        enter(y, w - 1)
    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w:
                enter(ny, nx)
    return ((~outside) * 255).astype(np.uint8)


def cut(path, out, matte=None, tolerance=32, feather=1.2):
    art = Image.open(path).convert('RGB')
    alpha = Image.fromarray(outline(art, tolerance))
    # What the flood leaves behind is a handful of stray pixels in the corners,
    # where the generated white drifts a shade off the corner it was measured
    # from. They are invisible, and they are also disastrous: the sprite is
    # scaled by its bounding box, so one speck in a corner makes her a head
    # shorter than she is in every other mood. Opening the mask — shrink, then
    # grow back — kills anything that thin and leaves her silhouette put.
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    if matte:
        held = Image.open(matte).convert('L').resize(art.size)
        alpha = Image.fromarray(np.minimum(np.asarray(alpha), np.asarray(held)))
    # A hard cut leaves a white rind along her hair and hem; softening the mask
    # by about a pixel is what stops that reading as an outline.
    alpha = alpha.filter(ImageFilter.GaussianBlur(feather))
    cutout = art.convert('RGBA')
    cutout.putalpha(alpha)
    cutout.save(out)
    return out


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--matte', help='a person/background mask, white where she is')
    said = parser.parse_args()
    print(cut(said.input, said.out, said.matte))
