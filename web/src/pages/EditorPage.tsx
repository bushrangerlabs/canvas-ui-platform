/**
 * EditorPage — full canvas editor layout.
 *
 * Layout (3-column):
 *   ┌─────────────┬──────────────────────┬─────────────────┐
 *   │  Sidebar    │      Canvas          │   Inspector     │
 *   │ (view list, │  (widget drag/drop)  │ (widget fields) │
 *   │  widget lib)│                      │                  │
 *   └─────────────┴──────────────────────┴─────────────────┘
 */
import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useEditorStore } from '../store';
import EditorTopBar from '../components/editor/EditorTopBar';
import EditorSidebar from '../components/editor/EditorSidebar';
import CanvasArea from '../components/canvas/CanvasArea';
import Inspector from '../components/inspector/Inspector';

export default function EditorPage() {
  const { loadViews } = useEditorStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <EditorTopBar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {sidebarOpen && <EditorSidebar />}
        <CanvasArea />
        <Inspector />
      </Box>
    </Box>
  );
}
