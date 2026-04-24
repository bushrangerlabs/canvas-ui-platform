/**
 * KioskScreen — Tauri shell kiosk display.
 *
 * Architecture:
 *   1. Register the device with the server (creates/updates DB entry, gets deviceId)
 *   2. Load the server's /display?device=<deviceId> in a fullscreen iframe
 *   3. DisplayPage (inside the iframe) manages its own WS connection, view changes,
 *      and schedule cycling — we don't duplicate any of that here
 *   4. A hidden 5-tap corner zone opens the settings overlay
 *   5. Screen power/brightness commands can later be forwarded from the iframe
 *      via window.postMessage → Tauri invoke() calls
 */
import { useEffect, useRef, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { nanoid } from 'nanoid';
import { saveDeviceId, clearConfig, type AppConfig } from '../store/config';
import SettingsScreen from './SettingsScreen';

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
  // Registers on every launch so last_seen stays current; deviceId is persisted
  // in the Tauri store so the same ID is reused across reboots.
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

  // ── Display URL ────────────────────────────────────────────────────────────
  // The server's /display page handles WS connection, view assignment, schedules.
  // We just point the iframe at it — no duplicate state management needed here.
  const displayUrl = deviceId
    ? `${config.serverUrl}/display?device=${encodeURIComponent(deviceId)}`
    : null;

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

  // appState === 'ready'
  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', bgcolor: '#000' }}>
      {/* DisplayPage loaded in iframe — handles WS, view changes, schedule cycling */}
      {displayUrl && (
        <iframe
          key={deviceId}
          src={displayUrl}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          allow="autoplay; fullscreen"
          title="Canvas UI Display"
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
