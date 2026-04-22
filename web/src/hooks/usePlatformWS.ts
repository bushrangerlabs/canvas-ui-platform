/**
 * WebSocket connection to the Canvas UI Platform server.
 * Provides real-time view-change pushes and data-source updates.
 */
import { useEffect, useRef, useCallback } from 'react';
import type { WsInboundMessage, WsOutboundMessage } from '../types';

type MessageHandler = (msg: WsInboundMessage) => void;

const WS_URL = (() => {
  const base = import.meta.env.VITE_WS_URL;
  if (base) return base;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
})();

const RECONNECT_DELAY = 3000;

export function usePlatformWS(onMessage: MessageHandler, enabled = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef<MessageHandler>(onMessage);
  onMessageRef.current = onMessage;

  const send = useCallback((msg: WsOutboundMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function connect() {
      const token = localStorage.getItem('cui_token');
      const url = token ? `${WS_URL}?token=${token}` : WS_URL;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.debug('[WS] connected');
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as WsInboundMessage;
          onMessageRef.current(msg);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        console.debug('[WS] closed — reconnecting in', RECONNECT_DELAY, 'ms');
        timerRef.current = setTimeout(connect, RECONNECT_DELAY);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [enabled]);

  return { send };
}
