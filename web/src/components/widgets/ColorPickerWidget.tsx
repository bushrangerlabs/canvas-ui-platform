/**
 * Color Picker Widget - Touch-friendly RGB color selection for lights
 */
import CloseIcon from '@mui/icons-material/Close';
import { Dialog, IconButton } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHAEntities } from '../../context/HAEntitiesContext';
import { useVisibility } from '../../hooks/useVisibility';
import type { WidgetProps } from '../../types';
import type { WidgetMetadata } from './metadata';

// ── Color utilities ────────────────────────────────────────────────────────────

const hexToRgb = (hex: string): [number, number, number] => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [255, 255, 255];
};
const rgbToHsv = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s, v };
};
const hsvToRgb = (h: number, s: number, v: number): [number, number, number] => {
  s /= 100; v /= 100;
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};
const toHex = (r: number, g: number, b: number) =>
  `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

const PRESETS = [
  '#FF0000', '#FF8000', '#FFFF00', '#80FF00', '#00FF00', '#00FF80',
  '#00FFFF', '#0080FF', '#0000FF', '#8000FF', '#FF00FF', '#FF0080',
  '#FFFFFF', '#C0C0C0', '#808080', '#404040', '#000000', '#FFC0CB',
];

export const ColorPickerWidgetMetadata: WidgetMetadata = {
  name: 'Color Picker',
  icon: 'Palette',
  category: 'control',
  description: 'Touch-friendly color picker — sends RGB to lights, hex to input_text',
  defaultSize: { w: 80, h: 80 },
  fields: [
    { name: 'width', type: 'number', label: 'Width', default: 80, min: 40, category: 'layout' },
    { name: 'height', type: 'number', label: 'Height', default: 80, min: 40, category: 'layout' },
    { name: 'entity_id', type: 'entity', label: 'Entity', default: '', category: 'behavior' },
    { name: 'swatchWidth', type: 'number', label: 'Swatch Width', default: 60, min: 20, max: 200, category: 'style' },
    { name: 'swatchHeight', type: 'number', label: 'Swatch Height', default: 60, min: 20, max: 200, category: 'style' },
    { name: 'swatchBorderRadius', type: 'number', label: 'Swatch Radius', default: 4, min: 0, max: 50, category: 'style' },
  ],
};

const ColorPickerWidget: React.FC<WidgetProps> = ({ config }) => {
  const {
    entity_id = '',
    swatchWidth = 60,
    swatchHeight = 60,
    swatchBorderRadius = 4,
  } = config.config;

  const { getEntity } = useHAEntities();
  const entity = entity_id ? getEntity(entity_id) : null;
  const isVisible = useVisibility(config.config.visibilityCondition);

  // Derive initial color from entity
  const getEntityColor = (): string | null => {
    if (!entity) return null;
    const rgb = entity.attributes?.rgb_color;
    if (Array.isArray(rgb) && rgb.length >= 3) return toHex(rgb[0], rgb[1], rgb[2]);
    const st = entity.state?.trim();
    if (st && /^#?[0-9A-Fa-f]{6}$/.test(st)) return st.startsWith('#') ? st : `#${st}`;
    return null;
  };

  const initialColor = getEntityColor() ?? '#ff0000';
  const initialHsv = rgbToHsv(...hexToRgb(initialColor));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [hue, setHue] = useState(initialHsv.h);
  const [saturation, setSaturation] = useState(initialHsv.s);
  const [brightness, setBrightness] = useState(initialHsv.v);
  const [localColor, setLocalColor] = useState(initialColor);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync when entity changes
  useEffect(() => {
    const c = getEntityColor();
    if (!c) return;
    setLocalColor(c);
    const hsv = rgbToHsv(...hexToRgb(c));
    setHue(hsv.h); setSaturation(hsv.s); setBrightness(hsv.v);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity?.attributes?.rgb_color, entity?.state]);

  // Draw color wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const radius = Math.min(cx, cy) - 10;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let angle = 0; angle < 360; angle++) {
      const a0 = (angle - 0.5) * Math.PI / 180, a1 = (angle + 0.5) * Math.PI / 180;
      for (let r = 0; r <= radius; r++) {
        const [red, green, blue] = hsvToRgb(angle, (r / radius) * 100, brightness);
        ctx.strokeStyle = toHex(red, green, blue);
        ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
      }
    }
    const ir = (saturation / 100) * radius, ia = hue * Math.PI / 180;
    const px = cx + ir * Math.cos(ia), py = cy + ir * Math.sin(ia);
    ctx.strokeStyle = '#fff'; ctx.fillStyle = localColor; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.stroke();
  }, [hue, saturation, brightness, localColor]);

  const applyHsv = useCallback(async (h: number, s: number, v: number) => {
    const [r, g, b] = hsvToRgb(h, s, v);
    const color = toHex(r, g, b);
    setLocalColor(color);
    if (!entity_id) return;
    const domain = entity_id.split('.')[0];
    const service = domain === 'light' ? 'turn_on' : 'set_value';
    const field = domain === 'light' ? 'rgb_color' : 'value';
    const value = domain === 'light' ? [r, g, b] : color;
    try {
      await fetch(`/api/ha/services/${domain}/${service}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id, [field]: value }),
      });
    } catch (e) { console.warn('[ColorPicker] service call failed:', e); }
  }, [entity_id]);

  const handleCanvas = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dx = clientX - rect.left - canvas.width / 2;
    const dy = clientY - rect.top - canvas.height / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = Math.min(canvas.width, canvas.height) / 2 - 10;
    if (dist <= radius) {
      const newH = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const newS = Math.min(100, (dist / radius) * 100);
      setHue(newH); setSaturation(newS);
      applyHsv(newH, newS, brightness);
    }
  };

  if (!isVisible) return null;

  return (
    <>
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        onClick={() => setDialogOpen(true)}>
        <div style={{ width: swatchWidth, height: swatchHeight, backgroundColor: localColor, borderRadius: swatchBorderRadius }} />
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { style: { backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 16, padding: 20 } } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 20, fontWeight: 'bold' }}>🎨 Pick a Color</span>
          <IconButton onClick={() => setDialogOpen(false)} style={{ color: '#fff' }}><CloseIcon /></IconButton>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <canvas ref={canvasRef} width={280} height={280}
            onClick={(e) => handleCanvas(e.clientX, e.clientY)}
            onTouchMove={(e) => { e.preventDefault(); const t = e.touches[0]; handleCanvas(t.clientX, t.clientY); }}
            style={{ cursor: 'crosshair', touchAction: 'none' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, opacity: 0.8, display: 'block', marginBottom: 6 }}>Brightness: {Math.round(brightness)}%</label>
          <input type="range" min="0" max="100" value={brightness}
            onChange={(e) => { const v = Number(e.target.value); setBrightness(v); applyHsv(hue, saturation, v); }}
            style={{ width: '100%', height: 36, cursor: 'pointer', borderRadius: 8,
              background: `linear-gradient(to right, #000, ${toHex(...hsvToRgb(hue, saturation, 100))})` }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, marginBottom: 20 }}>
          <div style={{ width: 50, height: 50, backgroundColor: localColor, borderRadius: 8, border: '2px solid rgba(255,255,255,0.3)' }} />
          <div>
            <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 18 }}>{localColor.toUpperCase()}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>RGB: {hsvToRgb(hue, saturation, brightness).join(', ')}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 6 }}>
          {PRESETS.map((color) => (
            <div key={color} onClick={() => {
              setLocalColor(color);
              const { h, s, v } = rgbToHsv(...hexToRgb(color));
              setHue(h); setSaturation(s); setBrightness(v);
              applyHsv(h, s, v);
            }} style={{
              paddingBottom: '100%', position: 'relative', backgroundColor: color, borderRadius: 6, cursor: 'pointer',
              border: localColor.toLowerCase() === color.toLowerCase() ? '3px solid #fff' : '2px solid rgba(255,255,255,0.2)',
            }} />
          ))}
        </div>
      </Dialog>
    </>
  );
};

export default ColorPickerWidget;
