/**
 * PagesPage — named display slots; each page points to a canvas-ui-hacs view slug.
 *
 * The kiosk loads:  http://<ha_host>/canvas-kiosk#<canvas_view_id>
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, List, ListItemButton, ListItemText,
  ListItemSecondaryAction, IconButton, Tooltip, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Divider, Stack, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import LayersIcon from '@mui/icons-material/Layers';
import SendIcon from '@mui/icons-material/Send';
import { useNavigate } from 'react-router-dom';
import { pagesApi } from '../api/client';
import type { Page } from '../types';

export default function PagesPage() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Selected page (editing copy)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editViewId, setEditViewId] = useState('');

  // New page dialog
  const [newDialog, setNewDialog] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pgs = await pagesApi.list();
      setPages(pgs);
      if (selectedId) {
        const fresh = pgs.find(p => p.id === selectedId);
        if (fresh) { setEditName(fresh.name); setEditViewId(fresh.canvas_view_id ?? ''); }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { load(); }, [load]);

  const selectPage = (p: Page) => {
    setSelectedId(p.id);
    setEditName(p.name);
    setEditViewId(p.canvas_view_id ?? '');
  };

  const savePage = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const updated = await pagesApi.update(selectedId, {
        name: editName.trim() || 'Unnamed',
        canvas_view_id: editViewId.trim() || null,
      });
      setPages(prev => prev.map(p => p.id === selectedId ? updated : p));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const createPage = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const page = await pagesApi.create({ name: newName.trim() });
      setPages(prev => [...prev, page]);
      setNewDialog(false);
      setNewName('');
      selectPage(page);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deletePage = async (id: string) => {
    if (!confirm('Delete this page? Devices assigned to it will be unassigned.')) return;
    try {
      await pagesApi.delete(id);
      setPages(prev => prev.filter(p => p.id !== id));
      if (selectedId === id) { setSelectedId(null); setEditName(''); setEditViewId(''); }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const pushPage = async () => {
    if (!selectedId) return;
    try {
      const { pushed_to } = await pagesApi.push(selectedId);
      alert(`Pushed to ${pushed_to} device(s).`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      {/* Top bar */}
      <Paper square elevation={2} sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <IconButton onClick={() => navigate('/devices')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <LayersIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>Pages</Typography>
        <Tooltip title="Refresh"><IconButton onClick={load} size="small"><RefreshIcon /></IconButton></Tooltip>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setNewDialog(true)}>
          New Page
        </Button>
      </Paper>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mx: 2, mt: 1 }}>{error}</Alert>}

      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Page list */}
        <Paper square elevation={0} sx={{ width: 260, borderRight: 1, borderColor: 'divider', overflow: 'auto', flexShrink: 0 }}>
          {loading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>}
          {!loading && pages.length === 0 && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">No pages yet.</Typography>
              <Button size="small" onClick={() => setNewDialog(true)} sx={{ mt: 1 }}>Create one</Button>
            </Box>
          )}
          <List dense disablePadding>
            {pages.map(page => (
              <ListItemButton
                key={page.id}
                selected={selectedId === page.id}
                onClick={() => selectPage(page)}
                sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              >
                <ListItemText
                  primary={page.name}
                  secondary={page.canvas_view_id
                    ? <Chip label={page.canvas_view_id} size="small" sx={{ fontSize: 10 }} />
                    : <Typography component="span" variant="caption" color="text.disabled">no view assigned</Typography>
                  }
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Delete page">
                    <IconButton edge="end" size="small" onClick={e => { e.stopPropagation(); deletePage(page.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItemButton>
            ))}
          </List>
        </Paper>

        {/* Editor */}
        {!selectedId ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Select a page to edit</Typography>
          </Box>
        ) : (
          <Box sx={{ flex: 1, p: 3 }}>
            <Stack spacing={3} sx={{ maxWidth: 480 }}>
              <TextField
                label="Page Name"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                fullWidth
              />
              <TextField
                label="Canvas View ID"
                value={editViewId}
                onChange={e => setEditViewId(e.target.value)}
                fullWidth
                helperText='The view slug from canvas-ui-hacs. Kiosk loads: /canvas-kiosk#<canvas_view_id>'
                placeholder="e.g. main_dashboard"
              />

              <Typography variant="caption" color="text.secondary">
                ID: {selectedId}
              </Typography>

              <Divider />

              <Stack direction="row" spacing={2}>
                <Button variant="contained" startIcon={<SaveIcon />} onClick={savePage} disabled={saving}>
                  Save
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<SendIcon />}
                  onClick={pushPage}
                  title="Send load_view command to all devices assigned to this page"
                >
                  Push to devices
                </Button>
              </Stack>
            </Stack>
          </Box>
        )}
      </Box>

      {/* New Page Dialog */}
      <Dialog open={newDialog} onClose={() => setNewDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Page</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Page Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            onKeyDown={e => { if (e.key === 'Enter') createPage(); }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={createPage} disabled={!newName.trim() || saving}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
