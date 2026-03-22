const en = {
  // Toolbar
  'toolbar.run': 'Run',
  'toolbar.running': 'Running...',
  'toolbar.stop': 'Stop',
  'toolbar.run.title': 'Execute the pipeline (Run)',
  'toolbar.stop.title': 'Stop execution',
  'toolbar.reloadNodes': 'Reload Nodes',
  'toolbar.reloadNodes.title': 'Reload node definitions from backend',
  'toolbar.reload.fail': 'Reload failed: {error}',

  // Menu: File
  'toolbar.menu.file': 'File',
  'toolbar.save': 'Save',
  'toolbar.save.title': 'Save graph',
  'toolbar.save.prompt': 'Enter a name for this graph:',
  'toolbar.save.success': 'Graph "{name}" saved successfully.',
  'toolbar.save.fail': 'Save failed: {error}',
  'toolbar.load': 'Load',
  'toolbar.load.title': 'Load a saved graph',
  'toolbar.load.fail': 'Load failed: {error}',
  'toolbar.load.loading': 'Loading...',
  'toolbar.load.empty': 'No saved graphs',
  'toolbar.import': 'Import JSON...',
  'toolbar.import.fail': 'Import failed: {error}',
  'toolbar.clear': 'Clear Canvas',
  'toolbar.clear.title': 'Clear the canvas',
  'toolbar.clear.confirm': 'Clear the canvas? All unsaved work will be lost.',

  // Menu: Export
  'toolbar.menu.export': 'Export',
  'toolbar.export.empty': 'Canvas is empty — add some nodes before exporting.',
  'toolbar.exportJson': 'Export as JSON',
  'toolbar.exportJson.title': 'Download graph as JSON file (includes subgraphs)',
  'toolbar.exportJson.empty': 'Canvas is empty — add some nodes before exporting.',
  'toolbar.export': 'Export as Subgraph',
  'toolbar.export.title': 'Export current graph as a reusable subgraph/preset',
  'toolbar.export.prompt': 'Enter a name for this subgraph:',
  'toolbar.export.success': 'Subgraph "{name}" exported successfully! It now appears in the Presets tab.',
  'toolbar.export.fail': 'Export failed: {error}',
  'toolbar.exportPython': 'Export as Python',
  'toolbar.exportPython.title': 'Download graph as a standalone Python script',
  'toolbar.exportPython.empty': 'Canvas is empty — add some nodes before exporting.',
  'toolbar.exportPython.fail': 'Python export failed: {error}',

  // Status
  'status.idle': 'Idle',
  'status.running': 'Running',
  'status.completed': 'Completed',
  'status.error': 'Error',
  'status.skipped': 'Skipped',
  'status.cached': 'Cached',

  // Node Palette
  'palette.title': 'Node Palette',
  'palette.search': 'Search nodes...',
  'palette.loading': 'Loading nodes...',
  'palette.loadFail': 'Failed to load nodes: {error}',
  'palette.retry': 'Retry',
  'palette.noMatch': 'No matching nodes',
  'palette.empty': 'No nodes available',
  'palette.hint': 'Drag nodes onto the canvas',
  'palette.tabPresets': 'Presets',
  'palette.tabOperations': 'Operations',
  'palette.noPresets': 'No presets available',

  // Config Panel
  'config.title': 'Node Config',
  'config.selectNode': 'Select a node to configure',
  'config.parameters': 'Parameters',
  'config.noParams': 'No configurable parameters',
  'config.ports': 'Ports',
  'config.inputs': 'Inputs',
  'config.outputs': 'Outputs',
  'config.optional': 'optional',
  'config.execution': 'Execution',
  'config.range': 'Range: {min} — {max}',

  // Node
  'node.opt': 'opt',
  'node.running': 'Running...',
  'node.completed': 'Completed',
  'node.cached': 'Cached',
  'node.error': 'Error: {error}',

  // Results Panel
  'results.title': 'Execution Log',
  'results.training': 'Training',
  'results.trainingConfig': 'Parameters',
  'results.trainingEmpty': 'No training data yet.',
  'results.clear': 'Clear',
  'results.empty': 'No log entries. Run the pipeline to see output.',

  // Preset
  'preset.badge': 'PRESET',
  'preset.configure': 'Configure Preset',
  'preset.nodeCount': '{count} nodes inside',
  'preset.nodesInside': 'nodes inside',
  'preset.apply': 'Apply',
  'preset.cancel': 'Cancel',
  'preset.generalGroup': 'General',

  // Empty Canvas
  'empty.title': 'Build your first deep learning model',
  'empty.subtitle': 'Pick a preset to get started quickly',
  'empty.hint': 'or drag a node from the left palette',

  // Context Menu
  'contextMenu.rename': 'Rename',
  'contextMenu.duplicate': 'Duplicate',
  'contextMenu.delete': 'Delete',
  'contextMenu.rename.prompt': 'Enter a new name for this node:',

  // Tabs
  'tabs.add': 'New tab',
  'tabs.closeRunning': 'This tab is still running. Close it anyway?',

  // Subgraph Editor (SequentialModel)
  'subgraph.title': 'Model Architecture Editor',
  'subgraph.palette': 'Layers',
  'subgraph.apply': 'Apply',
  'subgraph.cancel': 'Cancel',
  'subgraph.import': 'Import',
  'subgraph.export': 'Export',
  'subgraph.import.title': 'Import a saved model architecture',
  'subgraph.export.title': 'Export current architecture as JSON',
  'subgraph.empty': 'Drag layers from the left panel to build your model',
  'subgraph.layerCount': '{count} layers',
  'subgraph.params': 'Parameters',
  'subgraph.noParams': 'No parameters',
  'subgraph.deleteLayer': 'Delete',
  'subgraph.hint': 'Double-click to edit architecture',
  'subgraph.import.fail': 'Import failed: {error}',
  'subgraph.searchLayers': 'Search layers...',

  // Tooltips
  'toolbar.tooltips.on': 'Tips ON',
  'toolbar.tooltips.off': 'Tips OFF',
  'toolbar.tooltips.title': 'Toggle node description tooltips',

  // Grid Snap
  'toolbar.gridSnap.on': 'Snap ON',
  'toolbar.gridSnap.off': 'Snap OFF',
  'toolbar.gridSnap.title': 'Toggle grid snapping for node alignment',

  // Language
  'lang.label': 'EN',
} as const;

export type TranslationKey = keyof typeof en;
export default en;
