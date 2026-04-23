/**
 * ScreensaverWidget
 * Behaviour-only widget: mounts an idle timer and shows a screensaver overlay
 * in display mode. Edit mode shows a visible placeholder.
 *
 * Modes:
 *   dim      - Dim overlay over the whole page (click/key/touch to dismiss)
 *   black    - Full black overlay
 *   navigate - Navigate to another view when idle (not yet implemented)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WidgetProps } from '../../types';

const ScreensaverWidget: React.FC<WidgetProps> = ({ config, isEditMode }) => {
  const {
    mode = 'dim',
    dimOpacity = 85,
    overlayColor = '#000000',
    idleTimeout = 120,
    dismissOnTouch = true,
    dismissOnKeyboard = true,
  } = config.config;

  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activate = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    setActive(true);
  }, []);

  const dismiss = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setActive(false);
    // Restart idle timer immediately after dismiss
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => activateRef.current(), idleTimeout * 1000);
  }, [idleTimeout]);

  const activateRef = useRef(activate);
  const dismissRef = useRef(dismiss);
  useEffect(() => { activateRef.current = activate; }, [activate]);
  useEffect(() => { dismissRef.current = dismiss; }, [dismiss]);

  // Idle timer
  useEffect(() => {
    if (isEditMode || idleTimeout <= 0) return;

    const scheduleTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => activateRef.current(), idleTimeout * 1000);
    };

    const handleActivity = () => {
      if (activeRef.current) dismissRef.current();
      scheduleTimer();
    };

    const events = ['mousemove', 'mousedown', 'touchstart', 'keydown'] as const;
    events.forEach((e) => document.addEventListener(e, handleActivity, { passive: true }));
    scheduleTimer();

    return () => {
      events.forEach((e) => document.removeEventListener(e, handleActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isEditMode, idleTimeout]);

  // Dismiss interaction listeners
  useEffect(() => {
    if (!active) return;
    const handleDismiss = () => dismissRef.current();
    const events: string[] = [];
    if (dismissOnTouch) events.push('mousedown', 'touchstart');
    if (dismissOnKeyboard) events.push('keydown');
    events.forEach((e) => document.addEventListener(e, handleDismiss, { once: false }));
    return () => events.forEach((e) => document.removeEventListener(e, handleDismiss));
  }, [active, dismissOnTouch, dismissOnKeyboard]);

  const opacity = mode === 'black' ? 1 : (dimOpacity / 100);
  const bg = overlayColor || '#000000';

  // Edit mode placeholder
  if (isEditMode) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.3)',
          border: '2px dashed rgba(255,255,255,0.2)',
          borderRadius: 8,
          gap: 4,
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontSize: 28, opacity: 0.5 }}>💤</span>
        <span style={{ color: '#888', fontSize: 12, opacity: 0.8 }}>Screensaver</span>
        <span style={{ color: '#555', fontSize: 10 }}>
          {mode} · {idleTimeout}s idle
        </span>
      </div>
    );
  }

  // Display mode overlay (portal to document.body)
  if (!active) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: bg,
        opacity,
        zIndex: 99999,
        cursor: 'pointer',
      }}
      onClick={() => dismissRef.current()}
    />,
    document.body,
  );
};

export default ScreensaverWidget;
