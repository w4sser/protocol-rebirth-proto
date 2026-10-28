#!/usr/bin/env bash
# Shipping BIT F1 spectral regression check, using the check_f.sh methodology.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSET_DIR="${1:-$HERE/../../assets/audio/bit}"
LINES=(hunters-inbound scrap-detected heal-budget-low extraction-marked bag-heavy nice-shot signal-lost welcome-back)
rms_db() {
  ffmpeg -hide_banner -nostdin -i "$1" -af "$2,astats" -f null - 2>&1 \
    | awk '/RMS level dB/ {value=$NF} END {if(value == "") exit 1; print value}'
}
printf '%-24s %10s %10s %10s %10s %6s\n' file intro_hf voice_bp whole_hf below_dB result
failed=0
for slug in "${LINES[@]}"; do
  file="$ASSET_DIR/$slug.ogg"
  if [[ ! -f "$file" ]]; then
    printf '%-24s MISSING FAIL\n' "$slug.ogg"
    failed=1
    continue
  fi
  a=$(rms_db "$file" 'atrim=0:0.3,highpass=f=4000')
  b=$(rms_db "$file" 'highpass=f=300,lowpass=f=3400')
  c=$(rms_db "$file" 'highpass=f=4000')
  if [[ "$b" == '-inf' || "$a" == *nan* || "$b" == *nan* ]]; then
    delta=invalid; result=FAIL
  elif [[ "$a" == '-inf' ]]; then
    delta=inf; result=PASS
  else
    delta=$(awk -v a="$a" -v b="$b" 'BEGIN {printf "%.2f", b-a}')
    result=$(awk -v a="$a" -v b="$b" 'BEGIN {print (a <= b-20) ? "PASS" : "FAIL"}')
  fi
  [[ "$result" == FAIL ]] && failed=1
  printf '%-24s %10s %10s %10s %10s %6s\n' "$slug.ogg" "$a" "$b" "$c" "$delta" "$result"
done
exit "$failed"
