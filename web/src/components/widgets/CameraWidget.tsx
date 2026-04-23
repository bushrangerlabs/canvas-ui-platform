/**
 * Camera Widget — displays a live snapshot from an HA camera entity.
 * Polls /api/ha/camera_proxy/<entity_id> at a configurable interval.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useVisibility } from '../../hooks/useVisibility';
import { useWidget } from '../hooks/useWidget';
import type { WidgetProps } from '../../types';
import type { WidgetMetadata } from './metadata';
import { getApiBase } from '../../api/client';
import { applyUniversalStyles } from '../utils/styleBuilder';
import { useResolvedUniversalStyle } from '../../hooks/useResolvedUniversalStyle';

export const CameraWidgetMetadata: WidgetMetadata = {
  name: 'Camera',
  icon: 'Videocam',
  category: 'media',
  description: 'Display a live snapshot from an HA camera entity',
  defaultSize: { w: 320, h: 240 },
  minSize: { w: 160, h: 120 },
  requiresEntity: true,
  fields: [
    // Layout
    { name: 'width', type: 'number', label: 'Width', default: 320, min: 160, category: 'layout' },
    { name: 'height', type: 'number', label: 'Height', default: 240, min: 120, category: 'layout' },
    // Behavior
    {
      name: 'entity_id',
      type: 'entity',
      label: 'Camera Entity',
      default: '',
      category: 'behavior',
      domains: ['camera'],
      description: 'HA camera entity to display',
    },
    {
      name: 'refreshInterval',
      type: 'number',
      label: 'Refresh Interval (ms)',
      default: 2000,
      min: 500,
      max: 60000,
      step: 500,
      category: 'behavior',
      description: 'How often to fetch a new frame',
    },
    {
      name: 'showOverlay',
      type: 'checkbox',
      label: 'Show Entity Name Overlay',
      default: false,
      category: 'behavior',
    },
    // Style
    {
      name: 'objectFit',
      type: 'select',
      label: 'Object Fit',
      default: 'cover',
      category: 'style',
      options: [
        { value: 'contain', label: 'Contain' },
        { value: 'cover', label: 'Cover' },
        { value: 'fill', label: 'Fill' },
      ],
    },
    {
      name: 'overlayBackground',
      type: 'color',
      label: 'Overlay Background',
      default: 'rgba(0,0,0,0.5)',
      category: 'style',
      visibleWhen: { field: 'showOverlay', value: true },
    },
    {
      name: 'overlayColor',
      type: 'color',
      label: 'Overlay Text Color',
      default: '#ffffff',
      category: 'style',
      visibleWhen: { field: 'showOverlay', value: true },
    },
  ],
};

const CameraWidget: React.FC<WidgetProps> = ({ config }) => {
  const {
    entity_id = '',
    refreshInterval = 2000,
    showOverlay = false,
    objectFit = 'cover',
    overlayBackground = 'rgba(0,0,0,0.5)',
    overlayColor = '#ffffff',
    style,
  } = config.config;

  const isVisible = useVisibility(config.config.visibilityCondition);
  const { getEntity } = useWidget(config);
  const entity = getEntity('entity_id');

  const [imgSrc, setImgSrc] = useState<string>('');
  const [error, setError] = useState<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!entity_id) {
      setImgSrc('');
      setError('No camera entity configured');
      return;
    }

    setError('');

    const fetchFrame = () => {
      const base = getApiBase();
      // Bust cache so img always reloads the latest frame
      const ts = Date.now();
      setImgSrc(`${base}/api/ha/camera_proxy/${entity_id}?t=${ts}`);
    };

    fetchFrame();

    intervalRef.current = setInterval(fetchFrame, Math.max(500, refreshInterval));
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [entity_id, refreshInterval]);

  const resolvedStyle = useResolvedUniversalStyle(style);
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000',
  };
  const finalStyle = applyUniversalStyles(resolvedStyle, containerStyle);

  const entityName = entity?.attributes?.friendly_name ?? entity_id;

  if (!isVisible) return null;

  return (
    <div style={finalStyle}>
      {imgSrc && !error ? (
        <img
          src={imgSrc}
          alt={entityName}
          style={{ width: '100%', height: '100%', objectFit: objectFit as React.CSSProperties['objectFit'], display: 'block' }}
          onError={() => setError('Failed to load camera image')}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#666', fontSize: 13, textAlign: 'center', padding: 8,
          boxSizing: 'border-box',
        }}>
          {error || 'Loading camera…'}
        </div>
      )}

      {showOverlay && entity_id && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '4px 8px',
          background: overlayBackground,
          color: overlayColor,
          fontSize: 12,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {entityName}
        </div>
      )}
    </div>
  );
};

export default CameraWidget;
