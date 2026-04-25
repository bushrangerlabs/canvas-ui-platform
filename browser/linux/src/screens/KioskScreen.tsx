/**
 * KioskScreen — Tauri shell kiosk display.
 *
 * Architecture:
 *   1. Register the device with the server (creates/updates DB entry, gets deviceId)
 *   2. Connect to server WebSocket to receive page commands
 *   3. On load_page: render panels as absolutely-positioned iframes
 *   4. Fallback (no page assigned): single iframe → /display?device=<id>
 *   5. Handles: screen_on/off, set_brightness, reload, navigate_panel,
 *      show_floating, hide_floating via Tauri invoke or plain JS
 *   6. A hidden 5-tap corner zone opens the settings overlay
 */
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { invoke } from '@tauri-apps/api/core';
import { nanoid } from 'nanoid';
import { saveDeviceId, clearConfig, type AppConfig } from '../store/config';
import { useServerSocket } from '../hooks/useServerSocket';
import SettingsScreen from './SettingsScreen';

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

const SETTINGS_TAP_COUNT = 5;
const SETTINGS_TAP_WINDOW_MS = 3000;

interface Props {
  config: AppConfig;
  onResetConfig: () => void;
}

type AppState = 'registering' | 'ready' | 'error' | 'settings';

export default function KioskScreen({ config, onResetConfig }: Props) {
  const [appState, setAppState] = useState<AppState>('registering');
  const [errorMsg, setErrorMsg] = useState('');
  const [deviceId, setDeviceId] = useState(config.deviceId ?? '');
  const [loadedPage, setLoadedPage] = useState<LoadedPage | null>(null);
  const [floatingUrl, setFloatingUrl] = useState<string | null>(null);
  const [floatingVisible, setFloatingVisible] = useState(false);
  // Map of panelId → current URL (for navigate_panel overrides)
  const [panelUrlOverrides, setPanelUrlOverrides] = useState<Record<number, string>>({});

  // Hidden settings gesture: 5 taps on top-right corner within 3 seconds
  const tapTimestamps = useRef<number[]>([]);
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

  // ── Device registration ────────────────────────────────────────────────────
  useEffect(() => {
    async function register() {
      try {
        const id = config.deviceId || nanoid(10);
        const res = await fetch(`${config.serverUrl}/api/devices/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            name: config.deviceName,
            platform: 'linux',
            app_version: '0.1.0',
            screen_width: window.screen.width,
            screen_height: window.screen.height,
            pixel_ratio: window.devicePixelRatio,
          }),
        });
        if (!res.ok) throw new Error(`Registration failed: ${res.status}`);
        const device = await res.json();
        await saveDeviceId(device.id);
        setDeviceId(device.id);
        setAppState('ready');
      } catch (e) {
        const url = `${config.serverUrl}/api/devices/register`;
        setErrorMsg(`Cannot reach server at ${url}\n\n${String(e)}\n\nCheck that canvas-ui-platform server is running and the URL is correct.`);
        setAppState('error');
      }
    }
    register();
  }, [config.serverUrl, config.deviceId, config.deviceName]);

  // ── WS command handler ─────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCommand = useCallback(async (cmd: Record<string, any>) => {
    console.log('[KioskScreen] command:', cmd);
    switch (cmd.type) {
      case 'load_page': {
        const pageData = cmd.page_data as { panels: PagePanel[]; floating_config: FloatingConfig | null };
        setLoadedPage({
          page_id: cmd.page_id as number,
          panels: pageData?.panels ?? [],
          floating_config: pageData?.floating_config ?? null,
        });
        setPanelUrlOverrides({});
        setFloatingVisible(false);
        if (pageData?.floating_config?.url) setFloatingUrl(pageData.floating_config.url);
        break;
      }
      case 'navigate_panel': {
        const panelId = cmd.panel_id as number;
        const url = cmd.url as string;
        if (panelId != null && url) {
          setPanelUrlOverrides(prev => ({ ...prev, [panelId]: url }));
        }
        break;
      }
      case 'show_floating': {
        const url = (cmd.url as string) || floatingUrl;
        if (url) setFloatingUrl(url);
        setFloatingVisible(true);
        break;
      }
      case 'hide_floating': {
        setFloatingVisible(false);
        break;
      }
      case 'screen_off': {
        invoke('screen_off').catch(console.error);
        break;
      }
      case 'screen_on': {
        invoke('screen_on').catch(console.error);
        break;
      }
      case 'set_brightness': {
        invoke('set_brightness', { brightness: Number(cmd.brightness ?? 1) }).catch(console.error);
        break;
      }
      case 'reload': {
        window.location.reload();
        break;
      }
    }
  }, [floatingUrl]);

  // WS — only active once device is registered
  useServerSocket({
    serverUrl: config.serverUrl,
    deviceId,
    enabled: appState === 'ready' && !!deviceId,
    onCommand: handleCommand,
  });

  // ── Panel URL resolver ─────────────────────────────────────────────────────
  function panelSrc(panel: PagePanel): string {
    if (panelUrlOverrides[panel.id]) return panelUrlOverrides[panel.id];
    if (panel.url) return panel.url;
    if (panel.view_id) return `${config.serverUrl}/display?view=${encodeURIComponent(panel.view_id)}`;
    return `${config.serverUrl}/display?device=${encodeURIComponent(deviceId)}`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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

  // appState === 'ready'
  const fallbackUrl = deviceId
    ? `${config.serverUrl}/display?device=${encodeURIComponent(deviceId)}`
    : null;

  // Floating panel config for positioning
  const fc = loadedPage?.floating_config;
  const floatingStyle: CSSProperties = {
    position: 'absolute',
    left: `${fc?.x ?? 10}%`,
    top: `${fc?.y ?? 10}%`,
    width: `${fc?.w ?? 80}%`,
    height: `${fc?.h ?? 80}%`,
    border: 'none',
    zIndex: 100,
    display: floatingVisible ? 'block' : 'none',
  };

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', bgcolor: '#000' }}>

      {loadedPage && loadedPage.panels.length > 0 ? (
        // ── Multi-panel page layout ──────────────────────────────────────────
        loadedPage.panels.map(panel => (
          <iframe
            key={`panel-${panel.id}`}
            src={panelSrc(panel)}
            style={{
              position: 'absolute',
              left: `${panel.x}%`,
              top: `${panel.y}%`,
              width: `${panel.w}%`,
              height: `${panel.h}%`,
              border: 'none',
            }}
            allow="autoplay; fullscreen"
            title={panel.name}
          />
        ))
      ) : (
        // ── Fallback: single display iframe ──────────────────────────────────
        fallbackUrl && (
          <iframe
            key={deviceId}
            src={fallbackUrl}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            allow="autoplay; fullscreen"
            title="Canvas UI Display"
          />
        )
      )}

      {/* Floating overlay panel */}
      {floatingUrl && (
        <iframe
          src={floatingUrl}
          style={floatingStyle}
          allow="autoplay; fullscreen"
          title="Floating Panel"
        />
      )}

      {/* Hidden corner tap zone — 5 taps within 3 s opens settings overlay */}
      <Box
        onClick={handleCornerTap}
        sx={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, zIndex: 9999, cursor: 'default' }}
      />
    </Box>
  );
}

