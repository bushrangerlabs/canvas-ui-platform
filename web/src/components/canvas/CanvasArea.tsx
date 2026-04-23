/**
 * CanvasArea — editor canvas with widget drag, resize, selection, and zoom.
 * Supports multi-select (Shift+click, rubber-band), copy/paste, keyboard shortcuts.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';
import { useEditorStore } from '../../store';
import WidgetRenderer from '../widgets/WidgetRenderer';
import type { WidgetConfig } from '../../types';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const MIN_SIZE = 20;

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

// Multi-drag: track all selected widgets' original positions together
interface MultiDragState {
  startClientX: number;
  startClientY: number;
  origPositions: Record<string, { x: number; y: number }>;
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

// Rubber-band selection in canvas-space coordinates
interface RubberBand {
  startCX: number;
  startCY: number;
  curCX: number;
  curCY: number;
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
  const {
    activeView,
    selectedWidgetIds,
    selectWidget,
    toggleWidgetSelection,
    selectAllWidgets,
    clearSelection,
    copySelected,
    pasteClipboard,
    deleteSelected,
    duplicateSelected,
    updateWidget,
    snapEnabled,
    snapSize,
    pushHistorySnapshot,
  } = useEditorStore();

  const snap = (v: number) => snapEnabled ? Math.round(v / snapSize) * snapSize : Math.round(v);

  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [rubberBand, setRubberBand] = useState<RubberBand | null>(null);

  const multiDragRef = useRef<MultiDragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const panDragRef = useRef<{ startX: number; startY: number; origPan: { x: number; y: number } } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stable refs for values used inside non-React event handlers
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;
  const selectedWidgetIdsRef = useRef(selectedWidgetIds);
  selectedWidgetIdsRef.current = selectedWidgetIds;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { cx: 0, cy: 0 };
    return {
      cx: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      cy: (clientY - rect.top - panRef.current.y) / zoomRef.current,
    };
  }, []);

  // ── Auto-fit ───────────────────────────────────────────────────────────────

  const fitToContainer = useCallback(() => {
    const el = containerRef.current;
    const view = activeViewRef.current;
    if (!el || !view) return;
    const { width, height } = el.getBoundingClientRect();
    const szx = view.sizex ?? 1920;
    const szy = view.sizey ?? 1080;
    const padding = 40;
    const fitZoom = Math.min((width - padding * 2) / szx, (height - padding * 2) / szy, MAX_ZOOM);
    const clamped = Math.max(MIN_ZOOM, parseFloat(fitZoom.toFixed(2)));
    setZoom(clamped);
    const scaledW = szx * clamped;
    const scaledH = szy * clamped;
    setPan({
      x: Math.max(padding, (width - scaledW) / 2),
      y: Math.max(padding, (height - scaledH) / 2),
    });
  }, []);

  useEffect(() => { fitToContainer(); }, [activeView?.id, fitToContainer]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fitToContainer());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToContainer]);

  // ── Zoom via Ctrl+wheel ────────────────────────────────────────────────────

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

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'a') { e.preventDefault(); selectAllWidgets(); }
      else if (ctrl && e.key === 'c') { e.preventDefault(); copySelected(); }
      else if (ctrl && e.key === 'v') { e.preventDefault(); pasteClipboard(); }
      else if (ctrl && e.key === 'd') { e.preventDefault(); duplicateSelected(); }
      else if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); useEditorStore.getState().undo(); }
      else if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); useEditorStore.getState().redo(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWidgetIdsRef.current.length > 0) {
        e.preventDefault();
        deleteSelected();
      }
      else if (e.key === 'Escape') { clearSelection(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectAllWidgets, copySelected, pasteClipboard, duplicateSelected, deleteSelected, clearSelection]);

  // ── Widget mouse down ──────────────────────────────────────────────────────

  const onWidgetMouseDown = (e: React.MouseEvent, widget: WidgetConfig) => {
    e.stopPropagation();

    // Locked widgets can still be selected (click) but not dragged
    if (widget.locked) {
      if (e.shiftKey) toggleWidgetSelection(widget.id);
      else selectWidget(widget.id);
      return;
    }

    if (e.shiftKey) {
      toggleWidgetSelection(widget.id);
      return;
    }

    // If not in selection, clear and select just this widget
    if (!selectedWidgetIdsRef.current.includes(widget.id)) {
      selectWidget(widget.id);
    }

    // Build origPositions snapshot for all currently selected widgets
    const ids = selectedWidgetIdsRef.current.includes(widget.id)
      ? selectedWidgetIdsRef.current
      : [widget.id];

    const view = activeViewRef.current;
    if (!view) return;

    const origPositions: Record<string, { x: number; y: number }> = {};
    for (const wid of ids) {
      const w = view.widgets.find((ww) => ww.id === wid);
      if (w) origPositions[wid] = { x: w.position.x, y: w.position.y };
    }

    pushHistorySnapshot();
    multiDragRef.current = { startClientX: e.clientX, startClientY: e.clientY, origPositions };
  };

  // ── Resize mouse down ──────────────────────────────────────────────────────

  const onResizeMouseDown = (e: React.MouseEvent, widget: WidgetConfig, handle: ResizeHandle) => {
    e.stopPropagation();
    e.preventDefault();
    if (widget.locked) return;
    pushHistorySnapshot();
    resizeRef.current = {
      widgetId: widget.id, handle,
      startX: e.clientX, startY: e.clientY,
      origX: widget.position.x, origY: widget.position.y,
      origW: widget.position.width, origH: widget.position.height,
    };
  };

  // ── Mouse move ─────────────────────────────────────────────────────────────

  const onMouseMove = (e: React.MouseEvent) => {
    if (multiDragRef.current) {
      const md = multiDragRef.current;
      const dx = (e.clientX - md.startClientX) / zoom;
      const dy = (e.clientY - md.startClientY) / zoom;
      const view = activeViewRef.current;
      if (!view) return;
      for (const [wid, orig] of Object.entries(md.origPositions)) {
        const w = view.widgets.find((ww) => ww.id === wid);
        if (w) updateWidget(wid, { position: { ...w.position, x: snap(orig.x + dx), y: snap(orig.y + dy) } });
      }
    }

    if (resizeRef.current) {
      const r = resizeRef.current;
      const dx = (e.clientX - r.startX) / zoom;
      const dy = (e.clientY - r.startY) / zoom;
      let { origX: x, origY: y, origW: w, origH: h } = r;
      if (r.handle.includes('e')) w = Math.max(MIN_SIZE, snap(r.origW + dx));
      if (r.handle.includes('s')) h = Math.max(MIN_SIZE, snap(r.origH + dy));
      if (r.handle.includes('w')) { const nw = Math.max(MIN_SIZE, snap(r.origW - dx)); x = snap(r.origX + r.origW - nw); w = nw; }
      if (r.handle.includes('n')) { const nh = Math.max(MIN_SIZE, snap(r.origH - dy)); y = snap(r.origY + r.origH - nh); h = nh; }
      const orig = activeViewRef.current?.widgets.find((ww) => ww.id === r.widgetId);
      if (orig) updateWidget(r.widgetId, { position: { ...orig.position, x, y, width: w, height: h } });
    }

    if (panDragRef.current) {
      setPan({
        x: panDragRef.current.origPan.x + (e.clientX - panDragRef.current.startX),
        y: panDragRef.current.origPan.y + (e.clientY - panDragRef.current.startY),
      });
    }

    if (rubberBand) {
      const { cx, cy } = clientToCanvas(e.clientX, e.clientY);
      setRubberBand((rb) => rb ? { ...rb, curCX: cx, curCY: cy } : null);
    }
  };

  // ── Mouse up — commit rubber-band ──────────────────────────────────────────

  const onMouseUp = (e: React.MouseEvent) => {
    if (rubberBand) {
      const rb = rubberBand;
      const minX = Math.min(rb.startCX, rb.curCX);
      const maxX = Math.max(rb.startCX, rb.curCX);
      const minY = Math.min(rb.startCY, rb.curCY);
      const maxY = Math.max(rb.startCY, rb.curCY);

      if (maxX - minX > 4 || maxY - minY > 4) {
        const view = activeViewRef.current;
        if (view) {
          const hit = view.widgets
            .filter((w) => w.position.x < maxX && w.position.x + w.position.width > minX &&
                           w.position.y < maxY && w.position.y + w.position.height > minY)
            .map((w) => w.id);
          if (hit.length > 0) {
            const merged = e.shiftKey ? Array.from(new Set([...selectedWidgetIdsRef.current, ...hit])) : hit;
            useEditorStore.setState({ selectedWidgetIds: merged });
          } else if (!e.shiftKey) {
            clearSelection();
          }
        }
      }
      setRubberBand(null);
    }

    multiDragRef.current = null;
    resizeRef.current = null;
    panDragRef.current = null;
  };

  // ── Canvas background click — deselect / pan / rubber-band ────────────────

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey) {
      panDragRef.current = { startX: e.clientX, startY: e.clientY, origPan: { ...pan } };
      return;
    }
    if (!e.shiftKey) clearSelection();
    const { cx, cy } = clientToCanvas(e.clientX, e.clientY);
    setRubberBand({ startCX: cx, startCY: cy, curCX: cx, curCY: cy });
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

  // Rubber-band rect in screen-space for the overlay
  const rbScreen = rubberBand ? (() => {
    const l = Math.min(rubberBand.startCX, rubberBand.curCX) * zoom + pan.x;
    const t = Math.min(rubberBand.startCY, rubberBand.curCY) * zoom + pan.y;
    const w = Math.abs(rubberBand.curCX - rubberBand.startCX) * zoom;
    const h = Math.abs(rubberBand.curCY - rubberBand.startCY) * zoom;
    return { left: l, top: t, width: w, height: h };
  })() : null;

  const soleSelectedId = selectedWidgetIds.length === 1 ? selectedWidgetIds[0] : null;

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        overflow: 'hidden',
        bgcolor: '#0a0a18',
        position: 'relative',
        cursor: panDragRef.current ? 'grabbing' : rubberBand ? 'crosshair' : 'default',
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
        {/* Canvas */}
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
            const selected = selectedWidgetIds.includes(w.id);
            const soleSelected = w.id === soleSelectedId;
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
                  outline: selected
                    ? selectedWidgetIds.length > 1 ? '2px dashed #6c63ff' : '2px solid #6c63ff'
                    : '1px solid transparent',
                  cursor: w.locked ? 'default' : 'move',
                  boxSizing: 'border-box',
                }}
              >
                <WidgetRenderer config={w} isEditMode={true} />

                {w.hiddenInEdit && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                  }}>
                    <VisibilityOffIcon sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 20 }} />
                  </div>
                )}

                {w.locked && (
                  <div style={{
                    position: 'absolute', top: 2, right: 2,
                    pointerEvents: 'none',
                  }}>
                    <LockIcon sx={{ color: 'rgba(255,200,0,0.85)', fontSize: 13 }} />
                  </div>
                )}

                {/* Resize handles — sole selection only */}
                {soleSelected && HANDLE_DEFS.map(({ handle, cursor, style: hs }) => (
                  <div
                    key={handle}
                    onMouseDown={(e) => onResizeMouseDown(e, w, handle)}
                    style={{
                      position: 'absolute', width: 8, height: 8,
                      background: '#6c63ff', border: '1px solid #fff',
                      borderRadius: 1, cursor, zIndex: 1000, ...hs,
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Rubber-band rect */}
      {rbScreen && (
        <div style={{
          position: 'absolute',
          left: rbScreen.left, top: rbScreen.top,
          width: rbScreen.width, height: rbScreen.height,
          border: '1px solid #6c63ff',
          background: 'rgba(108,99,255,0.1)',
          pointerEvents: 'none',
          zIndex: 2000,
          boxSizing: 'border-box',
        }} />
      )}

      {/* Multi-select badge */}
      {selectedWidgetIds.length > 1 && (
        <Box sx={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          bgcolor: 'rgba(108,99,255,0.85)', color: '#fff',
          px: 1.5, py: 0.5, borderRadius: 1, fontSize: 12,
          fontFamily: 'monospace', pointerEvents: 'none', zIndex: 2000,
        }}>
          {selectedWidgetIds.length} widgets selected · Ctrl+C/D · Delete
        </Box>
      )}

      {/* Zoom indicator */}
      <Box sx={{
        position: 'absolute', bottom: 12, right: 12,
        bgcolor: 'rgba(0,0,0,0.5)', color: 'text.secondary',
        px: 1, py: 0.5, borderRadius: 1, fontSize: 11, fontFamily: 'monospace',
      }}>
        {Math.round(zoom * 100)}% | {sizex}×{sizey}
      </Box>
    </Box>
  );
}
