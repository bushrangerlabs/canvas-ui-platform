import { Box, AppBar, Toolbar, Typography, Button, Chip, IconButton, Tooltip } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useEditorStore } from '../../store';

export default function EditorTopBar() {
  const { activeView, isDirty, saveActiveView } = useEditorStore();

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar variant="dense" sx={{ gap: 1 }}>
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
