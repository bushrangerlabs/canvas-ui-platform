# Canvas UI — Android Browser App

**Status: Phase 2 — Not yet started**

This will be a Tauri 2 Android APK — a fullscreen kiosk browser that connects to a Canvas UI Platform server and displays canvas views on an Android display.

## Planned features (mirrors linux/)

- First-boot settings screen (server URL, device name, HA credentials)
- QR code scan fast-path for server discovery
- Fullscreen kiosk mode (system bars hidden)
- WebSocket connection to server (`role=browser`)
- View navigation: swipe gestures + server-pushed `view_change` commands
- Hidden settings overlay (5-tap corner gesture)
- Screen on/off via Android power management APIs (Tauri commands)
- Brightness control via Android WindowManager

## Setup (when ready)

Requires:
- Rust toolchain + `rustup target add aarch64-linux-android`
- Android SDK + NDK
- `npm install && npm run tauri android init`

See [Tauri Android docs](https://tauri.app/distribute/google-play/) for full setup.

## Notes

- The core app logic will be nearly identical to `browser/linux/` — consider a shared `browser/shared/` package for `config.ts`, `useServerSocket.ts`, and `KioskScreen.tsx`
- Android needs Tauri's `tauri-plugin-barcode-scanner` instead of `qr-scanner` for QR scanning
- Screen management uses `tauri-plugin-screen` (if available) or JNI calls
