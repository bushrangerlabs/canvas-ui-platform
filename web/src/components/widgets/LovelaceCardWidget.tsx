/**
 * LovelaceCardWidget
 * Embeds any Home Assistant Lovelace card using HA's custom-element infrastructure.
 *
 * Requirements:
 *  - Must run in a browser context that has loaded HA's frontend (e.g. displayed
 *    inside Home Assistant via ingress or an iframe pointing to HA).
 *  - In standalone kiosk/display mode outside HA, shows a friendly notice.
 *
 * Card config is entered as YAML or JSON in the inspector.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { WidgetProps } from '../../types';

// Walk up the window hierarchy to find the window that owns HA's custom elements.
function getHAWindow(): Window {
  let win: Window = window;
  try {
    while (win !== win.parent) {
      const parent = win.parent;
      try {
        if ((parent as any).customElements?.get('ha-card')) return parent;
      } catch { /* cross-origin */ }
      if (win === parent) break;
      win = parent;
    }
  } catch { /* cross-origin at top */ }
  // Fallback: return highest reachable same-origin window
  let best: Window = window;
  try {
    let cur: Window = window;
    while (cur !== cur.parent) {
      try { cur = cur.parent; best = cur; } catch { break; }
    }
  } catch {}
  return (best as any).customElements?.get('ha-card') ? best : window;
}

/**
 * Walk up the window hierarchy to find the real HA hass object.
 * Priority:
 *  1. <home-assistant>.hass (has localize, themes, callService, etc.)
 *  2. window.hass on any ancestor window
 *  3. window.hass on own window (fallback)
 */
function getFullHass(): any {
  // 1. Walk up to find <home-assistant> element
  let win: Window = window;
  let checkedTop = false;
  while (!checkedTop) {
    try {
      const ha = (win as any).document?.querySelector?.('home-assistant');
      if (ha && typeof (ha as any).hass?.localize === 'function') return (ha as any).hass;
    } catch { /* cross-origin */ }
    if (win === win.parent) { checkedTop = true; break; }
    try { win = win.parent; } catch { break; }
  }
  // 2. Walk up for window.hass with localize
  win = window;
  checkedTop = false;
  while (!checkedTop) {
    try {
      const wh = (win as any).hass;
      if (wh && typeof wh.localize === 'function') return wh;
    } catch { /* cross-origin */ }
    if (win === win.parent) { checkedTop = true; break; }
    try { win = win.parent; } catch { break; }
  }
  // 3. Fallback
  return (window as any).hass;
}

function waitForHass(): Promise<any> {
  return new Promise((resolve) => {
    const check = () => {
      const h = getFullHass();
      if (h && h.states && Object.keys(h.states).length > 0) {
        resolve(h);
      } else {
        setTimeout(check, 150);
      }
    };
    check();
  });
}

/** Parse YAML-ish or JSON card config text. Returns null on parse failure. */
function parseCardConfig(text: string): Record<string, any> | null {
  const trimmed = text.trim();
  if (!trimmed) return {};

  // Try JSON first
  try { return JSON.parse(trimmed); } catch { /* not JSON */ }

  // Minimal line-by-line YAML parser (handles simple flat keys only)
  try {
    const result: Record<string, any> = {};
    for (const line of trimmed.split('\n')) {
      const clean = line.trimEnd();
      if (!clean || clean.startsWith('#')) continue;
      const colon = clean.indexOf(':');
      if (colon === -1) continue;
      const key = clean.slice(0, colon).trim();
      const val = clean.slice(colon + 1).trim();
      if (val === '') continue;
      if (val === 'true')  { result[key] = true;  continue; }
      if (val === 'false') { result[key] = false; continue; }
      const num = Number(val);
      if (!isNaN(num) && val !== '') { result[key] = num; continue; }
      result[key] = val.replace(/^['"]|['"]$/g, '');
    }
    return result;
  } catch {
    return null;
  }
}

const LovelaceCardWidget: React.FC<WidgetProps> = ({ config }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  const {
    cardType = 'entities',
    cardConfig = '',
    refreshInterval = 0,
  } = config.config;

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    async function mountCard() {
      if (!containerRef.current || cancelled) return;
      setError('');
      setStatus('loading');

      const haWin = getHAWindow();

      try {
        const parsed = parseCardConfig(cardConfig);
        if (parsed === null) throw new Error('Invalid card config (bad YAML/JSON)');

        const fullConfig: Record<string, any> = {
          type: cardType.startsWith('custom:') || cardType.includes('-') || cardType.includes(':')
            ? cardType
            : cardType.replace(/^hui-/, '').replace(/-card$/, ''),
          ...parsed,
        };

        // Wait for hass with real states (retries every 150 ms, no timeout)
        const hassObj = await waitForHass();
        if (cancelled) return;

        // Create card element
        let cardEl: HTMLElement | null = null;

        // Try loadCardHelpers first (works for all built-in cards)
        if ((haWin as any).loadCardHelpers) {
          try {
            const helpers = await (haWin as any).loadCardHelpers();
            cardEl = await helpers.createCardElement(fullConfig);
          } catch { /* fall through */ }
        }

        // Fallback: direct custom element instantiation
        if (!cardEl) {
          const rawType = cardType.startsWith('custom:')
            ? cardType.slice(7)
            : `hui-${fullConfig.type}-card`;
          const Ctor = (haWin as any).customElements?.get(rawType);
          if (!Ctor) {
            throw new Error(`Unknown card type: "${cardType}". Make sure the card is loaded in HA.`);
          }
          const doc = containerRef.current?.ownerDocument ?? document;
          cardEl = doc.createElement(rawType) as HTMLElement;
        }

        if (cancelled) return;

        // Set config then hass (order matters for some cards)
        if ((cardEl as any).setConfig) {
          (cardEl as any).setConfig(fullConfig);
        }
        (cardEl as any).hass = hassObj;

        // Mount into DOM
        if (!containerRef.current || cancelled) return;
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild);
        }
        cardRef.current = cardEl;
        containerRef.current.appendChild(cardEl);
        setStatus('ok');
      } catch (e) {
        if (!cancelled) {
          setError(String(e instanceof Error ? e.message : e));
          setStatus('error');
        }
      }
    }

    mountCard();

    let timer: ReturnType<typeof setInterval> | undefined;
    if (refreshInterval > 0) {
      timer = setInterval(mountCard, refreshInterval);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [cardType, cardConfig, refreshInterval]);

  // Keep hass up-to-date on the mounted card so entity states refresh.
  useEffect(() => {
    const tick = () => {
      const h = getFullHass();
      if (h && cardRef.current && (cardRef.current as any).hass !== undefined) {
        (cardRef.current as any).hass = h;
      }
    };
    const iv = setInterval(tick, 2000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Loading / placeholder state */}
      {status === 'loading' && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 1, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#1e1e2e',
            border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: 8,
            gap: 6, flexDirection: 'column',
          }}
        >
          <span style={{ fontSize: 24 }}>🃏</span>
          <span style={{ color: '#888', fontSize: 11 }}>{cardType || 'Lovelace Card'}</span>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 1, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.75)', padding: 12, gap: 6, borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ color: '#f57', fontSize: 11, textAlign: 'center', maxWidth: 220 }}>
            {error}
          </span>
        </div>
      )}

      {/* Card mount point */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      />
    </div>
  );
};

export default LovelaceCardWidget;
