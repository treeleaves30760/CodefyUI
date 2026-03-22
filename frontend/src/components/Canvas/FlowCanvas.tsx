import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  type NodeTypes,
  type OnConnect,
  type IsValidConnection,
  type Connection,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import BaseNode from '../Nodes/BaseNode';
import PresetNode from '../Nodes/PresetNode';
import { EmptyCanvasOverlay } from './EmptyCanvasOverlay';
import { EdgeDataTooltip } from './EdgeDataTooltip';
import { QuickNodeSearch } from './QuickNodeSearch';
import {
  NodeContextMenu,
  useNodeContextMenuItems,
  type ContextMenuPosition,
} from '../ContextMenu/NodeContextMenu';
import { useTabStore } from '../../store/tabStore';
import { useUIStore } from '../../store/uiStore';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { isValidConnection } from '../../utils';
import { useI18n } from '../../i18n';
import { CATEGORY_COLORS } from '../../styles/theme';
import type { OutputSummary } from '../../types';
import styles from './FlowCanvas.module.css';

const nodeTypes: NodeTypes = {
  baseNode: BaseNode,
  presetNode: PresetNode,
};

export function FlowCanvas() {
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId)!);
  const onNodesChange = useTabStore((s) => s.onNodesChange);
  const onEdgesChange = useTabStore((s) => s.onEdgesChange);
  const storeOnConnect = useTabStore((s) => s.onConnect);
  const setSelectedNodeId = useTabStore((s) => s.setSelectedNodeId);
  const deleteNode = useTabStore((s) => s.deleteNode);
  const duplicateNode = useTabStore((s) => s.duplicateNode);
  const renameNode = useTabStore((s) => s.renameNode);
  const { t } = useI18n();
  const gridSnapEnabled = useUIStore((s) => s.gridSnapEnabled);
  const { screenToFlowPosition } = useReactFlow();

  const [quickSearch, setQuickSearch] = useState<{
    screen: { x: number; y: number };
    flow: { x: number; y: number };
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const [edgeTooltip, setEdgeTooltip] = useState<{
    x: number; y: number;
    sourceLabel: string; targetLabel: string;
    portName: string; summary: OutputSummary;
  } | null>(null);

  const outputSummaries = useTabStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.outputSummaries ?? {};
  });

  const { onDragOver, onDrop } = useDragAndDrop();

  const handleConnect: OnConnect = useCallback(
    (connection) => {
      storeOnConnect(connection);
    },
    [storeOnConnect]
  );

  const handleIsValidConnection: IsValidConnection = useCallback(
    (connection: Connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;
      if (!source || !target) return false;
      if (source === target) return false;

      if (sourceHandle && targetHandle) {
        const { tabs, activeTabId } = useTabStore.getState();
        const tab = tabs.find((t) => t.id === activeTabId)!;
        const sourceNode = tab.nodes.find((n) => n.id === source);
        const targetNode = tab.nodes.find((n) => n.id === target);
        if (!sourceNode || !targetNode) return true;

        const sourceDef = sourceNode.data.definition;
        const targetDef = targetNode.data.definition;
        if (!sourceDef || !targetDef) return true;

        const sourceOutput = sourceDef.outputs.find((o) => o.name === sourceHandle);
        const targetInput = targetDef.inputs.find((i) => i.name === targetHandle);
        if (!sourceOutput || !targetInput) return true;

        return isValidConnection(sourceOutput.data_type, targetInput.data_type);
      }

      return true;
    },
    []
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      const sourceId = edge.source;
      const sourceHandle = edge.sourceHandle ?? '';
      const nodeSummaries = outputSummaries[sourceId];
      if (!nodeSummaries || !nodeSummaries[sourceHandle]) {
        setEdgeTooltip(null);
        return;
      }
      const sourceNode = activeTab.nodes.find((n) => n.id === sourceId);
      const targetNode = activeTab.nodes.find((n) => n.id === edge.target);
      setEdgeTooltip({
        x: event.clientX + 8,
        y: event.clientY - 8,
        sourceLabel: sourceNode?.data.label ?? sourceId.slice(0, 8),
        targetLabel: targetNode?.data.label ?? edge.target.slice(0, 8),
        portName: sourceHandle,
        summary: nodeSummaries[sourceHandle],
      });
    },
    [outputSummaries, activeTab.nodes]
  );

  // Double-click on pane to open quick node search
  const screenToFlowRef = useRef(screenToFlowPosition);
  screenToFlowRef.current = screenToFlowPosition;
  const setQuickSearchRef = useRef(setQuickSearch);
  setQuickSearchRef.current = setQuickSearch;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const flowPos = screenToFlowRef.current({ x: e.clientX, y: e.clientY });
      setQuickSearchRef.current({ screen: { x: e.clientX, y: e.clientY }, flow: flowPos });
    };
    // Wait for React Flow to mount, then attach directly to .react-flow__pane
    const timer = setTimeout(() => {
      const pane = document.querySelector('.react-flow__pane');
      if (pane) {
        pane.addEventListener('dblclick', handler as EventListener);
      }
    }, 100);
    return () => {
      clearTimeout(timer);
      const pane = document.querySelector('.react-flow__pane');
      if (pane) pane.removeEventListener('dblclick', handler as EventListener);
    };
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setContextMenu(null);
    setEdgeTooltip(null);
    // quickSearch is closed by QuickNodeSearch's own outside-click handler
  }, [setSelectedNodeId]);

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: { id: string }) => {
      event.preventDefault();
      setSelectedNodeId(node.id);
      setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
    },
    [setSelectedNodeId]
  );

  const handleRename = useCallback(
    (nodeId: string) => {
      const node = activeTab.nodes.find((n) => n.id === nodeId);
      const currentLabel = node?.data.label ?? '';
      const newLabel = window.prompt(t('contextMenu.rename.prompt'), currentLabel);
      if (newLabel !== null && newLabel.trim()) {
        renameNode(nodeId, newLabel.trim());
      }
    },
    [activeTab.nodes, renameNode, t]
  );

  const menuItems = useNodeContextMenuItems(contextMenu?.nodeId ?? '', {
    onDelete: deleteNode,
    onRename: handleRename,
    onDuplicate: duplicateNode,
  });

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);
  const isEmpty = activeTab.nodes.length === 0;

  return (
    <div className={styles.canvas}>
      {isEmpty && <EmptyCanvasOverlay />}
      <ReactFlow
        nodes={activeTab.nodes}
        edges={activeTab.edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        isValidConnection={handleIsValidConnection}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={handlePaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        proOptions={proOptions}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        style={{ background: '#0a0a0a' }}
        defaultEdgeOptions={{
          animated: false,
          style: { stroke: '#555', strokeWidth: 2 },
        }}
        connectionLineStyle={{ stroke: '#888', strokeWidth: 2 }}
        zoomOnDoubleClick={false}
        snapToGrid={gridSnapEnabled}
        snapGrid={[24, 24]}
      >
        <Background
          color="#2a2a2a"
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
        />
        <Controls />
        <MiniMap
          style={{
            background: '#1e1e1e',
            border: '1px solid #333',
            borderRadius: 6,
          }}
          nodeColor={(node) => {
            const data = node.data as any;
            if (data?.isPreset) return '#D4A017';
            const category = data?.definition?.category ?? 'Utility';
            return CATEGORY_COLORS[category] ?? '#607D8B';
          }}
          maskColor="rgba(0,0,0,0.7)"
        />
      </ReactFlow>

      {contextMenu && (
        <NodeContextMenu
          position={contextMenu}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {edgeTooltip && (
        <EdgeDataTooltip
          x={edgeTooltip.x}
          y={edgeTooltip.y}
          sourceLabel={edgeTooltip.sourceLabel}
          targetLabel={edgeTooltip.targetLabel}
          portName={edgeTooltip.portName}
          summary={edgeTooltip.summary}
          onClose={() => setEdgeTooltip(null)}
        />
      )}

      {quickSearch && (
        <QuickNodeSearch
          screenPos={quickSearch.screen}
          flowPos={quickSearch.flow}
          onClose={() => setQuickSearch(null)}
        />
      )}
    </div>
  );
}
