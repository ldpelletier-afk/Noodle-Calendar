#!/bin/bash
# Creates a native-feeling macOS .app for Noodle Calendar.
# Opens the calendar in Chrome app mode (frameless window).
# Falls back to Safari / default browser if Chrome is absent.
#
# Usage:
#   chmod +x make_app.sh
#   ./make_app.sh              # puts app on Desktop
#   ./make_app.sh ~/Apps       # puts app in a custom folder

set -e

APP_NAME="Noodle Calendar"
INDEX_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/index.html"
DEST="${1:-$HOME/Desktop}"
APP_BUNDLE="${DEST}/${APP_NAME}.app"

# Abort early if index.html is missing
if [[ ! -f "$INDEX_PATH" ]]; then
    echo "Error: index.html not found at $INDEX_PATH"
    exit 1
fi

echo "Building ${APP_NAME}.app …"

# ── Directory structure ──────────────────────────────────────────────────────
mkdir -p "${APP_BUNDLE}/Contents/MacOS"
mkdir -p "${APP_BUNDLE}/Contents/Resources"

# ── Launcher shell script ────────────────────────────────────────────────────
cat > "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}" << LAUNCHER
#!/bin/bash
INDEX="${INDEX_PATH}"
FILE_URL="file://\${INDEX}"

# Chrome app mode gives a borderless window that feels native
if open -Ra "Google Chrome" 2>/dev/null; then
    open -na "Google Chrome" --args \\
        --app="\${FILE_URL}" \\
        --window-size=1400,900
    exit 0
fi

# Brave is also Chromium-based and supports --app
if open -Ra "Brave Browser" 2>/dev/null; then
    open -na "Brave Browser" --args \\
        --app="\${FILE_URL}" \\
        --window-size=1400,900
    exit 0
fi

# Fallback: open in whatever the system default is
open "\${FILE_URL}"
LAUNCHER

chmod +x "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}"

# ── Info.plist ───────────────────────────────────────────────────────────────
cat > "${APP_BUNDLE}/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>             <string>${APP_NAME}</string>
    <key>CFBundleDisplayName</key>      <string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key>       <string>com.local.noodle-calendar</string>
    <key>CFBundleVersion</key>          <string>1.0</string>
    <key>CFBundlePackageType</key>      <string>APPL</string>
    <key>CFBundleExecutable</key>       <string>${APP_NAME}</string>
    <key>CFBundleIconFile</key>         <string>AppIcon</string>
    <key>LSMinimumSystemVersion</key>   <string>10.13</string>
    <key>LSUIElement</key>              <false/>
    <key>NSHighResolutionCapable</key>  <true/>
</dict>
</plist>
PLIST

# ── Optional: generate a simple icon with sips ───────────────────────────────
# Creates a minimal 512×512 PNG using Python (no Xcode required).
python3 - "${APP_BUNDLE}/Contents/Resources/AppIcon.icns" << 'PYICON' 2>/dev/null || true
import sys, struct, zlib, os

# Minimal 64×64 RGBA PNG with a soft indigo background + white "N"
W, H = 64, 64
BG = (91, 108, 255, 255)
FG = (255, 255, 255, 255)

pixels = [list(BG) for _ in range(W * H)]

# Draw a crude "N" glyph in the centre (11×14 block)
def px(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        pixels[y * W + x] = list(c)

ox, oy = 27, 25
for r in range(14):
    px(ox,     oy + r, FG)
    px(ox + 4, oy + r, FG)
    px(ox + 10, oy + r, FG)
for d in range(5):
    px(ox + d,     oy + d, FG)
    px(ox + d + 1, oy + d, FG)
    px(ox + 6 + d, oy + 9 - d, FG)
    px(ox + 7 + d, oy + 9 - d, FG)

def png_chunk(name, data):
    c = zlib.crc32(name + data) & 0xFFFFFFFF
    return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)

raw = b''
for row in range(H):
    raw += b'\x00'
    for col in range(W):
        raw += bytes(pixels[row * W + col])

compressed = zlib.compress(raw, 9)
png = (b'\x89PNG\r\n\x1a\n'
       + png_chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0))
       + png_chunk(b'IDAT', compressed)
       + png_chunk(b'IEND', b''))

# Write the PNG, then convert to .icns if sips is available
png_path = sys.argv[1].replace('.icns', '.png')
with open(png_path, 'wb') as f:
    f.write(png)
os.system(f'sips -s format icns "{png_path}" --out "{sys.argv[1]}" 2>/dev/null')
os.remove(png_path)
PYICON

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "✓  Created: ${APP_BUNDLE}"
echo ""
echo "Next steps:"
echo "  • Double-click '${APP_NAME}' on your Desktop to launch"
echo "  • Drag it to /Applications or your Dock for easy access"
echo "  • Re-run this script any time you move the project folder"
echo ""
echo "Note: macOS may ask you to allow the app to open on first launch."
echo "Go to System Settings → Privacy & Security → Open Anyway if needed."
