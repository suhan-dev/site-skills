#!/usr/bin/env bash
# Downloads three.js r170 (MIT) from the npm registry, checks the tarball against npm's published sha512, and copies
# the build plus the addons the intro uses into <dest>/three (default: ./vendor/three next to this script).
#   bash fetch-vendor.sh              → assets/vendor/three/…
#   bash fetch-vendor.sh site/vendor  → site/vendor/three/…
# Pinned on purpose: the scene was tuned on r170, and GTAOPass / BokehPass change between releases. Serve the files
# from your own origin (import map: "three" → three/three.module.min.js, "three/addons/" → three/addons/).
set -euo pipefail
VER="0.170.0"
SHA512="FQK+LEpYc0fBD+J8g6oSEyyNzjp+Q7Ks1C568WWaoMRLW+TkNNWmenWeGgJjV105Gd+p/2ql1ZcjYvNiPZBhuQ=="  # npm dist.integrity
DEST="${1:-$(cd "$(dirname "$0")" && pwd)/vendor}/three"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://registry.npmjs.org/three/-/three-${VER}.tgz" -o "$TMP/three.tgz"
got="$(openssl dgst -sha512 -binary "$TMP/three.tgz" | base64 | tr -d '\n')"
[ "$got" = "$SHA512" ] || { echo "three-${VER}.tgz: sha512 mismatch, not installing" >&2; exit 1; }
FILES=(
  "build/three.module.min.js:three.module.min.js"
  "LICENSE:LICENSE"
  "examples/jsm/environments/RoomEnvironment.js:addons/environments/RoomEnvironment.js"
  "examples/jsm/geometries/RoundedBoxGeometry.js:addons/geometries/RoundedBoxGeometry.js"
  "examples/jsm/math/SimplexNoise.js:addons/math/SimplexNoise.js"
  "examples/jsm/postprocessing/EffectComposer.js:addons/postprocessing/EffectComposer.js"
  "examples/jsm/postprocessing/Pass.js:addons/postprocessing/Pass.js"
  "examples/jsm/postprocessing/MaskPass.js:addons/postprocessing/MaskPass.js"
  "examples/jsm/postprocessing/RenderPass.js:addons/postprocessing/RenderPass.js"
  "examples/jsm/postprocessing/ShaderPass.js:addons/postprocessing/ShaderPass.js"
  "examples/jsm/postprocessing/OutputPass.js:addons/postprocessing/OutputPass.js"
  "examples/jsm/postprocessing/GTAOPass.js:addons/postprocessing/GTAOPass.js"
  "examples/jsm/postprocessing/BokehPass.js:addons/postprocessing/BokehPass.js"
  "examples/jsm/shaders/CopyShader.js:addons/shaders/CopyShader.js"
  "examples/jsm/shaders/OutputShader.js:addons/shaders/OutputShader.js"
  "examples/jsm/shaders/GTAOShader.js:addons/shaders/GTAOShader.js"
  "examples/jsm/shaders/PoissonDenoiseShader.js:addons/shaders/PoissonDenoiseShader.js"
  "examples/jsm/shaders/BokehShader.js:addons/shaders/BokehShader.js"
)
tar -xzf "$TMP/three.tgz" -C "$TMP"
for f in "${FILES[@]}"; do
  src="$TMP/package/${f%%:*}"; out="$DEST/${f##*:}"
  mkdir -p "$(dirname "$out")"; cp "$src" "$out"
done
grep -q 'const t="170"' "$DEST/three.module.min.js" && echo "three.js r170 in $DEST (${#FILES[@]} files)"
# Never UnrealBloomPass: the look is a lit product, not a glow (references/quality.md).
