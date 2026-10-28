#!/usr/bin/env python3
"""Absolute-path service launcher for Copper's isolated demo artifact."""
from __future__ import annotations

import sys

from runtime.__main__ import main

if __name__ == "__main__":
    sys.argv.insert(1, "serve")
    sys.exit(main())
