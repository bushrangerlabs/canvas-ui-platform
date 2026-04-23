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

/**
 * Walk up the window hierarchy to find the window that has HA's custom elements.
 * Needed when running inside a nested iframe (e.g. IFrame widget in kiosk).
 */
function getHAWindow(): Window {
  let best: Window = window;
  try {
    let cur: Window = window;
    while (cur !== cur.parent) {
      try {
        const parent = cur.parent;
        if ((parent as any).customElements?.get('ha-card')) return parent;
        cur = parent;
        best = cur;
      } catch {
        break;
      }
    }
  } catch { /* cross-origin */ }
  return best;
}

function isHAAvailable(): boolean {
  try {
    const win = getHAWindow();
    return !!(win as any).customElements?.get('ha-card');
  } catch {
    return false;
  }
}

/** Parse YAML-ish or JSON card config text. Returns null on failure. */
function parseCardConfig(text: string): Record<string, any> | null {
  const trimmed = text.trim();
  if (!trimmed) return {};

  // Try JSON first
  try { return JSON.parse(trimmed); } catch { /* not JSON */ }

  // Minimal YAML key: value parser (no js-yaml dependency)
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
      if (val === 'true') { result[key] = true; continue; }
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

const LovelaceCardWidget: React.FC<WidgetProps> = ({ config, isEditMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string>('');
  const [haAvailable] = useState<boolean>(() => isHAAvailable());

  const {
    cardType = 'entities',
    cardConfig = '',
    refreshInterval = 0,
  } = config.config;

  useEffect(() => {
    if (!haAvailable || !containerRef.current) return;

    const haWin = getHAWindow();
    const doc = containerRef.current.ownerDocument;

    async function mountCard() {
      if (!containerRef.current) return;
      setError('');

      try {
        const parsed = parseCardConfig(cardConfig);
        if (parsed === null) throw new Error('Invalid card config (bad YAML/JSON)');

        const fullConfig = {
          type: cardType.startsWith('custom:') || cardType.includes(':')
            ? cardType
            : cardType.replace(/^hui-/, '').replace(/-card$/, ''),
          ...parsed,
        };

        // Try HA's loadCardHelpers first
        let cardEl: HTMLElement | null = null;
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
          const Ctor = (haWin as any).customElements.get(rawType);
          if (!Ctor) throw new Error(`Unknown card type: ${cardType}`);
          cardEl = doc.createElement(rawType) as HTMLElement;
        }

        if ((cardEl as any).setConfig) {
          (cardEl as any).setConfig(fullConfig);
        }

        // Provide hass object if available on haWin
        const hassObj = (haWin as any).hassConnection?.hass ?? (haWin as any).hass;
        if (hassObj && (cardEl as any).hass !== undefined) {
          (cardEl as any).hass = hassObj;
        }

        // Clear previous card and append new one
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild);
        }
        cardRef.current = cardEl;
        containerRef.current.appendChild(cardEl);
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
      }
    }

    mountCard();

    // Optional auto-refresh
    let timer: ReturnType<typeof setInterval> | undefined;
    if (refreshInterval > 0) {
      timer = setInterval(mountCard, refreshInterval);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [haAvailable, cardType, cardConfig, refreshInterval]);

  // Edit mode or HA unavailable placeholder
  if (isEditMode || !haAvailable) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1e1e2e',
          border: '1px dashed rgba(255,255,255,0.15)',
          borderRadius: 8,
          gap: 6,
          padding: 12,
          boxSizing: 'border-box',
        }}
      >
        <span style={{ fontSize: 28 }}>🃏</span>
        <span style={{ color: '#aaa', fontSize: 13, fontWeight: 600 }}>
          {cardType || 'Lovelace Card'}
        </span>
        {!haAvailable && !isEditMode && (
          <span style={{ color: '#f57', fontSize: 11, textAlign: 'center', maxWidth: 200 }}>
            Requires HA frontend context (not available in standalone mode)
          </span>
        )}
        {isEditMode && (
          <span style={{ color: '#666', fontSize: 10 }}>
            Card renders in display mode only
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {error && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 1, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.7)', padding: 12, gap: 6,
          }}
        >
          <span style={{ color: '#f57', fontSize: 12, textAlign: 'center' }}>
            {error}
          </span>
        </div>
      )}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      />
    </div>
  );
};

export default LovelaceCardWidget;
