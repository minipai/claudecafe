#!/usr/bin/env python3
"""Resolve the Cafe data root — one shared root for every host."""
import os
from pathlib import Path


def cafe_root():
    """The one Cafe data root, shared by every host that runs the café."""
    base = os.environ.get("XDG_CONFIG_HOME", "").strip()
    if not base:
        base = os.path.join(os.path.expanduser("~"), ".config")
    return Path(base).expanduser() / "claudecafe"


def main():
    print(cafe_root())


if __name__ == "__main__":
    main()
