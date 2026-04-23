/**
 * DisplayPage — kiosk/display view.
 * Connects via WebSocket and renders the assigned view full-screen,
 * scaled to fit the current viewport while preserving aspect ratio.
 * URL: /display?device=<deviceId>
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { usePlatformWS } from '../hooks/usePlatformWS';
import CanvasRenderer from '../components/canvas/CanvasRenderer';
import type { ViewConfig, WsInboundMessage, WsOutboundMessage } from '../types';

export default function DisplayPage() {
  const [searchParams] = useSearchParams();
  const deviceId = searchParams.get('device') ?? 'browser';

  const [view, setView] = useState<ViewConfig | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

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

  // Deferred send ref so onOpen can call it before send is in scope
  const sendRef = useRef<((msg: WsOutboundMessage) => void) | null>(null);

  const onMessage = useCallback((msg: WsInboundMessage) => {
    switch (msg.type) {
      case 'hello_ack':
        setStatus('connected');
        break;
      case 'view_change':
        setView(msg.viewData);
        break;
    }
  }, []);

  const onOpen = useCallback(() => {
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
        bgcolor: view?.style.backgroundColor ?? '#000',
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
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          <Typography color="text.secondary" variant="h6">
            {status === 'connecting' ? 'Connecting to server…' : 'Waiting for view assignment…'}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
