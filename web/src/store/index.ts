/**
 * Global zustand store for the Canvas UI Platform editor.
 */
import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { ServerView, ViewConfig, WidgetConfig, ViewStyle } from '../types';
import { viewsApi } from '../api/client';

interface EditorState {
  // ── views list (from server) ─────────────────────────────────────────────
  views: ServerView[];
  viewsLoading: boolean;
  viewsError: string | null;

  // ── active view being edited ─────────────────────────────────────────────
  activeViewId: string | null;
  activeView: ViewConfig | null;
  isDirty: boolean;

  // ── selection state ──────────────────────────────────────────────────────
  selectedWidgetId: string | null;

  // ── actions ──────────────────────────────────────────────────────────────
  loadViews: () => Promise<void>;
  openView: (id: string) => Promise<void>;
  createView: (name: string) => Promise<string>;
  saveActiveView: () => Promise<void>;
  deleteView: (id: string) => Promise<void>;

  // view-level edits
  updateViewStyle: (style: Partial<ViewStyle>) => void;
  updateViewName: (name: string) => void;
  updateViewSize: (w: number, h: number) => void;

  // widget CRUD
  addWidget: (widget: Omit<WidgetConfig, 'id'>) => string;
  updateWidget: (id: string, updates: Partial<WidgetConfig>) => void;
  removeWidget: (id: string) => void;
  duplicateWidget: (id: string) => void;
  selectWidget: (id: string | null) => void;

  setSelectedWidgetId: (id: string | null) => void;
}

function defaultView(name: string): ViewConfig {
  return {
    id: nanoid(),
    name,
    style: { backgroundColor: '#1a1a2e', backgroundOpacity: 1 },
    widgets: [],
    sizex: 1920,
    sizey: 1080,
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  views: [],
  viewsLoading: false,
  viewsError: null,
  activeViewId: null,
  activeView: null,
  isDirty: false,
  selectedWidgetId: null,

  loadViews: async () => {
    set({ viewsLoading: true, viewsError: null });
    try {
      const views = await viewsApi.list();
      set({ views, viewsLoading: false });
    } catch (err) {
      set({ viewsLoading: false, viewsError: String(err) });
    }
  },

  openView: async (id) => {
    const existing = get().views.find((v) => v.id === id);
    if (existing) {
      set({
        activeViewId: id,
        activeView: structuredClone(existing.view_data),
        isDirty: false,
        selectedWidgetId: null,
      });
      return;
    }
    const sv = await viewsApi.get(id);
    set({
      activeViewId: id,
      activeView: structuredClone(sv.view_data),
      isDirty: false,
      selectedWidgetId: null,
    });
  },

  createView: async (name) => {
    const view_data = defaultView(name);
    const sv = await viewsApi.create({ name, view_data });
    set((s) => ({
      views: [...s.views, sv],
      activeViewId: sv.id,
      activeView: structuredClone(sv.view_data),
      isDirty: false,
      selectedWidgetId: null,
    }));
    return sv.id;
  },

  saveActiveView: async () => {
    const { activeViewId, activeView, views } = get();
    if (!activeViewId || !activeView) return;
    const sv = views.find((v) => v.id === activeViewId);
    if (!sv) return;
    const updated = await viewsApi.update(activeViewId, {
      name: activeView.name,
      view_data: activeView,
    });
    set((s) => ({
      views: s.views.map((v) => (v.id === activeViewId ? updated : v)),
      isDirty: false,
    }));
  },

  deleteView: async (id) => {
    await viewsApi.delete(id);
    set((s) => ({
      views: s.views.filter((v) => v.id !== id),
      ...(s.activeViewId === id
        ? { activeViewId: null, activeView: null, isDirty: false }
        : {}),
    }));
  },

  updateViewStyle: (style) => {
    set((s) => {
      if (!s.activeView) return s;
      return {
        activeView: { ...s.activeView, style: { ...s.activeView.style, ...style } },
        isDirty: true,
      };
    });
  },

  updateViewName: (name) => {
    set((s) => {
      if (!s.activeView) return s;
      return { activeView: { ...s.activeView, name }, isDirty: true };
    });
  },

  updateViewSize: (w, h) => {
    set((s) => {
      if (!s.activeView) return s;
      return { activeView: { ...s.activeView, sizex: w, sizey: h }, isDirty: true };
    });
  },

  addWidget: (widget) => {
    const id = nanoid();
    const w: WidgetConfig = { ...widget, id };
    set((s) => {
      if (!s.activeView) return s;
      return {
        activeView: {
          ...s.activeView,
          widgets: [...s.activeView.widgets, w],
        },
        isDirty: true,
        selectedWidgetId: id,
      };
    });
    return id;
  },

  updateWidget: (id, updates) => {
    set((s) => {
      if (!s.activeView) return s;
      return {
        activeView: {
          ...s.activeView,
          widgets: s.activeView.widgets.map((w) =>
            w.id === id ? { ...w, ...updates } : w,
          ),
        },
        isDirty: true,
      };
    });
  },

  removeWidget: (id) => {
    set((s) => {
      if (!s.activeView) return s;
      return {
        activeView: {
          ...s.activeView,
          widgets: s.activeView.widgets.filter((w) => w.id !== id),
        },
        isDirty: true,
        selectedWidgetId: s.selectedWidgetId === id ? null : s.selectedWidgetId,
      };
    });
  },

  duplicateWidget: (id) => {
    set((s) => {
      if (!s.activeView) return s;
      const orig = s.activeView.widgets.find((w) => w.id === id);
      if (!orig) return s;
      const copy: WidgetConfig = {
        ...structuredClone(orig),
        id: nanoid(),
        position: {
          ...orig.position,
          x: orig.position.x + 20,
          y: orig.position.y + 20,
        },
      };
      return {
        activeView: {
          ...s.activeView,
          widgets: [...s.activeView.widgets, copy],
        },
        isDirty: true,
        selectedWidgetId: copy.id,
      };
    });
  },

  selectWidget: (id) => set({ selectedWidgetId: id }),
  setSelectedWidgetId: (id) => set({ selectedWidgetId: id }),
}));
