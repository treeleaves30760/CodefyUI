import { useState, useCallback, useRef, useEffect } from 'react';
import { useGraphExecution } from '../../hooks/useGraphExecution';
import { useTabStore } from '../../store/tabStore';
import { useNodeDefStore } from '../../store/nodeDefStore';
import { useUIStore } from '../../store/uiStore';
import { saveGraph, loadGraph, listGraphs, createPreset, exportGraph } from '../../api/rest';
import { useI18n, SUPPORTED_LOCALES } from '../../i18n';
import { resolveSerializedNodes, resolveSerializedEdges } from '../../utils';
import { SURFACE, TEXT, BRAND, STATUS_COLORS } from '../../styles/theme';
import styles from './Toolbar.module.css';

/* ── Shared dropdown menu component ─────────────────────────────── */

interface MenuItem {
  label: string;
  title?: string;
  onClick: () => void;
  dividerAfter?: boolean;
  color?: string;
}

function MenuDropdown({
  label,
  items,
  open,
  onToggle,
  onClose,
}: {
  label: string;
  items: MenuItem[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  return (
    <div ref={ref} className={styles.menuWrapper}>
      <button
        onClick={onToggle}
        className={`${styles.menuTrigger} ${open ? styles.menuTriggerOpen : ''}`}
      >
        {label}
      </button>

      {open && (
        <div className={styles.menuPanel}>
          {items.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => { item.onClick(); onClose(); }}
                className={styles.menuItem}
                title={item.title}
                style={item.color ? { color: item.color } : undefined}
              >
                {item.label}
              </button>
              {item.dividerAfter && <div className={styles.menuDivider} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Nested load sub-menu (shows saved graphs) ──────────────────── */

function LoadSubMenu({
  open,
  onToggle,
  onClose,
  onLoadGraph,
  onImport,
  t,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onLoadGraph: (name: string) => void;
  onImport: () => void;
  t: (key: string) => string;
}) {
  const [graphs, setGraphs] = useState<{ name: string; file: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchGraphs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listGraphs();
      setGraphs(Array.isArray(result) ? result : []);
    } catch { setGraphs([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (open) fetchGraphs();
  }, [open, fetchGraphs]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  return (
    <div ref={ref} className={styles.menuWrapper}>
      <button
        onClick={onToggle}
        className={`${styles.menuTrigger} ${open ? styles.menuTriggerOpen : ''}`}
      >
        {t('toolbar.load')}
      </button>

      {open && (
        <div className={styles.menuPanel}>
          {loading ? (
            <div className={styles.menuMessage}>{t('toolbar.load.loading')}</div>
          ) : graphs.length === 0 ? (
            <div className={styles.menuMessageDim}>{t('toolbar.load.empty')}</div>
          ) : (
            graphs.map((g) => (
              <button
                key={g.file}
                onClick={() => { onLoadGraph(g.file); onClose(); }}
                className={styles.menuItem}
              >
                {g.name}
              </button>
            ))
          )}
          <div className={styles.menuDivider} />
          <button
            onClick={() => { onImport(); onClose(); }}
            className={styles.menuItem}
            style={{ color: BRAND.primary }}
          >
            {t('toolbar.import')}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Tooltip toggle button ───────────────────────────────────── */

function TooltipToggle() {
  const tooltipsEnabled = useUIStore((s) => s.tooltipsEnabled);
  const toggle = useUIStore((s) => s.toggleTooltips);
  const { t } = useI18n();

  return (
    <button
      onClick={toggle}
      className={styles.tooltipToggle}
      title={t('toolbar.tooltips.title')}
      style={{
        color: tooltipsEnabled ? BRAND.primary : TEXT.muted,
        borderColor: tooltipsEnabled ? BRAND.primary : SURFACE.borderMedium,
        background: tooltipsEnabled ? 'rgba(33,150,243,0.1)' : 'transparent',
      }}
    >
      {t(tooltipsEnabled ? 'toolbar.tooltips.on' : 'toolbar.tooltips.off')}
    </button>
  );
}

/* ── Grid snap toggle button ─────────────────────────────────── */

function GridSnapToggle() {
  const gridSnapEnabled = useUIStore((s) => s.gridSnapEnabled);
  const toggle = useUIStore((s) => s.toggleGridSnap);
  const { t } = useI18n();

  return (
    <button
      onClick={toggle}
      className={styles.tooltipToggle}
      title={t('toolbar.gridSnap.title')}
      style={{
        color: gridSnapEnabled ? BRAND.primary : TEXT.muted,
        borderColor: gridSnapEnabled ? BRAND.primary : SURFACE.borderMedium,
        background: gridSnapEnabled ? 'rgba(33,150,243,0.1)' : 'transparent',
      }}
    >
      {t(gridSnapEnabled ? 'toolbar.gridSnap.on' : 'toolbar.gridSnap.off')}
    </button>
  );
}

/* ── Main Toolbar ──────────────────────────────────────────────── */

export function Toolbar() {
  const { execute, stop } = useGraphExecution();
  const { clear, getSerializedGraph, setNodes, setEdges } = useTabStore();
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId)!);
  const status = activeTab.status;
  const { reload, fetchDefinitions } = useNodeDefStore();
  const { t, locale, setLocale } = useI18n();

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRunning = status === 'running';

  const closeMenus = useCallback(() => setOpenMenu(null), []);
  const toggleMenu = useCallback((name: string) => {
    setOpenMenu((prev) => (prev === name ? null : name));
  }, []);

  /* ── Handlers ─────────────────────────────────────────────────── */

  const handleRun = useCallback(() => execute(), [execute]);
  const handleStop = useCallback(() => stop(), [stop]);

  const handleSave = useCallback(async () => {
    const name = window.prompt(t('toolbar.save.prompt'));
    if (!name?.trim()) return;
    try {
      const { nodes, edges, presets } = getSerializedGraph();
      await saveGraph({ nodes, edges, name: name.trim(), description: '', presets });
      window.alert(t('toolbar.save.success', { name: name.trim() }));
    } catch (e) {
      window.alert(t('toolbar.save.fail', { error: (e as Error).message }));
    }
  }, [getSerializedGraph, t]);

  const handleClear = useCallback(() => {
    if (window.confirm(t('toolbar.clear.confirm'))) clear();
  }, [clear, t]);

  const handleLoadGraph = useCallback(
    async (name: string) => {
      try {
        const graphData = await loadGraph(name);
        const rawNodes = graphData.nodes ?? [];
        const rawEdges = graphData.edges ?? [];
        const store = useNodeDefStore.getState();
        const savedPresets = Array.isArray(graphData.presets) ? graphData.presets : [];
        const mergedPresets = [...store.presets];
        for (const p of savedPresets) {
          if (!mergedPresets.some((ep) => ep.preset_name === p.preset_name)) {
            mergedPresets.push(p);
          }
        }
        setNodes(resolveSerializedNodes(rawNodes, store.definitions, mergedPresets));
        setEdges(resolveSerializedEdges(rawEdges));
        if (savedPresets.length > 0) {
          useNodeDefStore.setState({ presets: mergedPresets });
        }
      } catch (e) {
        window.alert(t('toolbar.load.fail', { error: (e as Error).message }));
      }
    },
    [setNodes, setEdges, t],
  );

  const handleImportFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          const rawNodes = data.nodes ?? [];
          const edges = data.edges ?? [];
          if (!Array.isArray(rawNodes) || !Array.isArray(edges)) {
            throw new Error('Invalid graph format');
          }
          const store = useNodeDefStore.getState();
          const importedPresets = Array.isArray(data.presets) ? data.presets : [];
          const mergedPresets = [...store.presets];
          for (const p of importedPresets) {
            if (!mergedPresets.some((ep) => ep.preset_name === p.preset_name)) {
              mergedPresets.push(p);
            }
          }
          setNodes(resolveSerializedNodes(rawNodes, store.definitions, mergedPresets));
          setEdges(resolveSerializedEdges(edges));
          if (importedPresets.length > 0) {
            useNodeDefStore.setState({ presets: mergedPresets });
          }
        } catch (err) {
          window.alert(t('toolbar.import.fail', { error: (err as Error).message }));
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    },
    [setNodes, setEdges, t],
  );

  const handleExportJson = useCallback(() => {
    const { nodes, edges, presets } = getSerializedGraph();
    if (nodes.length === 0) {
      window.alert(t('toolbar.exportJson.empty'));
      return;
    }
    const name = activeTab.name || 'graph';
    const data = { name, description: '', nodes, edges, presets };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [getSerializedGraph, activeTab.name, t]);

  const handleExportSubgraph = useCallback(async () => {
    const { nodes, edges } = getSerializedGraph();
    if (nodes.length === 0) {
      window.alert(t('toolbar.export.empty'));
      return;
    }
    const name = window.prompt(t('toolbar.export.prompt'));
    if (!name?.trim()) return;
    try {
      await createPreset({ name: name.trim(), nodes, edges });
      await fetchDefinitions();
      window.alert(t('toolbar.export.success', { name: name.trim() }));
    } catch (e) {
      window.alert(t('toolbar.export.fail', { error: (e as Error).message }));
    }
  }, [getSerializedGraph, fetchDefinitions, t]);

  const handleExportPython = useCallback(async () => {
    const { nodes, edges } = getSerializedGraph();
    if (nodes.length === 0) {
      window.alert(t('toolbar.exportPython.empty'));
      return;
    }
    try {
      const result = await exportGraph(nodes, edges);
      const name = activeTab.name || 'graph';
      const blob = new Blob([result.script], { type: 'text/x-python' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.py`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert(t('toolbar.exportPython.fail', { error: (e as Error).message }));
    }
  }, [getSerializedGraph, activeTab.name, t]);

  const handleReloadNodes = useCallback(async () => {
    try { await reload(); }
    catch (e) { window.alert(t('toolbar.reload.fail', { error: (e as Error).message })); }
  }, [reload, t]);

  /* ── Menu definitions ─────────────────────────────────────────── */

  const fileMenuItems: MenuItem[] = [
    { label: t('toolbar.save'), title: t('toolbar.save.title'), onClick: handleSave },
    { label: t('toolbar.clear'), title: t('toolbar.clear.title'), onClick: handleClear },
  ];

  const exportMenuItems: MenuItem[] = [
    { label: t('toolbar.exportJson'), title: t('toolbar.exportJson.title'), onClick: handleExportJson },
    { label: t('toolbar.export'), title: t('toolbar.export.title'), onClick: handleExportSubgraph, color: BRAND.preset },
    { label: t('toolbar.exportPython'), title: t('toolbar.exportPython.title'), onClick: handleExportPython },
  ];

  /* ── Status ───────────────────────────────────────────────────── */

  const statusKey = `status.${status}` as const;
  const statusDotColor = STATUS_COLORS[status] ?? SURFACE.borderMedium;
  const statusTextColor = STATUS_COLORS[status] ?? TEXT.dim;
  const statusGlow = status === 'running' ? `0 0 6px ${STATUS_COLORS.running}` : 'none';

  return (
    <div className={styles.root}>
      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.logoBrand}>Codefy</span>
        <span className={styles.logoSuffix}>UI</span>
      </div>

      <div className={styles.divider} />

      {/* Run / Stop */}
      <div className={styles.actionGroup}>
        <button
          onClick={handleRun}
          disabled={isRunning}
          title={t('toolbar.run.title')}
          className={`${styles.actionButton} ${styles.runButton}`}
          style={{ opacity: isRunning ? 0.4 : 1 }}
        >
          {isRunning ? t('toolbar.running') : t('toolbar.run')}
        </button>
        <button
          onClick={handleStop}
          disabled={!isRunning}
          title={t('toolbar.stop.title')}
          className={`${styles.actionButton} ${styles.stopButton}`}
          style={{ opacity: !isRunning ? 0.4 : 1 }}
        >
          {t('toolbar.stop')}
        </button>
      </div>

      <div className={styles.divider} />

      {/* File menu: Save + Clear */}
      <MenuDropdown
        label={t('toolbar.menu.file')}
        items={fileMenuItems}
        open={openMenu === 'file'}
        onToggle={() => toggleMenu('file')}
        onClose={closeMenus}
      />

      {/* Load menu: saved graphs + import JSON */}
      <LoadSubMenu
        open={openMenu === 'load'}
        onToggle={() => toggleMenu('load')}
        onClose={closeMenus}
        onLoadGraph={handleLoadGraph}
        onImport={() => fileInputRef.current?.click()}
        t={t}
      />

      {/* Export menu: JSON / Subgraph / Python */}
      <MenuDropdown
        label={t('toolbar.menu.export')}
        items={exportMenuItems}
        open={openMenu === 'export'}
        onToggle={() => toggleMenu('export')}
        onClose={closeMenus}
      />

      <div className={styles.divider} />

      {/* Reload nodes */}
      <button
        onClick={handleReloadNodes}
        title={t('toolbar.reloadNodes.title')}
        className={styles.menuTrigger}
        style={{ color: TEXT.muted }}
      >
        {t('toolbar.reloadNodes')}
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className={styles.fileInput}
        onChange={handleImportFile}
      />

      {/* Right side: toggles + status + language */}
      <div className={styles.rightCluster}>
        <GridSnapToggle />
        <TooltipToggle />

        <div className={styles.statusGroup}>
          <span
            className={styles.statusDot}
            style={{ background: statusDotColor, boxShadow: statusGlow }}
          />
          <span className={styles.statusLabel} style={{ color: statusTextColor }}>
            {t(statusKey)}
          </span>
        </div>

        {/* Language selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setLangMenuOpen((v) => !v)}
            className={styles.langButton}
            style={{ background: langMenuOpen ? SURFACE.borderLight : SURFACE.input }}
          >
            {SUPPORTED_LOCALES.find((l) => l.code === locale)?.label ?? locale}
          </button>

          {langMenuOpen && (
            <>
              <div className={styles.overlay} onClick={() => setLangMenuOpen(false)} />
              <div className={styles.langDropdown}>
                {SUPPORTED_LOCALES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => { setLocale(l.code); setLangMenuOpen(false); }}
                    className={styles.langOption}
                    style={{
                      color: l.code === locale ? BRAND.primary : TEXT.secondary,
                      fontWeight: l.code === locale ? 600 : 400,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = SURFACE.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span>{l.nativeName}</span>
                    {l.code === locale && <span className={styles.langOptionCheck}>✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
