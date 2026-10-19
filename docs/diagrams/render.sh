#!/usr/bin/env bash
# Renders every PlantUML source in docs/diagrams/src to PNG and SVG in docs/diagrams/.
# Requires Java 17+. Downloads PlantUML 1.2026.8 to ~/.cache/plantuml on first run.
set -euo pipefail
cd "$(dirname "$0")"
JAR="$HOME/.cache/plantuml/plantuml-1.2026.8.jar"
if [ ! -f "$JAR" ]; then
  mkdir -p "$(dirname "$JAR")"
  curl -sSL -o "$JAR" https://repo1.maven.org/maven2/net/sourceforge/plantuml/plantuml/1.2026.8/plantuml-1.2026.8.jar
fi
java -Djava.awt.headless=true -DPLANTUML_LIMIT_SIZE=16384 -jar "$JAR" -tpng -o .. src/[0-9]*.puml
java -Djava.awt.headless=true -DPLANTUML_LIMIT_SIZE=16384 -jar "$JAR" -tsvg -o .. src/[0-9]*.puml
ls -1 *.png
