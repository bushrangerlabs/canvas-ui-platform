/**
 * DisplayPage — kiosk/display view.
 * Connects via WebSocket and renders the assigned view full-screen,
 * scaled to fit the current viewport while preserving aspect ratio.
 *
 * URL: /display?device=<deviceId>
 *
 * Schedule cycling: if the device has a schedule_id, the page loads all
 * views in the schedule and cycles through them automatically at the
 * configured per-view durations. A WS view_change message can override
 * the current view even while a schedule is active.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { usePlatformWS } from '../hooks/usePlatformWS';
import CanvasRenderer from '../components/canvas/CanvasRenderer';
import { api } from '../api/client';
import type { ViewConfig, WsInboundMessage, WsOutboundMessage, Schedule, Device, ServerView } from '../types';

export default function DisplayPage() {
  const [searchParams] = useSearchParams();
  const deviceId = searchParams.get('device') ?? 'browser';
  const staticViewId = searchParams.get('view');   // panel-mode: view is pre-determined

  const [view, setView] = useState<ViewConfig | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const dbg = (msg: string) => {
    console.log('[DisplayPage]', msg);
    setDebugLog(prev => [...prev.slice(-8), `${new Date().toISOString().slice(11,19)} ${msg}`]);
  };

  // If a ?view= param is present, fetch and display it immediately (no WS push needed)
  useEffect(() => {
    dbg(`init — device="${deviceId}" staticViewId="${staticViewId ?? 'none'}" url="${window.location.href}"`);
    if (!staticViewId) { dbg('no ?view= param, waiting for WS push'); return; }
    dbg(`fetching /api/views/${staticViewId}…`);
    api.get<ServerView>(`/api/views/${staticViewId}`)
      .then(sv => { dbg(`got view "${sv.name}" (${sv.id})`); setView(sv.view_data); })
      .catch(err => { dbg(`FETCH ERROR: ${err?.message ?? String(err)}`); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticViewId]);
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Schedule state
  const [scheduleViews, setScheduleViews] = useState<ViewConfig[]>([]);
  const [scheduleDurations, setScheduleDurations] = useState<number[]>([]);
  const scheduleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track viewport size for scale computation
  useEffect(() => {
    const handler = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Compute scale to fit canvas inside viewport
  const sizex = view?.sizex ?? 1920;
  const sizey = view?.sizey ?? 1080;
  const scale = Math.min(windowSize.w / sizex, windowSize.h / sizey);
  const offsetX = (windowSize.w - sizex * scale) / 2;
  const offsetY = (windowSize.h - sizey * scale) / 2;

  // ── Schedule cycling ────────────────────────────────────────────────────

  useEffect(() => {
    if (scheduleViews.length === 0) return;
    let idx = 0;
    let cancelled = false;

    function showNext() {
      if (cancelled) return;
      setView(scheduleViews[idx]);
      scheduleTimerRef.current = setTimeout(() => {
        idx = (idx + 1) % scheduleViews.length;
        showNext();
      }, (scheduleDurations[idx] ?? 30) * 1000);
    }

    showNext();
    return () => {
      cancelled = true;
      if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current);
    };
  }, [scheduleViews, scheduleDurations]);

  // Load schedule for device after WS connects
  const loadSchedule = useCallback(async () => {
    if (deviceId === 'browser') return;
    try {
      const device = await api.get<Device>(`/api/devices/${deviceId}`);
      if (!device.schedule_id) return;
      const schedule = await api.get<Schedule>(`/api/schedules/${device.schedule_id}`);
      if (!schedule.enabled || schedule.entries.length === 0) return;

      const loaded: ViewConfig[] = [];
      const durations: number[] = [];
      for (const entry of schedule.entries) {
        try {
          const sv = await api.get<ServerView>(`/api/views/${entry.viewId}`);
          loaded.push(sv.view_data);
          durations.push(entry.duration ?? 30);
        } catch {
          // skip missing views
        }
      }
      if (loaded.length > 0) {
        setScheduleViews(loaded);
        setScheduleDurations(durations);
      }
    } catch {
      // no schedule or device not found — fall back to WS-assigned view
    }
  }, [deviceId]);

  // ── WebSocket ────────────────────────────────────────────────────────────

  const sendRef = useRef<((msg: WsOutboundMessage) => void) | null>(null);

  const staticViewIdRef = useRef(staticViewId);
  staticViewIdRef.current = staticViewId;

  const onMessage = useCallback((msg: WsInboundMessage) => {
    dbg(`WS msg: ${msg.type}`);
    switch (msg.type) {
      case 'hello_ack':
        setStatus('connected');
        loadSchedule();
        break;
      case 'view_change':
        dbg(`view_change: ${msg.viewId}`);
        if (scheduleTimerRef.current) {
          clearTimeout(scheduleTimerRef.current);
          scheduleTimerRef.current = null;
        }
        setScheduleViews([]);
        setView(msg.viewData);
        break;
      case 'view_updated':
        if (staticViewIdRef.current && msg.view_id === staticViewIdRef.current) {
          dbg(`view_updated, re-fetching ${msg.view_id}`);
          api.get<ServerView>(`/api/views/${msg.view_id}`)
            .then(sv => setView(sv.view_data))
            .catch(() => {});
        }
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSchedule]);

  const onOpen = useCallback(() => {
    dbg(`WS open, sending hello device_id="${deviceId}"`);
    sendRef.current?.({ type: 'hello', client_type: 'browser', device_id: deviceId });
  }, [deviceId]);

  const { send } = usePlatformWS(onMessage, true, onOpen);
  sendRef.current = send;

  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        bgcolor: view?.style?.backgroundColor ?? '#000',
        position: 'relative',
      }}
    >
      {view ? (
        <div style={{
          position: 'absolute',
          left: offsetX,
          top: offsetY,
          transformOrigin: '0 0',
          transform: `scale(${scale})`,
        }}>
          <CanvasRenderer view={view} isEditMode={false} />
        </div>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 2,
          }}
        >
          {debugLog.length > 0 && (
            <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, bgcolor: 'rgba(0,0,0,0.85)', borderRadius: 1, p: 1, fontFamily: 'monospace', fontSize: 11, color: '#0f0', zIndex: 9999 }}>
              {debugLog.map((line, i) => <div key={i}>{line}</div>)}
            </Box>
          )}
          <Typography color="text.secondary" variant="h6">
            {status === 'connecting' ? 'Connecting to server…' : 'Waiting for view assignment…'}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
