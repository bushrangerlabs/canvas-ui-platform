# Canvas UI Platform

> [!WARNING]
> **Work in progress — not ready for use.** This project is in early active development. There are no stable releases, the API will change without notice, and nothing is production-ready yet. Come back later.

A standalone display management platform for smart homes and kiosk deployments.

## Repositories

| Package | Description |
|---|---|
| `server/` | Node.js + SQLite backend — central config, real-time sync, device management |
| `web/` | React web app — view editor and management UI |
| `browser/` | Tauri native app — kiosk browser for Linux and Android |

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
