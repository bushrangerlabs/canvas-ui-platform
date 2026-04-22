/**
 * IconPickerField — text field with an icon browser dialog.
 * Uses @iconify/react for rendering — supports any valid Iconify icon string.
 */
import { useState, useMemo } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, InputAdornment, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Icon as IconifyIcon } from '@iconify/react';

interface Props {
  value: string;
  onChange: (icon: string) => void;
  label?: string;
}

// Curated icon list grouped by category
const ICON_GROUPS: Record<string, string[]> = {
  'Home': [
    'mdi:home','mdi:home-outline','mdi:sofa','mdi:bed','mdi:chair-rolling',
    'mdi:television','mdi:door-open','mdi:door-closed','mdi:garage','mdi:garage-open',
    'mdi:shower','mdi:bathtub','mdi:toilet','mdi:fridge','mdi:washing-machine',
    'mdi:dishwasher','mdi:tumble-dryer','mdi:microwave','mdi:stove','mdi:kettle',
    'mdi:window-open','mdi:window-closed','mdi:blinds','mdi:curtains','mdi:fan',
  ],
  'Lighting': [
    'mdi:lightbulb','mdi:lightbulb-outline','mdi:lightbulb-on','mdi:lightbulb-off',
    'mdi:ceiling-light','mdi:floor-lamp','mdi:desk-lamp','mdi:led-strip',
    'mdi:lamp','mdi:candle','mdi:torch','mdi:spotlight','mdi:string-lights',
    'mdi:brightness-5','mdi:brightness-6','mdi:brightness-7',
  ],
  'Climate': [
    'mdi:thermometer','mdi:thermometer-high','mdi:thermometer-low',
    'mdi:thermostat','mdi:heat-wave','mdi:snowflake','mdi:weather-sunny',
    'mdi:weather-cloudy','mdi:weather-rainy','mdi:humidity','mdi:water-percent',
    'mdi:air-filter','mdi:hvac','mdi:radiator','mdi:heat-pump','mdi:air-conditioner',
  ],
  'Security': [
    'mdi:lock','mdi:lock-open','mdi:lock-outline','mdi:lock-open-outline',
    'mdi:shield','mdi:shield-check','mdi:shield-alert','mdi:alarm',
    'mdi:alarm-light','mdi:cctv','mdi:motion-sensor','mdi:doorbell',
    'mdi:gate','mdi:fence','mdi:key','mdi:security',
  ],
  'Energy': [
    'mdi:power-plug','mdi:power-plug-off','mdi:power','mdi:flash',
    'mdi:lightning-bolt','mdi:battery','mdi:battery-charging','mdi:solar-power',
    'mdi:wind-power','mdi:electric-switch','mdi:meter-electric',
    'mdi:fuel','mdi:gas-burner','mdi:water-boiler',
  ],
  'Media': [
    'mdi:television','mdi:speaker','mdi:music','mdi:volume-high',
    'mdi:play','mdi:pause','mdi:stop','mdi:skip-next','mdi:skip-previous',
    'mdi:cast','mdi:headphones','mdi:radio','mdi:podcast','mdi:microphone',
    'mdi:gamepad','mdi:remote','mdi:projector','mdi:surround-sound',
  ],
  'Sensors': [
    'mdi:eye','mdi:motion-sensor','mdi:smoke-detector','mdi:water-alert',
    'mdi:co-detector','mdi:leak','mdi:vibrate','mdi:gauge','mdi:speedometer',
    'mdi:weight','mdi:ruler','mdi:signal','mdi:wifi','mdi:bluetooth',
    'mdi:radioactive','mdi:biohazard',
  ],
  'Controls': [
    'mdi:toggle-switch','mdi:toggle-switch-off','mdi:button-pointer',
    'mdi:gesture-tap','mdi:remote','mdi:controller-classic','mdi:knob',
    'mdi:slider','mdi:timer','mdi:timer-outline','mdi:alarm','mdi:stopwatch',
    'mdi:robot','mdi:cog','mdi:cogs','mdi:wrench','mdi:tools',
  ],
  'People': [
    'mdi:account','mdi:account-outline','mdi:account-group','mdi:human',
    'mdi:baby','mdi:dog','mdi:cat','mdi:bird',
    'mdi:account-check','mdi:account-alert','mdi:walk','mdi:run',
    'mdi:car','mdi:bicycle','mdi:bus','mdi:airplane',
  ],
  'Misc': [
    'mdi:star','mdi:heart','mdi:flag','mdi:bookmark','mdi:tag',
    'mdi:information','mdi:alert','mdi:check-circle','mdi:close-circle',
    'mdi:plus-circle','mdi:minus-circle','mdi:refresh','mdi:sync',
    'mdi:arrow-up','mdi:arrow-down','mdi:arrow-left','mdi:arrow-right',
    'mdi:chart-line','mdi:chart-bar','mdi:chart-pie','mdi:calendar',
  ],
  'Emoji': [
    'emoji:💡','emoji:🏠','emoji:🚪','emoji:🔒','emoji:🔓','emoji:🔑',
    'emoji:📷','emoji:🌡️','emoji:🔥','emoji:❄️','emoji:🌀','emoji:🎵',
    'emoji:🔊','emoji:📺','emoji:☀️','emoji:☁️','emoji:🌧️','emoji:⚡',
    'emoji:🔋','emoji:💧','emoji:🌿','emoji:🎮','emoji:⭐','emoji:❤️',
  ],
};

const ALL_GROUPS = Object.keys(ICON_GROUPS);

export function IconPickerField({ value, onChange, label = 'Icon' }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(value);

  const currentGroup = ALL_GROUPS[tab];
  const displayIcons = useMemo(() => {
    if (search.trim()) {
      // Search across all groups
      const q = search.toLowerCase();
      return Object.values(ICON_GROUPS)
        .flat()
        .filter((ic) => ic.toLowerCase().includes(q))
        .slice(0, 120);
    }
    return ICON_GROUPS[currentGroup] ?? [];
  }, [search, currentGroup]);

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {value && (
          <Box sx={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconifyIcon icon={value.startsWith('emoji:') ? 'mdi:emoticon' : value} width={24} height={24} />
            {value.startsWith('emoji:') && (
              <span style={{ fontSize: 18, position: 'absolute' }}>{value.replace('emoji:', '')}</span>
            )}
          </Box>
        )}
        <TextField
          fullWidth
          label={label}
          value={value}
          size="small"
          onChange={(e) => onChange(e.target.value)}
          placeholder="mdi:home"
          slotProps={{
            input: {
              style: { fontFamily: 'monospace', fontSize: 12 },
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Browse icons">
                    <IconButton size="small" onClick={() => { setPending(value); setSearch(''); setOpen(true); }}>
                      <IconifyIcon icon="mdi:magnify" width={18} height={18} />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          Select Icon
          <IconButton onClick={() => setOpen(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          <Box sx={{ px: 2, pt: 1.5, pb: 0 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search icons… (e.g. light, fan, lock)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <IconifyIcon icon="mdi:magnify" width={18} height={18} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>

          {!search && (
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}
            >
              {ALL_GROUPS.map((g) => <Tab key={g} label={g} sx={{ minWidth: 60, fontSize: 12 }} />)}
            </Tabs>
          )}

          <Box sx={{ p: 1.5, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 44px)', gap: 0.5, maxHeight: 320, overflowY: 'auto' }}>
            {displayIcons.length === 0 ? (
              <Typography color="text.secondary" sx={{ gridColumn: '1 / -1', py: 3, textAlign: 'center' }}>
                No icons found
              </Typography>
            ) : displayIcons.map((ic) => (
              <Tooltip key={ic} title={ic.replace(/^.+:/, '')} placement="top">
                <Box
                  onClick={() => setPending(ic)}
                  sx={{
                    width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 1, cursor: 'pointer', border: '1px solid',
                    borderColor: pending === ic ? 'primary.main' : 'transparent',
                    bgcolor: pending === ic ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover', borderColor: 'divider' },
                  }}
                >
                  {ic.startsWith('emoji:') ? (
                    <span style={{ fontSize: 22 }}>{ic.replace('emoji:', '')}</span>
                  ) : (
                    <IconifyIcon icon={ic} width={24} height={24} />
                  )}
                </Box>
              </Tooltip>
            ))}
          </Box>

          {pending && (
            <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {pending.startsWith('emoji:') ? (
                  <span style={{ fontSize: 24 }}>{pending.replace('emoji:', '')}</span>
                ) : (
                  <IconifyIcon icon={pending} width={28} height={28} />
                )}
              </Box>
              <Typography variant="caption" sx={{ flex: 1, fontFamily: 'monospace', color: 'text.secondary' }}>{pending}</Typography>
            </Box>
          )}
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
