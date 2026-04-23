/**
 * SchedulesPage — create and manage display schedules.
 * A schedule is an ordered list of (view, duration) entries.
 * Assign a schedule to a device on the Devices page.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Tooltip, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem,
  FormControl, InputLabel, Switch, FormControlLabel, Chip,
  CircularProgress, Alert, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Schedule, ScheduleEntry, ServerView } from '../types';

export default function SchedulesPage() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [views, setViews] = useState<ServerView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit dialog
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [editName, setEditName] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editEntries, setEditEntries] = useState<ScheduleEntry[]>([]);
  const [saving, setSaving] = useState(false);

  // New entry form
  const [newViewId, setNewViewId] = useState('');
  const [newDuration, setNewDuration] = useState(30);

  // Delete dialog
  const [deleteSchedule, setDeleteSchedule] = useState<Schedule | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [scheds, vws] = await Promise.all([
        api.get<Schedule[]>('/api/schedules'),
        api.get<ServerView[]>('/api/views'),
      ]);
      setSchedules(scheds);
      setViews(vws);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditSchedule({ id: '', name: '', entries: [], enabled: true, created_at: '', updated_at: '' });
    setEditName('New Schedule');
    setEditEnabled(true);
    setEditEntries([]);
    setNewViewId(views[0]?.id ?? '');
    setNewDuration(30);
  }

  function openEdit(s: Schedule) {
    setEditSchedule(s);
    setEditName(s.name);
    setEditEnabled(s.enabled);
    setEditEntries([...s.entries]);
    setNewViewId(views[0]?.id ?? '');
    setNewDuration(30);
  }

  function addEntry() {
    if (!newViewId) return;
    const viewName = views.find((v) => v.id === newViewId)?.name ?? newViewId;
    setEditEntries((prev) => [...prev, { viewId: newViewId, viewName, duration: newDuration }]);
  }

  function removeEntry(idx: number) {
    setEditEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveEntry(idx: number, dir: -1 | 1) {
    setEditEntries((prev) => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  }

  async function handleSave() {
    if (!editSchedule || !editName.trim()) return;
    setSaving(true);
    try {
      if (editSchedule.id) {
        const updated = await api.put<Schedule>(`/api/schedules/${editSchedule.id}`, {
          name: editName.trim(), enabled: editEnabled, entries: editEntries,
        });
        setSchedules((prev) => prev.map((s) => s.id === updated.id ? updated : s));
      } else {
        const created = await api.post<Schedule>('/api/schedules', {
          name: editName.trim(), enabled: editEnabled, entries: editEntries,
        });
        setSchedules((prev) => [...prev, created]);
      }
      setEditSchedule(null);
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteSchedule) return;
    try {
      await api.delete(`/api/schedules/${deleteSchedule.id}`);
      setSchedules((prev) => prev.filter((s) => s.id !== deleteSchedule.id));
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    } finally {
      setDeleteSchedule(null);
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Tooltip title="Back to editor">
          <IconButton onClick={() => navigate('/editor')}><ArrowBackIcon /></IconButton>
        </Tooltip>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Schedules</Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          New Schedule
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : schedules.length === 0 ? (
        <Typography color="text.secondary">No schedules yet. Create one to enable view cycling on a device.</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Views</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedules.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {s.entries.map((e, i) => (
                        <Chip key={i} label={`${e.viewName} (${e.duration}s)`} size="small" variant="outlined" />
                      ))}
                      {s.entries.length === 0 && <Typography variant="caption" color="text.secondary">No entries</Typography>}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={s.enabled ? 'Enabled' : 'Disabled'} color={s.enabled ? 'success' : 'default'} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(s)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => setDeleteSchedule(s)}><DeleteIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Edit / Create Dialog */}
      <Dialog open={Boolean(editSchedule)} onClose={() => setEditSchedule(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editSchedule?.id ? 'Edit Schedule' : 'New Schedule'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Name"
            fullWidth
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <FormControlLabel
            control={<Switch checked={editEnabled} onChange={(e) => setEditEnabled(e.target.checked)} />}
            label="Enabled"
          />
          <Divider />
          <Typography variant="subtitle2">View Entries</Typography>
          {editEntries.map((entry, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>{entry.viewName}</Typography>
              <Typography variant="body2" color="text.secondary">{entry.duration}s</Typography>
              <IconButton size="small" onClick={() => moveEntry(i, -1)} disabled={i === 0}>
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => moveEntry(i, 1)} disabled={i === editEntries.length - 1}>
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => removeEntry(i)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>View</InputLabel>
              <Select value={newViewId} label="View" onChange={(e) => setNewViewId(e.target.value)}>
                {views.map((v) => (
                  <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Duration (s)"
              type="number"
              value={newDuration}
              onChange={(e) => setNewDuration(Number(e.target.value))}
              sx={{ width: 120 }}
              slotProps={{ htmlInput: { min: 1 } }}
            />
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addEntry} disabled={!newViewId}>
              Add
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditSchedule(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !editName.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={Boolean(deleteSchedule)} onClose={() => setDeleteSchedule(null)}>
        <DialogTitle>Delete Schedule</DialogTitle>
        <DialogContent>
          <Typography>Delete "{deleteSchedule?.name}"? This will not affect devices using it immediately.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteSchedule(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
