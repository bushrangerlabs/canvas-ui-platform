/**
 * AISettingsDialog — configure AI provider, API keys, model.
 * Settings are stored server-side in server_settings table.
 */
import SmartToyIcon from '@mui/icons-material/SmartToy';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { aiService, type AIProvider, type AISettings } from '../../services/ai/AIService';
import { promptTemplateStore, type PromptTemplates } from '../../services/ai/PromptTemplateStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PROVIDERS: { value: AIProvider; label: string; desc: string }[] = [
  { value: 'ollama',        label: 'Ollama (local)',     desc: 'Runs locally on your server' },
  { value: 'openai',        label: 'OpenAI',             desc: 'GPT-4o, GPT-4o-mini, or custom OpenAI-compat endpoint' },
  { value: 'github',        label: 'GitHub Models',      desc: 'Free tier via GitHub token' },
  { value: 'groq',          label: 'Groq',               desc: 'Fast inference, free tier available' },
  { value: 'openwebui',     label: 'Open WebUI',         desc: 'Self-hosted Open WebUI instance' },
  { value: 'copilotproxy',  label: 'Copilot Proxy',      desc: 'GitHub Copilot via proxy service' },
];

const EMPTY: Partial<AISettings> = {};

const PROMPT_SECTIONS: { key: keyof PromptTemplates; label: string; desc: string }[] = [
  { key: 'systemPromptCreate', label: 'Create Prompt', desc: 'System instructions when building a new dashboard from scratch' },
  { key: 'systemPromptEdit',   label: 'Edit Prompt',   desc: 'System instructions when modifying an existing dashboard' },
  { key: 'widgetCatalog',      label: 'Widget Catalog', desc: 'Auto-generated — edit to add hints or correct AI mistakes' },
  { key: 'outputFormat',       label: 'Output Format',  desc: 'JSON structure the AI must follow' },
];

export const AISettingsDialog: React.FC<Props> = ({ open, onClose }) => {
  const [settings, setSettings] = useState<Partial<AISettings>>(EMPTY);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Prompt templates state
  const [templates, setTemplates] = useState<PromptTemplates>(() => promptTemplateStore.getTemplates());
  const [promptTab, setPromptTab] = useState(0);

  // Pending raw key values (never sent to GET, stored separately via /key endpoint)
  const [pendingKeys, setPendingKeys] = useState<Partial<Record<keyof AISettings, string>>>({});

  useEffect(() => {
    if (!open) return;
    setError('');
    setSaved(false);
    setPendingKeys({});
    setActiveTab(0);
    setPromptTab(0);
    setTemplates(promptTemplateStore.getTemplates());
    aiService.loadSettings().then(s => setSettings(s));
  }, [open]);

  const provider = (settings.ai_provider || 'ollama') as AIProvider;

  function handleChange(key: keyof AISettings, value: string) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  // For sensitive key fields — tracked separately so we can send them raw
  function handleKeyField(key: keyof AISettings, value: string) {
    setPendingKeys(p => ({ ...p, [key]: value }));
    setSettings(s => ({ ...s, [key]: value })); // show in UI
  }

  async function handleFetchModels() {
    setLoadingModels(true);
    setError('');
    // Save current pending keys first so the server can use them for model listing
    await flushPendingKeys();
    const ms = await aiService.fetchModels();
    setLoadingModels(false);
    if (!ms.length) { setError('No models found — check provider config'); return; }
    setModels(ms);
    if (!settings.ai_model || !ms.includes(settings.ai_model)) {
      handleChange('ai_model', ms[0]);
    }
  }

  async function flushPendingKeys() {
    for (const [k, v] of Object.entries(pendingKeys)) {
      if (v) await aiService.saveKey(k as keyof AISettings, v);
    }
    setPendingKeys({});
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await flushPendingKeys();
      // Save non-sensitive settings (masked values will be skipped server-side)
      await aiService.saveSettings({
        ai_provider: settings.ai_provider,
        ai_model: settings.ai_model,
        ai_ollama_url: settings.ai_ollama_url,
        ai_openai_base_url: settings.ai_openai_base_url,
        ai_openwebui_url: settings.ai_openwebui_url,
        ai_copilotproxy_url: settings.ai_copilotproxy_url,
        ai_timeout_ms: settings.ai_timeout_ms,
      });
      // Save prompt templates
      promptTemplateStore.saveTemplates(templates);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const isMasked = (v: string | undefined) =>
    !v || v === '***' || (v.length === 12 && v.includes('****'));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { bgcolor: '#1e1e2e' } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'white', pb: 0 }}>
        <SmartToyIcon /> AI Settings
      </DialogTitle>
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ px: 2, borderBottom: '1px solid #333' }}>
        <Tab label="Provider" sx={{ fontSize: 12, minHeight: 36 }} />
        <Tab label="Prompts" sx={{ fontSize: 12, minHeight: 36 }} />
      </Tabs>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
        {error && <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>}
        {saved && <Alert severity="success" sx={{ fontSize: 12 }}>Settings saved</Alert>}

        {activeTab === 0 && (<>

        {/* Provider */}
        <FormControl>
          <FormLabel sx={{ color: '#aaa', fontSize: 12, mb: 0.5 }}>Provider</FormLabel>
          <RadioGroup value={provider} onChange={e => handleChange('ai_provider', e.target.value)}>
            {PROVIDERS.map(p => (
              <FormControlLabel
                key={p.value}
                value={p.value}
                control={<Radio size="small" sx={{ color: '#666' }} />}
                label={
                  <Box>
                    <Typography sx={{ fontSize: 13, color: 'white', lineHeight: 1.2 }}>{p.label}</Typography>
                    <Typography sx={{ fontSize: 11, color: '#666' }}>{p.desc}</Typography>
                  </Box>
                }
                sx={{ mb: 0.5, alignItems: 'flex-start', mt: 0.5 }}
              />
            ))}
          </RadioGroup>
        </FormControl>

        {/* Provider-specific fields */}
        {provider === 'ollama' && (
          <TextField
            label="Ollama URL"
            size="small"
            value={settings.ai_ollama_url || ''}
            onChange={e => handleChange('ai_ollama_url', e.target.value)}
            placeholder="http://localhost:11434"
            slotProps={{ input: { sx: { fontSize: 13 } } }}
          />
        )}
        {provider === 'openai' && (
          <>
            <TextField
              label="OpenAI API Key"
              size="small"
              type="password"
              value={isMasked(settings.ai_openai_key) ? '' : (pendingKeys.ai_openai_key ?? '')}
              onChange={e => handleKeyField('ai_openai_key', e.target.value)}
              placeholder={isMasked(settings.ai_openai_key) ? '(saved — enter new to change)' : 'sk-...'}
              slotProps={{ input: { sx: { fontSize: 13 } } }}
            />
            <TextField
              label="OpenAI Base URL"
              size="small"
              value={settings.ai_openai_base_url || ''}
              onChange={e => handleChange('ai_openai_base_url', e.target.value)}
              placeholder="https://api.openai.com/v1"
              helperText="Change for OpenRouter or other compatible endpoints"
              slotProps={{ input: { sx: { fontSize: 13 } } }}
            />
          </>
        )}
        {provider === 'github' && (
          <TextField
            label="GitHub Token"
            size="small"
            type="password"
            value={isMasked(settings.ai_github_token) ? '' : (pendingKeys.ai_github_token ?? '')}
            onChange={e => handleKeyField('ai_github_token', e.target.value)}
            placeholder={isMasked(settings.ai_github_token) ? '(saved — enter new to change)' : 'github_pat_...'}
            slotProps={{ input: { sx: { fontSize: 13 } } }}
          />
        )}
        {provider === 'groq' && (
          <TextField
            label="Groq API Key"
            size="small"
            type="password"
            value={isMasked(settings.ai_groq_key) ? '' : (pendingKeys.ai_groq_key ?? '')}
            onChange={e => handleKeyField('ai_groq_key', e.target.value)}
            placeholder={isMasked(settings.ai_groq_key) ? '(saved — enter new to change)' : 'gsk_...'}
            slotProps={{ input: { sx: { fontSize: 13 } } }}
          />
        )}
        {provider === 'openwebui' && (
          <>
            <TextField
              label="Open WebUI URL"
              size="small"
              value={settings.ai_openwebui_url || ''}
              onChange={e => handleChange('ai_openwebui_url', e.target.value)}
              placeholder="http://localhost:3000"
              slotProps={{ input: { sx: { fontSize: 13 } } }}
            />
            <TextField
              label="Open WebUI API Key (optional)"
              size="small"
              type="password"
              value={isMasked(settings.ai_openwebui_key) ? '' : (pendingKeys.ai_openwebui_key ?? '')}
              onChange={e => handleKeyField('ai_openwebui_key', e.target.value)}
              placeholder={isMasked(settings.ai_openwebui_key) ? '(saved — enter new to change)' : ''}
              slotProps={{ input: { sx: { fontSize: 13 } } }}
            />
          </>
        )}
        {provider === 'copilotproxy' && (
          <>
            <TextField
              label="Copilot Proxy URL"
              size="small"
              value={settings.ai_copilotproxy_url || ''}
              onChange={e => handleChange('ai_copilotproxy_url', e.target.value)}
              placeholder="http://localhost:3000/api"
              slotProps={{ input: { sx: { fontSize: 13 } } }}
            />
            <TextField
              label="Copilot Proxy Token"
              size="small"
              type="password"
              value={isMasked(settings.ai_copilotproxy_token) ? '' : (pendingKeys.ai_copilotproxy_token ?? '')}
              onChange={e => handleKeyField('ai_copilotproxy_token', e.target.value)}
              placeholder={isMasked(settings.ai_copilotproxy_token) ? '(saved — enter new to change)' : ''}
              slotProps={{ input: { sx: { fontSize: 13 } } }}
            />
          </>
        )}

        {/* Model selection */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ flex: 1 }}>
            <FormLabel sx={{ color: '#aaa', fontSize: 12, mb: 0.5 }}>Model</FormLabel>
            {models.length > 0 ? (
              <Select
                value={settings.ai_model || ''}
                onChange={e => handleChange('ai_model', e.target.value)}
                sx={{ fontSize: 13 }}
              >
                {models.map(m => <MenuItem key={m} value={m} sx={{ fontSize: 13 }}>{m}</MenuItem>)}
              </Select>
            ) : (
              <TextField
                size="small"
                value={settings.ai_model || ''}
                onChange={e => handleChange('ai_model', e.target.value)}
                placeholder="e.g. llama3 or gpt-4o-mini"
                slotProps={{ input: { sx: { fontSize: 13 } } }}
              />
            )}
          </FormControl>
          <Button
            variant="outlined"
            size="small"
            onClick={handleFetchModels}
            disabled={loadingModels}
            sx={{ minWidth: 90, fontSize: 11, height: 40 }}
          >
            {loadingModels ? <CircularProgress size={14} /> : 'Fetch Models'}
          </Button>
        </Box>

        {/* Timeout */}
        <TextField
          label="Request Timeout (ms)"
          size="small"
          type="number"
          value={settings.ai_timeout_ms || '180000'}
          onChange={e => handleChange('ai_timeout_ms', e.target.value)}
          slotProps={{ input: { sx: { fontSize: 13 } } }}
          helperText="Default 180000 (3 min). Increase for slow models."
        />
        </>)}

        {activeTab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontSize: 12, color: '#aaa' }}>Customise prompts sent to the AI model</Typography>
              <Button
                size="small"
                onClick={() => {
                  if (confirm('Reset all prompts to defaults?')) {
                    promptTemplateStore.resetToDefaults();
                    setTemplates(promptTemplateStore.getTemplates());
                  }
                }}
                sx={{ fontSize: 11 }}
              >
                Reset to defaults
              </Button>
            </Box>
            <Tabs value={promptTab} onChange={(_, v) => setPromptTab(v)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 32, borderBottom: '1px solid #333' }}>
              {PROMPT_SECTIONS.map(s => (
                <Tab key={s.key} label={s.label} sx={{ fontSize: 11, minHeight: 32, py: 0 }} />
              ))}
            </Tabs>
            {PROMPT_SECTIONS.map((s, i) => promptTab === i && (
              <Box key={s.key} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography sx={{ fontSize: 11, color: '#777' }}>{s.desc}</Typography>
                <TextField
                  multiline
                  minRows={12}
                  maxRows={20}
                  fullWidth
                  value={templates[s.key]}
                  onChange={e => setTemplates(t => ({ ...t, [s.key]: e.target.value }))}
                  slotProps={{ input: { sx: { fontSize: 12, fontFamily: 'monospace' } } }}
                />
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2 }}>
        <Button onClick={onClose} size="small" sx={{ fontSize: 12 }}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          size="small"
          disabled={saving}
          sx={{ fontSize: 12 }}
        >
          {saving ? <CircularProgress size={14} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
