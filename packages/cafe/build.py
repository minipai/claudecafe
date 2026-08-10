#!/usr/bin/env python3
"""Copy the cast into ./maids so the plugin is self-contained when copied to
the marketplace cache. The cast lives one package over in this monorepo — a
plain file copy, no node toolchain (the plugin is pure python3 all the way).
maids/ is gitignored build output; build before installing/updating the plugin.
"""
import glob
import os
import shutil

HERE = os.path.dirname(os.path.realpath(__file__))
CAST = os.path.join(os.path.dirname(HERE), "maid-personas")
OUT = os.path.join(HERE, "maids")

shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT)
files = sorted(glob.glob(f"{CAST}/*.md"))
for f in files:
    shutil.copy(f, OUT)
print(f"copied {len(files)} personas from packages/maid-personas -> maids/")
