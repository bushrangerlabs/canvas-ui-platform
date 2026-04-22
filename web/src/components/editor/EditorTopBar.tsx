import { Box, AppBar, Toolbar, Typography, Button, Chip, IconButton, Tooltip } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import GridOnIcon from '@mui/icons-material/GridOn';
import GridOffIcon from '@mui/icons-material/GridOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { useEditorStore } from '../../store';

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function EditorTopBar({ sidebarOpen, onToggleSidebar }: Props) {
  const { activeView, isDirty, saveActiveView, snapEnabled, toggleSnap } = useEditorStore();

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

        <Tooltip title={snapEnabled ? 'Snap to grid: ON (click to disable)' : 'Snap to grid: OFF (click to enable)'}>
          <IconButton size="small" onClick={toggleSnap} color={snapEnabled ? 'primary' : 'default'}>
            {snapEnabled ? <GridOnIcon fontSize="small" /> : <GridOffIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Undo (coming soon)">
          <span>
            <IconButton size="small" disabled>
              <UndoIcon fontSize="small" />
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
