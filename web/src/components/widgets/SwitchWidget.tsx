/**
 * Switch Widget - Toggle switch for binary entities (lights, switches, etc.)
 * Migrated to Phase 44 standards (Feb 15, 2026)
 */

import React from 'react';
import { useVisibility } from '../../hooks/useVisibility';
import { useWidget } from '../hooks/useWidget';
import type { WidgetProps } from '../../types';
import type { WidgetMetadata } from './metadata';
import { applyUniversalStyles } from '../utils/styleBuilder';
import { useResolvedUniversalStyle } from '../../hooks/useResolvedUniversalStyle';

export const SwitchWidgetMetadata: WidgetMetadata = {
  name: 'Switch',
  icon: 'ToggleOnOutlined',
  category: 'control',
  description: 'Toggle switch for binary entities',
  defaultSize: { w: 200, h: 60 },
  minSize: { w: 80, h: 40 },
  requiresEntity: false,
  fields: [
    // Layout
    { name: 'x', type: 'number', label: 'X Position', default: 0, category: 'layout' },
    { name: 'y', type: 'number', label: 'Y Position', default: 0, category: 'layout' },
    { name: 'width', type: 'number', label: 'Width', default: 200, min: 80, category: 'layout' },
    { name: 'height', type: 'number', label: 'Height', default: 60, min: 40, category: 'layout' },

    // Behavior
    { name: 'label', type: 'text', label: 'Label', default: 'Switch', category: 'behavior' },
    { name: 'labelPosition', type: 'select', label: 'Label Position', default: 'left', category: 'behavior', options: [
      { value: 'left', label: 'Left' },
      { value: 'right', label: 'Right' },
      { value: 'top', label: 'Top' },
      { value: 'bottom', label: 'Bottom' },
    ]},
    { name: 'service_domain', type: 'text', label: 'Service Domain', default: 'homeassistant', category: 'behavior', description: 'e.g. light, switch, input_boolean (or use "homeassistant" for auto-detect)' },
    { name: 'entity_id', type: 'entity', label: 'Entity ID', default: '', category: 'behavior', description: 'Entity to control and monitor' },
    { name: 'state', type: 'text', label: 'State', default: 'off', category: 'behavior', description: 'Can use {entity.state} for dynamic state' },

    // Style
    { name: 'onColor', type: 'color', label: 'On Color', default: '#4caf50', category: 'style' },
    { name: 'offColor', type: 'color', label: 'Off Color', default: '#757575', category: 'style' },
    { name: 'textColor', type: 'color', label: 'Text Color', default: '#ffffff', category: 'style' },
    { name: 'fontFamily', type: 'font', label: 'Font Family', default: 'Arial, sans-serif', category: 'style' },
    { name: 'fontSize', type: 'number', label: 'Font Size', default: 14, min: 8, max: 32, category: 'style' },
    { name: 'fontWeight', type: 'select', label: 'Font Weight', default: '500', category: 'style', options: [
      { value: '300', label: 'Light' },
      { value: '400', label: 'Normal' },
      { value: '500', label: 'Medium' },
      { value: '600', label: 'Semi-Bold' },
      { value: '700', label: 'Bold' },
    ]},
    { name: 'thumbColor', type: 'color', label: 'Thumb Color', default: '#ffffff', category: 'style' },
  ],
};

const SwitchWidget: React.FC<WidgetProps> = ({ config, isEditMode }) => {
  // Phase 44: Config destructuring with defaults
  const {
    label = 'Switch',
    labelPosition = 'left',
    entity_id,
    onColor = '#4caf50',
    offColor = '#757575',
    textColor = '#ffffff',
    fontFamily = 'Arial, sans-serif',
    fontSize = 14,
    fontWeight = '500',
    thumbColor = '#ffffff',
    visibilityCondition,
  } = config.config;

  const isVisible = useVisibility(visibilityCondition);
  const universalStyle = useResolvedUniversalStyle(config.config.style || config.config as any);

  // Use useWidget hook for entity subscriptions
  const { getEntityState } = useWidget(config);

  // Get switch state from entity — will be undefined when not connected to HA
  const entityStateValue = getEntityState('entity_id');
  const isOn = entityStateValue ? String(entityStateValue).toLowerCase() === 'on' : false;

  const handleToggle = async () => {
    if (isEditMode) return;

    if (entity_id) {
      const domain = entity_id.split('.')[0];
      const service_name = isOn ? 'turn_off' : 'turn_on';
      const data = { entity_id };
      console.warn('[Canvas UI] Platform action (not yet connected):', domain, service_name, data);
    }
  };

  // Determine flex direction based on label position
  let flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse' = 'row';
  let justifyContent = 'space-between';
  const alignItems = 'center';

  if (labelPosition === 'right') {
    flexDirection = 'row-reverse';
  } else if (labelPosition === 'top') {
    flexDirection = 'column';
    justifyContent = 'center';
  } else if (labelPosition === 'bottom') {
    flexDirection = 'column-reverse';
    justifyContent = 'center';
  }

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection,
    alignItems,
    justifyContent,
    gap: '8px',
    padding: '8px 12px',
    boxSizing: 'border-box',
    cursor: isEditMode ? 'default' : 'pointer',
    pointerEvents: isEditMode ? 'none' : 'auto',
  };

  const labelStyle: React.CSSProperties = {
    color: textColor,
    fontFamily: fontFamily,
    fontSize: `${fontSize}px`,
    fontWeight: fontWeight,
    flex: labelPosition === 'left' || labelPosition === 'right' ? 1 : 0,
    textAlign: labelPosition === 'top' || labelPosition === 'bottom' ? 'center' : 'left',
  };

  const switchTrackStyle: React.CSSProperties = {
    width: '50px',
    height: '26px',
    backgroundColor: isOn ? onColor : offColor,
    borderRadius: '13px',
    position: 'relative',
    transition: 'background-color 0.2s ease',
    flexShrink: 0,
  };

  const switchThumbStyle: React.CSSProperties = {
    width: '22px',
    height: '22px',
    backgroundColor: thumbColor,
    borderRadius: '50%',
    position: 'absolute',
    top: '2px',
    left: isOn ? '26px' : '2px',
    transition: 'left 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
  };

  // Apply universal styles
  const finalStyle = applyUniversalStyles(universalStyle, containerStyle);

  if (!isVisible) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    handleToggle();
  };

  return (
    <div style={finalStyle} onClick={handleClick}>
      <div style={labelStyle}>{label}</div>
      <div style={switchTrackStyle}>
        <div style={switchThumbStyle}></div>
      </div>
    </div>
  );
};

export default SwitchWidget;
