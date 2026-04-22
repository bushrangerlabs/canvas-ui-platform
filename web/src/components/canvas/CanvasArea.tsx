/**
 * CanvasArea — editor canvas with widget drag, resize, selection, and zoom.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useEditorStore } from '../../store';
import WidgetRenderer from '../widgets/WidgetRenderer';
import type { WidgetConfig } from '../../types';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const MIN_SIZE = 20;

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

interface DragState {
  widgetId: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

interface ResizeState {
  widgetId: string;
  handle: ResizeHandle;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
}

const HANDLE_DEFS: { handle: ResizeHandle; cursor: string; style: React.CSSProperties }[] = [
  { handle: 'nw', cursor: 'nw-resize', style: { top: -4, left: -4 } },
  { handle: 'n',  cursor: 'n-resize',  style: { top: -4, left: '50%', transform: 'translateX(-50%)' } },
  { handle: 'ne', cursor: 'ne-resize', style: { top: -4, right: -4 } },
  { handle: 'e',  cursor: 'e-resize',  style: { top: '50%', right: -4, transform: 'translateY(-50%)' } },
  { handle: 'se', cursor: 'se-resize', style: { bottom: -4, right: -4 } },
  { handle: 's',  cursor: 's-resize',  style: { bottom: -4, left: '50%', transform: 'translateX(-50%)' } },
  { handle: 'sw', cursor: 'sw-resize', style: { bottom: -4, left: -4 } },
  { handle: 'w',  cursor: 'w-resize',  style: { top: '50%', left: -4, transform: 'translateY(-50%)' } },
];

export default function CanvasArea() {
  const { activeView, selectedWidgetId, selectWidget, updateWidget } = useEditorStore();
  const [zoom, setZoom] = useState(0.7);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
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

  // ── Resize drag ────────────────────────────────────────────────────────────
  const onResizeMouseDown = (e: React.MouseEvent, widget: WidgetConfig, handle: ResizeHandle) => {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = {
      widgetId: widget.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: widget.position.x,
      origY: widget.position.y,
      origW: widget.position.width,
      origH: widget.position.height,
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

    if (resizeRef.current) {
      const r = resizeRef.current;
      const dx = (e.clientX - r.startX) / zoom;
      const dy = (e.clientY - r.startY) / zoom;
      let { origX: x, origY: y, origW: w, origH: h } = r;

      if (r.handle.includes('e')) w = Math.max(MIN_SIZE, Math.round(r.origW + dx));
      if (r.handle.includes('s')) h = Math.max(MIN_SIZE, Math.round(r.origH + dy));
      if (r.handle.includes('w')) {
        const newW = Math.max(MIN_SIZE, Math.round(r.origW - dx));
        x = Math.round(r.origX + r.origW - newW);
        w = newW;
      }
      if (r.handle.includes('n')) {
        const newH = Math.max(MIN_SIZE, Math.round(r.origH - dy));
        y = Math.round(r.origY + r.origH - newH);
        h = newH;
      }

      const orig = activeView!.widgets.find((ww) => ww.id === r.widgetId)!;
      updateWidget(r.widgetId, {
        position: { ...orig.position, x, y, width: w, height: h },
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
    resizeRef.current = null;
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
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0a0a18' }}>
        <Typography color="text.secondary">
          Select or create a view in the sidebar to start editing.
        </Typography>
      </Box>
    );
  }

  const { sizex = 1920, sizey = 1080, style = { backgroundColor: '#1a1a2e', backgroundOpacity: 1 }, widgets = [] } = activeView;

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

                {/* Resize handles — only on selected widget */}
                {selected && HANDLE_DEFS.map(({ handle, cursor, style: hs }) => (
                  <div
                    key={handle}
                    onMouseDown={(e) => onResizeMouseDown(e, w, handle)}
                    style={{
                      position: 'absolute',
                      width: 8,
                      height: 8,
                      background: '#6c63ff',
                      border: '1px solid #fff',
                      borderRadius: 1,
                      cursor,
                      zIndex: 1000,
                      ...hs,
                    }}
                  />
                ))}
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
