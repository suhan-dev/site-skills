#!/usr/bin/env bash
# Downloads the two pinned libraries the References tab needs (md.js) into <dir>/vendor/ (default: the demo folder).
#   bash fetch-vendor.sh                 → assets/demo/vendor/{marked,katex}
#   bash fetch-vendor.sh path/to/site    → path/to/site/vendor/{marked,katex}
# marked 15.0.12 (MIT) and KaTeX 0.16.22 (MIT), straight from the npm registry. Do not commit the result.
set -euo pipefail
MARKED=15.0.12
KATEX=0.16.22
here="$(cd "$(dirname "$0")" && pwd)"
dest="${1:-$here/demo}/vendor"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl -fsSL "https://registry.npmjs.org/marked/-/marked-$MARKED.tgz" -o "$tmp/marked.tgz"
curl -fsSL "https://registry.npmjs.org/katex/-/katex-$KATEX.tgz" -o "$tmp/katex.tgz"
mkdir -p "$tmp/m" "$tmp/k"
tar -xzf "$tmp/marked.tgz" -C "$tmp/m"
tar -xzf "$tmp/katex.tgz" -C "$tmp/k"

mkdir -p "$dest/marked" "$dest/katex/fonts"
cp "$tmp/m/package/lib/marked.esm.js" "$dest/marked/marked.esm.js"
cp "$tmp/m/package/LICENSE.md" "$dest/marked/LICENSE.md"
cp "$tmp/k/package/dist/katex.min.js" "$tmp/k/package/dist/katex.min.css" "$dest/katex/"
cp "$tmp/k/package/dist/fonts/"*.woff2 "$dest/katex/fonts/"
cp "$tmp/k/package/LICENSE" "$dest/katex/LICENSE"
echo "vendor: marked $MARKED and KaTeX $KATEX in $dest"
