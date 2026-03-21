import type { TranslationKey } from './en';

const zhTW: Record<TranslationKey, string> = {
  // Toolbar
  'toolbar.run': '執行',
  'toolbar.running': '執行中...',
  'toolbar.stop': '停止',
  'toolbar.run.title': '執行管線',
  'toolbar.stop.title': '停止執行',
  'toolbar.reloadNodes': '重新載入節點',
  'toolbar.reloadNodes.title': '從後端重新載入節點定義',
  'toolbar.reload.fail': '重新載入失敗：{error}',

  // Menu: File
  'toolbar.menu.file': '檔案',
  'toolbar.save': '儲存',
  'toolbar.save.title': '儲存圖表',
  'toolbar.save.prompt': '請輸入圖表名稱：',
  'toolbar.save.success': '圖表「{name}」儲存成功。',
  'toolbar.save.fail': '儲存失敗：{error}',
  'toolbar.load': '載入',
  'toolbar.load.title': '載入已儲存的圖表',
  'toolbar.load.fail': '載入失敗：{error}',
  'toolbar.load.loading': '載入中...',
  'toolbar.load.empty': '沒有已儲存的圖表',
  'toolbar.import': '匯入 JSON...',
  'toolbar.import.fail': '匯入失敗：{error}',
  'toolbar.clear': '清除畫布',
  'toolbar.clear.title': '清除畫布',
  'toolbar.clear.confirm': '確定要清除畫布嗎？所有未儲存的內容將會遺失。',

  // Menu: Export
  'toolbar.menu.export': '匯出',
  'toolbar.export.empty': '畫布為空 — 請先新增一些節點再匯出。',
  'toolbar.exportJson': '匯出為 JSON',
  'toolbar.exportJson.title': '將圖表下載為 JSON 檔案（包含子圖）',
  'toolbar.exportJson.empty': '畫布為空 — 請先新增一些節點再匯出。',
  'toolbar.export': '匯出為子圖',
  'toolbar.export.title': '將目前圖表匯出為可重用的子圖/預設模組',
  'toolbar.export.prompt': '請輸入子圖名稱：',
  'toolbar.export.success': '子圖「{name}」匯出成功！已出現在預設模組分頁中。',
  'toolbar.export.fail': '匯出失敗：{error}',
  'toolbar.exportPython': '匯出為 Python',
  'toolbar.exportPython.title': '將圖表下載為獨立的 Python 腳本',
  'toolbar.exportPython.empty': '畫布為空 — 請先新增一些節點再匯出。',
  'toolbar.exportPython.fail': 'Python 匯出失敗：{error}',

  // Status
  'status.idle': '閒置',
  'status.running': '執行中',
  'status.completed': '已完成',
  'status.error': '錯誤',
  'status.skipped': '已跳過',
  'status.cached': '已快取',

  // Node Palette
  'palette.title': '節點面板',
  'palette.search': '搜尋節點...',
  'palette.loading': '載入節點中...',
  'palette.loadFail': '載入節點失敗：{error}',
  'palette.retry': '重試',
  'palette.noMatch': '找不到符合的節點',
  'palette.empty': '沒有可用的節點',
  'palette.hint': '拖曳節點到畫布上',
  'palette.tabPresets': '預設模組',
  'palette.tabOperations': '操作節點',
  'palette.noPresets': '沒有可用的預設模組',

  // Config Panel
  'config.title': '節點設定',
  'config.selectNode': '請選擇一個節點進行設定',
  'config.parameters': '參數',
  'config.noParams': '沒有可設定的參數',
  'config.ports': '連接埠',
  'config.inputs': '輸入',
  'config.outputs': '輸出',
  'config.optional': '可選',
  'config.execution': '執行狀態',
  'config.range': '範圍：{min} — {max}',

  // Node
  'node.opt': '可選',
  'node.running': '執行中...',
  'node.completed': '已完成',
  'node.cached': '已快取',
  'node.error': '錯誤：{error}',

  // Results Panel
  'results.title': '執行紀錄',
  'results.training': '訓練',
  'results.trainingConfig': '訓練參數',
  'results.trainingEmpty': '尚無訓練資料。',
  'results.clear': '清除',
  'results.empty': '尚無紀錄。請執行管線以查看輸出。',

  // Preset
  'preset.badge': '預設',
  'preset.configure': '設定預設模組',
  'preset.nodeCount': '內含 {count} 個節點',
  'preset.nodesInside': '個內部節點',
  'preset.apply': '套用',
  'preset.cancel': '取消',
  'preset.generalGroup': '一般',

  // Empty Canvas
  'empty.title': '建立你的第一個深度學習模型',
  'empty.subtitle': '選擇一個預設模組快速開始',
  'empty.hint': '或從左側面板拖曳節點',

  // Context Menu
  'contextMenu.rename': '重新命名',
  'contextMenu.duplicate': '複製',
  'contextMenu.delete': '刪除',
  'contextMenu.rename.prompt': '請輸入節點的新名稱：',

  // Tabs
  'tabs.add': '新增分頁',
  'tabs.closeRunning': '此分頁仍在執行中，確定要關閉嗎？',

  // Subgraph Editor (SequentialModel)
  'subgraph.title': '模型架構編輯器',
  'subgraph.palette': '層級',
  'subgraph.apply': '套用',
  'subgraph.cancel': '取消',
  'subgraph.import': '匯入',
  'subgraph.export': '匯出',
  'subgraph.import.title': '匯入已儲存的模型架構',
  'subgraph.export.title': '將目前架構匯出為 JSON',
  'subgraph.empty': '從左側面板拖曳層級來建構你的模型',
  'subgraph.layerCount': '{count} 個層級',
  'subgraph.params': '參數',
  'subgraph.noParams': '無參數',
  'subgraph.deleteLayer': '刪除',
  'subgraph.hint': '雙擊以編輯架構',
  'subgraph.import.fail': '匯入失敗：{error}',
  'subgraph.searchLayers': '搜尋層級...',

  // Tooltips
  'toolbar.tooltips.on': '提示 ON',
  'toolbar.tooltips.off': '提示 OFF',
  'toolbar.tooltips.title': '切換節點描述提示',

  // Language
  'lang.label': '中',
};

export default zhTW;
