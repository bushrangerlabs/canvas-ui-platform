/**
 * PagesPage — create and manage Pages (multi-panel layouts for display devices).
 *
 * Layout:
 *  ┌──────────────────────────────────────────────────────────────────┐
 *  │  ← Pages                              [+ New Page]               │
 *  ├──────────────────┬───────────────────────────────────────────────┤
 *  │  Page list       │  Page editor (name, swipe links, panels)      │
 *  │  ─────────────   │  ─────────────────────────────────────        │
 *  │  Main Dashboard  │  [Preview  |  Panels]  (tabs)                 │
 *  │  Night Mode      │                                               │
 *  └──────────────────┴───────────────────────────────────────────────┘
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, List, ListItemButton, ListItemText, ListItemSecondaryAction,
  IconButton, Tooltip, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, Chip, CircularProgress, Alert,
  Divider, Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import LayersIcon from '@mui/icons-material/Layers';
import SendIcon from '@mui/icons-material/Send';
import { useNavigate } from 'react-router-dom';
import { api, pagesApi } from '../api/client';
import type { Page, PagePanel, ServerView } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PANEL_COLORS = ['#6c63ff', '#ff6584', '#43c6ac', '#f9a825', '#e91e63', '#29b6f6', '#66bb6a', '#ff7043'];

function panelColor(i: number) { return PANEL_COLORS[i % PANEL_COLORS.length]; }

// ─── PanelPreview ─────────────────────────────────────────────────────────────

function PanelPreview({ panels, width = 480 }: { panels: PagePanel[]; width?: number }) {
  const height = Math.round(width * (9 / 16));
  return (
    <Box
      sx={{
        position: 'relative',
        width,
        height,
        border: '2px solid rgba(255,255,255,0.15)',
        borderRadius: 1,
        bgcolor: '#0d0d1a',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {panels.map((p, i) => (
        <Box
          key={p.id ?? i}
          sx={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.w}%`,
            height: `${p.h}%`,
            bgcolor: panelColor(i),
            opacity: 0.6,
            border: `2px solid ${panelColor(i)}`,
            borderRadius: 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, textShadow: '0 1px 2px #000' }}>
            {p.name || `panel_${i}`}
          </Typography>
        </Box>
      ))}
      {panels.length === 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>No panels</Typography>
        </Box>
      )}
    </Box>
  );
}

// ─── PanelEditDialog ──────────────────────────────────────────────────────────

interface PanelDialogProps {
  open: boolean;
  panel: Partial<PagePanel>;
  views: ServerView[];
  onClose: () => void;
  onSave: (p: Partial<PagePanel>) => void;
}

function PanelEditDialog({ open, panel, views, onClose, onSave }: PanelDialogProps) {
  const [val, setVal] = useState<Partial<PagePanel>>(panel);
  useEffect(() => { setVal(panel); }, [panel]);

  const set = (k: keyof PagePanel, v: any) => setVal(prev => ({ ...prev, [k]: v }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{val.id ? 'Edit Panel' : 'Add Panel'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Panel Name"
            value={val.name ?? ''}
            onChange={e => set('name', e.target.value)}
            helperText='Friendly name, e.g. "header", "main", "footer"'
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField label="X (%)" type="number" slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
              value={val.x ?? 0} onChange={e => set('x', Number(e.target.value))} fullWidth />
            <TextField label="Y (%)" type="number" slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
              value={val.y ?? 0} onChange={e => set('y', Number(e.target.value))} fullWidth />
            <TextField label="W (%)" type="number" slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
              value={val.w ?? 100} onChange={e => set('w', Number(e.target.value))} fullWidth />
            <TextField label="H (%)" type="number" slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
              value={val.h ?? 100} onChange={e => set('h', Number(e.target.value))} fullWidth />
          </Stack>
          <FormControl fullWidth>
            <InputLabel>View (canvas-ui view)</InputLabel>
            <Select
              label="View (canvas-ui view)"
              value={val.view_id ?? ''}
              onChange={e => { set('view_id', e.target.value || undefined); if (e.target.value) set('url', undefined); }}
            >
              <MenuItem value="">(none)</MenuItem>
              {views.map(v => <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            label="External URL (overrides view)"
            value={val.url ?? ''}
            onChange={e => { set('url', e.target.value || undefined); if (e.target.value) set('view_id', undefined); }}
            placeholder="https://example.com"
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(val)}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PagesPage() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<Page[]>([]);
  const [views, setViews] = useState<ServerView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Selected page state (editing copy)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editPage, setEditPage] = useState<Partial<Page> | null>(null);
  const [tab, setTab] = useState(0); // 0=Preview, 1=Panels

  // Panel edit dialog
  const [panelDialog, setPanelDialog] = useState<{ open: boolean; panel: Partial<PagePanel>; idx: number | null }>({
    open: false, panel: {}, idx: null,
  });

  // New page dialog
  const [newPageDialog, setNewPageDialog] = useState(false);
  const [newPageName, setNewPageName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pgs, vws] = await Promise.all([
        pagesApi.list(),
        api.get<ServerView[]>('/api/views'),
      ]);
      setPages(pgs);
      setViews(vws);
      // Sync selected
      if (selectedId) {
        const fresh = pgs.find(p => p.id === selectedId);
        if (fresh) setEditPage(fresh);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { load(); }, [load]);

  const selectPage = (page: Page) => {
    setSelectedId(page.id);
    setEditPage(structuredClone(page));
    setTab(0);
  };

  // ── Save name / swipe links ────────────────────────────────────────────────
  const saveMeta = async () => {
    if (!selectedId || !editPage) return;
    setSaving(true);
    try {
      const updated = await pagesApi.update(selectedId, {
        name: editPage.name,
        swipe_left_page_id: editPage.swipe_left_page_id ?? undefined,
        swipe_right_page_id: editPage.swipe_right_page_id ?? undefined,
      });
      setPages(prev => prev.map(p => p.id === selectedId ? updated : p));
      setEditPage(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Save panels ────────────────────────────────────────────────────────────
  const savePanels = async (panels: Partial<PagePanel>[]) => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const updated = await pagesApi.updatePanels(selectedId, panels);
      setPages(prev => prev.map(p => p.id === selectedId ? updated : p));
      setEditPage(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Panel dialog handlers ──────────────────────────────────────────────────
  const openAddPanel = () => setPanelDialog({
    open: true,
    panel: { name: '', x: 0, y: 0, w: 100, h: 100 },
    idx: null,
  });

  const openEditPanel = (panel: PagePanel, idx: number) => setPanelDialog({
    open: true,
    panel: { ...panel },
    idx,
  });

  const handlePanelSave = async (panel: Partial<PagePanel>) => {
    if (!editPage) return;
    const current = editPage.panels ?? [];
    let updated: Partial<PagePanel>[];
    if (panelDialog.idx === null) {
      updated = [...current, panel];
    } else {
      updated = current.map((p, i) => i === panelDialog.idx ? { ...p, ...panel } : p);
    }
    setPanelDialog(d => ({ ...d, open: false }));
    await savePanels(updated);
  };

  const deletePanel = async (idx: number) => {
    if (!editPage) return;
    const updated = (editPage.panels ?? []).filter((_, i) => i !== idx);
    await savePanels(updated);
  };

  // ── New page ───────────────────────────────────────────────────────────────
  const createPage = async () => {
    if (!newPageName.trim()) return;
    setSaving(true);
    try {
      const page = await pagesApi.create({ name: newPageName.trim() });
      setPages(prev => [...prev, page]);
      setNewPageDialog(false);
      setNewPageName('');
      selectPage(page);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete page ────────────────────────────────────────────────────────────
  const deletePage = async (id: string) => {
    if (!confirm('Delete this page? Devices assigned to it will be unassigned.')) return;
    try {
      await pagesApi.delete(id);
      setPages(prev => prev.filter(p => p.id !== id));
      if (selectedId === id) { setSelectedId(null); setEditPage(null); }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Push page to devices ───────────────────────────────────────────────────
  const pushPage = async () => {
    if (!selectedId) return;
    try {
      const { pushed_to } = await pagesApi.push(selectedId);
      alert(`Pushed to ${pushed_to} device(s).`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const currentPanels = editPage?.panels ?? [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      {/* ── Top bar ── */}
      <Paper square elevation={2} sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <IconButton onClick={() => navigate('/')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <LayersIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>Pages</Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={load} size="small"><RefreshIcon /></IconButton>
        </Tooltip>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setNewPageDialog(true)}
        >
          New Page
        </Button>
      </Paper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mx: 2, mt: 1 }}>{error}</Alert>
      )}

      {/* ── Body ── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Page List ── */}
        <Paper square elevation={0} sx={{ width: 260, borderRight: 1, borderColor: 'divider', overflow: 'auto', flexShrink: 0 }}>
          {loading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>}
          {!loading && pages.length === 0 && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">No pages yet.</Typography>
              <Button size="small" onClick={() => setNewPageDialog(true)} sx={{ mt: 1 }}>Create one</Button>
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
                  secondary={`${page.panels.length} panel${page.panels.length !== 1 ? 's' : ''}`}
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

        {/* ── Editor ── */}
        {!editPage ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Select a page to edit</Typography>
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── Page meta bar ── */}
            <Box sx={{ px: 3, pt: 2, pb: 1, flexShrink: 0 }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  label="Page Name"
                  value={editPage.name ?? ''}
                  onChange={e => setEditPage(p => p ? { ...p, name: e.target.value } : p)}
                  size="small"
                  sx={{ minWidth: 200 }}
                />
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Swipe Left →</InputLabel>
                  <Select
                    label="Swipe Left →"
                    value={editPage.swipe_left_page_id ?? ''}
                    onChange={e => setEditPage(p => p ? { ...p, swipe_left_page_id: e.target.value || undefined } : p)}
                  >
                    <MenuItem value="">(none)</MenuItem>
                    {pages.filter(p => p.id !== selectedId).map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Swipe Right →</InputLabel>
                  <Select
                    label="Swipe Right →"
                    value={editPage.swipe_right_page_id ?? ''}
                    onChange={e => setEditPage(p => p ? { ...p, swipe_right_page_id: e.target.value || undefined } : p)}
                  >
                    <MenuItem value="">(none)</MenuItem>
                    {pages.filter(p => p.id !== selectedId).map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={saveMeta}
                  disabled={saving}
                >
                  Save
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  color="secondary"
                  startIcon={<SendIcon />}
                  onClick={pushPage}
                  title="Push this page to all devices currently assigned to it"
                >
                  Push to devices
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                ID: {selectedId}
              </Typography>
            </Box>

            <Divider />

            {/* ── Tabs: Preview / Panels ── */}
            <Box sx={{ px: 3, pt: 1, flexShrink: 0 }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 36 }}>
                <Tab label="Preview" sx={{ minHeight: 36, py: 0 }} />
                <Tab label={`Panels (${currentPanels.length})`} sx={{ minHeight: 36, py: 0 }} />
              </Tabs>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 2 }}>

              {/* ── Preview tab ── */}
              {tab === 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Panel layout at 16:9 proportion. Percentages are relative to the device screen dimensions.
                  </Typography>
                  <PanelPreview panels={currentPanels} width={600} />
                  <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {currentPanels.map((p, i) => (
                      <Chip
                        key={p.id ?? i}
                        label={p.name || `panel_${i}`}
                        size="small"
                        sx={{ bgcolor: panelColor(i), color: '#fff' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* ── Panels tab ── */}
              {tab === 1 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
                    <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openAddPanel}>
                      Add Panel
                    </Button>
                  </Box>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Color</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>X%</TableCell>
                          <TableCell>Y%</TableCell>
                          <TableCell>W%</TableCell>
                          <TableCell>H%</TableCell>
                          <TableCell>Content</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {currentPanels.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} align="center">
                              <Typography variant="body2" color="text.secondary">No panels. Click "Add Panel" to get started.</Typography>
                            </TableCell>
                          </TableRow>
                        )}
                        {currentPanels.map((p, i) => (
                          <TableRow key={p.id ?? i} hover>
                            <TableCell>
                              <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: panelColor(i) }} />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{p.name || `panel_${i}`}</TableCell>
                            <TableCell>{p.x}</TableCell>
                            <TableCell>{p.y}</TableCell>
                            <TableCell>{p.w}</TableCell>
                            <TableCell>{p.h}</TableCell>
                            <TableCell>
                              {p.view_id
                                ? <Chip label={views.find(v => v.id === p.view_id)?.name ?? p.view_id} size="small" sx={{ bgcolor: 'rgba(108,99,255,0.2)' }} />
                                : p.url
                                  ? <Chip label="External URL" size="small" sx={{ bgcolor: 'rgba(255,101,132,0.2)' }} />
                                  : <Typography variant="caption" color="text.disabled">—</Typography>
                              }
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="Edit panel">
                                <IconButton size="small" onClick={() => openEditPanel(p, i)}><EditIcon fontSize="small" /></IconButton>
                              </Tooltip>
                              <Tooltip title="Delete panel">
                                <IconButton size="small" onClick={() => deletePanel(i)}><DeleteIcon fontSize="small" /></IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Panel Edit Dialog ── */}
      <PanelEditDialog
        open={panelDialog.open}
        panel={panelDialog.panel}
        views={views}
        onClose={() => setPanelDialog(d => ({ ...d, open: false }))}
        onSave={handlePanelSave}
      />

      {/* ── New Page Dialog ── */}
      <Dialog open={newPageDialog} onClose={() => setNewPageDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Page</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Page Name"
            value={newPageName}
            onChange={e => setNewPageName(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            onKeyDown={e => { if (e.key === 'Enter') createPage(); }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewPageDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={createPage} disabled={!newPageName.trim() || saving}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
