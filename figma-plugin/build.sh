#!/bin/sh
# Assemble code.js (cœur + interface) pour Figma
cd "$(dirname "$0")" && cat core.js main.js > code.js
