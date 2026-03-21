import { useCallback, useEffect, useRef } from 'react';
import { useTabStore } from '../store/tabStore';

export function useGraphExecution() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const getActiveTab = useTabStore((s) => s.getActiveTab);
  const getSerializedGraph = useTabStore((s) => s.getSerializedGraph);
  const clearExecutionStatus = useTabStore((s) => s.clearExecutionStatus);
  const setTabStatus = useTabStore((s) => s.setTabStatus);
  const setTabNodeExecutionStatus = useTabStore((s) => s.setTabNodeExecutionStatus);
  const addTabLog = useTabStore((s) => s.addTabLog);
  const clearLogs = useTabStore((s) => s.clearLogs);

  // Track which tabs have had WS listeners attached
  const attachedTabs = useRef(new Set<string>());

  // Attach WS listeners for the active tab (idempotent per tab)
  useEffect(() => {
    const tab = getActiveTab();
    if (attachedTabs.current.has(tab.id)) return;
    attachedTabs.current.add(tab.id);

    const tabId = tab.id;
    const ws = tab.ws;

    ws.on('node_status', (data: any) => {
      setTabNodeExecutionStatus(tabId, data.node_id, data.status, data.error);
      addTabLog(tabId, {
        nodeId: data.node_id,
        message: `Node ${String(data.node_id).slice(0, 8)}... ${data.status}`,
        type: data.status === 'error' ? 'error' : data.status === 'completed' ? 'success' : 'info',
      });
      // If the node produced log output (Print node), show it
      if (data.log) {
        addTabLog(tabId, {
          nodeId: data.node_id,
          message: data.log,
          type: 'info',
        });
      }
      // If the node produced a base64 image, add it as a separate log entry
      if (data.image) {
        addTabLog(tabId, {
          nodeId: data.node_id,
          message: `__IMAGE__:${data.image}`,
          type: 'info',
        });
      }
    });

    ws.on('execution_complete', () => {
      setTabStatus(tabId, 'completed');
      addTabLog(tabId, { message: 'Execution completed successfully', type: 'success' });
    });

    ws.on('execution_error', (data: any) => {
      setTabStatus(tabId, 'error');
      addTabLog(tabId, { message: `Execution error: ${data.error}`, type: 'error' });
    });

    ws.on('execution_start', () => {
      setTabStatus(tabId, 'running');
      addTabLog(tabId, { message: 'Execution started', type: 'info' });
    });

    ws.on('execution_stopped', () => {
      setTabStatus(tabId, 'idle');
      addTabLog(tabId, { message: 'Execution cancelled', type: 'info' });
    });
  }, [activeTabId, getActiveTab, setTabNodeExecutionStatus, setTabStatus, addTabLog]);

  const execute = useCallback(async () => {
    const tab = getActiveTab();
    const ws = tab.ws;

    if (!ws.connected) {
      try {
        await ws.connect();
      } catch {
        addTabLog(tab.id, { message: 'Failed to connect to execution server', type: 'error' });
        return;
      }
    }

    clearLogs();
    clearExecutionStatus();
    setTabStatus(tab.id, 'running');
    const graph = getSerializedGraph();
    ws.send({ action: 'execute', ...graph });
  }, [getActiveTab, getSerializedGraph, clearLogs, clearExecutionStatus, setTabStatus, addTabLog]);

  const stop = useCallback(() => {
    const tab = getActiveTab();
    tab.ws.send({ action: 'stop' });
  }, [getActiveTab]);

  return { execute, stop };
}
