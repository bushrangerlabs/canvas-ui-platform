/**
 * VisibilityConditionEditor
 * Structured UI for editing a widget's visibility rules (VisibilityConfig).
 * Replaces the old plain-text "Show when (condition)" text field.
 */
import {
  Box, Button, Checkbox, Chip, FormControl, FormControlLabel,
  IconButton, MenuItem, Select, TextField, Tooltip, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import type {
  Condition,
  NumericStateCondition,
  ScreenCondition,
  StateCondition,
  TimeCondition,
  VisibilityConfig,
} from '../../types';

interface Props {
  value: VisibilityConfig | undefined;
  onChange: (v: VisibilityConfig | undefined) => void;
  hiddenInEdit: boolean;
  onHiddenInEditChange: (v: boolean) => void;
}

const STATE_OPS = ['==', '!=', 'contains', 'starts_with', 'ends_with'] as const;
const NUM_OPS   = ['==', '!=', '>', '>=', '<', '<='] as const;
const WEEKDAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function emptyState(): StateCondition {
  return { type: 'state', source: 'ha', key: '', operator: '==', value: '' };
}
function emptyNumeric(): NumericStateCondition {
  return { type: 'numeric_state', source: 'ha', key: '', operator: '>', value: 0 };
}
function emptyTime(): TimeCondition {
  return { type: 'time' };
}
function emptyScreen(): ScreenCondition {
  return { type: 'screen' };
}

function ConditionRow({
  cond,
  onChange,
  onDelete,
}: {
  cond: Condition;
  onChange: (c: Condition) => void;
  onDelete: () => void;
}) {
  const inputSx = { flex: 1, minWidth: 60 };

  if (cond.type === 'state' || cond.type === 'numeric_state') {
    const isNum = cond.type === 'numeric_state';
    const c = cond as StateCondition | NumericStateCondition;
    return (
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip label={isNum ? 'numeric' : 'state'} size="small"
          color={isNum ? 'warning' : 'primary'} variant="outlined"
          sx={{ fontSize: 10, height: 22 }}
        />
        <TextField size="small" label="Entity / Key" value={c.key} sx={{ ...inputSx, flex: 2 }}
          placeholder="e.g. sensor.temp"
          onChange={(e) => onChange({ ...c, key: e.target.value } as Condition)}
        />
        <FormControl size="small" sx={{ minWidth: 90 }}>
          <Select value={c.operator}
            onChange={(e) => onChange({ ...c, operator: e.target.value as any } as Condition)}
          >
            {(isNum ? NUM_OPS : STATE_OPS).map((op) => (
              <MenuItem key={op} value={op}>{op}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {isNum ? (
          <TextField size="small" label="Value" type="number" sx={inputSx}
            value={(cond as NumericStateCondition).value}
            onChange={(e) => onChange({ ...c, value: Number(e.target.value) } as Condition)}
          />
        ) : (
          <TextField size="small" label="Value" sx={inputSx}
            value={(cond as StateCondition).value}
            onChange={(e) => onChange({ ...c, value: e.target.value } as Condition)}
          />
        )}
        <Tooltip title="Delete condition">
          <IconButton size="small" color="error" onClick={onDelete}>
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  if (cond.type === 'time') {
    const c = cond as TimeCondition;
    return (
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Chip label="time" size="small" color="secondary" variant="outlined" sx={{ fontSize: 10, height: 22, mt: 0.5 }} />
        <TextField size="small" label="After (HH:MM)" sx={inputSx}
          value={c.after ?? ''}
          onChange={(e) => onChange({ ...c, after: e.target.value || undefined })}
        />
        <TextField size="small" label="Before (HH:MM)" sx={inputSx}
          value={c.before ?? ''}
          onChange={(e) => onChange({ ...c, before: e.target.value || undefined })}
        />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, alignItems: 'center', mt: 0.25 }}>
          {WEEKDAYS.map((d, i) => {
            const active = c.weekdays?.includes(i) ?? false;
            return (
              <Chip key={d} label={d} size="small"
                variant={active ? 'filled' : 'outlined'}
                color={active ? 'primary' : 'default'}
                sx={{ fontSize: 9, height: 20, cursor: 'pointer' }}
                onClick={() => {
                  const days = c.weekdays ? [...c.weekdays] : [];
                  const idx = days.indexOf(i);
                  if (idx === -1) days.push(i); else days.splice(idx, 1);
                  onChange({ ...c, weekdays: days.length ? days : undefined });
                }}
              />
            );
          })}
        </Box>
        <Tooltip title="Delete condition">
          <IconButton size="small" color="error" onClick={onDelete} sx={{ mt: 0.25 }}>
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  if (cond.type === 'screen') {
    const c = cond as ScreenCondition;
    const nf = (v: number | undefined) => v ?? '';
    return (
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip label="screen" size="small" color="success" variant="outlined" sx={{ fontSize: 10, height: 22 }} />
        <TextField size="small" label="Min W" type="number" sx={inputSx}
          value={nf(c.min_width)}
          onChange={(e) => onChange({ ...c, min_width: e.target.value ? Number(e.target.value) : undefined })}
        />
        <TextField size="small" label="Max W" type="number" sx={inputSx}
          value={nf(c.max_width)}
          onChange={(e) => onChange({ ...c, max_width: e.target.value ? Number(e.target.value) : undefined })}
        />
        <TextField size="small" label="Min H" type="number" sx={inputSx}
          value={nf(c.min_height)}
          onChange={(e) => onChange({ ...c, min_height: e.target.value ? Number(e.target.value) : undefined })}
        />
        <TextField size="small" label="Max H" type="number" sx={inputSx}
          value={nf(c.max_height)}
          onChange={(e) => onChange({ ...c, max_height: e.target.value ? Number(e.target.value) : undefined })}
        />
        <Tooltip title="Delete condition">
          <IconButton size="small" color="error" onClick={onDelete}>
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return null;
}

export function VisibilityConditionEditor({ value, onChange, hiddenInEdit, onHiddenInEditChange }: Props) {
  const cfg = value ?? {};
  const conditions = cfg.conditions ?? [];
  const logic = cfg.logic ?? 'and';
  const defaultVisible = cfg.defaultVisible ?? true;

  function updateConds(newConds: Condition[]) {
    if (newConds.length === 0) {
      onChange(undefined);
    } else {
      onChange({ ...cfg, conditions: newConds });
    }
  }

  function addCondition(type: Condition['type']) {
    let c: Condition;
    if (type === 'state') c = emptyState();
    else if (type === 'numeric_state') c = emptyNumeric();
    else if (type === 'time') c = emptyTime();
    else c = emptyScreen();
    updateConds([...conditions, c]);
  }

  function updateCondition(i: number, updated: Condition) {
    const next = [...conditions];
    next[i] = updated;
    updateConds(next);
  }

  function deleteCondition(i: number) {
    updateConds(conditions.filter((_, idx) => idx !== i));
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {conditions.length === 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
          No conditions — widget is always visible.
        </Typography>
      ) : (
        <>
          {conditions.length > 1 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">Logic:</Typography>
              {(['and', 'or'] as const).map((l) => (
                <Chip key={l} label={l.toUpperCase()} size="small"
                  variant={logic === l ? 'filled' : 'outlined'}
                  color={logic === l ? 'primary' : 'default'}
                  sx={{ cursor: 'pointer', fontSize: 11 }}
                  onClick={() => onChange({ ...cfg, logic: l })}
                />
              ))}
              <Tooltip title="What to show when no conditions match">
                <FormControlLabel
                  sx={{ ml: 'auto', mr: 0 }}
                  control={
                    <Checkbox size="small" checked={defaultVisible}
                      onChange={(e) => onChange({ ...cfg, defaultVisible: e.target.checked })}
                    />
                  }
                  label={<Typography variant="caption">Default visible</Typography>}
                />
              </Tooltip>
            </Box>
          )}
          {conditions.map((c, i) => (
            <ConditionRow
              key={i}
              cond={c}
              onChange={(updated) => updateCondition(i, updated)}
              onDelete={() => deleteCondition(i)}
            />
          ))}
        </>
      )}

      {/* Add condition buttons */}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
        {(['state', 'numeric_state', 'time', 'screen'] as const).map((t) => (
          <Button key={t} size="small" variant="outlined"
            startIcon={<AddIcon sx={{ fontSize: 12 }} />}
            sx={{ fontSize: 10, py: 0.25, px: 1, minWidth: 0 }}
            onClick={() => addCondition(t)}
          >
            {t === 'numeric_state' ? 'numeric' : t}
          </Button>
        ))}
      </Box>

      <FormControlLabel
        control={
          <Checkbox size="small"
            checked={hiddenInEdit}
            onChange={(e) => onHiddenInEditChange(e.target.checked)}
          />
        }
        label={<Typography variant="caption">Hide in edit mode</Typography>}
      />
    </Box>
  );
}
