/**
 * Knob Widget - Custom SVG-based rotary control
 * Full custom implementation with complete control over all elements
 * Migrated to Phase 44 standards (Feb 15, 2026)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEntityBinding } from '../../hooks/useEntityBinding';
import { useVisibility } from '../../hooks/useVisibility';
import { useWidgetRuntimeStore } from '../stores/widgetRuntimeStore';
import type { WidgetProps } from '../../types';
import type { WidgetMetadata } from './metadata';
import { applyUniversalStyles } from '../utils/styleBuilder';
import { useResolvedUniversalStyle } from '../../hooks/useResolvedUniversalStyle';

export const KnobWidgetMetadata: WidgetMetadata = {
  name: 'Knob',
  icon: 'DialpadOutlined',
  category: 'control',
  description: 'Custom SVG rotary control with full marker customization',
  defaultSize: { w: 150, h: 150 },
  minSize: { w: 80, h: 80 },
  requiresEntity: false,
  fields: [
    // Layout
    { name: 'x', type: 'number', label: 'X Position', default: 0, category: 'layout' },
    { name: 'y', type: 'number', label: 'Y Position', default: 0, category: 'layout' },
    { name: 'width', type: 'number', label: 'Width', default: 150, min: 80, category: 'layout' },
    { name: 'height', type: 'number', label: 'Height', default: 150, min: 80, category: 'layout' },

    // Behavior
    { name: 'label', type: 'text', label: 'Label', default: 'Knob', category: 'behavior' },
    { name: 'entity_id', type: 'entity', label: 'Entity ID', default: '', category: 'behavior', description: 'Entity to control' },
    { name: 'min', type: 'number', label: 'Minimum Value', default: 0, category: 'behavior' },
    { name: 'max', type: 'number', label: 'Maximum Value', default: 100, category: 'behavior' },
    { name: 'step', type: 'number', label: 'Step', default: 1, category: 'behavior' },
    { name: 'dialStep', type: 'number', label: 'Dial Step (number spacing)', default: 10, category: 'behavior', description: 'Step for dial numbers (e.g., 10 shows 0, 10, 20...)' },
    { name: 'value', type: 'number', label: 'Initial Value', default: 50, category: 'behavior', description: 'Can use {entity.state} for dynamic value' },
    { name: 'showValue', type: 'select', label: 'Show Value', default: 'true', category: 'behavior', description: 'Display value in center', options: [
      { value: 'true', label: 'Show' },
      { value: 'false', label: 'Hide' },
    ]},
    { name: 'valuePrefix', type: 'text', label: 'Value Prefix', default: '', category: 'behavior', description: 'Text before value (e.g., "$")' },
    { name: 'valueSuffix', type: 'text', label: 'Value Suffix', default: '', category: 'behavior', description: 'Text after value (e.g., "%", "°C")' },
    { name: 'angleOffset', type: 'number', label: 'Angle Offset (°)', default: 220, min: 0, max: 360, category: 'behavior', description: 'Starting angle of the scale' },
    { name: 'angleRange', type: 'number', label: 'Angle Range (°)', default: 280, min: 0, max: 360, category: 'behavior', description: 'Range of rotation' },

    // Style
    { name: 'skin', type: 'select', label: 'Knob Style', default: 'p1', category: 'style', options: [
      { value: 'p1', label: 'P1 - Circle with Dial' },
      { value: 'p2', label: 'P2 - Arc with Pointer' },
      { value: 'p3', label: 'P3 - Arc Only' },
      { value: 'p4', label: 'P4 - Circle with Ticks' },
      { value: 'p5', label: 'P5 - Arc Pointer' },
    ]},
    { name: 'contentScale', type: 'number', label: 'Content Scale (%)', default: 100, min: 20, max: 150, category: 'style', description: 'Scale knob content within bounds (100 = full size)' },
    { name: 'knobColor', type: 'color', label: 'Knob Color', default: '#2196f3', category: 'style' },
    { name: 'textColor', type: 'color', label: 'Text Color', default: '#ffffff', category: 'style' },
    { name: 'accentColor', type: 'color', label: 'Accent Color', default: '#1976d2', category: 'style' },

    // Position Marker
    { name: 'scalePadding', type: 'number', label: 'Scale Padding (%)', default: 8, min: 0, max: 30, category: 'style', description: 'Distance between knob edge and surrounding numbers/ticks (% of knob size)' },
    { name: 'markerType', type: 'select', label: 'Marker Type', default: 'triangle', category: 'style', options: [
      { value: 'triangle', label: 'Triangle' },
      { value: 'rect', label: 'Rectangle Block' },
      { value: 'dot', label: 'Dot (Circle)' },
      { value: 'none', label: 'None (Hidden)' },
    ]},
    { name: 'markerWidth', type: 'number', label: 'Marker Size', default: 12, min: 4, max: 50, category: 'style' },
    { name: 'markerColor', type: 'color', label: 'Marker Color', default: '#ffeb3b', category: 'style' },
  ],
};

const KnobWidget: React.FC<WidgetProps> = ({ config, isEditMode }) => {
  const { setWidgetState } = useWidgetRuntimeStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentValue, setCurrentValue] = useState(50);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase 44: Config destructuring with defaults
  const {
    min = 0,
    max = 100,
    step = 1,
    dialStep = 10,
    showValue: showValueConfig = 'true',
    valuePrefix = '',
    valueSuffix = '',
    angleOffset = 220,
    angleRange = 280,
    skin = 'p1',
    contentScale = 100,
    knobColor = '#2196f3',
    textColor = '#ffffff',
    accentColor = '#1976d2',
    scalePadding = 8,
    markerType: rawMarkerType = 'triangle',
    markerWidth = 12,
    markerColor = '#ffeb3b',
    entity_id = '',
    value: valueConfig,
    visibilityCondition,
  } = config.config;

  const showValue = showValueConfig !== 'false';
  const universalStyle = useResolvedUniversalStyle(config.config.style || config.config as any);
  const markerType = rawMarkerType === 'auto' ? 'triangle' : rawMarkerType;

  // Apply content scale to size
  const baseSize = Math.min(config.position.width, config.position.height);
  const size = baseSize * (contentScale / 100);
  const paddingRatio = skin === 'p4' ? 0.15 : 0.15;
  const radius = (size / 2) - (size * paddingRatio);
  const center = size / 2;

  // Use entity binding for value — no entity state in platform, falls back to config default
  const boundValue = useEntityBinding(valueConfig, undefined);
  const numericValue = typeof boundValue === 'number' ? boundValue : parseFloat(String(boundValue)) || valueConfig || 50;

  useEffect(() => {
    setCurrentValue(numericValue);
  }, [numericValue]);

  // Publish runtime state for flow system access
  useEffect(() => {
    setWidgetState(config.id, {
      value: currentValue,
      type: 'knob',
      metadata: { min, max, step, skin, angleOffset, angleRange },
    });
  }, [currentValue, config.id, setWidgetState, min, max, step, skin, angleOffset, angleRange]);

  // Convert value to angle
  const valueToAngle = useCallback((value: number) => {
    const normalized = (value - min) / (max - min);
    return angleOffset + (normalized * angleRange);
  }, [min, max, angleOffset, angleRange]);

  // Convert angle to value
  const angleToValue = useCallback((angle: number) => {
    let angleDiff = angle - angleOffset;
    if (angleDiff < 0) {
      angleDiff += 360;
    }
    let normalized = angleDiff / angleRange;
    normalized = Math.max(0, Math.min(1, normalized));
    const value = min + (normalized * (max - min));
    return Math.round(value / step) * step;
  }, [min, max, angleOffset, angleRange, step]);

  // Handle mouse/touch drag
  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current || !isDragging) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = clientX - rect.left - center;
    const y = clientY - rect.top - center;

    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    const startAngle = angleOffset;
    const endAngle = angleOffset + angleRange;

    if (endAngle > 360) {
      if (angle < startAngle && angle > (endAngle % 360)) {
        const distToStart = Math.abs(angle - startAngle);
        const distToEnd = Math.abs(angle - (endAngle % 360));
        angle = distToStart < distToEnd ? startAngle : endAngle;
      }
    } else {
      if (angle < startAngle || angle > endAngle) {
        const distToStart = Math.abs(angle - startAngle);
        const distToEnd = Math.abs(angle - endAngle);
        angle = distToStart < distToEnd ? startAngle : endAngle;
      }
    }

    const newValue = angleToValue(angle);
    setCurrentValue(newValue);

    // Debounced platform stub for service calls
    if (entity_id) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const domain = entity_id.split('.')[0];
        const serviceData: any = { entity_id };

        if (domain === 'light') {
          serviceData.brightness = Math.round((newValue / 100) * 255);
          console.warn('[Canvas UI] Platform action (not yet connected):', 'light', 'turn_on', serviceData);
        } else if (domain === 'cover') {
          serviceData.position = newValue;
          console.warn('[Canvas UI] Platform action (not yet connected):', 'cover', 'set_cover_position', serviceData);
        } else if (domain === 'climate') {
          serviceData.temperature = newValue;
          console.warn('[Canvas UI] Platform action (not yet connected):', 'climate', 'set_temperature', serviceData);
        } else if (domain === 'input_number') {
          serviceData.value = newValue;
          console.warn('[Canvas UI] Platform action (not yet connected):', 'input_number', 'set_value', serviceData);
        } else if (domain === 'input_text') {
          serviceData.value = String(newValue);
          console.warn('[Canvas UI] Platform action (not yet connected):', 'input_text', 'set_value', serviceData);
        }
      }, 300);
    }
  }, [isDragging, center, angleToValue, entity_id]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleEnd = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleEnd);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging, handlePointerMove]);

  // Generate scale marks (numbers for P1, ticks for P4)
  const scaleMarks = [];
  if (skin === 'p1') {
    const dialSteps = Math.floor((max - min) / dialStep);
    for (let i = 0; i <= dialSteps; i++) {
      const value = min + (i * dialStep);
      const angle = valueToAngle(value);
      const angleRad = (angle - 90) * (Math.PI / 180);
      const textRadius = radius + (size * scalePadding / 100);
      const x = center + Math.cos(angleRad) * textRadius;
      const y = center + Math.sin(angleRad) * textRadius;

      scaleMarks.push(
        <text
          key={i}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textColor}
          fontSize={size * 0.08}
          fontWeight="500"
        >
          {value}
        </text>
      );
    }
  } else if (skin === 'p4') {
    const tickCount = 36;
    const ticksInRange = Math.floor(tickCount * (angleRange / 360));

    for (let i = 0; i <= ticksInRange; i++) {
      const tickAngle = angleOffset + (i / ticksInRange) * angleRange;
      const tickAngleRad = (tickAngle - 90) * (Math.PI / 180);

      const gapSize = size * scalePadding / 100;
      const innerRadius = radius + gapSize;
      const outerRadius = radius + gapSize + (size * 0.08);

      const x1 = center + Math.cos(tickAngleRad) * innerRadius;
      const y1 = center + Math.sin(tickAngleRad) * innerRadius;
      const x2 = center + Math.cos(tickAngleRad) * outerRadius;
      const y2 = center + Math.sin(tickAngleRad) * outerRadius;

      scaleMarks.push(
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={accentColor}
          strokeWidth={2}
        />
      );
    }
  }

  // Current angle for marker
  const currentAngle = valueToAngle(currentValue);
  const currentAngleRad = (currentAngle - 90) * (Math.PI / 180);

  // Render marker based on type
  const renderMarker = () => {
    if (markerType === 'none') return null;

    if (markerType === 'triangle') {
      const tipX = center + Math.cos(currentAngleRad) * radius;
      const tipY = center + Math.sin(currentAngleRad) * radius;
      const baseRadius = radius * 0.6;
      const width = markerWidth / 2;

      const perpAngle = currentAngleRad + Math.PI / 2;
      const base1X = center + Math.cos(currentAngleRad) * baseRadius + Math.cos(perpAngle) * width;
      const base1Y = center + Math.sin(currentAngleRad) * baseRadius + Math.sin(perpAngle) * width;
      const base2X = center + Math.cos(currentAngleRad) * baseRadius - Math.cos(perpAngle) * width;
      const base2Y = center + Math.sin(currentAngleRad) * baseRadius - Math.sin(perpAngle) * width;

      return (
        <polygon
          points={`${tipX},${tipY} ${base1X},${base1Y} ${base2X},${base2Y}`}
          fill={markerColor}
          stroke={markerColor}
        />
      );
    } else if (markerType === 'rect') {
      const height = radius * 0.3;
      const markerRadius = radius - (height / 2);
      const markerX = center + Math.cos(currentAngleRad) * markerRadius;
      const markerY = center + Math.sin(currentAngleRad) * markerRadius;

      return (
        <rect
          x={markerX - markerWidth / 2}
          y={markerY - height / 2}
          width={markerWidth}
          height={height}
          fill={markerColor}
          transform={`rotate(${currentAngle}, ${markerX}, ${markerY})`}
        />
      );
    } else if (markerType === 'dot') {
      const dotRadius = radius - (markerWidth * 1.5);
      const dotX = center + Math.cos(currentAngleRad) * dotRadius;
      const dotY = center + Math.sin(currentAngleRad) * dotRadius;

      return (
        <circle
          cx={dotX}
          cy={dotY}
          r={markerWidth}
          fill={markerColor}
        />
      );
    }

    return null;
  };

  const visibility = useVisibility(visibilityCondition);

  if (!visibility) return null;

  // Render knob body based on selected skin
  const renderKnobBody = () => {
    switch (skin) {
      case 'p1':
        return (
          <>
            <circle cx={center} cy={center} r={radius} fill={knobColor} stroke={accentColor} strokeWidth={2} />
          </>
        );

      case 'p2':
      case 'p3': {
        const arcStartAngle = (angleOffset - 90) * (Math.PI / 180);
        const arcEndAngle = (angleOffset + angleRange - 90) * (Math.PI / 180);
        const arcStartX = center + radius * Math.cos(arcStartAngle);
        const arcStartY = center + radius * Math.sin(arcStartAngle);
        const arcEndX = center + radius * Math.cos(arcEndAngle);
        const arcEndY = center + radius * Math.sin(arcEndAngle);
        const largeArcFlag = angleRange > 180 ? 1 : 0;

        const valueAngle = valueToAngle(currentValue);
        const valueAngleRad = (valueAngle - 90) * (Math.PI / 180);
        const p2ValueArcEndX = center + radius * Math.cos(valueAngleRad);
        const p2ValueArcEndY = center + radius * Math.sin(valueAngleRad);
        const p2ValueArcRange = valueAngle - angleOffset;
        const p2ValueLargeArcFlag = p2ValueArcRange > 180 ? 1 : 0;

        return (
          <>
            <path
              d={`M ${arcStartX} ${arcStartY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${arcEndX} ${arcEndY}`}
              fill="none"
              stroke={accentColor}
              strokeWidth={size / 5}
              strokeLinecap="round"
            />
            <path
              d={`M ${arcStartX} ${arcStartY} A ${radius} ${radius} 0 ${p2ValueLargeArcFlag} 1 ${p2ValueArcEndX} ${p2ValueArcEndY}`}
              fill="none"
              stroke={knobColor}
              strokeWidth={size / 5}
              strokeLinecap="round"
            />
          </>
        );
      }

      case 'p4':
        return (
          <>
            <circle cx={center} cy={center} r={radius} fill={knobColor} stroke={accentColor} strokeWidth={2} />
          </>
        );

      case 'p5': {
        const valueArcAngle = angleOffset + (currentValue - min) / (max - min) * angleRange;
        const valueArcStartAngle = (angleOffset - 90) * (Math.PI / 180);
        const valueArcEndAngle = (valueArcAngle - 90) * (Math.PI / 180);
        const valueArcStartX = center + (radius * 0.7) * Math.cos(valueArcStartAngle);
        const valueArcStartY = center + (radius * 0.7) * Math.sin(valueArcStartAngle);
        const valueArcEndX = center + (radius * 0.7) * Math.cos(valueArcEndAngle);
        const valueArcEndY = center + (radius * 0.7) * Math.sin(valueArcEndAngle);
        const valueArcRange = valueArcAngle - angleOffset;
        const valueLargeArcFlag = valueArcRange > 180 ? 1 : 0;

        return (
          <>
            <circle cx={center} cy={center} r={radius} fill="none" stroke={accentColor} strokeWidth={2} />
            <path
              d={`M ${valueArcStartX} ${valueArcStartY} A ${radius * 0.7} ${radius * 0.7} 0 ${valueLargeArcFlag} 1 ${valueArcEndX} ${valueArcEndY}`}
              fill="none"
              stroke={knobColor}
              strokeWidth={size / 6}
              strokeLinecap="round"
            />
          </>
        );
      }

      default:
        return (
          <>
            <circle cx={center} cy={center} r={radius} fill={knobColor} stroke={accentColor} strokeWidth={2} />
          </>
        );
    }
  };

  return (
    <div
      data-widget-id={config.id}
      style={{
        ...applyUniversalStyles(universalStyle, {}),
        width: '100%',
        height: '100%',
        cursor: isEditMode ? 'move' : 'pointer',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
      }}
    >
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          pointerEvents: isEditMode ? 'none' : 'auto',
          display: 'block',
        }}
        onMouseDown={(e) => {
          if (!isEditMode) {
            setIsDragging(true);
            handlePointerMove(e.clientX, e.clientY);
          }
        }}
        onTouchStart={(e) => {
          if (!isEditMode && e.touches.length > 0) {
            setIsDragging(true);
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
      >
        {/* Knob body - rendered based on selected skin */}
        {renderKnobBody()}

        {/* Scale marks (only show for P1 and P4) */}
        {(skin === 'p1' || skin === 'p4') && scaleMarks}

        {/* Marker (hide for P3 and P5 which use arc as indicator) */}
        {(skin !== 'p3' && skin !== 'p5') && renderMarker()}

        {/* Center value display */}
        {showValue && (
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={textColor}
            fontSize={size * 0.15}
            fontWeight="bold"
          >
            {valuePrefix}{Math.round(currentValue)}{valueSuffix}
          </text>
        )}
      </svg>
    </div>
  );
};

export default KnobWidget;
