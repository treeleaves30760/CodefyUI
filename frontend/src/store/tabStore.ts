import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';
import { generateId } from '../utils';
import type { NodeData, NodeDefinition, PresetDefinition, ExecutionStatus, OutputSummary, NodeProgress } from '../types';
import { ExecutionWebSocket } from '../api/ws';

// ── Per-tab state ──

export interface LogEntry {
  timestamp: number;
  nodeId?: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

interface UndoSnapshot {
  nodes: Node<NodeData>[];
  edges: Edge[];
}

const MAX_UNDO = 50;

export interface TabState {
  id: string;
  name: string;
  // flow
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  presetModalNodeId: string | null;
  subgraphModalNodeId: string | null;
  // undo/redo
  undoStack: UndoSnapshot[];
  redoStack: UndoSnapshot[];
  // execution
  status: ExecutionStatus;
  logs: LogEntry[];
  ws: ExecutionWebSocket;
  // output summaries per node (for edge inspection)
  outputSummaries: Record<string, Record<string, OutputSummary>>;
}

function createTabState(id: string, name: string): TabState {
  return {
    id,
    name,
    nodes: [],
    edges: [],
    selectedNodeId: null,
    presetModalNodeId: null,
    subgraphModalNodeId: null,
    undoStack: [],
    redoStack: [],
    status: 'idle',
    logs: [],
    ws: new ExecutionWebSocket(),
    outputSummaries: {},
  };
}

// ── Store ──

interface TabStoreState {
  tabs: TabState[];
  activeTabId: string;

  // tab management
  addTab: (name?: string) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, name: string) => void;

  // flow actions (operate on active tab)
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (definition: NodeDefinition, position: { x: number; y: number }) => void;
  addPresetNode: (preset: PresetDefinition, position: { x: number; y: number }) => void;
  updateNodeParams: (nodeId: string, params: Record<string, any>) => void;
  updatePresetInternalParam: (nodeId: string, internalNodeId: string, paramName: string, value: any) => void;
  setSelectedNodeId: (id: string | null) => void;
  openPresetModal: (id: string) => void;
  closePresetModal: () => void;
  openSubgraphModal: (id: string) => void;
  closeSubgraphModal: () => void;
  updateSubgraphLayers: (nodeId: string, layersJson: string) => void;
  setNodeExecutionStatus: (nodeId: string, status: NodeData['executionStatus'], error?: string) => void;
  clearExecutionStatus: () => void;
  clear: () => void;
  getSerializedGraph: () => { nodes: any[]; edges: any[]; presets?: import('../types').PresetDefinition[] };
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  renameNode: (nodeId: string, newLabel: string) => void;

  // undo/redo
  pushUndoSnapshot: () => void;
  undo: () => void;
  redo: () => void;

  // clipboard (copy/paste)
  clipboard: { nodes: Node<NodeData>[]; edges: Edge[] } | null;
  copySelectedNodes: () => void;
  pasteNodes: () => void;

  // execution actions (operate on active tab)
  setStatus: (s: ExecutionStatus) => void;
  addLog: (entry: Omit<LogEntry, 'timestamp'>) => void;
  clearLogs: () => void;

  // helpers
  getActiveTab: () => TabState;
  getTab: (id: string) => TabState | undefined;

  // execution actions for specific tab (used by WS handlers)
  setTabNodeExecutionStatus: (tabId: string, nodeId: string, status: NodeData['executionStatus'], error?: string) => void;
  setTabNodeProgress: (tabId: string, nodeId: string, progress: NodeProgress) => void;
  setTabOutputSummary: (tabId: string, nodeId: string, summary: Record<string, OutputSummary>) => void;
  clearOutputSummaries: () => void;
  setTabStatus: (tabId: string, s: ExecutionStatus) => void;
  addTabLog: (tabId: string, entry: Omit<LogEntry, 'timestamp'>) => void;
}

function updateTab(tabs: TabState[], tabId: string, updater: (tab: TabState) => Partial<TabState>): TabState[] {
  return tabs.map((tab) => (tab.id === tabId ? { ...tab, ...updater(tab) } : tab));
}

// ── LocalStorage persistence ──

const STORAGE_KEY = 'codefyui-tabs';

interface PersistedTab {
  id: string;
  name: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
}

function saveTabs(tabs: TabState[], activeTabId: string) {
  try {
    const data: { tabs: PersistedTab[]; activeTabId: string } = {
      activeTabId,
      tabs: tabs.map((t) => ({ id: t.id, name: t.name, nodes: t.nodes, edges: t.edges })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

function loadTabs(): { tabs: TabState[]; activeTabId: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.tabs) && data.tabs.length > 0) {
        const tabs: TabState[] = data.tabs.map((t: PersistedTab) => ({
          ...createTabState(t.id, t.name),
          nodes: t.nodes ?? [],
          edges: t.edges ?? [],
        }));
        const activeTabId = tabs.some((t) => t.id === data.activeTabId)
          ? data.activeTabId
          : tabs[0].id;
        return { tabs, activeTabId };
      }
    }
  } catch {
    // Corrupted data — fall through to default
  }
  const id = generateId();
  return { tabs: [createTabState(id, 'Tab 1')], activeTabId: id };
}

const initialState = loadTabs();

export const useTabStore = create<TabStoreState>((set, get) => ({
  tabs: initialState.tabs,
  activeTabId: initialState.activeTabId,

  // ── Tab management ──

  addTab: (name) => {
    const id = generateId();
    const tabCount = get().tabs.length;
    set({
      tabs: [...get().tabs, createTabState(id, name ?? `Tab ${tabCount + 1}`)],
      activeTabId: id,
    });
  },

  removeTab: (id) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return;

    const tab = tabs.find((t) => t.id === id);
    if (tab) tab.ws.disconnect();

    const remaining = tabs.filter((t) => t.id !== id);
    const newActive = activeTabId === id
      ? remaining[Math.min(tabs.findIndex((t) => t.id === id), remaining.length - 1)].id
      : activeTabId;
    set({ tabs: remaining, activeTabId: newActive });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  renameTab: (id, name) =>
    set({ tabs: updateTab(get().tabs, id, () => ({ name })) }),

  // ── Helpers ──

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId)!;
  },

  getTab: (id) => get().tabs.find((t) => t.id === id),

  // ── Flow actions (active tab) ──

  setNodes: (nodes) =>
    set({ tabs: updateTab(get().tabs, get().activeTabId, () => ({ nodes })) }),

  setEdges: (edges) =>
    set({ tabs: updateTab(get().tabs, get().activeTabId, () => ({ edges })) }),

  onNodesChange: (changes) => {
    // Snapshot at drag start for undo (not every pixel)
    const hasDragStart = changes.some(
      (c) => c.type === 'position' && (c as any).dragging === true
    );
    if (hasDragStart) {
      // Check if we already snapshotted for this drag session
      const tab = get().getActiveTab();
      const wasDragging = tab.nodes.some((n) => n.dragging);
      if (!wasDragging) {
        get().pushUndoSnapshot();
      }
    }
    // Snapshot on node removal via Delete key
    const hasRemove = changes.some((c) => c.type === 'remove');
    if (hasRemove) {
      get().pushUndoSnapshot();
    }
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (tab) => ({
        nodes: applyNodeChanges(changes, tab.nodes) as Node<NodeData>[],
      })),
    });
  },

  onEdgesChange: (changes) => {
    const hasRemove = changes.some((c) => c.type === 'remove');
    if (hasRemove) {
      get().pushUndoSnapshot();
    }
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (tab) => ({
        edges: applyEdgeChanges(changes, tab.edges),
      })),
    });
  },

  onConnect: (connection) => {
    get().pushUndoSnapshot();
    const edge: Edge = {
      id: generateId(),
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
      animated: false,
      style: { stroke: '#555', strokeWidth: 2 },
    };
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (tab) => ({
        edges: [...tab.edges, edge],
      })),
    });
  },

  addNode: (definition, position) => {
    get().pushUndoSnapshot();
    const defaultParams: Record<string, any> = {};
    for (const p of definition.params) {
      defaultParams[p.name] = p.default;
    }
    const node: Node<NodeData> = {
      id: generateId(),
      type: 'baseNode',
      position,
      data: {
        label: definition.node_name,
        type: definition.node_name,
        params: defaultParams,
        definition,
        executionStatus: 'idle',
      },
    };
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (tab) => ({
        nodes: [...tab.nodes, node],
      })),
    });
  },

  addPresetNode: (preset, position) => {
    get().pushUndoSnapshot();
    const internalParams: Record<string, Record<string, any>> = {};
    for (const n of preset.nodes) {
      internalParams[n.id] = { ...n.params };
    }
    const definition: NodeDefinition = {
      node_name: preset.preset_name,
      category: preset.category,
      description: preset.description,
      inputs: preset.exposed_inputs.map((p) => ({
        name: p.name,
        data_type: p.data_type,
        description: p.description,
        optional: false,
      })),
      outputs: preset.exposed_outputs.map((p) => ({
        name: p.name,
        data_type: p.data_type,
        description: p.description,
        optional: false,
      })),
      params: [],
    };
    const node: Node<NodeData> = {
      id: generateId(),
      type: 'presetNode',
      position,
      data: {
        label: preset.preset_name,
        type: `preset:${preset.preset_name}`,
        params: {},
        definition,
        isPreset: true,
        presetDefinition: preset,
        internalParams,
        executionStatus: 'idle',
      },
    };
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (tab) => ({
        nodes: [...tab.nodes, node],
      })),
    });
  },

  updateNodeParams: (nodeId, params) =>
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (tab) => ({
        nodes: tab.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, params: { ...n.data.params, ...params } } }
            : n
        ),
      })),
    }),

  updatePresetInternalParam: (nodeId, internalNodeId, paramName, value) =>
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (tab) => ({
        nodes: tab.nodes.map((n) => {
          if (n.id !== nodeId) return n;
          const prev = n.data.internalParams ?? {};
          return {
            ...n,
            data: {
              ...n.data,
              internalParams: {
                ...prev,
                [internalNodeId]: {
                  ...prev[internalNodeId],
                  [paramName]: value,
                },
              },
            },
          };
        }),
      })),
    }),

  setSelectedNodeId: (id) =>
    set({ tabs: updateTab(get().tabs, get().activeTabId, () => ({ selectedNodeId: id })) }),

  openPresetModal: (id) =>
    set({ tabs: updateTab(get().tabs, get().activeTabId, () => ({ presetModalNodeId: id })) }),

  closePresetModal: () =>
    set({ tabs: updateTab(get().tabs, get().activeTabId, () => ({ presetModalNodeId: null })) }),

  openSubgraphModal: (id) =>
    set({ tabs: updateTab(get().tabs, get().activeTabId, () => ({ subgraphModalNodeId: id })) }),

  closeSubgraphModal: () =>
    set({ tabs: updateTab(get().tabs, get().activeTabId, () => ({ subgraphModalNodeId: null })) }),

  updateSubgraphLayers: (nodeId, layersJson) =>
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (tab) => ({
        nodes: tab.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, params: { ...n.data.params, layers: layersJson } } }
            : n
        ),
      })),
    }),

  setNodeExecutionStatus: (nodeId, status, error) =>
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (tab) => ({
        nodes: tab.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, executionStatus: status, error } }
            : n
        ),
      })),
    }),

  clearExecutionStatus: () =>
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (tab) => ({
        nodes: tab.nodes.map((n) => ({
          ...n,
          data: { ...n.data, executionStatus: 'idle' as const, error: undefined },
        })),
      })),
    }),

  clear: () => {
    get().pushUndoSnapshot();
    set({
      tabs: updateTab(get().tabs, get().activeTabId, () => ({
        nodes: [],
        edges: [],
        selectedNodeId: null,
        presetModalNodeId: null,
        subgraphModalNodeId: null,
      })),
    });
  },

  getSerializedGraph: () => {
    const tab = get().getActiveTab();
    const presets: import('../types').PresetDefinition[] = [];
    const seenPresets = new Set<string>();

    const nodes = tab.nodes.map((n) => {
      if (n.data.isPreset && n.data.presetDefinition) {
        const name = n.data.presetDefinition.preset_name;
        if (!seenPresets.has(name)) {
          seenPresets.add(name);
          presets.push(n.data.presetDefinition);
        }
      }
      return {
        id: n.id,
        type: n.data.type,
        position: n.position,
        data: {
          params: n.data.params,
          ...(n.data.isPreset ? { internalParams: n.data.internalParams } : {}),
        },
      };
    });

    return {
      nodes,
      edges: tab.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? '',
        targetHandle: e.targetHandle ?? '',
      })),
      presets,
    };
  },

  deleteNode: (nodeId) => {
    get().pushUndoSnapshot();
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (tab) => ({
        nodes: tab.nodes.filter((n) => n.id !== nodeId),
        edges: tab.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
        selectedNodeId: tab.selectedNodeId === nodeId ? null : tab.selectedNodeId,
      })),
    });
  },

  duplicateNode: (nodeId) => {
    get().pushUndoSnapshot();
    const tab = get().getActiveTab();
    const original = tab.nodes.find((n) => n.id === nodeId);
    if (!original) return;
    const newNode: Node<NodeData> = {
      ...original,
      id: generateId(),
      position: { x: original.position.x + 40, y: original.position.y + 40 },
      selected: false,
      data: { ...original.data, executionStatus: 'idle', error: undefined },
    };
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (t) => ({
        nodes: [...t.nodes, newNode],
      })),
    });
  },

  renameNode: (nodeId, newLabel) => {
    get().pushUndoSnapshot();
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (tab) => ({
        nodes: tab.nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n
        ),
      })),
    });
  },

  // ── Undo/Redo ──

  pushUndoSnapshot: () => {
    const tab = get().getActiveTab();
    const snapshot: UndoSnapshot = {
      nodes: JSON.parse(JSON.stringify(tab.nodes)),
      edges: JSON.parse(JSON.stringify(tab.edges)),
    };
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (t) => ({
        undoStack: [...t.undoStack.slice(-(MAX_UNDO - 1)), snapshot],
        redoStack: [],
      })),
    });
  },

  undo: () => {
    const tab = get().getActiveTab();
    if (tab.undoStack.length === 0) return;
    const current: UndoSnapshot = {
      nodes: JSON.parse(JSON.stringify(tab.nodes)),
      edges: JSON.parse(JSON.stringify(tab.edges)),
    };
    const prev = tab.undoStack[tab.undoStack.length - 1];
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (t) => ({
        nodes: prev.nodes,
        edges: prev.edges,
        undoStack: t.undoStack.slice(0, -1),
        redoStack: [...t.redoStack, current],
      })),
    });
  },

  redo: () => {
    const tab = get().getActiveTab();
    if (tab.redoStack.length === 0) return;
    const current: UndoSnapshot = {
      nodes: JSON.parse(JSON.stringify(tab.nodes)),
      edges: JSON.parse(JSON.stringify(tab.edges)),
    };
    const next = tab.redoStack[tab.redoStack.length - 1];
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (t) => ({
        nodes: next.nodes,
        edges: next.edges,
        redoStack: t.redoStack.slice(0, -1),
        undoStack: [...t.undoStack, current],
      })),
    });
  },

  // ── Clipboard (copy/paste) ──

  clipboard: null,

  copySelectedNodes: () => {
    const tab = get().getActiveTab();
    const selected = tab.nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    const selectedIds = new Set(selected.map((n) => n.id));
    const internalEdges = tab.edges.filter(
      (e) => selectedIds.has(e.source) && selectedIds.has(e.target)
    );
    set({
      clipboard: {
        nodes: JSON.parse(JSON.stringify(selected)),
        edges: JSON.parse(JSON.stringify(internalEdges)),
      },
    });
  },

  pasteNodes: () => {
    const { clipboard } = get();
    if (!clipboard || clipboard.nodes.length === 0) return;
    get().pushUndoSnapshot();

    const idMap = new Map<string, string>();
    clipboard.nodes.forEach((n) => idMap.set(n.id, generateId()));

    const newNodes: Node<NodeData>[] = clipboard.nodes.map((n) => ({
      ...JSON.parse(JSON.stringify(n)),
      id: idMap.get(n.id)!,
      position: { x: n.position.x + 50, y: n.position.y + 50 },
      selected: true,
      data: { ...JSON.parse(JSON.stringify(n.data)), executionStatus: 'idle' as const, error: undefined },
    }));

    const newEdges: Edge[] = clipboard.edges.map((e) => ({
      ...JSON.parse(JSON.stringify(e)),
      id: generateId(),
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
    }));

    set({
      tabs: updateTab(get().tabs, get().activeTabId, (tab) => ({
        nodes: [
          ...tab.nodes.map((n) => ({ ...n, selected: false })),
          ...newNodes,
        ],
        edges: [...tab.edges, ...newEdges],
      })),
    });
  },

  // ── Execution actions (active tab) ──

  setStatus: (s) =>
    set({ tabs: updateTab(get().tabs, get().activeTabId, () => ({ status: s })) }),

  addLog: (entry) =>
    set({
      tabs: updateTab(get().tabs, get().activeTabId, (tab) => ({
        logs: [...tab.logs, { ...entry, timestamp: Date.now() }],
      })),
    }),

  clearLogs: () =>
    set({ tabs: updateTab(get().tabs, get().activeTabId, () => ({ logs: [] })) }),

  // ── Tab-specific execution actions (WS handlers target a specific tab) ──

  setTabNodeExecutionStatus: (tabId, nodeId, status, error) =>
    set({
      tabs: updateTab(get().tabs, tabId, (tab) => ({
        nodes: tab.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, executionStatus: status, error } }
            : n
        ),
      })),
    }),

  setTabNodeProgress: (tabId, nodeId, progress) =>
    set({
      tabs: updateTab(get().tabs, tabId, (tab) => ({
        nodes: tab.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, progress } }
            : n
        ),
      })),
    }),

  setTabOutputSummary: (tabId, nodeId, summary) =>
    set({
      tabs: updateTab(get().tabs, tabId, (tab) => ({
        outputSummaries: { ...tab.outputSummaries, [nodeId]: summary },
      })),
    }),

  clearOutputSummaries: () =>
    set({ tabs: updateTab(get().tabs, get().activeTabId, () => ({ outputSummaries: {} })) }),

  setTabStatus: (tabId, s) =>
    set({ tabs: updateTab(get().tabs, tabId, () => ({ status: s })) }),

  addTabLog: (tabId, entry) =>
    set({
      tabs: updateTab(get().tabs, tabId, (tab) => ({
        logs: [...tab.logs, { ...entry, timestamp: Date.now() }],
      })),
    }),
}));

// ── Auto-save to localStorage ──
useTabStore.subscribe((state) => {
  saveTabs(state.tabs, state.activeTabId);
});
