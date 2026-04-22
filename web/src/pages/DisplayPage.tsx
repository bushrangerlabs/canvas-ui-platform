/**
 * DisplayPage — kiosk/display view.
 * Connects via WebSocket and renders the assigned view full-screen.
 * URL: /display?device=<deviceId>
 */
import { useState, useCallback, useRef } from 'react';
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
        <CanvasRenderer view={view} isEditMode={false} />
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
