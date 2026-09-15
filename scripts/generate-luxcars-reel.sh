#!/usr/bin/env bash
# Genera un reel vertical 9:16 (1080x1920) sobre por qué existe LuxCars.
# Requiere: brew install ffmpeg-full (el ffmpeg de Homebrew sin -full no incluye drawtext).
# Uso: ./scripts/generate-luxcars-reel.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FF="${FFMPEG_FULL:-/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg}"
FONT="${REEL_FONT:-/System/Library/Fonts/Supplemental/Arial.ttf}"
LOGO="${ROOT}/public/assets/reel/luxcars-logo-raster.png"
OUT="${ROOT}/public/videos/luxcars-por-que-existe-reel.mp4"
TMP="$(mktemp -d)"

if [[ ! -x "$FF" ]]; then
  echo "Instala ffmpeg-full: brew install ffmpeg-full"
  echo "Luego: export PATH=\"/opt/homebrew/opt/ffmpeg-full/bin:\$PATH\""
  exit 1
fi

if [[ ! -f "$FONT" ]]; then
  echo "No se encontró la fuente: $FONT"
  exit 1
fi

if [[ ! -f "$LOGO" ]]; then
  echo "Generando logo raster desde SVG…"
  mkdir -p "$(dirname "$LOGO")"
  qlmanage -t -s 512 -o "$(dirname "$LOGO")" "${ROOT}/public/images/logo-clean.svg"
  mv "$(dirname "$LOGO")/logo-clean.svg.png" "$LOGO"
fi

cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

# Slide 1 — gancho + logo
"$FF" -y -f lavfi -i "color=c=0x0a0a0f:s=1080x1920:d=3" -loop 1 -i "$LOGO" \
  -filter_complex "[0:v]drawtext=fontfile=${FONT}:text='¿Por qué existe':fontsize=64:fontcolor=0xf5d072:x=(w-text_w)/2:y=780,drawtext=fontfile=${FONT}:text='LuxCars?':fontsize=88:fontcolor=0xf5d072:x=(w-text_w)/2:y=870,drawtext=fontfile=${FONT}:text='Te lo explicamos en segundos.':fontsize=32:fontcolor=white:x=(w-text_w)/2:y=1000[base];[1:v]scale=190:-1,format=rgba[lg];[base][lg]overlay=(W-w)/2:90:format=auto[outv]" \
  -map "[outv]" -t 3 -c:v libx264 -pix_fmt yuv420p "$TMP/s1.mp4"

# Slides 2–5 — solo texto
"$FF" -y -f lavfi -i "color=c=0x0a0a0f:s=1080x1920:d=3.3" \
  -vf "drawtext=fontfile=${FONT}:text='Porque importar un auto premium':fontsize=44:fontcolor=white:x=(w-text_w)/2:y=720,drawtext=fontfile=${FONT}:text='desde Miami a Lima no debería ser':fontsize=44:fontcolor=white:x=(w-text_w)/2:y=795,drawtext=fontfile=${FONT}:text='un misterio lleno de dudas.':fontsize=44:fontcolor=0xf5d072:x=(w-text_w)/2:y=870" \
  -t 3.3 -c:v libx264 -pix_fmt yuv420p "$TMP/s2.mp4"

"$FF" -y -f lavfi -i "color=c=0x0a0a0f:s=1080x1920:d=3.3" \
  -vf "drawtext=fontfile=${FONT}:text='Porque mereces precios claros,':fontsize=44:fontcolor=white:x=(w-text_w)/2:y=740,drawtext=fontfile=${FONT}:text='impuestos explicados':fontsize=44:fontcolor=white:x=(w-text_w)/2:y=815,drawtext=fontfile=${FONT}:text='y cero sorpresas al cerrar.':fontsize=44:fontcolor=0xf5d072:x=(w-text_w)/2:y=890" \
  -t 3.3 -c:v libx264 -pix_fmt yuv420p "$TMP/s3.mp4"

"$FF" -y -f lavfi -i "color=c=0x0a0a0f:s=1080x1920:d=3.3" \
  -vf "drawtext=fontfile=${FONT}:text='Porque actuamos como tu broker':fontsize=42:fontcolor=white:x=(w-text_w)/2:y=740,drawtext=fontfile=${FONT}:text='y negociamos a tu favor':fontsize=42:fontcolor=white:x=(w-text_w)/2:y=815,drawtext=fontfile=${FONT}:text='con transparencia total.':fontsize=42:fontcolor=0xf5d072:x=(w-text_w)/2:y=890" \
  -t 3.3 -c:v libx264 -pix_fmt yuv420p "$TMP/s4.mp4"

"$FF" -y -f lavfi -i "color=c=0x0a0a0f:s=1080x1920:d=3.3" \
  -vf "drawtext=fontfile=${FONT}:text='Concierge de punta a punta':fontsize=42:fontcolor=white:x=(w-text_w)/2:y=740,drawtext=fontfile=${FONT}:text='búsqueda, inspección, logística':fontsize=42:fontcolor=white:x=(w-text_w)/2:y=815,drawtext=fontfile=${FONT}:text='y placas sin fricción.':fontsize=42:fontcolor=0xf5d072:x=(w-text_w)/2:y=890" \
  -t 3.3 -c:v libx264 -pix_fmt yuv420p "$TMP/s5.mp4"

# Slide 6 — cierre + logo
"$FF" -y -f lavfi -i "color=c=0x0a0a0f:s=1080x1920:d=4.5" -loop 1 -i "$LOGO" \
  -filter_complex "[0:v]drawtext=fontfile=${FONT}:text='LuxCars Perú':fontsize=72:fontcolor=0xf5d072:x=(w-text_w)/2:y=820,drawtext=fontfile=${FONT}:text='Importación premium con datos,':fontsize=38:fontcolor=white:x=(w-text_w)/2:y=920,drawtext=fontfile=${FONT}:text='no con promesas vacías.':fontsize=38:fontcolor=white:x=(w-text_w)/2:y=980[base];[1:v]scale=200:-1,format=rgba[lg];[base][lg]overlay=(W-w)/2:100:format=auto[outv]" \
  -map "[outv]" -t 4.5 -c:v libx264 -pix_fmt yuv420p "$TMP/s6.mp4"

{
  echo "file '$TMP/s1.mp4'"
  echo "file '$TMP/s2.mp4'"
  echo "file '$TMP/s3.mp4'"
  echo "file '$TMP/s4.mp4'"
  echo "file '$TMP/s5.mp4'"
  echo "file '$TMP/s6.mp4'"
} > "$TMP/list.txt"

mkdir -p "$(dirname "$OUT")"
"$FF" -y -f concat -safe 0 -i "$TMP/list.txt" -c copy "$TMP/merged.mp4"

# Pista de audio silenciosa (mejor compatibilidad en redes)
"$FF" -y -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100" -i "$TMP/merged.mp4" \
  -c:v copy -c:a aac -shortest "$OUT"

echo "Listo: $OUT"
ls -la "$OUT"
