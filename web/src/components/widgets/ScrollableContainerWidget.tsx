/**
 * ScrollableContainerWidget
 * A styled scrollable container panel. Other widgets can be layered on top of it
 * using normal canvas positioning. Provides a visible scrollable content area
 * with configurable grid layout, colors, and scroll direction.
 */
import React from 'react';
import type { WidgetProps } from '../../types';

const ScrollableContainerWidget: React.FC<WidgetProps> = ({ config, isEditMode }) => {
  const {
    scrollDirection = 'vertical',
    backgroundColor = 'rgba(255,255,255,0.05)',
    borderColor = 'rgba(255,255,255,0.1)',
    borderWidth = 1,
    borderRadius = 8,
    padding = 8,
    showScrollbar = true,
    label = '',
    labelColor = '#888888',
    labelSize = 12,
  } = config.config;

  const overflowX = scrollDirection === 'horizontal' || scrollDirection === 'both' ? 'auto' : 'hidden';
  const overflowY = scrollDirection === 'vertical' || scrollDirection === 'both' ? 'auto' : 'hidden';

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor,
    border: `${borderWidth}px solid ${borderColor}`,
    borderRadius,
    padding,
    boxSizing: 'border-box',
    overflowX: overflowX as any,
    overflowY: overflowY as any,
    scrollbarWidth: showScrollbar ? 'thin' : 'none',
    position: 'relative',
  };

  return (
    <div style={containerStyle}>
      {isEditMode && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 28, opacity: 0.2 }}>⬜</span>
          <span style={{ color: labelColor, fontSize: labelSize, opacity: 0.5 }}>
            {label || 'Scrollable Container'}
          </span>
          <span style={{ color: '#666', fontSize: 10, opacity: 0.6 }}>
            scroll: {scrollDirection}
          </span>
        </div>
      )}
    </div>
  );
};

export default ScrollableContainerWidget;
