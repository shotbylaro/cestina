#!/bin/bash
# Přegeneruje sešit v pořadí PORADI.txt, pushne ho do SCHULE (NotebookLM) a do repa cestina (web cestina.shotbylaro.eu/sesit).
# Volá ho skill /cestina (krok 4) a hlidac.sh.
set -e
WEB="$(cd "$(dirname "$0")" && pwd)"
SCHULE="$WEB/../skolni shi"
MSG="${1:-Čeština: aktualizace $(date '+%Y-%m-%d %H:%M')}"

cd "$SCHULE/cestina"
{ echo "# Sešit – Čeština"; for f in $( { grep -v '^#' PORADI.txt; ls *.md | grep -v -e '^_' -e '^SESIT.md$'; } | awk '!s[$0]++' ); do [ -f "$f" ] || continue; echo; echo '---'; echo; cat "$f"; done; } > SESIT.md

cd "$SCHULE"
git add cestina
git diff --cached --quiet || { git commit -qm "$MSG"; git push -q; }

cp cestina/SESIT.md "$WEB/zdroje/SESIT.md"
cd "$WEB"
node postav.mjs sesit   # zašifruje sešit heslem z ~/.cestina-heslo
git add -A
git diff --cached --quiet || { git commit -qm "$MSG"; git push -q; }
echo "Hotovo: $MSG"
