import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { nanoid } from 'nanoid'; // tiny dep, or use crypto.randomUUID()
import { saveDeviceId, clearConfig, type AppConfig } from '../store/config';
import { useServerSocket } from '../hooks/useServerSocket';
import SettingsScreen from './SettingsScreen';

// ── Gesture detection threshold ──────────────────────────────────────────────
const SWIPE_THRESHOLD_PX = 80;
const SETTINGS_TAP_COUNT = 5;
const SETTINGS_TAP_WINDOW_MS = 3000;

interface Props {
  config: AppConfig;
  onResetConfig: () => void;
}

interface ViewInfo {
  id: string;
  name: string;
}

type AppState = 'registering' | 'loading_views' | 'ready' | 'error' | 'settings';

export default function KioskScreen({ config, onResetConfig }: Props) {
  const [appState, setAppState] = useState<AppState>('registering');
  const [errorMsg, setErrorMsg] = useState('');
  const [deviceId, setDeviceId] = useState(config.deviceId ?? '');
  const [views, setViews] = useState<ViewInfo[]>([]);
  const [viewIndex, setViewIndex] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
          }),
        });
        if (!res.ok) throw new Error(`Registration failed: ${res.status}`);
        const device = await res.json();
        await saveDeviceId(device.id);
        setDeviceId(device.id);
        setAppState('loading_views');
      } catch (e) {
        setErrorMsg(String(e));
        setAppState('error');
      }
    }
    register();
  }, [config.serverUrl, config.deviceId, config.deviceName]);

  // ── Fetch assigned views once registered ──────────────────────────────────
  useEffect(() => {
    if (appState !== 'loading_views' || !deviceId) return;
    async function fetchViews() {
      try {
        const res = await fetch(`${config.serverUrl}/api/devices/${deviceId}/views`);
        if (!res.ok) throw new Error(`Failed to fetch views: ${res.status}`);
        const data: ViewInfo[] = await res.json();
        setViews(data);
        setViewIndex(0);
        setAppState('ready');
      } catch (e) {
        // No views assigned yet — show a waiting state (not an error)
        setViews([]);
        setAppState('ready');
      }
    }
    fetchViews();
  }, [appState, deviceId, config.serverUrl]);

  // ── WebSocket commands from server ─────────────────────────────────────────
  useServerSocket({
    serverUrl: config.serverUrl,
    deviceId,
    enabled: appState === 'ready',
    onCommand(cmd) {
      switch (cmd.type) {
        case 'view_change':
          if (cmd.viewId) {
            const idx = views.findIndex(v => v.id === cmd.viewId);
            if (idx !== -1) setViewIndex(idx);
          }
          break;
        case 'reload':
          window.location.reload();
          break;
        case 'navigate':
          if (typeof cmd.payload?.index === 'number') {
            setViewIndex(Math.min(cmd.payload.index, views.length - 1));
          }
          break;
        // screen_on / screen_off / set_brightness handled by Tauri Rust commands
        default:
          break;
      }
    },
  });

  // ── Swipe gesture navigation ───────────────────────────────────────────────
  const touchStartX = useRef<number | null>(null);
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || !config.swipeNavEnabled) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx < 0) { // swipe left → next view
      setViewIndex(i => Math.min(i + 1, views.length - 1));
    } else { // swipe right → prev view
      setViewIndex(i => Math.max(i - 1, 0));
    }
  }

  // ── Navigate between views via button action from iframe ──────────────────
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'canvas_navigate' && typeof e.data.viewId === 'string') {
        const idx = views.findIndex(v => v.id === e.data.viewId);
        if (idx !== -1) setViewIndex(idx);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [views]);

  // ── Current kiosk URL ─────────────────────────────────────────────────────
  const currentView = views[viewIndex];
  const kioskUrl = currentView
    ? `${config.serverUrl}/kiosk/${deviceId}?view=${currentView.id}&haUrl=${encodeURIComponent(config.haUrl)}&haToken=${encodeURIComponent(config.haToken)}`
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

  if (appState === 'registering' || appState === 'loading_views') {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0a0a0a', flexDirection: 'column', gap: 2 }}>
        <CircularProgress size={40} />
        <Typography color="text.secondary" variant="body2">
          {appState === 'registering' ? `Connecting to ${config.serverUrl}…` : 'Loading views…'}
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

  if (!views.length) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0a0a0a', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6" color="text.secondary">No views assigned</Typography>
        <Typography variant="body2" color="text.secondary">
          Open Canvas UI and assign views to <strong>{config.deviceName}</strong>
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ mt: 2 }}>Device ID: {deviceId}</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', bgcolor: '#000' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Kiosk iframe — loads the server's /kiosk/:deviceId viewer */}
      {kioskUrl && (
        <iframe
          ref={iframeRef}
          key={currentView.id}
          src={kioskUrl}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          allow="autoplay; fullscreen"
          title="Canvas UI View"
        />
      )}

      {/* Hidden corner tap zone for settings access (top-right, 60×60px) */}
      <Box
        onClick={handleCornerTap}
        sx={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, zIndex: 9999, cursor: 'default' }}
      />

      {/* View indicator dots (bottom center) — only when multiple views */}
      {views.length > 1 && (
        <Box sx={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1, zIndex: 100 }}>
          {views.map((v, i) => (
            <Box
              key={v.id}
              onClick={() => setViewIndex(i)}
              sx={{
                width: i === viewIndex ? 20 : 8, height: 8,
                borderRadius: 4,
                bgcolor: i === viewIndex ? 'primary.main' : 'rgba(255,255,255,0.3)',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
