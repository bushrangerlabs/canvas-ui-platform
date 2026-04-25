/**
 * DevicesPage — manage registered display devices and view assignments.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Tooltip, Chip, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem,
  FormControl, InputLabel, CircularProgress, Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import MonitorIcon from '@mui/icons-material/Monitor';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { api, pagesApi } from '../api/client';
import type { Device, ServerView, Schedule, Page } from '../types';

export default function DevicesPage() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<(Device & { online?: boolean })[]>([]);
  const [views, setViews] = useState<ServerView[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit dialog state
  const [editDevice, setEditDevice] = useState<(Device & { online?: boolean }) | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editViewId, setEditViewId] = useState('');
  const [editPageId, setEditPageId] = useState('');
  const [editScheduleId, setEditScheduleId] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteDevice, setDeleteDevice] = useState<Device | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [devs, vws] = await Promise.all([
        api.get<(Device & { online?: boolean })[]>('/api/devices'),
        api.get<ServerView[]>('/api/views'),
      ]);
      const [scheds, pgs] = await Promise.all([
        api.get<Schedule[]>('/api/schedules').catch(() => [] as Schedule[]),
        pagesApi.list().catch(() => [] as Page[]),
      ]);
      setDevices(devs);
      setViews(vws);
      setSchedules(scheds);
      setPages(pgs);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh online status every 10s
  useEffect(() => {
    const t = setInterval(() => load(), 10_000);
    return () => clearInterval(t);
  }, [load]);

  const openEdit = (dev: Device & { online?: boolean }) => {
    setEditDevice(dev);
    setEditName(dev.name);
    setEditDescription(dev.description ?? '');
    setEditViewId(dev.default_view_id ?? '');
    setEditPageId(dev.default_page_id ?? '');
    setEditScheduleId(dev.schedule_id ?? '');
  };

  const handleSave = async () => {
    if (!editDevice) return;
    setSaving(true);
    try {
      await api.patch(`/api/devices/${editDevice.id}`, {
        name: editName.trim() || editDevice.id,
        description: editDescription.trim() || undefined,
        default_view_id: editViewId || null,
        default_page_id: editPageId || null,
        schedule_id: editScheduleId || null,
      });
      setEditDevice(null);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDevice) return;
    try {
      await api.delete(`/api/devices/${deleteDevice.id}`);
      setDeleteDevice(null);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Build display URL for a device
  const displayUrl = (dev: Device) => {
    const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
    return `${base}/display?device=${dev.id}`;
  };

  const viewName = (viewId?: string | null) => {
    if (!viewId) return '—';
    return views.find((v) => v.id === viewId)?.name ?? viewId;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
        <IconButton size="small" onClick={() => navigate('/editor')}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <MonitorIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
          Devices
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1 }}>
          {devices.length} registered · {devices.filter((d) => d.online).length} online
        </Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={load} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {loading && devices.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress />
          </Box>
        ) : devices.length === 0 ? (
          <Box sx={{ textAlign: 'center', pt: 8, color: 'text.secondary' }}>
            <MonitorIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
            <Typography>No devices registered yet.</Typography>
            <Typography variant="caption">
              Devices register automatically when they connect to <code>/display?device=YOUR_ID</code>
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Device</TableCell>
                  <TableCell>Platform</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Assigned View</TableCell>
                  <TableCell>Last Seen</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {devices.map((dev) => (
                  <TableRow key={dev.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{dev.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{dev.id}</Typography>
                      {dev.description && (
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                          {dev.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{dev.platform ?? '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={dev.online ? 'Online' : 'Offline'}
                        color={dev.online ? 'success' : 'default'}
                        variant={dev.online ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{viewName(dev.default_view_id)}</Typography>
                      {dev.current_view_id && dev.current_view_id !== dev.default_view_id && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          Live: {viewName(dev.current_view_id)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {dev.last_seen ? new Date(dev.last_seen).toLocaleString() : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Open display URL">
                        <IconButton size="small" onClick={() => window.open(displayUrl(dev), '_blank')}>
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit device">
                        <IconButton size="small" onClick={() => openEdit(dev)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete device">
                        <IconButton size="small" color="error" onClick={() => setDeleteDevice(dev)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Edit Dialog */}
      <Dialog open={!!editDevice} onClose={() => setEditDevice(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Device</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Name"
            fullWidth
            size="small"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <TextField
            label="Description"
            fullWidth
            size="small"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
          <FormControl fullWidth size="small">
            <InputLabel>Assigned Page (new panels system)</InputLabel>
            <Select
              label="Assigned Page (new panels system)"
              value={editPageId}
              onChange={(e) => setEditPageId(e.target.value)}
            >
              <MenuItem value="">— None —</MenuItem>
              {pages.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Assigned View</InputLabel>
            <Select
              label="Assigned View"
              value={editViewId}
              onChange={(e) => setEditViewId(e.target.value)}
            >
              <MenuItem value="">— None —</MenuItem>
              {views.map((v) => (
                <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Schedule (view cycling)</InputLabel>
            <Select
              label="Schedule (view cycling)"
              value={editScheduleId}
              onChange={(e) => setEditScheduleId(e.target.value)}
            >
              <MenuItem value="">— None —</MenuItem>
              {schedules.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name}{!s.enabled ? ' (disabled)' : ''}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDevice(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteDevice} onClose={() => setDeleteDevice(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Device</DialogTitle>
        <DialogContent>
          <Typography>
            Remove <strong>{deleteDevice?.name}</strong>? This only removes the record — the device can re-register by connecting again.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDevice(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
