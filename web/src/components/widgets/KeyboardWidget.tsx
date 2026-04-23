/**
 * KeyboardWidget
 * On-screen virtual keyboard. Sends keystrokes to a target input_text entity
 * and/or syncs with the currently focused input element on the page.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { WidgetProps } from '../../types';

const LAYOUTS = {
  default: [
    ['1','2','3','4','5','6','7','8','9','0','{bksp}'],
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l'],
    ['{shift}','z','x','c','v','b','n','m','.'],
    ['{space}','{enter}'],
  ],
  shift: [
    ['1','2','3','4','5','6','7','8','9','0','{bksp}'],
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['{shift}','Z','X','C','V','B','N','M',','],
    ['{space}','{enter}'],
  ],
  numeric: [
    ['7','8','9'],
    ['4','5','6'],
    ['1','2','3'],
    ['{clear}','0','{bksp}'],
  ],
};

const LABELS: Record<string, string> = {
  '{bksp}': '⌫',
  '{space}': 'Space',
  '{enter}': '↵',
  '{shift}': '⇧',
  '{clear}': 'C',
};

const WIDE_KEYS = new Set(['{bksp}', '{space}', '{enter}', '{shift}', '{clear}']);

const KeyboardWidget: React.FC<WidgetProps> = ({ config, isEditMode }) => {
  const {
    layout = 'default',
    target_entity = '',
    showDisplay = true,
    backgroundColor = '#1e1e1e',
    buttonColor = '#3b3b3b',
    buttonTextColor = '#ffffff',
    buttonHoverColor = '#5a5a5a',
    displayBackgroundColor = '#2a2a2a',
    displayTextColor = '#ffffff',
  } = config.config;

  const [input, setInput] = useState('');
  const [shiftActive, setShiftActive] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const focusedInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Sync with focused input element
  useEffect(() => {
    if (isEditMode) return;
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if ((t as HTMLElement).dataset?.widgetKeyboard) return;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') {
        focusedInputRef.current = t as HTMLInputElement | HTMLTextAreaElement;
        setInput((t as HTMLInputElement).value ?? '');
      }
    };
    document.addEventListener('focusin', onFocus, true);
    return () => document.removeEventListener('focusin', onFocus, true);
  }, [isEditMode]);

  const syncEntity = useCallback(async (value: string) => {
    if (!target_entity) return;
    try {
      await fetch('/api/ha/services/input_text/set_value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: target_entity, value }),
      });
    } catch (e) {
      console.warn('[KeyboardWidget] Service call failed:', e);
    }
  }, [target_entity]);

  const syncFocused = useCallback((value: string) => {
    const el = focusedInputRef.current;
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, []);

  const handleKey = useCallback((key: string) => {
    let next = input;
    if (key === '{bksp}') {
      next = input.slice(0, -1);
    } else if (key === '{clear}') {
      next = '';
    } else if (key === '{space}') {
      next = input + ' ';
    } else if (key === '{enter}') {
      next = input + '\n';
    } else if (key === '{shift}') {
      setShiftActive((s) => !s);
      return;
    } else {
      next = input + key;
    }
    setInput(next);
    setShiftActive(false);
    syncEntity(next);
    syncFocused(next);
  }, [input, syncEntity, syncFocused]);

  const activeLayout = layout === 'numeric'
    ? LAYOUTS.numeric
    : (shiftActive ? LAYOUTS.shift : LAYOUTS.default);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor,
        padding: 8,
        boxSizing: 'border-box',
        pointerEvents: isEditMode ? 'none' : 'auto',
      }}
    >
      {showDisplay && (
        <input
          data-widget-keyboard="true"
          value={input}
          readOnly
          style={{
            width: '100%',
            padding: '8px 12px',
            boxSizing: 'border-box',
            fontSize: 18,
            marginBottom: 8,
            border: '1px solid #555',
            borderRadius: 4,
            backgroundColor: displayBackgroundColor,
            color: displayTextColor,
            outline: 'none',
          }}
          placeholder="Type here…"
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {activeLayout.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 4, flex: 1 }}>
            {row.map((key) => {
              const label = LABELS[key] ?? key;
              const isWide = WIDE_KEYS.has(key);
              const isActive = key === '{shift}' && shiftActive;
              return (
                <button
                  key={key}
                  onMouseEnter={() => setHoveredKey(key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onPointerDown={(e) => { e.preventDefault(); handleKey(key); }}
                  style={{
                    flex: isWide ? 2 : 1,
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: isActive
                      ? buttonHoverColor
                      : hoveredKey === key ? buttonHoverColor : buttonColor,
                    color: buttonTextColor,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.1s',
                    minWidth: 0,
                    padding: '4px 2px',
                    boxSizing: 'border-box',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeyboardWidget;
