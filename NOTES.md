# Canvas UI Platform — Notes & Planning

> Living document. Updated as decisions are made.  
> Last updated: April 2026

---

## 🏗️ Architecture Overview

```
canvas-ui-platform/
├── server/          Node.js + SQLite  — config store, REST API, WebSocket hub
├── web/             React SPA         — drag-drop editor, device management UI
├── browser/
│   ├── linux/       Tauri app         — kiosk display client (Linux AppImage)
│   └── android/     Tauri app         — kiosk display client (Android APK)
```

### Data Flow

```
Home Assistant  ──WebSocket──►  browser app  (live entity states for widgets)
                                     │
Canvas UI Server ──WebSocket──►  browser app  (view config, commands)
                                     │
Canvas UI Web   ──REST/WS───►   server        (build views, manage devices)
```

---

## ✅ Current Status

| Component | Status | Notes |
|---|---|---|
| `server/` | ✅ Complete | Views, devices, device_views, commands, data sources, AI proxy, HA proxy, schedules |
| `web/` editor | ✅ Complete | Full drag-drop editor, 35+ widgets, inspector, AI panel |
| `browser/linux` | 🔲 Not started | Tauri 2, kiosk mode, Linux AppImage |
| `browser/android` | 🔲 Not started | Tauri 2, Android APK — after Linux is stable |
| Device management UI | ⚠️ Partial | Server API complete; web UI for assigning views to devices needs work |
| QR code pairing | 🔲 Not started | Server generates QR; browser app scans on first boot |

---

## 📱 Browser App — Design Decisions

### Settings / First Boot
- **Local settings screen** is the primary mechanism (always accessible)
- **QR code** is the fast-path for initial setup — server's device page shows a QR code containing `{ serverUrl, haUrl, haToken, deviceName }`
- Settings screen appears on first boot (no config stored) or via hidden gesture (5-tap on corner)
- Config persisted in Tauri's app data dir (`config.json`)

### View Navigation
- **Button widget action** `navigate_to_view: <view_id>` — tapping a configured button switches views
- **Swipe gesture** — left/right swipe through the device's assigned view list (configurable, can be disabled per-device)
- No persistent nav bar by default — UI is fullscreen canvas only

### Screen Management (both platforms)
- Linux: `xset dpms force off/on` + `xrandr --brightness` via Tauri shell sidecar
- Android: Tauri Android plugin — `WindowManager.LayoutParams.screenBrightness` + wake lock
- Triggered by WebSocket commands from server: `screen_on`, `screen_off`, `set_brightness`
- Can also be triggered by HA automations via server

### HA Entity Data
- Browser connects **directly** to HA WebSocket (not proxied through server)
- Needs: HA URL + long-lived access token (set in settings screen or via QR)
- Reconnects with exponential backoff if HA goes offline

### Offline Resilience
- Last-fetched view data cached locally (Tauri SQLite or JSON file)
- Display keeps working if server goes down — shows cached view, HA data still live
- Reconnects to server automatically when it comes back

### Commands (server → device via WebSocket)
| Command | Action |
|---|---|
| `view_change` | Switch to specified view immediately |
| `reload` | Reload the app / refetch views |
| `screen_on` | Turn display on |
| `screen_off` | Turn display off |
| `set_brightness` | Set brightness 0–100 |
| `navigate` | Navigate to view by ID or index |

---

## 🗺️ Browser App Build Plan

### Phase 1 — Linux (AppImage)
1. [ ] Tauri 2 project scaffold in `browser/linux/`
2. [ ] Settings screen (server URL, HA URL, HA token, device name)
3. [ ] Device registration with server on boot (persistent device ID)
4. [ ] Fetch assigned views from server
5. [ ] Render canvas using shared React widget renderer
6. [ ] WebSocket to server — handle commands
7. [ ] WebSocket to HA — live entity data
8. [ ] Swipe + button navigation between views
9. [ ] Screen on/off + brightness via shell commands
10. [ ] QR code scan for fast pairing
11. [ ] Offline view caching
12. [ ] AppImage build + release

### Phase 2 — Android (APK)
1. [ ] Tauri 2 Android project in `browser/android/`
2. [ ] Port settings screen
3. [ ] Android-specific screen management (wake lock, brightness)
4. [ ] QR code scan (Android camera)
5. [ ] APK build + release

---

## 🖥️ Device Management Web UI — Gaps

The server API is complete. The web editor needs:
- [ ] Device list page — show all registered devices, online status, last seen
- [ ] Device detail — assign/reorder views, rename, send commands
- [ ] View assignment drag-drop — drag views onto devices
- [ ] QR code display for each device (for fast browser app pairing)

---

## 🤖 AI Panel
- Server-side proxy: ✅ Complete (`/api/ai/chat`, `/api/ai/settings`, `/api/ai/models`)
- Client AIService: ✅ Complete
- AIPanel + AISettingsDialog: ✅ Complete
- Wired into EditorSidebar: ✅ Complete
- Providers: OpenAI, GitHub Models, Groq, OpenWebUI, Copilot Proxy (Coxy)
- Status: Needs real-world testing / bug fixing

---

## 🔧 Tech Stack

| Layer | Stack |
|---|---|
| Server | Node.js, Fastify, better-sqlite3, nanoid |
| Web editor | React 19, TypeScript, Vite, Material-UI |
| Browser app | Tauri 2 (Rust shell + React frontend) |
| Database | SQLite (server), optional local SQLite on device |
| Realtime | WebSocket (server↔browser, browser↔HA) |
| Build/release | GitHub Actions, `release.sh` |

---

## 📋 Open Questions

- **MQTT** — Is there value in MQTT as an alternative/complement to WebSocket commands? Useful if devices are behind NAT and can't be reached directly by server. Deferred for now — WebSocket server-push covers the use case while devices are on the same LAN.
- **Multi-view per device** — Current DB has `default_view_id` + `device_views` join table. Browser app works off `device_views` list. ✅ Schema supports it.
- **View transitions** — Instant switch or animated slide between views? Decision deferred to implementation.
- **Authentication** — Server currently has no auth. Fine for LAN use; needs consideration for remote access.
