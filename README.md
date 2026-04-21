# Canvas UI Platform

> [!WARNING]
> **Work in progress — not ready for use.** This project is in early active development. There are no stable releases, the API will change without notice, and nothing is production-ready yet. Come back later.

The next generation of Canvas UI — a fully standalone display management platform for smart homes and kiosk deployments. **This project replaces the [canvas-ui HACS integration](https://github.com/bushrangerlabs/canvas-ui).** It has everything canvas-ui has (the full drag-and-drop editor, all widgets, Home Assistant entity integration) plus a standalone server, multi-device management, and a native Tauri app for Linux and Android. No Home Assistant required to run it.

## Packages

| Package | Description |
|---|---|
| `server/` | Node.js + SQLite backend — central config store, REST API, real-time WebSocket sync, device management |
| `web/` | React SPA — the full drag-and-drop canvas editor, all widgets, HA data source config, device management UI |
| `browser/` | Tauri native app — kiosk display client for Linux (AppImage) and Android (APK), connects to server for views and HA for live entity data |

## Architecture

```
Canvas UI Server (server/)
  ├── SQLite database — views, devices, assignments
  ├── REST API — CRUD for views, devices, data sources
  └── WebSocket — real-time push to all connected clients

Canvas UI Web (web/)
  ├── Full drag-drop view editor (uses existing widget library)
  └── Device management UI

Canvas UI Browser (browser/)
  ├── Tauri — Linux AppImage + Android APK
  ├── Connects to server for config
  ├── Connects to HA for entity data
  └── MQTT command/control
```

## Getting Started

### Server

```bash
cd server
npm install
npm run dev
# API: http://localhost:3100
# WebSocket: ws://localhost:3100/ws
```

### Web

```bash
cd web
npm install
npm run dev
# http://localhost:5173
```

## Related

- [canvas-ui](https://github.com/bushrangerlabs/canvas-ui) — HACS panel for Home Assistant
