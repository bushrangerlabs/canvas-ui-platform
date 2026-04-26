/**
 * LovelaceCardWidget
 * Embeds any Home Assistant Lovelace card using HA's custom-element infrastructure.
 *
 * Cross-document note: the platform runs inside an HA ingress iframe.
 * Lit-based HA cards are created in the parent window's document context, and
 * appending them into our iframe document causes:
 *   NotAllowedError: Sharing constructed stylesheets in multiple documents is not allowed
 *
 * Fix: render into a portal <div> in haWindow.document.body and position it to
 * overlay our React placeholder using getBoundingClientRect + iframe offset.
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
 * Get the hass bridge installed by the Tauri kiosk init script.
 * The bridge runs in the HA lovelace parent window's JS realm, so calling
 * setHass(el) avoids WebKit cross-realm property setter restrictions.
 */
function hassbridge(): { getHass(): any; setHass(el: HTMLElement): void } | null {
  try {
    const b = (window.parent as any).__canvas_hass_bridge;
    return b ?? null;
  } catch { return null; }
}

// Walk up the window hierarchy to find the real HA hass object.
function getFullHass(): any {
  // Prefer bridge (parent realm, avoids cross-realm type coercion in WebKit)
  try {
    const b = hassbridge();
    if (b) { const h = b.getHass(); if (h) return h; }
  } catch { /* ignore */ }
  let win: Window = window;
  let checkedTop = false;
  // 1. <home-assistant>.hass
  while (!checkedTop) {
    try {
      const ha = (win as any).document?.querySelector?.('home-assistant');
      if (ha && typeof (ha as any).hass?.localize === 'function') return (ha as any).hass;
    } catch { /* cross-origin */ }
    if (win === win.parent) { checkedTop = true; break; }
    try { win = win.parent; } catch { break; }
  }
  // 2. window.hass with localize
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
  return (window as any).hass;
}

function waitForHass(timeoutMs = 30000): Promise<any> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      const h = getFullHass();
      if (h && h.states && Object.keys(h.states).length > 0) { resolve(h); return; }
      if (Date.now() >= deadline) { reject(new Error('Home Assistant frontend not available. Lovelace cards only work when displayed via the HA Canvas UI panel (ingress), not standalone.')); return; }
      setTimeout(check, 150);
    };
    check();
  });
}

/** Parse YAML-ish or JSON card config text. Returns null on parse failure. */
function parseCardConfig(text: string): Record<string, any> | null {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try { return JSON.parse(trimmed); } catch { /* not JSON */ }
  try {
    const result: Record<string, any> = {};
    let pendingKey: string | null = null;
    for (const line of trimmed.split('\n')) {
      const clean = line.trimEnd();
      if (!clean || clean.startsWith('#')) continue;
      const colon = clean.indexOf(':');
      if (colon === -1) {
        // Bare value on next line after a "key:" with no inline value
        if (pendingKey !== null) {
          const val = clean.trim().replace(/^['"]|['"]$/g, '');
          if (val !== '') result[pendingKey] = val;
          pendingKey = null;
        }
        continue;
      }
      const key = clean.slice(0, colon).trim();
      const val = clean.slice(colon + 1).trim();
      pendingKey = null;
      if (val === '') {
        // Value may be on the next line (e.g. "entity:\n  climate.foo")
        pendingKey = key;
        continue;
      }
      if (val === 'true')  { result[key] = true;  continue; }
      if (val === 'false') { result[key] = false; continue; }
      const num = Number(val);
      if (!isNaN(num) && val !== '') { result[key] = num; continue; }
      result[key] = val.replace(/^['"]|['"]$/g, '');
    }
    return result;
  } catch { return null; }
}

const LovelaceCardWidget: React.FC<WidgetProps> = ({ config, isEditMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const portalRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number>(0);
  const [error, setError] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  const {
    cardType = 'entities',
    entity_id = '',
    cardConfig = '',
    refreshInterval = 0,
  } = config.config;

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function mountCard() {
      if (!containerRef.current || cancelled) return;
      setError('');
      setStatus('loading');

      // Clean up any previous portal
      if (portalRef.current) {
        try { portalRef.current.remove(); } catch { /* ignore */ }
        portalRef.current = null;
      }
      if (cardRef.current) {
        try { cardRef.current.remove(); } catch { /* ignore */ }
        cardRef.current = null;
      }

      try {
        const parsed = parseCardConfig(cardConfig);
        if (parsed === null) throw new Error('Invalid card config (bad YAML/JSON)');

        const fullConfig: Record<string, any> = {
          type: cardType.startsWith('custom:') || cardType.includes('-') || cardType.includes(':')
            ? cardType
            : cardType.replace(/^hui-/, '').replace(/-card$/, ''),
          // Extra config textarea first, then entity_id field wins (so the picker always takes effect)
          ...parsed,
          ...(entity_id ? { entity: entity_id } : {}),
        };

        // Wait for HA frontend to be ready BEFORE resolving haWin — with JSC JIT disabled
        // the parent HA lovelace page can take 20+ seconds to register ha-card.
        const hassObj = await waitForHass();
        if (cancelled) return;

        // Resolve haWin AFTER waitForHass so ha-card is guaranteed registered in window.parent.
        const haWin = getHAWindow();

        // Create card element via loadCardHelpers (preferred — works for all built-in cards)
        // createCardElement internally calls setConfig, so we must NOT call it again.
        let cardEl: HTMLElement | null = null;
        let configAlreadySet = false;

        if ((haWin as any).loadCardHelpers) {
          try {
            const helpers = await (haWin as any).loadCardHelpers();
            cardEl = await helpers.createCardElement(fullConfig);
            configAlreadySet = true;
          } catch { /* fall through */ }
        }

        // Fallback: direct custom element instantiation in haWin's document
        if (!cardEl) {
          const rawType = cardType.startsWith('custom:')
            ? cardType.slice(7)
            : `hui-${fullConfig.type}-card`;
          const Ctor = (haWin as any).customElements?.get(rawType);
          if (!Ctor) {
            throw new Error(`Unknown card type: "${cardType}". Make sure the card is loaded in HA.`);
          }
          // Use haWin.document.createElement so element is owned by the correct document
          cardEl = (haWin as any).document.createElement(rawType) as HTMLElement;
        }

        if (cancelled) return;

        // Only call setConfig on the fallback path — createCardElement already called it
        if (!configAlreadySet && (cardEl as any).setConfig) {
          (cardEl as any).setConfig(fullConfig);
        }
        // hass will be assigned after the card is appended to the portal (below)

        if (!containerRef.current || cancelled) return;
        cardRef.current = cardEl;

        const crossDocument = (haWin as any) !== window;

        if (crossDocument) {
          // Portal approach: append into haWin.document.body to avoid cross-document
          // Lit stylesheet sharing errors. Position over our React placeholder.
          const portalDiv = (haWin as any).document.createElement('div');
          // In edit mode, use pointer-events:none so canvas editor can select/drag the widget.
          // In view mode, use pointer-events:auto so the card is interactive.
          portalDiv.style.cssText = `position:fixed;overflow:hidden;z-index:2147483647;pointer-events:${isEditMode ? 'none' : 'auto'};`;
          (haWin as any).document.body.appendChild(portalDiv);
          portalDiv.appendChild(cardEl);
          portalRef.current = portalDiv;

          // Set hass immediately after the card is in haWin's document so
          // Lit's connectedCallback sees hass right away.
          // Use the bridge when available so the assignment runs in the parent
          // window's JS realm (avoids WebKit cross-realm property restrictions).
          const bridge = hassbridge();
          if (bridge) {
            bridge.setHass(cardEl);
          } else {
            (cardEl as any).hass = hassObj;
          }

          const syncPosition = () => {
            if (!containerRef.current || !portalDiv.isConnected) return;
            const rect = containerRef.current.getBoundingClientRect();
            // Get our iframe's offset in the parent window.
            // window.frameElement is the most reliable way (no scanning needed).
            let iframeTop = 0, iframeLeft = 0;
            try {
              const frameEl = window.frameElement as HTMLElement | null;
              if (frameEl) {
                const ir = frameEl.getBoundingClientRect();
                iframeTop = ir.top;
                iframeLeft = ir.left;
              } else {
                // Fallback: scan iframes in parent window
                const iframes = (haWin as any).document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                  try {
                    if (iframe.contentWindow === window) {
                      const ir = iframe.getBoundingClientRect();
                      iframeTop = ir.top;
                      iframeLeft = ir.left;
                      break;
                    }
                  } catch { /* cross-origin */ }
                }
              }
            } catch { /* ignore */ }
            portalDiv.style.top    = (iframeTop  + rect.top)    + 'px';
            portalDiv.style.left   = (iframeLeft + rect.left)   + 'px';
            portalDiv.style.width  = rect.width  + 'px';
            portalDiv.style.height = rect.height + 'px';
          };

          // Use a rAF loop for continuous position sync — this correctly tracks
          // canvas pan/zoom (CSS transforms) and drag operations in the editor.
          const rafLoop = () => {
            syncPosition();
            rafRef.current = requestAnimationFrame(rafLoop);
          };
          syncPosition();
          rafRef.current = requestAnimationFrame(rafLoop);

          cleanup = () => {
            cancelAnimationFrame(rafRef.current);
          };
        } else {
          // Same document: safe to append directly
          while (containerRef.current.firstChild) {
            containerRef.current.removeChild(containerRef.current.firstChild);
          }
          containerRef.current.appendChild(cardEl);
        }

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
      if (cleanup) cleanup();
      if (portalRef.current) {
        try { portalRef.current.remove(); } catch { /* ignore */ }
        portalRef.current = null;
      }
      if (cardRef.current) {
        try { cardRef.current.remove(); } catch { /* ignore */ }
        cardRef.current = null;
      }
    };
  }, [cardType, entity_id, cardConfig, refreshInterval]);

  // Keep hass up-to-date on the mounted card so entity states refresh.
  // Poll at 200ms for the first 5s (initial render), then slow to 2s.
  useEffect(() => {
    let slowIv: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const h = getFullHass();
      if (h && cardRef.current) {
        const bridge = hassbridge();
        if (bridge) {
          bridge.setHass(cardRef.current);
        } else {
          (cardRef.current as any).hass = h;
        }
      }
    };
    const fastIv = setInterval(tick, 200);
    const slowTimer = setTimeout(() => {
      clearInterval(fastIv);
      slowIv = setInterval(tick, 2000);
    }, 5000);
    return () => { clearInterval(fastIv); clearTimeout(slowTimer); if (slowIv) clearInterval(slowIv); };
  }, []);

  // Keep portal pointer-events in sync with edit mode changes
  useEffect(() => {
    if (portalRef.current) {
      (portalRef.current as HTMLElement).style.pointerEvents = isEditMode ? 'none' : 'auto';
    }
  }, [isEditMode]);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {status === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#1e1e2e',
          border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8,
          gap: 6, flexDirection: 'column',
        }}>
          <span style={{ fontSize: 24 }}>🃏</span>
          <span style={{ color: '#888', fontSize: 11 }}>{cardType || 'Lovelace Card'}</span>
        </div>
      )}
      {status === 'error' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.75)', padding: 12, gap: 6, borderRadius: 8,
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ color: '#f57', fontSize: 11, textAlign: 'center', maxWidth: 220 }}>{error}</span>
        </div>
      )}
      {/* Placeholder div used for position tracking in portal mode */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }} />
    </div>
  );
};

export default LovelaceCardWidget;
