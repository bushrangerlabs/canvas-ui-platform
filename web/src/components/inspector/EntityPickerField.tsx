/**
 * EntityPickerField — text field with an entity browser dialog.
 * Fetches entity states from the platform server's HA proxy endpoint.
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputAdornment, InputLabel, MenuItem,
  Select, TextField, Tooltip, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { haApi, type HaEntityState } from '../../api/client';

interface Props {
  value: string;
  onChange: (entityId: string) => void;
  label?: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  light: '#FFC107', switch: '#4CAF50', sensor: '#2196F3',
  binary_sensor: '#9C27B0', cover: '#795548', climate: '#FF5722',
  fan: '#00BCD4', media_player: '#E91E63', camera: '#607D8B',
  lock: '#FF9800', alarm_control_panel: '#F44336', automation: '#3F51B5',
  script: '#009688', scene: '#673AB7', input_boolean: '#8BC34A',
  person: '#536DFE', weather: '#81C784',
};

function domainColor(domain: string) {
  return DOMAIN_COLORS[domain] ?? '#9E9E9E';
}

export function EntityPickerField({ value, onChange, label = 'Entity' }: Props) {
  const [open, setOpen] = useState(false);
  const [states, setStates] = useState<HaEntityState[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [pending, setPending] = useState(value);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    haApi.states()
      .then(setStates)
      .catch(() => setStates([]))
      .finally(() => setLoading(false));
  }, [open]);

  const domains = useMemo(() => {
    const s = new Set(states.map((e) => e.entity_id.split('.')[0]));
    return Array.from(s).sort();
  }, [states]);

  const filtered = useMemo(() => {
    let list = states;
    if (domainFilter !== 'all') list = list.filter((e) => e.entity_id.startsWith(domainFilter + '.'));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.entity_id.toLowerCase().includes(q) ||
          String(e.attributes?.friendly_name ?? '').toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => a.entity_id.localeCompare(b.entity_id));
  }, [states, domainFilter, search]);

  const friendlyName = states.find((e) => e.entity_id === value)?.attributes?.friendly_name;

  return (
    <>
      <TextField
        fullWidth
        label={label}
        value={value}
        size="small"
        onChange={(e) => onChange(e.target.value)}
        placeholder="sensor.example"
        helperText={friendlyName && friendlyName !== value ? String(friendlyName) : undefined}
        slotProps={{
          input: {
            style: { fontFamily: 'monospace', fontSize: 12 },
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Browse entities">
                  <IconButton size="small" onClick={() => { setPending(value); setOpen(true); }}>
                    <SearchIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
      />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          Select Entity
          <IconButton onClick={() => setOpen(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Domain</InputLabel>
              <Select value={domainFilter} label="Domain" onChange={(e) => setDomainFilter(e.target.value)}>
                <MenuItem value="all">All Domains</MenuItem>
                {domains.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{ flex: 1, minWidth: 200 }}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                },
              }}
            />
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {loading ? 'Loading…' : `${filtered.length} entities`}
          </Typography>

          <Box sx={{ maxHeight: 420, overflow: 'auto' }}>
            {filtered.map((entity) => {
              const domain = entity.entity_id.split('.')[0];
              const name = entity.attributes?.friendly_name ?? entity.entity_id;
              return (
                <Box
                  key={entity.entity_id}
                  onClick={() => setPending(entity.entity_id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1, p: 1, cursor: 'pointer',
                    borderRadius: 1, border: '1px solid',
                    borderColor: pending === entity.entity_id ? 'primary.main' : 'divider',
                    bgcolor: pending === entity.entity_id ? 'action.selected' : 'transparent',
                    mb: 0.5,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Chip
                    label={domain} size="small"
                    sx={{ bgcolor: domainColor(domain), color: '#fff', fontSize: '0.7rem', height: 20, minWidth: 70 }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>{String(name)}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ fontFamily: 'monospace' }}>
                      {entity.entity_id}
                    </Typography>
                  </Box>
                  <Chip label={entity.state} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
                </Box>
              );
            })}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => { onChange(''); setOpen(false); }} color="secondary">Clear</Button>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!pending} onClick={() => { onChange(pending); setOpen(false); }}>
            Select
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
