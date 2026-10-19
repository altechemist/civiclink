#!/usr/bin/env bash
# Tags the assessed release and builds the final report with the tag and commit hash filled in.
#   scripts/release.sh v1.0.0
# Refuses to run unless the working tree is clean and CI passed for the current commit.
set -euo pipefail
cd "$(dirname "$0")/.."
TAG="${1:?usage: scripts/release.sh v1.0.0}"
[ -z "$(git status --porcelain)" ] || { echo "Working tree not clean"; exit 1; }
git fetch -q origin
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "HEAD is not origin/main; push first"; exit 1; }
SHA=$(git rev-parse HEAD)
CONCLUSION=$(gh run list --commit "$SHA" --workflow CI --json conclusion --jq '.[0].conclusion')
[ "$CONCLUSION" = "success" ] || { echo "CI for $SHA is '$CONCLUSION' (needs success)"; exit 1; }
git tag -a "$TAG" -m "CivicLink $TAG: assessed release (NPRJ740)"
git push -q origin "$TAG"
gh release create "$TAG" --title "CivicLink $TAG" --notes-file <(sed -n "/## \[${TAG#v}\]/,/^## \[/p" CHANGELOG.md | sed '$d')
python3 docs/report/build_report.py
echo "Tagged $TAG at $SHA. Submit docs/report/CivicLink_Final_Project_Report.docx (not committed, so the tag stays reproducible)."
