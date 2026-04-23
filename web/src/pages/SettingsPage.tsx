/**
 * SettingsPage — global application settings.
 *
 * Sections:
 *   • Canvas defaults (snap size, default resolution)
 *   • About / version
 */
import React, { useState } from 'react';
import {
  Box, Typography, Paper, Divider, Slider, Switch, FormControlLabel,
  TextField, Button, IconButton, Tooltip, Stack,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { useEditorStore } from '../store';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { snapEnabled, snapSize, toggleSnap } = useEditorStore();

  // Local state so user must "Apply" before changes take effect
  const [localSnapSize, setLocalSnapSize] = useState(snapSize);
  const [defaultWidth, setDefaultWidth] = useState(1920);
  const [defaultHeight, setDefaultHeight] = useState(1080);

  // Persist snap size to store on apply
  function applyCanvasDefaults() {
    useEditorStore.setState({ snapSize: localSnapSize });
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default', overflow: 'hidden' }}>
      {/* Top bar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1,
        borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper',
      }}>
        <Tooltip title="Back to editor">
          <IconButton size="small" onClick={() => navigate(-1)}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
          Settings
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3, maxWidth: 640, mx: 'auto', width: '100%' }}>
        <Stack spacing={3}>

          {/* ── Canvas defaults ───────────────────────────────────────────── */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Canvas Defaults
            </Typography>

            <FormControlLabel
              control={<Switch checked={snapEnabled} onChange={toggleSnap} />}
              label="Snap to grid"
              sx={{ mb: 2 }}
            />

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" gutterBottom>
                Snap size: {localSnapSize}px
              </Typography>
              <Slider
                value={localSnapSize}
                min={1}
                max={50}
                step={1}
                onChange={(_, v) => setLocalSnapSize(v as number)}
                valueLabelDisplay="auto"
                disabled={!snapEnabled}
                sx={{ width: '100%', maxWidth: 320 }}
              />
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Typography variant="body2" color="text.secondary" gutterBottom>
              Default new view resolution
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
              <TextField
                label="Width"
                type="number"
                size="small"
                value={defaultWidth}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaultWidth(Number(e.target.value))}
                slotProps={{ htmlInput: { min: 320, max: 7680, step: 1 } }}
                sx={{ width: 110 }}
              />
              <Typography variant="body2" color="text.secondary">×</Typography>
              <TextField
                label="Height"
                type="number"
                size="small"
                value={defaultHeight}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaultHeight(Number(e.target.value))}
                slotProps={{ htmlInput: { min: 240, max: 4320, step: 1 } }}
                sx={{ width: 110 }}
              />
            </Stack>

            <Button variant="contained" size="small" onClick={applyCanvasDefaults}>
              Apply
            </Button>
          </Paper>

          {/* ── About ─────────────────────────────────────────────────────── */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              About
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Canvas UI Platform — Home Assistant add-on
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Built with React 19 + MUI v7 + Zustand + Fastify
            </Typography>
          </Paper>

        </Stack>
      </Box>
    </Box>
  );
}
