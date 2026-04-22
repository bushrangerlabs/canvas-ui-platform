/**
 * Input Text Widget - Text input for input_text entities
 */
import React, { useState, useEffect } from 'react';
import { useHAEntities } from '../../context/HAEntitiesContext';
import type { WidgetProps } from '../../types';
import type { WidgetMetadata } from './metadata';

export const InputTextWidgetMetadata: WidgetMetadata = {
  name: 'Input Text',
  icon: 'TextFields',
  category: 'control',
  description: 'Text input field bound to an input_text entity',
  defaultSize: { w: 250, h: 50 },
  fields: [
    { name: 'width', type: 'number', label: 'Width', default: 250, min: 100, category: 'layout' },
    { name: 'height', type: 'number', label: 'Height', default: 50, min: 40, category: 'layout' },
    { name: 'entity_id', type: 'entity', label: 'Entity ID', default: '', category: 'behavior' },
    { name: 'placeholder', type: 'text', label: 'Placeholder', default: 'Enter text...', category: 'behavior' },
    { name: 'label', type: 'text', label: 'Label', default: '', category: 'behavior' },
    { name: 'passwordMode', type: 'checkbox', label: 'Password Mode', default: false, category: 'behavior' },
    { name: 'textColor', type: 'color', label: 'Text Color', default: '#ffffff', category: 'style' },
    { name: 'backgroundColor', type: 'color', label: 'Background Color', default: '#424242', category: 'style' },
    { name: 'borderColor', type: 'color', label: 'Border Color', default: '#666666', category: 'style' },
    { name: 'fontSize', type: 'number', label: 'Font Size', default: 14, min: 10, max: 32, category: 'style' },
  ],
};

const InputTextWidget: React.FC<WidgetProps> = ({ config }) => {
  const {
    entity_id = '',
    placeholder = 'Enter text...',
    label = '',
    passwordMode = false,
    textColor = '#ffffff',
    backgroundColor: bgColor = '#424242',
    borderColor = '#666666',
    fontSize = 14,
  } = config.config;

  const { getEntity } = useHAEntities();
  const entity = entity_id ? getEntity(entity_id) : null;
  const entityValue = entity?.state ?? '';

  const [value, setValue] = useState(entityValue);

  useEffect(() => {
    setValue(entityValue);
  }, [entityValue]);

  const handleBlur = async () => {
    if (!entity_id) return;
    try {
      // Post to HA via the platform's ha proxy if available
      await fetch('/api/ha/services/input_text/set_value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id, value }),
      });
    } catch (e) {
      console.warn('[InputTextWidget] Service call failed:', e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { handleBlur(); (e.target as HTMLInputElement).blur(); }
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <div style={{ fontSize: fontSize - 2, color: textColor, opacity: 0.8, paddingLeft: 8 }}>{label}</div>
      )}
      <input
        type={passwordMode ? 'password' : 'text'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          flex: 1,
          backgroundColor: bgColor,
          color: textColor,
          border: `1px solid ${borderColor}`,
          borderRadius: 4,
          padding: '8px 12px',
          boxSizing: 'border-box',
          fontSize: fontSize,
          outline: 'none',
          fontFamily: 'inherit',
          width: '100%',
        }}
      />
    </div>
  );
};

export default InputTextWidget;
