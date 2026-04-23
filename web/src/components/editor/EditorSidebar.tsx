import { useState } from 'react';
import {
  Box, Tabs, Tab, List, ListItemButton, ListItemText, ListItemIcon,
  Typography, IconButton, Button, Tooltip, Divider, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import WidgetsIcon from '@mui/icons-material/Widgets';
import { useEditorStore } from '../../store';
import { WIDGET_REGISTRY } from '../widgets/registry';
import WidgetIcon from '../WidgetIcon';
import type { WidgetConfig } from '../../types';

const CATEGORY_ORDER = ['display', 'clocks', 'control', 'data', 'layout'];
const CATEGORY_LABELS: Record<string, string> = {
  display: 'Display',
  clocks: 'Clocks',
  control: 'Controls',
  data: 'Data',
  layout: 'Layout',
};

export default function EditorSidebar() {
  const [tab, setTab] = useState(0);
  const [newViewName, setNewViewName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const { views, activeViewId, openView, createView, deleteView, addWidget, activeView } = useEditorStore();

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
        <Tab icon={<ViewQuiltIcon fontSize="small" />} iconPosition="start" label="Views" sx={{ minHeight: 40 }} />
        <Tab icon={<WidgetsIcon fontSize="small" />} iconPosition="start" label="Widgets" sx={{ minHeight: 40 }} />
      </Tabs>
      <Divider />

      {tab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <Box sx={{ p: 1 }}>
            <Button
              fullWidth
              size="small"
              startIcon={<AddIcon />}
              variant="outlined"
              onClick={() => setDialogOpen(true)}
            >
              New View
            </Button>
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
