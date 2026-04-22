import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { getDb } from '../db/index';

export type ClientType = 'browser' | 'editor' | 'api';

interface ConnectedClient {
  ws: WebSocket;
  clientType: ClientType;
  deviceId?: string;        // set for 'browser' clients
  connectedAt: Date;
}

const clients = new Map<WebSocket, ConnectedClient>();
let wss: WebSocketServer;

export function initWss(server: any): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const ip = req.socket.remoteAddress ?? 'unknown';
    console.log(`[ws] Client connected from ${ip}`);

    // Temporarily store as unknown until hello received
    clients.set(ws, {
      ws,
      clientType: 'api',
      connectedAt: new Date(),
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleMessage(ws, msg);
      } catch {
        console.warn('[ws] Invalid JSON received');
      }
    });

    ws.on('close', () => {
      const client = clients.get(ws);
      if (client?.deviceId) {
        console.log(`[ws] Device ${client.deviceId} disconnected`);
        // Notify editors that device went offline
        broadcast({ type: 'device_offline', device_id: client.deviceId }, 'editor');
      }
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[ws] Error:', err.message);
      clients.delete(ws);
    });
  });

  // Heartbeat — remove dead connections every 30s
  setInterval(() => {
    clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clients.delete(ws);
      }
    });
  }, 30_000);

  return wss;
}

function handleMessage(ws: WebSocket, msg: any): void {
  switch (msg.type) {
    case 'hello': {
      const client = clients.get(ws)!;
      client.clientType = msg.client_type ?? 'api';
      client.deviceId = msg.device_id;
      console.log(`[ws] Hello from ${client.clientType}${client.deviceId ? ` (${client.deviceId})` : ''}`);
      send(ws, { type: 'hello_ack', server_version: '0.1.0' });

      // For browser clients, push their assigned view immediately
      if (client.clientType === 'browser' && client.deviceId) {
        try {
          const db = getDb();
          const device = db.prepare('SELECT default_view_id FROM devices WHERE id = ?').get(client.deviceId) as any;
          if (device?.default_view_id) {
            const row = db.prepare('SELECT * FROM views WHERE id = ?').get(device.default_view_id) as any;
            if (row) {
              const viewData = { ...row, widgets: JSON.parse(row.widgets ?? '[]'), tags: JSON.parse(row.tags ?? '[]') };
              send(ws, { type: 'view_change', viewId: row.id, viewData });
            }
          }
        } catch (err) {
          console.warn('[ws] Failed to push initial view:', err);
        }
      }
      break;
    }

    case 'device_status': {
      const client = clients.get(ws);
      if (client) client.deviceId = msg.device_id;
      // Forward to all editor clients
      broadcast(msg, 'editor');
      break;
    }

    case 'command_ack': {
      broadcast({ type: 'command_ack', command_id: msg.command_id, device_id: msg.device_id }, 'editor');
      break;
    }

    case 'ping': {
      send(ws, { type: 'pong' });
      break;
    }

    default:
      console.warn(`[ws] Unknown message type: ${msg.type}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Send a message to a specific WebSocket */
export function send(ws: WebSocket, msg: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/** Broadcast to all clients of a given type, or to a specific device */
export function broadcast(msg: object, target: ClientType | 'all' | string = 'all'): void {
  clients.forEach((client) => {
    if (client.ws.readyState !== WebSocket.OPEN) return;

    const shouldSend =
      target === 'all' ||
      client.clientType === target ||
      client.deviceId === target;

    if (shouldSend) {
      client.ws.send(JSON.stringify(msg));
    }
  });
}

/** Send a command to a specific device or all devices ('*') */
export function sendCommand(deviceId: string, command: object): void {
  if (deviceId === '*') {
    broadcast(command, 'browser');
  } else {
    clients.forEach((client) => {
      if (client.deviceId === deviceId) {
        send(client.ws, command);
      }
    });
  }
}

/** Get count of currently connected devices */
export function getConnectedDeviceIds(): string[] {
  const ids: string[] = [];
  clients.forEach((client) => {
    if (client.clientType === 'browser' && client.deviceId) {
      ids.push(client.deviceId);
    }
  });
  return ids;
}
