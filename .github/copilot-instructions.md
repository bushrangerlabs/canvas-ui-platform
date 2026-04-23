# Canvas UI Platform Development

**Stack:** Fastify + SQLite + WebSocket · React 19 + TypeScript + Vite + MUI v7 + Zustand  
**Current version:** see `config.yaml`

> ⚠️ This is **canvas-ui-platform** — a standalone HA add-on with its own server and web app.  
> It is NOT the same as **canvas-ui-hacs** (the integration at `/home/spetchal/Code/canvas-ui-hacs`).

---

## 📂 Key Paths

| Purpose | Path |
|---|---|
| Project root | `/home/spetchal/Code/canvas-ui-platform/` |
| Web source | `web/src/` |
| Zustand store | `web/src/store/index.ts` |
| Pages | `web/src/pages/` |
| Canvas editor | `web/src/components/canvas/CanvasArea.tsx` |
| Inspector | `web/src/components/inspector/Inspector.tsx` |
| Sidebar | `web/src/components/editor/EditorSidebar.tsx` |
| Widget components | `web/src/components/widgets/` |
| Widget metadata | `web/src/components/widgets/widget-catalog.ts` |
| Widget lazy map | `web/src/components/widgets/WidgetRenderer.tsx` |
| Server source | `server/src/` |
| Server routes | `server/src/routes/` |
| Server entry | `server/src/index.ts` |
| Build output | `server/public/` |

---

## 🏗️ Architecture

### Server (Fastify + SQLite)
- Runs on port `8099`
- REST API at `/api/*` — views, devices, config
- WebSocket at `/ws` — broadcasts HA entity state changes to display clients
- Proxies HA supervisor at `http://supervisor/core/api`
- SQLite DB via `server/src/db/`

### Web (React 19 + MUI v7 + Zustand)
- Vite dev server: `cd web && npm run dev`
- Routes: `/editor` · `/display` · `/devices` · `/settings`
- Global state in `web/src/store/index.ts` (Zustand)
- Widget rendering is **lazy-loaded** via `WidgetRenderer.tsx`

---

## 🔧 Build & Release

### Development
```bash
cd web && npm run dev          # Vite dev server
# API calls proxy to localhost:8099 (server must be running separately or via HA)
```

### Production build (web only)
```bash
cd web && npm run build
# Output → server/public/  (served by Fastify)
```

### Release
```bash
./release.sh 0.1.30 "Brief release notes"
# 1. Bumps version in config.yaml
# 2. Runs web build (output → server/public/)
# 3. git add -A, commit, tag v0.1.30, push main + tag
```

---

## 🎛️ Zustand Store (`store/index.ts`)

### Key state fields
| Field | Type | Purpose |
|---|---|---|
| `views` | `View[]` | All canvas views |
| `activeViewId` | `string \| null` | Currently open view |
| `selectedWidgetIds` | `string[]` | Multi-select — all selected widget IDs |
| `clipboard` | `WidgetConfig[]` | Copy/paste clipboard |
| `snapEnabled` | `boolean` | Snap-to-grid toggle |
| `snapSize` | `number` | Grid size in px |
| `history` | snapshot stack | Undo/redo |

### Multi-select actions
- `selectWidget(id)` — select single widget (replaces selection)
- `toggleWidgetSelection(id)` — shift+click additive toggle
- `selectAllWidgets()` — Ctrl+A
- `clearSelection()` — Escape
- `copySelected()` → `pasteClipboard()` — Ctrl+C / Ctrl+V
- `deleteSelected()` — Delete key
- `duplicateSelected()` — Ctrl+D
- `moveSelected(dx, dy)` — arrow key nudge

---

## 🧩 Widget Architecture

### CRITICAL: Two files control widget registration

1. **`widget-catalog.ts`** — metadata only, NO `.tsx` imports (preserves code splitting)
2. **`WidgetRenderer.tsx`** — lazy-loads component files

### Adding a new widget

1. Create `web/src/components/widgets/MyWidget.tsx` — export default component + named `myWidgetMetadata`
2. Add metadata const to `widget-catalog.ts` (copy inline — do NOT import from the .tsx)
3. Add `mywidget: MyWidgetMetadata` to the `WIDGET_CATALOG` object in `widget-catalog.ts`
4. Add `mywidget: lazy(() => import('./MyWidget'))` to `WidgetRenderer.tsx`

### WidgetProps pattern
```typescript
import type { WidgetProps } from '../../types';

const MyWidget: React.FC<WidgetProps> = ({ config }) => {
  const cfg = config.config ?? {};
  const width = config.position?.width ?? cfg.width ?? 200;
  const height = config.position?.height ?? cfg.height ?? 100;
  // ...
};
```

**Width/height come from `config.position.width` / `config.position.height`** — NOT `config.width`.

### WidgetMetadata fields
```typescript
export interface WidgetMetadata {
  name: string;
  icon: string;          // MUI icon name e.g. 'CalendarMonth'
  category: string;      // 'display' | 'control' | 'media' | 'layout' | 'clock'
  description: string;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  requiresEntity?: boolean;
  fields: FieldMetadata[];
}
```

### Field types: `number` · `text` · `textarea` · `color` · `select` · `checkbox` · `entity` · `icon` · `slider` · `file`
### Field categories: `layout` · `behavior` · `style`

---

## 📋 Current Widgets (29)

`text` · `value` · `gauge` · `progressbar` · `progresscircle` · `icon` · `html` · `scrollingtext` · `weather` · `graph` · `resolution` · `analogclock` · `flipclock` · `digitalclock` · `button` · `switch` · `slider` · `knob` · `inputtext` · `radiobutton` · `colorpicker` · `image` · `camera` · `iframe` · `border` · `shape` · `calendar`

---

## 🔍 Troubleshooting

**TypeScript errors referencing `selectedWidgetId` (non-plural)**
- Field was removed. Use `selectedWidgetIds: string[]` from store.
- Single-select pattern: `const id = selectedWidgetIds.length === 1 ? selectedWidgetIds[0] : null;`

**`config.width` / `config.height` TS errors in widgets**
- Wrong. Use `config.position.width` / `config.position.height`.

**Widget not appearing in library**
- Must be in BOTH `widget-catalog.ts` (metadata) AND `WidgetRenderer.tsx` (lazy import).

**MUI v7 Stack `alignItems` prop error**
- Move to `sx`: `<Stack sx={{ alignItems: 'center' }}>` instead of `alignItems="center"`.

**MUI v7 TextField `inputProps` error**
- Use `slotProps={{ htmlInput: { min, max } }}` instead of `inputProps={{ min, max }}`.

---

## 🌿 Branching

All commits go to `main` directly (no dev branch for this repo).  
Release with `./release.sh <version> "notes"`.
