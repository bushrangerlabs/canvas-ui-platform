import { Box, AppBar, Toolbar, Typography, Button, Chip, IconButton, Tooltip, Popover, List, ListItemButton, ListItemText, Divider } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import HistoryIcon from '@mui/icons-material/History';
import GridOnIcon from '@mui/icons-material/GridOn';
import GridOffIcon from '@mui/icons-material/GridOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MonitorIcon from '@mui/icons-material/Monitor';
import SettingsIcon from '@mui/icons-material/Settings';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditorStore } from '../../store';

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function EditorTopBar({ sidebarOpen, onToggleSidebar }: Props) {
  const navigate = useNavigate();
  const { activeView, isDirty, saveActiveView, snapEnabled, toggleSnap, _past, _future, undo, redo, jumpToHistory } = useEditorStore();
  const canUndo = _past.length > 0;
  const canRedo = _future.length > 0;

  const [historyAnchor, setHistoryAnchor] = useState<HTMLElement | null>(null);

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar variant="dense" sx={{ gap: 1 }}>
        <Tooltip title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
          <IconButton size="small" onClick={onToggleSidebar} sx={{ mr: 0.5 }}>
            {sidebarOpen ? <MenuOpenIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Typography variant="h6" component="div" sx={{ color: 'primary.main', fontWeight: 700, mr: 2 }}>
          Canvas UI
        </Typography>

        {activeView && (
          <>
            <Typography variant="body1" sx={{ flex: 1 }}>
              {activeView.name}
            </Typography>
            {isDirty && (
              <Chip label="Unsaved" size="small" color="warning" variant="outlined" />
            )}
          </>
        )}

        <Box sx={{ flex: activeView ? 0 : 1 }} />

        <Tooltip title="Preview (display mode)">
          <span>
            <IconButton
              size="small"
              disabled={!activeView}
              onClick={() => window.open('/display', '_blank')}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Manage devices">
          <IconButton size="small" onClick={() => navigate('/devices')}>
            <MonitorIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Schedules">
          <IconButton size="small" onClick={() => navigate('/schedules')}>
            <CalendarMonthIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Settings">
          <IconButton size="small" onClick={() => navigate('/settings')}>
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title={snapEnabled ? 'Snap to grid: ON (click to disable)' : 'Snap to grid: OFF (click to enable)'}>
          <IconButton size="small" onClick={toggleSnap} color={snapEnabled ? 'primary' : 'default'}>
            {snapEnabled ? <GridOnIcon fontSize="small" /> : <GridOffIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Undo (Ctrl+Z)">
          <span>
            <IconButton size="small" disabled={!canUndo} onClick={undo}>
              <UndoIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Undo history">
          <span>
            <IconButton
              size="small"
              disabled={!canUndo}
              onClick={(e) => setHistoryAnchor(e.currentTarget)}
              sx={{ ml: -0.75 }}
            >
              <HistoryIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </span>
        </Tooltip>

        <Popover
          open={Boolean(historyAnchor)}
          anchorEl={historyAnchor}
          onClose={() => setHistoryAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Box sx={{ width: 240, maxHeight: 360, overflowY: 'auto' }}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" color="text.secondary">Undo history ({_past.length} steps)</Typography>
            </Box>
            <Divider />
            <List dense disablePadding>
              {[..._past].reverse().map((snapshot, i) => {
                const realIdx = _past.length - 1 - i;
                return (
                  <ListItemButton
                    key={realIdx}
                    onClick={() => {
                      jumpToHistory(realIdx);
                      setHistoryAnchor(null);
                    }}
                  >
                    <ListItemText
                      primary={snapshot.name || `Step ${realIdx + 1}`}
                      secondary={`${snapshot.widgets.length} widget${snapshot.widgets.length !== 1 ? 's' : ''}`}
                      slotProps={{ primary: { variant: 'body2', noWrap: true } }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        </Popover>

        <Tooltip title="Redo (Ctrl+Shift+Z)">
          <span>
            <IconButton size="small" disabled={!canRedo} onClick={redo}>
              <RedoIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Button
          size="small"
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={!activeView || !isDirty}
          onClick={saveActiveView}
        >
          Save
        </Button>
      </Toolbar>
    </AppBar>
  );
}
