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

# Every language, each in its own directory. A persona is mostly tone by
# example, and the examples are quoted lines — they do not survive being
# translated at injection time, so the file a maid is loaded from has to
# already be written in the language she is going to answer in.
copied = {}
for d in sorted(glob.glob(f"{CAST}/*/")):
    lang = os.path.basename(d.rstrip("/"))
    files = sorted(glob.glob(f"{d}/*.md"))
    if not files:
        continue
    os.makedirs(f"{OUT}/{lang}", exist_ok=True)
    for f in files:
        shutil.copy(f, f"{OUT}/{lang}")
    copied[lang] = len(files)
summary = ", ".join(f"{n} {lang}" for lang, n in sorted(copied.items()))
print(f"copied {summary} from packages/maid-personas -> maids/")
