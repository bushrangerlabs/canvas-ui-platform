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
/**
 * Builds the initialization_script that:
 * 1. Stores the HA long-lived token in localStorage so HA's frontend auto-logs in.
 * 2. On DOMContentLoaded, hides HA's chrome and injects a full-screen iframe
 *    pointing to the canvas display view via HA ingress (same origin as the parent
 *    HA frontend window → window.parent.customElements.get('ha-card') works).
 */
function buildHAKioskScript(params: {
  haUrl: string;
  haToken: string;
  iframeSrc: string;
}): string {
  // Long-lived tokens don't expire — fake an expiry far in the future so HA's
  // frontend auth module won't try to refresh (which requires a refresh_token).
  const hassTokens = JSON.stringify({
    access_token:  params.haToken,
    token_type:    'Bearer',
    expires_in:    99999999,
    hassUrl:       params.haUrl,
    clientId:      `${params.haUrl}/`,
    expires:       new Date('2099-01-01').getTime(),
    refresh_token: '',
  });
  const iframeSrc  = JSON.stringify(params.iframeSrc);
  const tokensJson = JSON.stringify(hassTokens);

  return `(function(){
  try{ localStorage.setItem('hassTokens', ${tokensJson}); }catch(e){}
  function setup(){
    var s=document.createElement('style');
    s.textContent='ha-sidebar,ha-drawer,app-header,app-toolbar,.header,[slot="toolbar"],ha-menu-button,paper-icon-button{display:none!important}body,html{margin:0;padding:0;overflow:hidden;width:100%;height:100%}';
    (document.head||document.documentElement).appendChild(s);
    var f=document.createElement('iframe');
    f.src=${iframeSrc};
    f.style.cssText='position:fixed;top:0;left:0;width:100vw;height:100vh;border:none;z-index:2147483647;background:#000;pointer-events:auto;';
    f.allow='autoplay; fullscreen';
    document.body.appendChild(f);
  }
  // Hass bridge: canvas iframe calls these to get/set hass entirely within
  // this window's JS realm, avoiding WebKit cross-realm property restrictions.
  window.__canvas_hass_bridge = {
    getHass: function(){
      var ha = document.querySelector('home-assistant');
      return (ha && ha.hass) ? ha.hass : null;
    },
    setHass: function(el){
      var ha = document.querySelector('home-assistant');
      if (ha && ha.hass && el) el.hass = ha.hass;
    }
  };
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',setup);
  }else{
    setTimeout(setup,0);
  }
})();`;
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
  if (panel.url) return panel.url;
  if (panel.view_id) return `${config.serverUrl}/display?view=${encodeURIComponent(panel.view_id)}`;
  return `${config.serverUrl}/display?device=${encodeURIComponent(deviceId)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

const SETTINGS_TAP_COUNT = 5;
const SETTINGS_TAP_WINDOW_MS = 3000;

export default function KioskScreen({ config, onResetConfig }: Props) {
  const [appState, setAppState]     = useState<AppState>('registering');
  const [errorMsg, setErrorMsg]     = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deviceId, setDeviceId]     = useState(config.deviceId ?? '');
  const [loadedPage, setLoadedPage] = useState<LoadedPage | null>(null);

  // HA ingress session for Lovelace cards in panel windows
  const ingressRef = useRef<{ session: string; ingressPath: string; haUrl: string } | null>(null);

  // Fetch HA ingress session + path so panel windows can load via HA ingress.
  // This gives them access to HA's custom element registry (needed for Lovelace cards).
  useEffect(() => {
    async function fetchIngress() {
      if (!config.haUrl || !config.haToken) return;
      try {
        // 1. Get this add-on's ingress path from our server
        const infoRes = await fetch(`${config.serverUrl}/api/ingress-info`);
        if (!infoRes.ok) return;
        const info = await infoRes.json() as { ingress_url: string | null };
        if (!info.ingress_url) return;
        const ingressPath = info.ingress_url.endsWith('/') ? info.ingress_url : info.ingress_url + '/';

        // 2. Create an HA ingress session using the long-lived token
        const sessionRes = await fetch(`${config.haUrl}/api/ingress/session`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.haToken}` },
        });
        if (!sessionRes.ok) return;
        const sessionData = await sessionRes.json() as { session: string };
        if (!sessionData.session) return;

        ingressRef.current = { session: sessionData.session, ingressPath, haUrl: config.haUrl };
        console.log('[KioskScreen] HA ingress ready, path:', ingressPath);
      } catch (e) {
        console.warn('[KioskScreen] Could not get HA ingress session:', e);
      }
    }
    fetchIngress();
  }, [config.haUrl, config.haToken, config.serverUrl]);

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

  // ── Device registration with automatic retry ──────────────────────────
  // Retries indefinitely with capped backoff — handles the kiosk starting
  // before the server (add-on) is ready.
  useEffect(() => {
    let cancelled = false;

    async function attempt(n: number) {
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
        if (cancelled) return;
        await saveDeviceId(device.id);
        setDeviceId(device.id);
        setRetryCount(0);
        setAppState('ready');
      } catch (e) {
        if (cancelled) return;
        const delay = Math.min(2000 * Math.pow(1.5, n), 30000); // 2s→30s cap
        setRetryCount(n + 1);
        setErrorMsg(String(e));
        retryTimerRef.current = setTimeout(() => {
          if (!cancelled) attempt(n + 1);
        }, delay);
      }
    }

    attempt(0);
    return () => {
      cancelled = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [config.serverUrl, config.deviceId, config.deviceName]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const directUrl = resolvePanelUrl(panel, config, deviceId);

      // If a panel has a view (canvas content) and HA ingress is available,
      // load the panel by opening HA's actual frontend (ha:8123/lovelace) in the
      // WebviewWindow. An initialization_script:
      //   1. Sets localStorage hassTokens for HA auto-login (using the long-lived token)
      //   2. Sets the ingress_session cookie for the iframe's ingress request
      //   3. On DOMContentLoaded, hides HA chrome and injects a full-screen iframe
      //      pointing to the canvas display via HA ingress.
      // Because both the parent (ha:8123/lovelace) and the iframe
      // (ha:8123/api/hassio_ingress/.../display) share origin ha:8123, the iframe
      // can access window.parent.customElements.get('ha-card') → Lovelace works.
      const ingress = ingressRef.current;
      const useIngress = !panel.url && ingress && config.haToken;

      if (useIngress) {
        const iframeSrc = `${ingress!.haUrl}${ingress!.ingressPath}display?view=${encodeURIComponent(panel.view_id ?? '')}&device=${encodeURIComponent(deviceId)}`;
        const haFrontendUrl = `${ingress!.haUrl}/lovelace`;
        const initScript = buildHAKioskScript({
          haUrl:     ingress!.haUrl,
          haToken:   config.haToken!,
          iframeSrc,
        });

        invoke('create_panel_webview', {
          label,
          url:           haFrontendUrl,
          x:             ox + pct(panel.x, sw),
          y:             oy + pct(panel.y, sh),
          width:         pct(panel.w, sw),
          height:        pct(panel.h, sh),
          title:         panel.name,
          visible:       true,
          ingressSession: ingress!.session,
          initScript,
        }).catch(e => console.error(`[${label}] create_panel_webview error:`, e));
      } else {
        const win = new WebviewWindow(label, {
          url: directUrl,
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
      }
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
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0a0a0a', flexDirection: 'column', gap: 2, p: 4 }}>
        <CircularProgress size={40} />
        <Typography color="text.secondary" variant="body2">
          {retryCount === 0
            ? `Connecting to ${config.serverUrl}…`
            : `Retrying… (attempt ${retryCount + 1})`}
        </Typography>
        {retryCount > 0 && (
          <Typography color="error" variant="caption" sx={{ maxWidth: 480, textAlign: 'center', opacity: 0.7 }}>
            {errorMsg}
          </Typography>
        )}
        {retryCount >= 3 && (
          <Button variant="outlined" size="small" onClick={() => setAppState('settings')} sx={{ mt: 1 }}>
            Open Settings
          </Button>
        )}
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
