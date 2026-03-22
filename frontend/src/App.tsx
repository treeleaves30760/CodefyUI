import { ReactFlowProvider } from '@xyflow/react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { TabBar } from './components/TabBar/TabBar';
import { NodePalette } from './components/Sidebar/NodePalette';
import { FlowCanvas } from './components/Canvas/FlowCanvas';
import { NodeConfigPanel } from './components/ConfigPanel/NodeConfigPanel';
import { ResultsPanel } from './components/ResultsPanel/ResultsPanel';
import { PresetConfigModal } from './components/PresetModal/PresetConfigModal';
import { SubgraphEditorModal } from './components/SubgraphEditor/SubgraphEditorModal';
import { useTabStore } from './store/tabStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import styles from './App.module.css';

function TabContent({ tabId }: { tabId: string }) {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const isActive = tabId === activeTabId;

  return (
    <div
      className={styles.tabContent}
      // "display" is the only value that changes based on state
      style={{ display: isActive ? 'flex' : 'none' }}
    >
      <div className={styles.tabInner}>
        <ReactFlowProvider>
          <NodePalette />
          <div className={styles.canvasHost}>
            <div className={styles.canvasFill}>
              <FlowCanvas />
            </div>
          </div>
          <NodeConfigPanel />
        </ReactFlowProvider>
      </div>
      <ResultsPanel />
    </div>
  );
}

function App() {
  useKeyboardShortcuts();
  const tabs = useTabStore((s) => s.tabs);

  return (
    <div className={styles.root}>
      <Toolbar />
      <TabBar />
      {tabs.map((tab) => (
        <TabContent key={tab.id} tabId={tab.id} />
      ))}
      <PresetConfigModal />
      <SubgraphEditorModal />
    </div>
  );
}

export default App;
