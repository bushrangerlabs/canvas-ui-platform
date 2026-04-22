/**
 * CanvasArea — editor canvas with widget drag, selection, and zoom.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useEditorStore } from '../../store';
import WidgetRenderer from '../widgets/WidgetRenderer';
import type { WidgetConfig } from '../../types';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;

interface DragState {
  widgetId: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

export default function CanvasArea() {
  const { activeView, selectedWidgetId, selectWidget, updateWidget } = useEditorStore();
  const [zoom, setZoom] = useState(0.7);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const dragRef = useRef<DragState | null>(null);
  const panDragRef = useRef<{ startX: number; startY: number; origPan: { x: number; y: number } } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.001)));
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Widget drag ────────────────────────────────────────────────────────────
  const onWidgetMouseDown = (e: React.MouseEvent, widget: WidgetConfig) => {
    e.stopPropagation();
    selectWidget(widget.id);
    dragRef.current = {
      widgetId: widget.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: widget.position.x,
      origY: widget.position.y,
    };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current) {
      const dx = (e.clientX - dragRef.current.startX) / zoom;
      const dy = (e.clientY - dragRef.current.startY) / zoom;
      updateWidget(dragRef.current.widgetId, {
        position: {
          ...activeView!.widgets.find((w) => w.id === dragRef.current!.widgetId)!.position,
          x: Math.round(dragRef.current.origX + dx),
          y: Math.round(dragRef.current.origY + dy),
        },
      });
    }
    if (panDragRef.current) {
      const dx = e.clientX - panDragRef.current.startX;
      const dy = e.clientY - panDragRef.current.startY;
      setPan({ x: panDragRef.current.origPan.x + dx, y: panDragRef.current.origPan.y + dy });
    }
  };

  const onMouseUp = () => {
    dragRef.current = null;
    panDragRef.current = null;
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    selectWidget(null);
    if (e.button === 1 || e.altKey) {
      panDragRef.current = { startX: e.clientX, startY: e.clientY, origPan: { ...pan } };
    }
  };

  if (!activeView) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0a0a18',
        }}
      >
        <Typography color="text.secondary">
          Select or create a view in the sidebar to start editing.
        </Typography>
      </Box>
    );
  }

  const { sizex = 1920, sizey = 1080, style, widgets } = activeView;

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        overflow: 'hidden',
        bgcolor: '#0a0a18',
        position: 'relative',
        cursor: panDragRef.current ? 'grabbing' : 'default',
        userSelect: 'none',
      }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onMouseDown={onCanvasMouseDown}
    >
      {/* Zoom/pan container */}
      <div
        style={{
          position: 'absolute',
          transformOrigin: '0 0',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* Canvas background */}
        <div
          style={{
            position: 'relative',
            width: sizex,
            height: sizey,
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImage ? `url(${style.backgroundImage})` : undefined,
            backgroundSize: 'cover',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          }}
        >
          {widgets.map((w) => {
            const selected = w.id === selectedWidgetId;
            return (
              <div
                key={w.id}
                onMouseDown={(e) => onWidgetMouseDown(e, w)}
                style={{
                  position: 'absolute',
                  left: w.position.x,
                  top: w.position.y,
                  width: w.position.width,
                  height: w.position.height,
                  zIndex: selected ? 999 : (w.position.zIndex ?? 1),
                  outline: selected ? '2px solid #6c63ff' : '1px solid transparent',
                  cursor: 'move',
                  boxSizing: 'border-box',
                }}
              >
                <WidgetRenderer config={w} isEditMode={true} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Zoom indicator */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          bgcolor: 'rgba(0,0,0,0.5)',
          color: 'text.secondary',
          px: 1,
          py: 0.5,
          borderRadius: 1,
          fontSize: 11,
          fontFamily: 'monospace',
        }}
      >
        {Math.round(zoom * 100)}% | {sizex}×{sizey}
      </Box>
    </Box>
  );
}
