"""Cut a half-body portrait out of a full-body sprite, at a settled head size.

The maids are not drawn to one scale: くるみ's head is a third wider than
ことね's on the same canvas, because she is drawn as the smaller, younger one.
Standing side by side at full height that reads correctly. Cropped to the same
rectangle it does not — one of them fills her card while the other sits small in
the middle of hers, and a row of faces at different sizes reads as artwork that
was never finished rather than as two different girls.

So the crop is measured off her head, not off the canvas: scaled until her hair
is HEAD_WIDTH across, hung HAIR_TOP below the top edge, and centred on her head
rather than on her outline — a raised hand should not shove her face aside.

Read from her neutral sprite: the one pose every outfit has, with her arms where
they normally are.
"""
import argparse
import statistics

import numpy as np
from PIL import Image

CANVAS = (384, 480)
"""Upright, and about two and a half heads across: her shoulders come to twice
her head and want a margin either side, and below her chin there is a chest's
worth of her and no more."""

HEAD_WIDTH = 150
"""How wide her hair comes out, whoever she is. Just under the narrowest maid's
own head, so nobody is enlarged into softness to meet it."""

HAIR_TOP = 40
"""Air above her head. Without it she is wearing the top edge as a hat."""


def measure(alpha):
    """Where her head is: how wide her hair is, where it starts, and the line
    down its middle. Taken over the top tenth of her, which is hair and nothing
    else — below that the shoulders come in and stop being a head."""
    there = alpha > 40
    rows = np.where(there.any(axis=1))[0]
    top, tall = rows[0], rows[-1] - rows[0] + 1
    band = range(top, top + max(1, tall // 10))
    width = statistics.median([there[y].sum() for y in band])
    middles = []
    for y in band:
        cols = np.where(there[y])[0]
        if len(cols):
            middles.append((cols[0] + cols[-1]) / 2)
    return width, top, statistics.median(middles)


def crop(path, out):
    sprite = Image.open(path).convert('RGBA')
    width, top, middle = measure(np.asarray(sprite.getchannel('A')))
    scale = HEAD_WIDTH / width
    grown = sprite.resize((round(sprite.width * scale), round(sprite.height * scale)), Image.LANCZOS)
    card = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
    card.alpha_composite(grown, (round(CANVAS[0] / 2 - middle * scale), round(HAIR_TOP - top * scale)))
    card.save(out)
    print(f'{out}: head {width:.0f} -> {HEAD_WIDTH} ({scale:.2f}x)')
    return out


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--out', required=True)
    said = parser.parse_args()
    crop(said.input, said.out)
