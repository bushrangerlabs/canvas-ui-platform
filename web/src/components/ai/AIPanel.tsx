/**
 * AIPanel — AI-powered dashboard generation chat interface.
 *
 * Lives in the editor sidebar as a third tab.
 * - Entity selector  → choose HA entities as context
 * - Chat history     → shows user/AI messages
 * - Text input       → with optional image attachment
 * - On success       → imports generated widgets into active view with undo support
 */
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import SendIcon from '@mui/icons-material/Send';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHAEntities } from '../../context/HAEntitiesContext';
import { aiService, type ChatMessage } from '../../services/ai/AIService';
import type { SelectedEntity } from '../../services/ai/PromptBuilder';
import { useEditorStore } from '../../store';
import type { ViewConfig, WidgetConfig } from '../../types';
import { AISettingsDialog } from './AISettingsDialog';

// ─── Entity Selector Dialog ──────────────────────────────────────────────────

interface EntityPickerProps {
  open: boolean;
  onClose: () => void;
  selected: SelectedEntity[];
  onSelect: (entities: SelectedEntity[]) => void;
}

const EntityPicker: React.FC<EntityPickerProps> = ({ open, onClose, selected, onSelect }) => {
  const { entities } = useHAEntities();
  const [filter, setFilter] = useState('');
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set(selected.map(e => e.entity_id)));

  useEffect(() => {
    if (open) setLocalSelected(new Set(selected.map(e => e.entity_id)));
  }, [open, selected]);

  if (!open) return null;

  const allEntities = Object.values(entities ?? {});
  const filtered = allEntities.filter(e =>
    !filter || e.entity_id.toLowerCase().includes(filter.toLowerCase()) ||
    (e.attributes?.friendly_name ?? '').toLowerCase().includes(filter.toLowerCase()),
  );

  function toggle(entityId: string) {
    setLocalSelected(s => {
      const n = new Set(s);
      n.has(entityId) ? n.delete(entityId) : n.add(entityId);
      return n;
    });
  }

  function handleConfirm() {
    const result: SelectedEntity[] = Array.from(localSelected).map(id => {
      const e = entities?.[id];
      return {
        entity_id: id,
        friendly_name: e?.attributes?.friendly_name ?? id,
        domain: id.split('.')[0],
        state: e?.state,
      };
    });
    onSelect(result);
    onClose();
  }

  return (
    <Box
      sx={{
        position: 'absolute', inset: 0, zIndex: 100, bgcolor: '#151520',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <Box sx={{ p: 1, borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'white', flex: 1 }}>Select Entities</Typography>
        <Button size="small" onClick={onClose} sx={{ fontSize: 11 }}>Cancel</Button>
        <Button size="small" variant="contained" onClick={handleConfirm} sx={{ fontSize: 11 }}>
          Done ({localSelected.size})
        </Button>
      </Box>
      <Box sx={{ p: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Filter entities..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          autoFocus
          slotProps={{ input: { sx: { fontSize: 12 } } }}
        />
      </Box>
      <List dense sx={{ flex: 1, overflow: 'auto', p: 0 }}>
        {filtered.map(e => (
          <ListItemButton
            key={e.entity_id}
            selected={localSelected.has(e.entity_id)}
            onClick={() => toggle(e.entity_id)}
            sx={{ py: 0.5, px: 1 }}
          >
            <ListItemText
              primary={e.attributes?.friendly_name ?? e.entity_id}
              secondary={`${e.entity_id} · ${e.state}`}
              slotProps={{ primary: { sx: { fontSize: 12 } }, secondary: { sx: { fontSize: 10 } } }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
};

// ─── Message bubble ──────────────────────────────────────────────────────────

const MsgBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', mb: 1 }}>
      <Paper
        elevation={0}
        sx={{
          maxWidth: '90%', px: 1.5, py: 1,
          bgcolor: isUser ? '#2d4a7a' : '#252535',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        }}
      >
        <Typography sx={{ fontSize: 12, color: '#e0e0e0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {msg.content}
        </Typography>
        <Typography sx={{ fontSize: 9, color: '#555', mt: 0.5 }}>
          {new Date(msg.timestamp).toLocaleTimeString()}
        </Typography>
      </Paper>
    </Box>
  );
};

// ─── AIPanel ─────────────────────────────────────────────────────────────────

export const AIPanel: React.FC = () => {
  const { activeView, activeViewId, saveActiveView } = useEditorStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedEntities, setSelectedEntities] = useState<SelectedEntity[]>([]);
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [imageName, setImageName] = useState('');
  const [entityPickerOpen, setEntityPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync messages with service history
  useEffect(() => {
    setMessages(aiService.getHistory());
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setError('');
    setSuccess('');
    setLoading(true);
    setLoadingMsg('Generating dashboard…');

    const currentWidgets = activeView?.widgets ?? [];

    const result = await aiService.generate({
      userRequest: text,
      entities: selectedEntities,
      viewId: activeViewId ?? 'ai-view',
      viewName: activeView?.name ?? 'AI Dashboard',
      currentWidgets,
      viewWidth: activeView?.sizex ?? 1920,
      viewHeight: activeView?.sizey ?? 1080,
      imageDataUrl,
    });

    // Update chat history display
    setMessages([...aiService.getHistory()]);
    setImageDataUrl(undefined);
    setImageName('');
    setLoading(false);
    setLoadingMsg('');

    if (!result.success || !result.extractedView) {
      setError(result.error ?? 'Unknown error');
      return;
    }

    // Import widgets into active view via Zustand (with undo)
    const newWidgets = result.extractedView.view.widgets as WidgetConfig[];
    useEditorStore.setState((s) => {
      if (!s.activeView) return s;
      return {
        _past: [...(s._past ?? []).slice(-49), structuredClone(s.activeView as ViewConfig)],
        _future: [],
        activeView: { ...(s.activeView as ViewConfig), widgets: newWidgets },
        isDirty: true,
      };
    });

    // Auto-save
    setTimeout(() => saveActiveView().catch(() => {}), 300);

    setSuccess(`✓ Imported ${result.widgetCount} widget${result.widgetCount === 1 ? '' : 's'}`);
    setTimeout(() => setSuccess(''), 4000);
  }, [input, loading, activeView, activeViewId, selectedEntities, imageDataUrl, saveActiveView]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setImageDataUrl(ev.target?.result as string);
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleClear() {
    aiService.clearHistory();
    setMessages([]);
    setError('');
    setSuccess('');
  }

  const hasNoView = !activeView;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Entity picker overlay */}
      <EntityPicker
        open={entityPickerOpen}
        onClose={() => setEntityPickerOpen(false)}
        selected={selectedEntities}
        onSelect={setSelectedEntities}
      />

      {/* Settings dialog */}
      <AISettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Header */}
      <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#aaa', flex: 1 }}>
          AI Builder
        </Typography>
        <Tooltip title="Clear history">
          <IconButton size="small" onClick={handleClear} sx={{ color: '#555' }}>
            <ClearAllIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="AI Settings">
          <IconButton size="small" onClick={() => setSettingsOpen(true)} sx={{ color: '#555' }}>
            <SettingsIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Entity chips */}
      <Box sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid #2a2a3a', display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
        <Tooltip title="Add HA entities as context for AI">
          <Button
            size="small"
            startIcon={<PersonSearchIcon sx={{ fontSize: 14 }} />}
            onClick={() => setEntityPickerOpen(true)}
            sx={{ fontSize: 10, py: 0.3, px: 0.8, minWidth: 0, color: '#888', bgcolor: '#1e1e2e', border: '1px dashed #444' }}
          >
            {selectedEntities.length === 0 ? 'Add entities' : 'Edit'}
          </Button>
        </Tooltip>
        {selectedEntities.map(e => (
          <Chip
            key={e.entity_id}
            label={e.friendly_name}
            size="small"
            onDelete={() => setSelectedEntities(s => s.filter(x => x.entity_id !== e.entity_id))}
            sx={{ fontSize: 10, height: 20 }}
          />
        ))}
      </Box>

      {/* Chat history */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1, display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, opacity: 0.4 }}>
            <Typography sx={{ fontSize: 28 }}>🤖</Typography>
            <Typography sx={{ fontSize: 12, color: '#888', textAlign: 'center' }}>
              Describe a dashboard to create or edit
            </Typography>
            <Typography sx={{ fontSize: 11, color: '#666', textAlign: 'center' }}>
              e.g. "Create a dark dashboard with a temperature gauge and a light toggle"
            </Typography>
          </Box>
        )}
        {messages.map((m, i) => <MsgBubble key={i} msg={m} />)}
        {loading && (
          <Box sx={{ py: 1 }}>
            <LinearProgress sx={{ mb: 0.5 }} />
            <Typography sx={{ fontSize: 11, color: '#888' }}>{loadingMsg}</Typography>
          </Box>
        )}
        <div ref={bottomRef} />
      </Box>

      {/* Status messages */}
      {error && <Alert severity="error" sx={{ mx: 1, mb: 0.5, fontSize: 11, py: 0 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mx: 1, mb: 0.5, fontSize: 11, py: 0 }}>{success}</Alert>}
      {hasNoView && <Alert severity="warning" sx={{ mx: 1, mb: 0.5, fontSize: 11, py: 0 }}>Open a view to use AI Builder</Alert>}

      {/* Image attachment indicator */}
      {imageDataUrl && (
        <Box sx={{ mx: 1, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: '#1e2a1e', borderRadius: 1, px: 1, py: 0.5 }}>
          <Typography sx={{ fontSize: 11, color: '#8f8', flex: 1 }}>📎 {imageName}</Typography>
          <Button size="small" onClick={() => { setImageDataUrl(undefined); setImageName(''); }} sx={{ fontSize: 10, minWidth: 0, py: 0 }}>✕</Button>
        </Box>
      )}

      {/* Input area */}
      <Box sx={{ p: 1, borderTop: '1px solid #333', display: 'flex', gap: 0.5, alignItems: 'flex-end' }}>
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={handleFileAttach}
        />
        <Tooltip title="Attach screenshot / mockup">
          <IconButton
            size="small"
            onClick={() => fileInputRef.current?.click()}
            sx={{ color: imageDataUrl ? '#8f8' : '#555', mb: 0.5 }}
          >
            <AttachFileIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <TextField
          multiline
          maxRows={4}
          fullWidth
          size="small"
          placeholder={hasNoView ? 'Open a view first…' : 'Describe your dashboard…'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || hasNoView}
          slotProps={{ input: { sx: { fontSize: 12 } } }}
        />
        <IconButton
          onClick={handleSend}
          disabled={!input.trim() || loading || hasNoView}
          size="small"
          color="primary"
          sx={{ mb: 0.5 }}
        >
          {loading ? <CircularProgress size={16} /> : <SendIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>
    </Box>
  );
};
