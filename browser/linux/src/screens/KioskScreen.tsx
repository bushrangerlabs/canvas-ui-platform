/**
 * KioskScreen — Tauri kiosk controller using native WebviewWindows.
 *
 * Architecture:
 *   • This React app (main window) is the WS controller only — black background.
 *   • Each panel in a page becomes a native OS WebviewWindow (no X-Frame-Options,
 *     no iframe sandbox restrictions, separate renderer process per panel).
 *   • load_page      → close existing panel windows, open new native ones
 *   • navigate_panel → Rust command navigates window URL in-place
 *   • show/hide_floating → create / show / hide a floating WebviewWindow
 *   • screen_on/off, set_brightness → xset / xrandr via Tauri invoke
 *   • reload         → close panels + window.location.reload()
 *   • Settings overlay: hides panel windows while shown, restores after
 *   • Fallback (no page): single fullscreen panel → /display?device=<id>
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { nanoid } from 'nanoid';
import { clearConfig, saveDeviceId, type AppConfig } from '../store/config';
import { useServerSocket } from '../hooks/useServerSocket';
import SettingsScreen from './SettingsScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PagePanel {
  id: number;
  name: string;
  x: number;   // 0-100 %
  y: number;
  w: number;
  h: number;
  view_id: string | null;
  url: string | null;
  position: number;
}

interface FloatingConfig {
  url?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

interface LoadedPage {
  page_id: number;
  panels: PagePanel[];
  floating_config: FloatingConfig | null;
}

type AppState = 'registering' | 'ready' | 'error' | 'settings';

interface Props {
  config: AppConfig;
  onResetConfig: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(percent: number, total: number) {
  return Math.round((percent / 100) * total);
}

async function closeAllPanelWindows() {
  const all = await WebviewWindow.getAll();
  await Promise.all(
    all
      .filter(w => w.label.startsWith('panel-') || w.label === 'floating')
      .map(w => w.close().catch(() => {}))
  );
}

function resolvePanelUrl(panel: PagePanel, config: AppConfig, deviceId: string): string {
  if (panel.url) return panel.url;   // native WebviewWindow has no X-Frame-Options restriction
  if (panel.view_id) return `${config.serverUrl}/display?view=${encodeURIComponent(panel.view_id)}`;
  return `${config.serverUrl}/display?device=${encodeURIComponent(deviceId)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

const SETTINGS_TAP_COUNT = 5;
const SETTINGS_TAP_WINDOW_MS = 3000;

export default function KioskScreen({ config, onResetConfig }: Props) {
  const [appState, setAppState]     = useState<AppState>('registering');
  const [errorMsg, setErrorMsg]     = useState('');
  const [deviceId, setDeviceId]     = useState(config.deviceId ?? '');
  const [loadedPage, setLoadedPage] = useState<LoadedPage | null>(null);

  const panelLabelsRef   = useRef<string[]>([]);
  const tapTimestamps    = useRef<number[]>([]);

  function handleCornerTap() {
    const now = Date.now();
    tapTimestamps.current = tapTimestamps.current
      .filter(t => now - t < SETTINGS_TAP_WINDOW_MS)
      .concat(now);
    if (tapTimestamps.current.length >= SETTINGS_TAP_COUNT) {
      tapTimestamps.current = [];
      setAppState('settings');
    }
  }

  // Hide / show panel windows when settings overlay opens/closes
  useEffect(() => {
    if (appState === 'settings') {
      panelLabelsRef.current.forEach(label =>
        WebviewWindow.getByLabel(label).then(w => w?.hide().catch(() => {}))
      );
    } else if (appState === 'ready') {
      panelLabelsRef.current.forEach(label =>
        WebviewWindow.getByLabel(label).then(w => w?.show().catch(() => {}))
      );
    }
  }, [appState]);

  // Cleanup on unmount
  useEffect(() => () => { closeAllPanelWindows(); }, []);

  // ── Device registration ─────────────────────────────────────────────────
  useEffect(() => {
    async function register() {
      try {
        const id = config.deviceId || nanoid(10);
        const res = await fetch(`${config.serverUrl}/api/devices/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            name:         config.deviceName,
            platform:     'linux',
            app_version:  '0.1.0',
            screen_width:  window.screen.width,
            screen_height: window.screen.height,
            pixel_ratio:   window.devicePixelRatio,
          }),
        });
        if (!res.ok) throw new Error(`Registration failed: ${res.status}`);
        const device = await res.json();
        await saveDeviceId(device.id);
        setDeviceId(device.id);
        setAppState('ready');
      } catch (e) {
        setErrorMsg(`Cannot reach server at ${config.serverUrl}\n\n${String(e)}`);
        setAppState('error');
      }
    }
    register();
  }, [config.serverUrl, config.deviceId, config.deviceName]);

  // ── Open native WebviewWindow panels ─────────────────────────────────────
  const openPanelWindows = useCallback(async (panels: PagePanel[], floating: FloatingConfig | null) => {
    await closeAllPanelWindows();
    panelLabelsRef.current = [];

    const sw = window.screen.width;
    const sh = window.screen.height;
    const ox = window.screenX ?? 0;
    const oy = window.screenY ?? 0;

    for (const panel of panels) {
      const label = `panel-${panel.id}`;
      const url   = resolvePanelUrl(panel, config, deviceId);

      const win = new WebviewWindow(label, {
        url,
        x:      ox + pct(panel.x, sw),
        y:      oy + pct(panel.y, sh),
        width:  pct(panel.w, sw),
        height: pct(panel.h, sh),
        decorations: false,
        resizable:   false,
        skipTaskbar: true,
        visible:     true,
        title:       panel.name,
      });
      win.once('tauri://error', e => console.error(`[${label}] error:`, e));
      panelLabelsRef.current.push(label);
    }

    if (floating?.url) {
      const fc = floating;
      const fl = new WebviewWindow('floating', {
        url:    fc.url!,
        x:      ox + pct(fc.x ?? 10, sw),
        y:      oy + pct(fc.y ?? 10, sh),
        width:  pct(fc.w ?? 80, sw),
        height: pct(fc.h ?? 80, sh),
        decorations: false,
        resizable:   false,
        skipTaskbar: true,
        visible:     false,
      });
      fl.once('tauri://error', e => console.error('[floating] error:', e));
    }
  }, [config, deviceId]);

  // ── WS command handler ───────────────────────────────────────────────────
  const handleCommand = useCallback(async (cmd: Record<string, any>) => {
    console.log('[KioskScreen] command:', cmd);
    switch (cmd.type) {

      case 'load_page': {
        const pageData = cmd.page_data as { panels: PagePanel[]; floating_config: FloatingConfig | null };
        const page: LoadedPage = {
          page_id:        cmd.page_id as number,
          panels:         pageData?.panels ?? [],
          floating_config: pageData?.floating_config ?? null,
        };
        setLoadedPage(page);
        await openPanelWindows(page.panels, page.floating_config);
        break;
      }

      case 'navigate_panel': {
        const panelId = cmd.panel_id as number;
        const url     = cmd.url as string;
        if (panelId != null && url) {
          await invoke('navigate_webview', { label: `panel-${panelId}`, url }).catch(console.error);
        }
        break;
      }

      case 'show_floating': {
        const url = cmd.url as string | undefined;
        const existing = await WebviewWindow.getByLabel('floating');
        if (url && existing) {
          await invoke('navigate_webview', { label: 'floating', url }).catch(console.error);
        } else if (url && !existing) {
          const fc = loadedPage?.floating_config;
          const sw = window.screen.width;
          const sh = window.screen.height;
          const ox = window.screenX ?? 0;
          const oy = window.screenY ?? 0;
          const fl = new WebviewWindow('floating', {
            url,
            x:      ox + pct(fc?.x ?? 10, sw),
            y:      oy + pct(fc?.y ?? 10, sh),
            width:  pct(fc?.w ?? 80, sw),
            height: pct(fc?.h ?? 80, sh),
            decorations: false, resizable: false, skipTaskbar: true, visible: true,
          });
          fl.once('tauri://error', e => console.error('[floating] error:', e));
          return;
        }
        WebviewWindow.getByLabel('floating').then(w => w?.show().catch(() => {}));
        break;
      }

      case 'hide_floating':
        WebviewWindow.getByLabel('floating').then(w => w?.hide().catch(() => {}));
        break;

      case 'screen_off':
        invoke('screen_off').catch(console.error);
        break;

      case 'screen_on':
        invoke('screen_on').catch(console.error);
        break;

      case 'set_brightness':
        invoke('set_brightness', { brightness: Number(cmd.brightness ?? 1) }).catch(console.error);
        break;

      case 'reload':
        await closeAllPanelWindows();
        window.location.reload();
        break;
    }
  }, [openPanelWindows, loadedPage]);

  useServerSocket({
    serverUrl: config.serverUrl,
    deviceId,
    enabled:   appState === 'ready' && !!deviceId,
    onCommand: handleCommand,
  });

  // ── Fallback: single fullscreen display window when no page assigned ───────
  useEffect(() => {
    if (appState !== 'ready' || !deviceId || loadedPage) return;
    const label = 'panel-fallback';
    WebviewWindow.getByLabel(label).then(existing => {
      if (existing) return;
      const sw = window.screen.width;
      const sh = window.screen.height;
      const fallback = new WebviewWindow(label, {
        url: `${config.serverUrl}/display?device=${encodeURIComponent(deviceId)}`,
        x: window.screenX ?? 0,
        y: window.screenY ?? 0,
        width: sw, height: sh,
        decorations: false, resizable: false, skipTaskbar: true, visible: true,
      });
      fallback.once('tauri://error', e => console.error('[fallback] error:', e));
      panelLabelsRef.current = [label];
    });
  }, [appState, deviceId, loadedPage, config.serverUrl]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (appState === 'settings') {
    return (
      <SettingsScreen
        isEditing
        existingConfig={config}
        onSaved={() => window.location.reload()}
        onCancel={() => setAppState('ready')}
      />
    );
  }

  if (appState === 'registering') {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0a0a0a', flexDirection: 'column', gap: 2 }}>
        <CircularProgress size={40} />
        <Typography color="text.secondary" variant="body2">
          Connecting to {config.serverUrl}…
        </Typography>
      </Box>
    );
  }

  if (appState === 'error') {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0a0a0a', flexDirection: 'column', gap: 2, p: 4 }}>
        <Alert severity="error" sx={{ maxWidth: 500 }}>{errorMsg}</Alert>
        <Button variant="outlined" onClick={() => setAppState('settings')}>Open Settings</Button>
        <Button variant="text" color="error" onClick={async () => { await clearConfig(); onResetConfig(); }}>Reset Config</Button>
      </Box>
    );
  }

  // appState === 'ready' — main window is the invisible controller + corner tap
  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', bgcolor: '#000' }}>
      <Box
        onClick={handleCornerTap}
        sx={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, zIndex: 9999, cursor: 'default' }}
      />
    </Box>
  );
}
