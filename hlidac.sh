#!/bin/bash
# Spouští launchd každé 2 min (~/Library/LaunchAgents/eu.shotbylaro.cestina.plist).
# 1) Nové skeny v "skolni shi/cestina/archiv" předá Claudovi (skill /cestina), ten z nich udělá zápisy.
# 2) Pak publikuj.sh: sešit + push do SCHULE a do repa cestina (to chytí i ruční úpravy zápisů).
export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"
WEB="$(cd "$(dirname "$0")" && pwd)"
SCHULE="$WEB/../skolni shi"
ARCH="$SCHULE/cestina/archiv"
DONE="$ARCH/.zpracovano.txt"
LOCK="/tmp/cestina-hlidac.lock"

mkdir "$LOCK" 2>/dev/null || exit 0  # už běží
trap 'rmdir "$LOCK"' EXIT

seznam() { cd "$ARCH" && find . -type f \( -iname '*.pdf' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.heic' \) | sed 's#^\./##' | sort; }
touch "$DONE"
NOVE=$(comm -23 <(seznam) <(sort "$DONE"))

if [ -n "$NOVE" ]; then
  sleep 30  # počkej, až se dokopírují všechny fotky
  NOVE=$(comm -23 <(seznam) <(sort "$DONE"))
  echo "$(date '+%F %T') nové skeny: $(echo "$NOVE" | wc -l)"
  cd "$SCHULE"
  if claude -p "/cestina Nové skeny sešitu v cestina/archiv (cesty relativně k archiv/):
$NOVE

Přečti je všechny. Ke každému tématu vytvoř nebo doplň zápis podle skillu a zařaď ho do PORADI.txt podle čísla složky (viz skill, krok 3). Sešit negeneruj a nic necommituj ani nepushuj, to udělá skript." \
     --allowedTools "Read" "Write" "Edit" "Glob" "Grep" "WebSearch" "WebFetch" "Bash(ls:*)" "Bash(find:*)"; then
    echo "$NOVE" >> "$DONE"
  else
    echo "$(date '+%F %T') Claude selhal, zkusím příště"
  fi
fi

"$WEB/publikuj.sh" "Čeština: aktualizace $(date '+%Y-%m-%d %H:%M')" >/dev/null
