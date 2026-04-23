import { useState } from 'react';
import {
  Box, Tabs, Tab, List, ListItemButton, ListItemText, ListItemIcon,
  Typography, IconButton, Button, Tooltip, Divider, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import WidgetsIcon from '@mui/icons-material/Widgets';
import LayersIcon from '@mui/icons-material/Layers';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useEditorStore } from '../../store';
import { WIDGET_REGISTRY } from '../widgets/registry';
import WidgetIcon from '../WidgetIcon';
import type { WidgetConfig } from '../../types';

const CATEGORY_ORDER = ['display', 'clocks', 'control', 'media', 'layout'];
const CATEGORY_LABELS: Record<string, string> = {
  display: 'Display',
  clocks: 'Clocks',
  control: 'Controls',
  media: 'Media',
  layout: 'Layout',
};

export default function EditorSidebar() {
  const [tab, setTab] = useState(0);
  const [newViewName, setNewViewName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const { views, activeViewId, openView, createView, deleteView, addWidget, activeView,
          selectWidget, selectedWidgetIds, toggleWidgetLocked, updateWidget, importView } = useEditorStore();
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);

  function handleExportView(e: React.MouseEvent, v: { id: string; name: string; view_data: import('../../types').ViewConfig }) {
    e.stopPropagation();
    const json = JSON.stringify(v.view_data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${v.name.replace(/[^a-z0-9_-]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        // Accept both a bare ViewConfig and a ServerView export
        const viewData = data.view_data ?? data;
        viewData.name = viewData.name ?? file.name.replace(/\.json$/i, '');
        await importView(viewData);
      } catch {
        alert('Failed to import view — invalid JSON.');
      }
    };
    input.click();
  }

  const toggleCategory = (cat: string) =>
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));

  async function handleCreateView() {
    if (!newViewName.trim()) return;
    await createView(newViewName.trim());
    setNewViewName('');
    setDialogOpen(false);
  }

  function handleAddWidget(type: string) {
    if (!activeView) return;
    const meta = WIDGET_REGISTRY[type];
    if (!meta) return;
    const widget: Omit<WidgetConfig, 'id'> = {
      type,
      position: { x: 100, y: 100, width: meta.defaultSize.w, height: meta.defaultSize.h, zIndex: 1 },
      config: Object.fromEntries(
        meta.fields.map((f) => [f.name, f.default ?? ''])
      ),
    };
    addWidget(widget);
  }

  const filteredWidgets = Object.entries(WIDGET_REGISTRY).filter(([, meta]) =>
    meta.name.toLowerCase().includes(search.toLowerCase()) ||
    meta.category.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category when not searching
  const groupedWidgets = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    widgets: filteredWidgets.filter(([, m]) => m.category.toLowerCase() === cat.toLowerCase()),
  })).filter((g) => g.widgets.length > 0);

  // If searching, show flat list; otherwise grouped
  const isSearching = search.trim().length > 0;

  return (
    <Box
      sx={{
        width: 240,
        flexShrink: 0,
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ minHeight: 40 }}>
        <Tab icon={<ViewQuiltIcon fontSize="small" />} iconPosition="start" label="Views" sx={{ minHeight: 40, fontSize: 11 }} />
        <Tab icon={<WidgetsIcon fontSize="small" />} iconPosition="start" label="Widgets" sx={{ minHeight: 40, fontSize: 11 }} />
        <Tab icon={<LayersIcon fontSize="small" />} iconPosition="start" label="Layers" sx={{ minHeight: 40, fontSize: 11 }} />
      </Tabs>
      <Divider />

      {tab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <Box sx={{ p: 1, display: 'flex', gap: 0.5 }}>
            <Button
              fullWidth
              size="small"
              startIcon={<AddIcon />}
              variant="outlined"
              onClick={() => setDialogOpen(true)}
            >
              New View
            </Button>
            <Tooltip title="Import view from JSON">
              <IconButton size="small" onClick={handleImportClick}>
                <FileUploadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <List dense sx={{ flex: 1, overflowY: 'auto', py: 0 }}>
            {views.map((v) => (
              <ListItemButton
                key={v.id}
                selected={v.id === activeViewId}
                onClick={() => openView(v.id)}
                sx={{ pr: 1 }}
              >
                <ListItemText
                  primary={v.name}
                  slotProps={{ primary: { noWrap: true, variant: "body2" } }}
                />
                <Tooltip title="Export view as JSON">
                  <IconButton
                    size="small"
                    onClick={(e) => handleExportView(e, v)}
                  >
                    <FileDownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete view">
                  <IconButton
                    size="small"
                    edge="end"
                    onClick={(e) => { e.stopPropagation(); deleteView(v.id); }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItemButton>
            ))}
            {views.length === 0 && (
              <Typography variant="caption" sx={{ p: 2, display: 'block', color: 'text.secondary' }}>
                No views yet. Create one above.
              </Typography>
            )}
          </List>
        </Box>
      )}

      {tab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <Box sx={{ p: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search widgets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!activeView}
            />
          </Box>
          {!activeView && (
            <Typography variant="caption" sx={{ p: 2, color: 'text.secondary' }}>
              Open a view first to add widgets.
            </Typography>
          )}
          <List dense sx={{ flex: 1, overflowY: 'auto', py: 0 }}>
            {isSearching ? (
              filteredWidgets.map(([type, meta]) => (
                <ListItemButton key={type} onClick={() => handleAddWidget(type)} disabled={!activeView}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <WidgetIcon name={meta.icon} fontSize="small" sx={{ color: 'primary.main' }} />
                  </ListItemIcon>
                  <ListItemText primary={meta.name} secondary={meta.category} />
                </ListItemButton>
              ))
            ) : (
              groupedWidgets.map(({ cat, label, widgets }) => (
                <Box key={cat}>
                  <ListItemButton
                    dense
                    onClick={() => toggleCategory(cat)}
                    sx={{ py: 0.5, bgcolor: 'action.hover' }}
                  >
                    <ListItemText
                      primary={label}
                      slotProps={{ primary: { variant: 'caption', sx: { fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' } } }}
                    />
                    {collapsedCategories[cat] ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
                  </ListItemButton>
                  <Collapse in={!collapsedCategories[cat]}>
                    {widgets.map(([type, meta]) => (
                      <ListItemButton key={type} onClick={() => handleAddWidget(type)} disabled={!activeView} sx={{ pl: 2 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <WidgetIcon name={meta.icon} fontSize="small" sx={{ color: 'primary.main' }} />
                        </ListItemIcon>
                        <ListItemText primary={meta.name} />
                      </ListItemButton>
                    ))}
                  </Collapse>
                </Box>
              ))
            )}
          </List>
        </Box>
      )}

      {/* Layers panel */}
      {tab === 2 && (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {!activeView ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No view open.</Typography>
          ) : activeView.widgets.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No widgets yet.</Typography>
          ) : (
            <List dense disablePadding>
              {[...activeView.widgets]
                .sort((a, b) => (b.position.zIndex ?? 1) - (a.position.zIndex ?? 1))
                .map((w) => {
                  const meta = WIDGET_REGISTRY[w.type];
                  const isSelected = selectedWidgetIds.includes(w.id);
                  return (
                    <ListItemButton
                      key={w.id}
                      selected={isSelected}
                      onClick={() => selectWidget(w.id)}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragLayerId(w.id); }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!dragLayerId || dragLayerId === w.id || !activeView) return;
                        const sorted = [...activeView.widgets]
                          .sort((a, b) => (b.position.zIndex ?? 1) - (a.position.zIndex ?? 1));
                        const fromIdx = sorted.findIndex((x) => x.id === dragLayerId);
                        const toIdx = sorted.findIndex((x) => x.id === w.id);
                        if (fromIdx < 0 || toIdx < 0) return;
                        const reordered = [...sorted];
                        const [moved] = reordered.splice(fromIdx, 1);
                        reordered.splice(toIdx, 0, moved);
                        const maxZ = reordered.length;
                        reordered.forEach((widget, i) => {
                          updateWidget(widget.id, { position: { ...widget.position, zIndex: maxZ - i } });
                        });
                        setDragLayerId(null);
                      }}
                      onDragEnd={() => setDragLayerId(null)}
                      sx={{
                        py: 0.5, px: 1, gap: 0.5,
                        opacity: dragLayerId === w.id ? 0.4 : 1,
                      }}
                    >
                      <DragIndicatorIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0, cursor: 'grab', mr: 0.25 }} />
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <WidgetIcon name={meta?.icon ?? 'Widgets'} sx={{ fontSize: 14 }} />
                      </ListItemIcon>
                      <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <Typography noWrap sx={{ fontSize: 12, lineHeight: 1.4 }}>
                          {w.name || meta?.name || w.type}
                        </Typography>
                      </Box>
                      <Tooltip title={w.locked ? 'Unlock' : 'Lock'}>
                        <IconButton size="small" sx={{ p: '2px' }}
                          onClick={(e) => { e.stopPropagation(); toggleWidgetLocked(w.id); }}>
                          {w.locked
                            ? <LockIcon sx={{ fontSize: 13, color: 'warning.main' }} />
                            : <LockOpenIcon sx={{ fontSize: 13, color: 'text.disabled' }} />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={w.hiddenInEdit ? 'Show in editor' : 'Hide in editor'}>
                        <IconButton size="small" sx={{ p: '2px' }}
                          onClick={(e) => { e.stopPropagation(); updateWidget(w.id, { hiddenInEdit: !w.hiddenInEdit }); }}>
                          {w.hiddenInEdit
                            ? <VisibilityOffIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                            : <VisibilityIcon sx={{ fontSize: 13, color: 'text.disabled' }} />}
                        </IconButton>
                      </Tooltip>
                    </ListItemButton>
                  );
                })}
            </List>
          )}
        </Box>
      )}

      {/* New View Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create New View</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="View Name"
            fullWidth
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateView()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateView} disabled={!newViewName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
