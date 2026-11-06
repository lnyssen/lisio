#!/bin/sh
# Assemble code.js (cœur de Lisio inliné + core.js + main.js) : passe par src/build.py, qui inline src/core.
cd "$(dirname "$0")/.." && python3 src/build.py && git checkout -q -- lisio-figma-plugin.zip 2>/dev/null; true
