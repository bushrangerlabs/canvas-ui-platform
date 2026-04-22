/**
 * Inspector — shows config fields for the selected widget.
 */
import {
  Box, Typography, Divider, TextField, Select, MenuItem,
  FormControl, InputLabel, Checkbox, FormControlLabel, Slider,
  IconButton, Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useEditorStore } from '../../store';
import { WIDGET_REGISTRY } from '../widgets/registry';
import type { FieldMetadata } from '../widgets/metadata';

export default function Inspector() {
  const { activeView, selectedWidgetId, updateWidget, removeWidget, duplicateWidget } =
    useEditorStore();

  const widget = activeView?.widgets.find((w) => w.id === selectedWidgetId);
  const meta = widget ? WIDGET_REGISTRY[widget.type] : undefined;

  if (!widget || !meta) {
    return (
      <Box
        sx={{
          width: 280,
          flexShrink: 0,
          bgcolor: 'background.paper',
          borderLeft: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
          Select a widget to inspect its properties.
        </Typography>
      </Box>
    );
  }

  function setConfig(key: string, value: any) {
    updateWidget(widget!.id, { config: { ...widget!.config, [key]: value } });
  }

  function setPosition(key: 'x' | 'y' | 'width' | 'height' | 'zIndex', value: number) {
    updateWidget(widget!.id, {
      position: { ...widget!.position, [key]: value },
    });
  }

  const categories = Array.from(new Set(meta.fields.map((f) => f.category ?? 'general')));

  return (
    <Box
      sx={{
        width: 280,
        flexShrink: 0,
        bgcolor: 'background.paper',
        borderLeft: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {meta.name}
        </Typography>
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

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        {/* Position fields */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          LAYOUT
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
          {(['x', 'y', 'width', 'height', 'zIndex'] as const).map((key) => (
            <TextField
              key={key}
              label={key.toUpperCase()}
              size="small"
              type="number"
              value={widget.position[key] ?? 0}
              onChange={(e) => setPosition(key, Number(e.target.value))}
              slotProps={{ htmlInput: { step: 1 } }}
              sx={{ gridColumn: key === 'zIndex' ? '1 / -1' : undefined }}
            />
          ))}
        </Box>

        {/* Widget-specific fields grouped by category */}
        {categories.map((cat) => {
          const fields = meta.fields.filter(
            (f) => (f.category ?? 'general') === cat && !['width', 'height'].includes(f.name),
          );
          if (fields.length === 0) return null;

          // Check visibleWhen conditions
          const visibleFields = fields.filter((f) => {
            if (!f.visibleWhen) return true;
            return widget.config[f.visibleWhen.field] === f.visibleWhen.value;
          });
          if (visibleFields.length === 0) return null;

          return (
            <Box key={cat} sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {cat.toUpperCase()}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {visibleFields.map((field) => renderField(field, widget.config, setConfig))}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function renderField(
  field: FieldMetadata,
  config: Record<string, any>,
  setConfig: (key: string, value: any) => void,
): React.ReactNode {
  const value = config[field.name] ?? field.default ?? '';

  switch (field.type) {
    case 'checkbox':
      return (
        <FormControlLabel
          key={field.name}
          control={
            <Checkbox
              size="small"
              checked={Boolean(value)}
              onChange={(e) => setConfig(field.name, e.target.checked)}
            />
          }
          label={<Typography variant="caption">{field.label}</Typography>}
        />
      );

    case 'select':
      return (
        <FormControl key={field.name} size="small" fullWidth>
          <InputLabel sx={{ fontSize: 12 }}>{field.label}</InputLabel>
          <Select
            value={value}
            label={field.label}
            onChange={(e) => setConfig(field.name, e.target.value)}
          >
            {field.options?.map((opt) => (
              <MenuItem key={String(opt.value)} value={opt.value}>
                {opt.label}
              </MenuItem>
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
        <Box key={field.name} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <input
            type="color"
            value={value || '#ffffff'}
            onChange={(e) => setConfig(field.name, e.target.value)}
            style={{ width: 32, height: 32, padding: 0, border: 'none', cursor: 'pointer' }}
          />
          <TextField
            size="small"
            label={field.label}
            value={value}
            onChange={(e) => setConfig(field.name, e.target.value)}
            sx={{ flex: 1 }}
          />
        </Box>
      );

    case 'textarea':
      return (
        <TextField
          key={field.name}
          label={field.label}
          size="small"
          multiline
          rows={3}
          fullWidth
          value={value}
          onChange={(e) => setConfig(field.name, e.target.value)}
        />
      );

    case 'number':
      return (
        <TextField
          key={field.name}
          label={field.label}
          size="small"
          type="number"
          fullWidth
          value={value}
          onChange={(e) => setConfig(field.name, Number(e.target.value))}
          slotProps={{ htmlInput: { min: field.min, max: field.max, step: field.step ?? 1 } }}
        />
      );

    default: // text, datasource, font, icon
      return (
        <TextField
          key={field.name}
          label={field.label}
          size="small"
          fullWidth
          value={value}
          onChange={(e) => setConfig(field.name, e.target.value)}
        />
      );
  }
}
