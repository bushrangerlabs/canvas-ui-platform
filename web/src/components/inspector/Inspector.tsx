/**
 * Inspector — right-side panel for editing the selected widget or the active view.
 * Tabs: View (view properties) | Widget (widget config when one is selected)
 */
import { useState, useEffect } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary,
  Box, Checkbox, Divider, FormControl, FormControlLabel,
  Button, IconButton, InputLabel, MenuItem, Select, Slider, Tab, Tabs,
  TextField, Tooltip, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AlignHorizontalLeftIcon from '@mui/icons-material/AlignHorizontalLeft';
import AlignHorizontalCenterIcon from '@mui/icons-material/AlignHorizontalCenter';
import AlignHorizontalRightIcon from '@mui/icons-material/AlignHorizontalRight';
import AlignVerticalTopIcon from '@mui/icons-material/AlignVerticalTop';
import AlignVerticalCenterIcon from '@mui/icons-material/AlignVerticalCenter';
import AlignVerticalBottomIcon from '@mui/icons-material/AlignVerticalBottom';
import DistributeHorizontalIcon from '@mui/icons-material/ViewColumn';
import DistributeVerticalIcon from '@mui/icons-material/TableRows';
import { useEditorStore } from '../../store';
import { WIDGET_REGISTRY } from '../widgets/registry';
import type { FieldMetadata } from '../widgets/metadata';
import { HexColorPicker } from 'react-colorful';
import { EntityPickerField } from './EntityPickerField';
import { IconPickerField } from './IconPickerField';
import { VisibilityConditionEditor } from './VisibilityConditionEditor';

// ── Helpers ──────────────────────────────────────────────────────────────────

const RESOLUTION_PRESETS = [
  { label: 'Custom',      value: 'custom' },
  { label: '1920 × 1080', value: '1920x1080' },
  { label: '1280 × 720',  value: '1280x720' },
  { label: '1024 × 768',  value: '1024x768' },
  { label: '800 × 600',   value: '800x600' },
];

const CAT_EXPANDED: Record<string, boolean> = {
  layout: true, style: true, behavior: true, general: true,
};

// ── View tab ─────────────────────────────────────────────────────────────────

function ViewTab() {
  const { activeView, updateViewStyle, updateViewName, updateViewSize } = useEditorStore();

  if (!activeView) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">No view open.</Typography>
      </Box>
    );
  }

  const style = activeView.style ?? { backgroundColor: '#1a1a2e', backgroundOpacity: 1 };
  const resKey = (activeView.sizex ?? 1920) + 'x' + (activeView.sizey ?? 1080);
  const selValue = RESOLUTION_PRESETS.find((p) => p.value === resKey)?.value ?? 'custom';

  function handleResPreset(val: string) {
    if (val === 'custom') return;
    const [w, h] = val.split('x').map(Number);
    updateViewSize(w, h);
  }

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TextField
        label="View Name" size="small" fullWidth
        value={activeView.name ?? ''}
        onChange={(e) => updateViewName(e.target.value)}
      />

      <Divider />
      <Typography variant="caption" color="text.secondary">BACKGROUND</Typography>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <input
          type="color"
          value={style.backgroundColor || '#1a1a2e'}
          onChange={(e) => updateViewStyle({ backgroundColor: e.target.value })}
          style={{ width: 32, height: 32, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 4 }}
        />
        <TextField
          size="small" label="Background Color"
          value={style.backgroundColor || '#1a1a2e'}
          onChange={(e) => updateViewStyle({ backgroundColor: e.target.value })}
          sx={{ flex: 1 }}
        />
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary">
          Opacity: {Math.round((style.backgroundOpacity ?? 1) * 100)}%
        </Typography>
        <Slider
          size="small"
          value={(style.backgroundOpacity ?? 1) * 100}
          min={0} max={100} step={1}
          onChange={(_, v) => updateViewStyle({ backgroundOpacity: (v as number) / 100 })}
        />
      </Box>

      <TextField
        label="Background Image URL" size="small" fullWidth
        value={style.backgroundImage ?? ''}
        onChange={(e) => updateViewStyle({ backgroundImage: e.target.value || undefined })}
        placeholder="https://…"
      />
      {style.backgroundImage && (
        <Box sx={{
          height: 80, borderRadius: 1, backgroundSize: 'cover', backgroundPosition: 'center',
          backgroundImage: `url(${style.backgroundImage})`,
          border: '1px solid', borderColor: 'divider',
        }} />
      )}

      <Divider />
      <Typography variant="caption" color="text.secondary">DIMENSIONS</Typography>

      <FormControl size="small" fullWidth>
        <InputLabel>Resolution Preset</InputLabel>
        <Select value={selValue} label="Resolution Preset" onChange={(e) => handleResPreset(e.target.value)}>
          {RESOLUTION_PRESETS.map((p) => (
            <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <TextField
          label="Width (px)" size="small" type="number"
          value={activeView.sizex ?? 1920}
          onChange={(e) => updateViewSize(Number(e.target.value), activeView.sizey ?? 1080)}
        />
        <TextField
          label="Height (px)" size="small" type="number"
          value={activeView.sizey ?? 1080}
          onChange={(e) => updateViewSize(activeView.sizex ?? 1920, Number(e.target.value))}
        />
      </Box>
    </Box>
  );
}

// ── Widget tab ────────────────────────────────────────────────────────────────

function WidgetTab() {
  const { activeView, selectedWidgetIds, updateWidget, removeWidget, duplicateWidget,
          bringToFront, sendToBack, bringForward, sendBackward,
          deleteSelected, duplicateSelected, alignSelected } = useEditorStore();

  const selectedWidgetId = selectedWidgetIds.length === 1 ? selectedWidgetIds[0] : null;
  const widget = activeView?.widgets.find((w) => w.id === selectedWidgetId);

  // Multi-select panel
  if (selectedWidgetIds.length > 1) {
    const n = selectedWidgetIds.length;
    const align = (d: Parameters<typeof alignSelected>[0]) => alignSelected(d);
    const btnSx = { p: '4px', borderRadius: 1, color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: 'action.hover' } };
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {n} widgets selected
        </Typography>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Align</Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Align left edges"><IconButton sx={btnSx} onClick={() => align('left')}><AlignHorizontalLeftIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Center horizontally"><IconButton sx={btnSx} onClick={() => align('centerX')}><AlignHorizontalCenterIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Align right edges"><IconButton sx={btnSx} onClick={() => align('right')}><AlignHorizontalRightIcon fontSize="small" /></IconButton></Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Tooltip title="Align top edges"><IconButton sx={btnSx} onClick={() => align('top')}><AlignVerticalTopIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Center vertically"><IconButton sx={btnSx} onClick={() => align('centerY')}><AlignVerticalCenterIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Align bottom edges"><IconButton sx={btnSx} onClick={() => align('bottom')}><AlignVerticalBottomIcon fontSize="small" /></IconButton></Tooltip>
          </Box>
        </Box>

        {n >= 3 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Distribute</Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Distribute horizontally"><IconButton sx={btnSx} onClick={() => align('distributeX')}><DistributeHorizontalIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Distribute vertically"><IconButton sx={btnSx} onClick={() => align('distributeY')}><DistributeVerticalIcon fontSize="small" /></IconButton></Tooltip>
            </Box>
          </Box>
        )}

        <Divider />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" sx={{ flex: 1 }} onClick={() => duplicateSelected()}>Duplicate</Button>
          <Button size="small" variant="outlined" color="error" sx={{ flex: 1 }} onClick={() => deleteSelected()}>Delete</Button>
        </Box>
      </Box>
    );
  }
  const meta = widget ? WIDGET_REGISTRY[widget.type] : undefined;

  if (!widget || !meta) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Select a widget on the canvas to edit its properties.
        </Typography>
      </Box>
    );
  }

  function setConfig(key: string, value: any) {
    updateWidget(widget!.id, { config: { ...widget!.config, [key]: value } });
  }

  function setPosition(key: 'x' | 'y' | 'width' | 'height' | 'zIndex', value: number) {
    updateWidget(widget!.id, { position: { ...widget!.position, [key]: value } });
  }

  const categories = Array.from(
    new Set(meta.fields.map((f) => f.category ?? 'general')),
  );

  return (
    <>
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>{meta.name}</Typography>
        <Tooltip title="Duplicate">
          <IconButton size="small" onClick={() => duplicateWidget(widget.id)}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" color="error" onClick={() => removeWidget(widget.id)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />

      {/* Layout accordion */}
      <Accordion defaultExpanded disableGutters square elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', '&::before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}
          sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
          <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>LAYOUT</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 1.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {(['x', 'y', 'width', 'height', 'zIndex'] as const).map((key) => (
              <TextField
                key={key}
                label={key === 'zIndex' ? 'Z-Index' : key.toUpperCase()}
                size="small" type="number"
                value={widget.position[key] ?? 0}
                onChange={(e) => setPosition(key, Number(e.target.value))}
                slotProps={{ htmlInput: { step: 1 } }}
                sx={{ gridColumn: key === 'zIndex' ? '1 / -1' : undefined }}
              />
            ))}
            {/* Z-order quick actions */}
            <Box sx={{ gridColumn: '1 / -1', display: 'flex', gap: 0.5, mt: 0.5 }}>
              <Tooltip title="Send to Back">
                <IconButton size="small" onClick={() => sendToBack(widget.id)}><FlipToBackIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Send Backward">
                <IconButton size="small" onClick={() => sendBackward(widget.id)}><ArrowDownwardIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Bring Forward">
                <IconButton size="small" onClick={() => bringForward(widget.id)}><ArrowUpwardIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Bring to Front">
                <IconButton size="small" onClick={() => bringToFront(widget.id)}><FlipToFrontIcon fontSize="small" /></IconButton>
              </Tooltip>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {categories.map((cat) => {
        if (cat === 'layout') return null;
        const fields = meta.fields.filter(
          (f) => (f.category ?? 'general') === cat && !['width', 'height'].includes(f.name),
        );
        if (fields.length === 0) return null;
        const visibleFields = fields.filter((f) => {
          if (!f.visibleWhen) return true;
          return widget.config[f.visibleWhen.field] === f.visibleWhen.value;
        });
        if (visibleFields.length === 0) return null;

        return (
          <Accordion
            key={cat}
            defaultExpanded={CAT_EXPANDED[cat] ?? true}
            disableGutters square elevation={0}
            sx={{ borderBottom: 1, borderColor: 'divider', '&::before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}
              sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
              <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>
                {cat.toUpperCase()}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 1.5 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {visibleFields.map((field) => renderField(field, widget.config, setConfig))}
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}

      {/* Data Bindings accordion */}
      <Accordion disableGutters square elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', '&::before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}
          sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
          <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>BINDINGS</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 1.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
              Bind widget fields to platform data source values (format: sourceId.key)
            </Typography>
            {Object.entries(widget.bindings ?? {}).map(([field, ref]) => (
              <Box key={field} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <TextField size="small" label="Field" value={field} sx={{ flex: 1 }}
                  onChange={(e) => {
                    const newBindings = { ...widget.bindings };
                    delete newBindings[field];
                    newBindings[e.target.value] = ref;
                    updateWidget(widget.id, { bindings: newBindings });
                  }}
                />
                <TextField size="small" label="sourceId.key" value={ref} sx={{ flex: 2 }}
                  onChange={(e) => {
                    updateWidget(widget.id, { bindings: { ...widget.bindings, [field]: e.target.value } });
                  }}
                />
                <IconButton size="small" color="error"
                  onClick={() => {
                    const newBindings = { ...widget.bindings };
                    delete newBindings[field];
                    updateWidget(widget.id, { bindings: newBindings });
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button size="small" variant="outlined" sx={{ mt: 0.5, fontSize: 11 }}
              onClick={() => {
                const existing = widget.bindings ?? {};
                const newKey = `field_${Object.keys(existing).length + 1}`;
                updateWidget(widget.id, { bindings: { ...existing, [newKey]: '' } });
              }}
            >
              + Add Binding
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Visibility / show-hide accordion */}
      <Accordion disableGutters square elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', '&::before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}
          sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
          <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>VISIBILITY</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 1.5 }}>
          <VisibilityConditionEditor
            value={widget.visibility}
            onChange={(v) => updateWidget(widget.id, { visibility: v })}
            hiddenInEdit={Boolean(widget.hiddenInEdit)}
            onHiddenInEditChange={(v) => updateWidget(widget.id, { hiddenInEdit: v })}
          />
        </AccordionDetails>
      </Accordion>
    </>
  );
}

// ── Color field component ────────────────────────────────────────────────────

function ColorFieldInspector({
  field,
  value,
  onChange,
}: {
  field: FieldMetadata;
  value: string;
  onChange: (v: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const isBinding = /^\{.*\}$/.test(value);

  const isValidColor = (c: string) =>
    /^#([0-9a-f]{3,8})$/i.test(c) ||
    /^(rgb|hsl)a?\(/.test(c) ||
    /^[a-z]+$/i.test(c);

  const swatchColor = !isBinding && isValidColor(value) ? value : null;

  return (
    <Box key={field.name}>
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <TextField
          label={field.label}
          size="small"
          fullWidth
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#rrggbb or {entity.id}"
          slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: 13 } } }}
        />
        <Tooltip title={isBinding ? 'Binding active — clear to use picker' : 'Open color picker'}>
          <span>
            <IconButton
              size="small"
              onClick={() => setShowPicker((p) => !p)}
              disabled={isBinding}
              sx={{
                width: 32,
                height: 32,
                border: '1px solid',
                borderColor: showPicker ? 'primary.main' : 'divider',
                borderRadius: 1,
                p: 0,
                flexShrink: 0,
                overflow: 'hidden',
                bgcolor: swatchColor ?? 'transparent',
                ...(!swatchColor && {
                  backgroundImage:
                    'repeating-linear-gradient(45deg, #555 0px, #555 4px, #333 4px, #333 8px)',
                }),
                '&:hover': { opacity: 0.85 },
                '&.Mui-disabled': { opacity: 0.5, cursor: 'not-allowed' },
              }}
            />
          </span>
        </Tooltip>
        {isBinding && (
          <Tooltip title="Binding expression — will resolve at runtime">
            <Box
              sx={{
                width: 32,
                height: 32,
                flexShrink: 0,
                border: '2px solid',
                borderColor: 'primary.main',
                borderRadius: 1,
                backgroundImage:
                  'repeating-linear-gradient(45deg, #555 0px, #555 4px, #333 4px, #333 8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                userSelect: 'none',
              }}
            >
              🔗
            </Box>
          </Tooltip>
        )}
      </Box>
      {showPicker && !isBinding && (
        <Box sx={{ mt: 1, p: 2, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 3 }}>
          <HexColorPicker
            color={swatchColor?.startsWith('#') ? swatchColor : '#000000'}
            onChange={onChange}
          />
          <Button fullWidth size="small" onClick={() => setShowPicker(false)} sx={{ mt: 1 }}>
            Close
          </Button>
        </Box>
      )}
    </Box>
  );
}

// ── Field renderer ────────────────────────────────────────────────────────────

function renderField(
  field: FieldMetadata,
  config: Record<string, any>,
  setConfig: (key: string, value: any) => void,
): React.ReactNode {
  const value = config[field.name] ?? field.default ?? '';

  switch (field.type) {
    case 'entity':
      return (
        <EntityPickerField
          key={field.name}
          label={field.label}
          value={String(value)}
          onChange={(v) => setConfig(field.name, v)}
        />
      );

    case 'icon':
      return (
        <IconPickerField
          key={field.name}
          label={field.label}
          value={String(value)}
          onChange={(v) => setConfig(field.name, v)}
        />
      );

    case 'checkbox':
      return (
        <FormControlLabel
          key={field.name}
          control={
            <Checkbox size="small" checked={Boolean(value)}
              onChange={(e) => setConfig(field.name, e.target.checked)} />
          }
          label={<Typography variant="caption">{field.label}</Typography>}
        />
      );

    case 'select':
      return (
        <FormControl key={field.name} size="small" fullWidth>
          <InputLabel sx={{ fontSize: 12 }}>{field.label}</InputLabel>
          <Select value={value} label={field.label} onChange={(e) => setConfig(field.name, e.target.value)}>
            {field.options?.map((opt) => (
              <MenuItem key={String(opt.value)} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      );

    case 'slider':
      return (
        <Box key={field.name}>
          <Typography variant="caption" color="text.secondary">
            {field.label}: {value}
          </Typography>
          <Slider
            size="small"
            value={Number(value)}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            onChange={(_, v) => setConfig(field.name, v)}
          />
        </Box>
      );

    case 'color':
      return (
        <ColorFieldInspector
          key={field.name}
          field={field}
          value={String(value)}
          onChange={(v) => setConfig(field.name, v)}
        />
      );

    case 'textarea':
      return (
        <TextField
          key={field.name} label={field.label} size="small"
          multiline rows={3} fullWidth value={value}
          onChange={(e) => setConfig(field.name, e.target.value)}
        />
      );

    case 'number':
      return (
        <TextField
          key={field.name} label={field.label} size="small"
          type="number" fullWidth value={value}
          onChange={(e) => setConfig(field.name, Number(e.target.value))}
          slotProps={{ htmlInput: { min: field.min, max: field.max, step: field.step ?? 1 } }}
        />
      );

    default:
      return (
        <TextField
          key={field.name} label={field.label} size="small"
          fullWidth value={value}
          onChange={(e) => setConfig(field.name, e.target.value)}
        />
      );
  }
}

// ── Root Inspector ────────────────────────────────────────────────────────────

export default function Inspector() {
  const { selectedWidgetIds } = useEditorStore();
  const [tab, setTab] = useState<'view' | 'widget'>('view');

  // Auto-switch to Widget tab when a widget is selected on the canvas
  useEffect(() => {
    if (selectedWidgetIds.length > 0) setTab('widget');
  }, [selectedWidgetIds.length]);

  return (
    <Box
      sx={{
        width: 280, flexShrink: 0,
        bgcolor: 'background.paper',
        borderLeft: 1, borderColor: 'divider',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
      >
        <Tab label="View" value="view" sx={{ minHeight: 40, fontSize: 12 }} />
        <Tab label="Widget" value="widget" sx={{ minHeight: 40, fontSize: 12 }}
          onClick={() => selectedWidgetIds.length > 0 && setTab('widget')} />
      </Tabs>

      <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {tab === 'view' ? <ViewTab /> : <WidgetTab />}
      </Box>
    </Box>
  );
}
