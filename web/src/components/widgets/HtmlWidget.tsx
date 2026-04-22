/**
 * HTML Widget - Display custom HTML content
 * Migrated to Phase 44 standards (Feb 15, 2026)
 */

import React, { useEffect, useRef } from 'react';
import type { WidgetProps } from '../../types';
import type { WidgetMetadata } from './metadata';
import { applyUniversalStyles } from '../utils/styleBuilder';
import { useResolvedUniversalStyle } from '../../hooks/useResolvedUniversalStyle';
import { useVisibility } from '../../hooks/useVisibility';

const HtmlWidget: React.FC<WidgetProps> = ({ config }) => {
  // Phase 44: Config destructuring with defaults
  const {
    html: htmlContent = '<div>Enter HTML here</div>',
    backgroundColor = 'transparent',
    padding = 8,
    overflow = 'auto',
  } = config.config;

  const universalStyle = useResolvedUniversalStyle(config.config.style || config.config as any);
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useVisibility(config.config.visibilityCondition);

  // Get HTML from entity attribute, entity state, or static config
  const getHtml = (): string => {
    // Data-source binding can be added here via dataValues prop
    return htmlContent;
  };

  // Update HTML content
  useEffect(() => {
    if (containerRef.current) {
      const html = getHtml();
      containerRef.current.innerHTML = html;
    }
  }, [htmlContent]);

  const baseStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor,
    padding: `${padding}px`,
    overflow,
    boxSizing: 'border-box',
  };
  const finalStyle = applyUniversalStyles(universalStyle, baseStyle);

  if (!isVisible) return null;

  return (
    <div
      ref={containerRef}
      style={finalStyle}
    />
  );
};

export const htmlWidgetMetadata: WidgetMetadata = {
  name: 'HTML',
  description: 'Display custom HTML content',
  icon: 'CodeOutlined',
  category: 'display',
  defaultSize: { w: 400, h: 300 },
  fields: [
    // Layout
    { name: 'width', type: 'number', label: 'Width', default: 400, min: 100, category: 'layout' },
    { name: 'height', type: 'number', label: 'Height', default: 300, min: 100, category: 'layout' },

    // Behavior
    { 
      name: 'useEntityHtml', 
      type: 'checkbox', 
      label: 'Use Entity HTML', 
      default: false, 
      category: 'behavior',
      description: 'Use entity state as HTML instead of static HTML'
    },
    { 
      name: 'htmlEntity', 
      type: 'entity', 
      label: 'HTML Entity', 
      default: '', 
      category: 'behavior',
      description: 'Entity whose state or attribute contains the HTML'
    },
    { 
      name: 'htmlAttribute', 
      type: 'text', 
      label: 'HTML Attribute', 
      default: '', 
      category: 'behavior',
      description: 'Entity attribute name containing HTML (bypasses 255-char state limit). Leave blank to use state.'
    },
    { 
      name: 'html', 
      type: 'textarea', 
      label: 'HTML Content', 
      default: '<div>Enter HTML here</div>', 
      category: 'behavior',
      description: 'Custom HTML content'
    },
    { 
      name: 'overflow', 
      type: 'select', 
      label: 'Overflow', 
      default: 'auto', 
      category: 'behavior',
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'hidden', label: 'Hidden' },
        { value: 'scroll', label: 'Scroll' },
        { value: 'visible', label: 'Visible' }
      ]
    },

    // Style
    { name: 'backgroundColor', type: 'color', label: 'Background Color', default: 'transparent', category: 'style' },
    { name: 'padding', type: 'number', label: 'Padding', default: 8, min: 0, max: 50, category: 'style' },
  ],
};

export default HtmlWidget;
