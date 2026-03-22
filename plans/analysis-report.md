# CodefyUI 專案分析報告

> 撰寫日期：2026-03-21（最後更新：2026-03-22）
> 目標：評估 CodefyUI 現況、分析競品、規劃專業 AI/ML 視覺化管線工具的發展路徑

---

## 目錄

1. [Executive Summary](#1-executive-summary)
2. [現況分析](#2-現況分析)
3. [競品分析](#3-競品分析)
4. [Gap Analysis — 差距分析](#4-gap-analysis--差距分析)
5. [目標定位與願景](#5-目標定位與願景)
6. [建議發展路線圖](#6-建議發展路線圖)
7. [技術架構建議](#7-技術架構建議)
8. [風險評估](#8-風險評估)
9. [附錄：競品功能對照表](#9-附錄競品功能對照表)

---

## 1. Executive Summary

CodefyUI 目前是一個**早期原型** (v0.1.0)，具備視覺化節點式深度學習管線建構的核心功能。專案架構良好（前後端分離、Backend-authoritative 設計、類型安全的連線系統），但距離「專業 AI/ML 專案工具」仍有顯著差距。

**核心優勢：**
- 已具備完整的 DAG 圖形編輯器、拓撲排序執行引擎（含並行執行）、類型系統
- 架構設計正確（BaseNode 抽象、Registry 模式、Preset 子圖系統）
- 前後端技術棧現代化（React 19 + FastAPI + WebSocket）
- 支援自訂節點熱重載、多分頁工作區
- Custom Node Manager GUI（上傳、啟用/停用、刪除自訂節點）
- 部分重新執行（Dirty Node Tracking — 僅重跑變更的節點及其下游）
- 快速節點搜尋（雙擊畫布即時搜尋新增節點）
- 模型權重檔案管理 API（上傳/列表/刪除 .pt/.pth/.safetensors/.ckpt/.bin）
- CLI 圖表執行器（`run_graph.py` — 命令列直接執行 graph.json）
- 結構化日誌系統（JSON 格式化、輪轉檔案）
- 完整測試套件（後端 pytest + 前端 vitest）
- 執行取消、錯誤恢復、並行執行、節點快取
- 6 種 ParamType（int/float/string/bool/select/model_file）
- 範例工作流分類組織（Model_Architecture / Usage_Example）

**主要差距：**
- 缺乏 GPU/分散式計算支援
- 無實驗追蹤、模型版本管理
- 無使用者認證與團隊協作
- 無容器化部署方案
- 節點生態系統持續擴充中（59 個內建節點，涵蓋 11 類別）
- 無 LLM/GenAI 相關節點

---

## 2. 現況分析

### 2.1 技術棧

| 層級 | 技術 | 版本 |
|------|------|------|
| **前端框架** | React | 19.1 |
| **類型系統** | TypeScript | 5.8 |
| **圖形引擎** | React Flow (@xyflow/react) | 12.6 |
| **狀態管理** | Zustand | 5.0 |
| **建構工具** | Vite | 6.3 |
| **後端框架** | FastAPI | 0.115+ |
| **ML 框架** | PyTorch | 2.0+ |
| **即時通訊** | WebSocket (原生) | — |
| **數據驗證** | Pydantic | 2.0+ |
| **Python** | 3.10+ (實際用 3.14) | — |

### 2.2 架構分析

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React 19)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ NodePal  │ │FlowCanvas│ │ConfigPanl│ │ ResultsPanel  │  │
│  │  ette    │ │(ReactFlow│ │          │ │               │  │
│  │          │ │ + BaseNod│ │          │ │               │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Zustand Store (tabStore)                 │   │
│  │   nodes[] | edges[] | tabs[] | execution status      │   │
│  └──────────────────────────────────────────────────────┘   │
│                    │ REST API        │ WebSocket             │
└────────────────────┼────────────────┼───────────────────────┘
                     │                │
┌────────────────────┼────────────────┼───────────────────────┐
│                    ▼                ▼                        │
│                   Backend (FastAPI)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   routes_nodes | routes_graph | routes_presets        │   │
│  │   routes_custom_nodes | routes_models                │   │
│  │                 ws_execution                          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Core Engine                              │   │
│  │  NodeRegistry | PresetRegistry | GraphEngine          │   │
│  │  TypeSystem   | BaseNode (ABC)                        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Node Packages (59 nodes)                  │   │
│  │  CNN(9) | RNN(2) | Transformer(3) | RL(3) | Data(3)  │   │
│  │  Training(4) | IO(9) | Control(3) | Utility(8)       │   │
│  │  Normalization(4) | TensorOps(11)                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 功能清單

| 功能 | 狀態 | 備註 |
|------|------|------|
| DAG 圖形編輯器 | 已完成 | React Flow 12, 拖放、連線、多選 |
| 類型安全連線 | 已完成 | 10 種 DataType, 相容性矩陣 |
| 節點參數面板 | 已完成 | 6 種 ParamType (int/float/string/bool/select/model_file) |
| 拓撲排序執行 | 已完成 | Kahn's algorithm, 循環偵測 |
| WebSocket 即時進度 | 已完成 | 每節點 running/completed/error 狀態 |
| Preset 子圖系統 | 已完成 | 巢狀展開、自動偵測外露埠口 |
| 多分頁工作區 | 已完成 | 獨立執行環境、localStorage 持久化 |
| 自訂節點 | 已完成 | Python 檔案放入 custom_nodes/, 熱重載, Custom Node Manager GUI |
| 匯入/匯出 Graph JSON | 已完成 | 檔案上傳 + 後端儲存 |
| Python 腳本匯出 | 部分完成 | 僅產生骨架，非可執行程式碼 |
| i18n 多語言 | 已完成 | 英文 + 繁體中文 |
| 深色主題 | 已完成 | 固定深色主題 |
| 範例工作流 | 已完成 | 16 個範例, 分類組織 (Model_Architecture / Usage_Example) |
| 圖表驗證 | 已完成 | 邊緣類型檢查 + 循環偵測 |
| MiniMap | 已完成 | 類別顏色標示 |
| 右鍵選單 | 已完成 | 刪除/複製/重命名 |
| 快速節點搜尋 | 已完成 | 雙擊畫布開啟搜尋面板, 即時搜尋新增節點/Preset |
| 部分重新執行 | 已完成 | Dirty Node Tracking, 僅重跑變更節點及其下游 |
| 模型權重管理 | 已完成 | REST API 上傳/列表/刪除 (.pt/.pth/.safetensors/.ckpt/.bin) |
| MODEL_FILE 參數類型 | 已完成 | 節點參數可選取已上傳的模型檔案, 含上傳按鈕 |
| Custom Node Manager | 已完成 | GUI 管理自訂節點 (上傳/啟用/停用/刪除) |
| CLI 圖表執行器 | 已完成 | `run_graph.py` 命令列直接執行 graph.json |
| ResultsPanel 增強 | 已完成 | 分頁 (Log/Training), 可調整高度, Loss 曲線圖表 |

### 2.4 內建節點清單 (59 個)

| 類別 | 節點 | 數量 |
|------|------|------|
| **CNN** | Conv2d, Conv1d, ConvTranspose2d, MaxPool2d, AvgPool2d, AdaptiveAvgPool2d, BatchNorm2d, Dropout, Activation | 9 |
| **RNN** | LSTM, GRU | 2 |
| **Transformer** | MultiHeadAttention, TransformerEncoder, TransformerDecoder | 3 |
| **RL** | DQN, PPO, EnvWrapper | 3 |
| **Data** | Dataset, DataLoader, Transform | 3 |
| **Training** | Optimizer, Loss, TrainingLoop, LRScheduler | 4 |
| **IO** | ImageReader, ImageWriter, ImageBatchReader, FileReader, CheckpointSaver, CheckpointLoader, ModelLoader, ModelSaver, Inference | 9 |
| **Control** | If, ForLoop, Compare | 3 |
| **Utility** | Print, Reshape, Concat, Flatten, Linear, SequentialModel, Visualize, Embedding | 8 |
| **Normalization** | BatchNorm1d, LayerNorm, GroupNorm, InstanceNorm2d | 4 |
| **Tensor Operations** | Add, MatMul, Mean, Multiply, Permute, Softmax, Split, Squeeze, Stack, TensorCreate, Unsqueeze | 11 |

### 2.5 程式碼品質評估

**優點：**
- 後端架構清晰：BaseNode ABC → NodeRegistry → GraphEngine 層次分明
- 前端 Zustand 單一 store 設計合理，per-tab 隔離良好
- 類型系統完整（DataType enum + 相容性矩陣）
- Preset 系統設計精巧（自動外露偵測、巢狀展開、參數覆蓋）

**近期改善（已完成）：**
- 前端樣式已遷移至 CSS Modules + 共用 theme tokens（commit 0245d51）
- 測試套件已建立：後端 10 個測試檔案 43+ 測試函式（pytest）、前端 vitest
- 結構化日誌系統已實作（JsonFormatter、輪轉檔案、16 個模組使用 logging）（commit 2b582d1）
- WebSocket 執行取消已實作（ExecutionContext event-based cancellation）（commit ce226d4）
- 並行節點執行已實作（topological_levels + asyncio.gather 同層級並行）（commit ce226d4）
- 錯誤恢復機制已實作（fail_fast / continue / retry 三種模式）（commit ce226d4）
- 節點輸出快取已實作（hash-based 變更偵測）（commit ce226d4）
- Custom Node Manager GUI 已實作（上傳/啟用/停用/刪除自訂節點）（commit ec12b16）
- 部分重新執行已實作（Dirty Node Tracking — 修改節點後僅重跑該節點及下游）（commit 5f13037）
- 快速節點搜尋面板已實作（雙擊畫布開啟搜尋，支援節點+Preset）（commit ef0c592）
- 模型權重檔案管理 API 已實作（routes_models — 上傳/列表/刪除 .pt/.pth/.safetensors/.ckpt/.bin）
- MODEL_FILE ParamType 已新增（節點參數可下拉選取已上傳模型檔案，含上傳按鈕）
- CLI 圖表執行器已實作（run_graph.py — 命令列驗證+執行 graph.json）
- ResultsPanel 增強（分頁切換 Log/Training、可拖曳調整高度、Loss 曲線圖表）
- 範例工作流重新分類組織（Model_Architecture / Usage_Example 子目錄）
- python-multipart 依賴已加入（支援檔案上傳）（commit e3c00fb）

**仍待改善：**
- Graph 儲存使用 JSON 檔案，無資料庫
- Python 腳本匯出功能不完整（僅骨架程式碼，無可執行的資料流程式碼）

---

## 3. 競品分析

### 3.1 ComfyUI — 圖像生成工作流引擎

**概述：** ComfyUI 是最成功的開源節點式 AI 工作流工具，專注於 Stable Diffusion 圖像生成。GitHub 92.5k+ stars，4M+ 活躍使用者。

| 面向 | 詳情 |
|------|------|
| **技術棧** | 後端 Python (PyTorch), 前端 Vue 3 + TypeScript (獨立套件 comfyui-frontend-package), REST + WebSocket |
| **執行引擎** | 智慧快取系統 — 僅重新執行變更的節點，大幅提升效率 |
| **GPU 管理** | 智慧 VRAM 管理，自動卸載不需要的模型，支援多 GPU |
| **節點數量** | 核心 ~50+，社群擴充 2,000+ 套件 (透過 ComfyUI Manager)，2.5M 共享工作流 |
| **社群生態** | ComfyUI Manager 一鍵安裝社群節點，50k+ Discord 月活，300+ 核心貢獻者 |
| **API** | 完整 REST API，可程式化驅動工作流 |
| **部署** | Docker 支援, 雲端服務 (RunComfy, ComfyICU), 內建隊列 |

**ComfyUI 成功關鍵因素：**
1. **增量執行 + 快取** — 只重跑改動的部分，互動體驗極佳
2. **社群節點生態** — ComfyUI Manager 讓安裝第三方節點像 npm install 一樣簡單
3. **專注單一領域** — 圖像生成做到極致
4. **GPU 智慧管理** — 自動 VRAM 分配、模型切換
5. **工作流分享文化** — JSON 工作流直接匯入匯出

**ComfyUI 弱點：**
- 學習曲線陡峭，對非技術使用者不友善
- 僅限圖像/影片生成，不適合通用 ML
- 自訂節點生態碎片化（維護品質參差、版本相容性問題）
- 行動裝置體驗差
- 安裝設定複雜（特別是 macOS）

### 3.2 n8n — 工作流自動化平台

**概述：** 開源工作流自動化工具，定位類似 Zapier 但可自建。GitHub 40k+ stars，45k+ 社群論壇成員。

| 面向 | 詳情 |
|------|------|
| **技術棧** | TypeScript, Vue.js 前端, Node.js 後端, SQLite/PostgreSQL |
| **節點數量** | 400+ 內建整合節點 |
| **AI 功能** | AI Agent 節點、LangChain 整合、向量儲存、MCP 支援、多 Agent 系統編排 |
| **部署** | Docker, Kubernetes, 雲端託管 (n8n Cloud) |
| **定價** | Community (免費自建) / Cloud ($20/mo+) / Enterprise (客製) |
| **特色** | 視覺化除錯、版本控制、子工作流、錯誤處理流程、Agentic AI 四大模式 |

**與 CodefyUI 的關聯：**
- n8n 展示了節點式工具如何擴展到企業級
- AI Agent 功能值得參考（LLM 整合、工具使用、記憶機制）
- 子工作流 = CodefyUI 的 Preset 概念，但更成熟
- 錯誤處理流程是 CodefyUI 缺失的關鍵功能

### 3.3 Kubeflow Pipelines — 企業級 ML 管線

**概述：** Google 主導的 Kubernetes 原生 ML 管線平台。

| 面向 | 詳情 |
|------|------|
| **技術棧** | Python SDK, Kubernetes, Argo Workflows |
| **UI** | 有視覺化介面但非主要互動方式，以 Python SDK 為主 |
| **特色** | 容器化每個步驟、自動擴縮、實驗追蹤、Artifacts 管理 |
| **適合** | 大規模 MLOps、生產環境管線 |
| **GitHub Stars** | ~14k (Kubeflow 整體) |

**啟示：**
- Pipeline = 容器化步驟的 DAG，每個步驟是獨立容器
- 實驗追蹤是必要功能
- 生產環境部署需要容器化
- 與 K8s 的深度整合帶來強大的擴縮能力

### 3.4 Apache Airflow — DAG 排程引擎

**概述：** Python 原生的工作流排程平台。Airflow 是 DAG 式工作流的標竿。

| 面向 | 詳情 |
|------|------|
| **技術棧** | Python, Flask, Celery/Kubernetes Executor |
| **定義方式** | Python 程式碼定義 DAG（非視覺化優先） |
| **特色** | 排程、重試、SLA、告警、豐富的 Operator 生態 |
| **GitHub Stars** | ~40k |

**啟示：**
- DAG 排程（Cron-based）是 CodefyUI 缺失的
- 重試機制、SLA 監控是生產環境必須
- Operator/Hook/Sensor 模式值得參考
- Airflow 的視覺化介面是輔助而非主要入口 — CodefyUI 的「視覺化優先」是差異化

### 3.5 MLflow — ML 生命週期管理

**概述：** ML 實驗追蹤、模型註冊、部署的標準工具。

| 面向 | 詳情 |
|------|------|
| **核心功能** | Tracking (實驗記錄), Models (模型版本), Registry (模型註冊), Serving |
| **GitHub Stars** | ~19k |
| **整合** | PyTorch, TensorFlow, scikit-learn, HuggingFace |

**啟示：**
- CodefyUI 應整合 MLflow 而非重新發明
- 實驗追蹤 (metrics, params, artifacts) 是核心需求
- 模型版本管理是生產化的前提

### 3.6 Weights & Biases (W&B) — 實驗追蹤平台

**概述：** ML 實驗追蹤與協作平台，商業化成功案例。

| 面向 | 詳情 |
|------|------|
| **核心功能** | 實驗追蹤、超參搜尋、模型評估、資料版本、報告 |
| **協作** | 團隊 Dashboard、報告分享、模型審核 |
| **特色** | Sweeps (超參最佳化), Artifacts (資料版本), Tables (互動式資料分析) |

**啟示：**
- 互動式訓練曲線、即時指標是必備功能
- 團隊協作功能對企業客戶至關重要
- W&B 的 Dashboard 和報告功能可作為 UI 參考

### 3.7 Flowise / Langflow — LLM 視覺化工作流

**概述：** 專為 LLM 應用設計的節點式工作流建構工具。

| 工具 | 技術棧 | Stars | 特色 |
|------|--------|-------|------|
| **Flowise** | TypeScript, React Flow, Node.js | ~30k | LangChain 視覺化, 拖放建構 Chatbot, 100+ 整合, RBAC/SSO |
| **Langflow** | Python, React Flow, FastAPI | **100k+** | DataStax 支持, 多框架支援, MCP 支援, 最快速的 RAG 原型開發 |
| **Dify** | Python, React | ~55k | 全方位 LLM 應用建構, RAG + Agent, YAML DSL 工作流分享 |

**關鍵共通點：**
- 都使用 React Flow（與 CodefyUI 相同）
- 都聚焦 LLM/RAG 應用場景
- Langflow 的技術棧（Python + FastAPI + React Flow）與 CodefyUI 幾乎相同

**啟示：**
- LLM/GenAI 節點是當前市場最大需求
- RAG 管線建構是高需求場景
- CodefyUI 可以覆蓋 Langflow 的場景並擴展到傳統 ML

### 3.8 其他值得關注的工具

| 工具 | 定位 | 值得借鏡之處 |
|------|------|-------------|
| **Gradio** | ML 模型 Demo 介面 | 快速原型驗證、分享、HuggingFace 整合 |
| **Streamlit** | 資料應用快速開發 | Python-native 體驗、即時預覽 |
| **Dify** | LLM 應用開發平台 | Agent 編排、知識庫、工作流、YAML DSL |
| **NodeTool** | 本地優先節點式 AI 工作流 | 支援圖像/影片/文字/資料/自動化 |
| **Adobe Project Graph** | Creative Cloud 節點式 AI 系統 | 原生 Creative Cloud 整合 (2025 發布) |
| **Haystack** | NLP/RAG 管線 | Pipeline 抽象、Component 系統 |
| **ZenML** | MLOps 管線框架 | 可插拔的 Stack（orchestrator/artifact store/model deployer） |
| **Prefect** | 現代工作流引擎 | Python-native, ControlFlow AI 任務抽象 |
| **Kedro** | ML 管線框架 | 資料目錄、管線視覺化、可重現性 |
| **Metaflow** | ML 工程框架 | Netflix 出品, 專注 ML 工程師體驗 |

### 3.9 市場規模數據

| 市場區間 | 2024-2025 規模 | 預估 2033-2035 | CAGR |
|----------|---------------|---------------|------|
| 視覺分析工具 | $150 億 | $600 億 (2033) | 20% |
| 資料管線工具 | $639 億 | $5,145 億 (2034) | 26.8% |
| MLOps | $17-30 億 | $390-890 億 (2034) | 37-40% |
| LLM 市場 | $77.7 億 | $1,498 億 (2035) | 34.4% |
| 多模態 AI | $16 億 | 快速增長 (2034) | 32.7% |
| 低代碼平台 | $287.5 億 | $2,644 億 (2032) | 32.2% |

**關鍵市場趨勢：**
- 企業 AI 支出：2025 年 GenAI 支出 $370 億，較 2024 年 $115 億增長 3.2 倍
- Anthropic 取代 OpenAI 成為企業 LLM 支出第一（40% vs 27%）
- 開源 LLM 即將突破 50% 生產環境市佔率
- 76% 技術組織正在增加開源 AI 工具投資
- 2025 年 70% 新應用將使用低代碼/無代碼技術
- Model Context Protocol (MCP) 正成為 LLM 整合標準協議

---

## 4. Gap Analysis — 差距分析

### 4.1 關鍵差距矩陣

| 功能領域 | CodefyUI 現況 | 行業標準 | 差距嚴重度 |
|----------|---------------|----------|-----------|
| **執行引擎** | 並行執行 + 部分重新執行（dirty tracking） | 增量/並行/分散式 | 低（僅剩分散式） |
| **快取系統** | 已實作 hash-based 節點快取 + dirty node tracking | 節點級快取、增量執行 | 低（已解決） |
| **GPU 管理** | 僅基本 cpu/cuda 選擇 | VRAM 管理、多 GPU、自動裝置分配 | 嚴重 |
| **實驗追蹤** | 無 | MLflow/W&B 整合 | 嚴重 |
| **模型管理** | 基本（模型檔案上傳/列表/刪除 API） | 版本控制、註冊、部署 | 中（已部分解決） |
| **LLM/GenAI 節點** | 無 | LLM 推理、RAG、Embedding、Agent | 嚴重 |
| **使用者認證** | 無 | OAuth2, RBAC | 高 |
| **團隊協作** | 無 | 共享工作區、版本控制、評論 | 高 |
| **容器化部署** | 無 | Docker, K8s, Helm | 高 |
| **錯誤處理** | 已實作 fail_fast/continue/retry 三種模式 | 重試、fallback、錯誤分支 | 低（已解決） |
| **排程執行** | 無 | Cron、事件觸發 | 中 |
| **節點生態** | 59 個內建（11 類別）+ Custom Node Manager GUI | 社群市場、包管理器 | 中（管理工具已有） |
| **資料庫儲存** | JSON 檔案 | PostgreSQL/SQLite | 中 |
| **API/SDK** | 基本 REST | 完整 API + Python/JS SDK | 中 |
| **監控/可觀測性** | WebSocket 進度 + 結構化日誌系統 | 指標、日誌、告警、Dashboard | 中（日誌已解決） |
| **測試框架** | 已建立（pytest + vitest, 43+ 測試） | 節點單元測試、管線整合測試 | 低（已部分解決） |
| **文件** | README 等級 | 完整文件站、教學、API 文件 | 中 |
| **Diffusion 模型節點** | 無 | SD/SDXL/Flux/ComfyUI 等級 | 視定位 |

### 4.2 最關鍵的 5 個差距

1. ~~**執行引擎升級**~~ — 已實作節點快取、並行執行、執行取消、錯誤恢復（剩餘：分散式執行）
2. **LLM/GenAI 節點** — 當前市場最大需求，Langflow/Flowise 的增長證明了這一點
3. **實驗追蹤整合** — 沒有 MLflow/W&B 整合，對 ML 工程師來說工具不完整
4. **社群節點生態** — ComfyUI Manager 模式證明了生態系統的重要性
5. **容器化 + 部署** — 無法 Docker 部署 = 無法進入生產環境

---

## 5. 目標定位與願景

### 5.1 建議定位

> **CodefyUI：視覺化 AI/ML 全流程管線建構平台**
>
> 從模型設計到部署的一站式視覺化工具 — 涵蓋傳統 ML、深度學習、LLM/GenAI、RAG 管線。

### 5.2 差異化策略

相較於競品，CodefyUI 的差異化空間：

| 競品 | 其限制 | CodefyUI 的機會 |
|------|--------|----------------|
| ComfyUI | 僅限圖像生成 | **通用 AI/ML**，涵蓋 NLP/CV/RL/GenAI |
| Langflow/Flowise | 僅限 LLM/RAG | **全流程**，含訓練 + 推理 + 部署 |
| Kubeflow | 複雜、K8s 門檻高 | **低門檻視覺化優先**，漸進式複雜度 |
| Airflow | 非視覺化優先 | **拖放式設計**，零程式碼入門 |
| MLflow/W&B | 無管線建構 | **整合**實驗追蹤 + 管線建構 |

### 5.3 目標使用者

| 使用者層級 | 描述 | 需求 |
|-----------|------|------|
| **初學者** | AI/ML 學生、研究者 | 視覺化理解模型架構、快速實驗 |
| **ML 工程師** | 日常模型開發 | 訓練管線、實驗追蹤、模型比較 |
| **MLOps 工程師** | 管線自動化 | 排程、監控、部署、CI/CD |
| **AI 應用開發者** | LLM 應用建構 | RAG 管線、Agent 編排、API 整合 |
| **團隊/企業** | 協作開發 | 共享工作區、權限、版本控制 |

---

## 6. 建議發展路線圖

### Phase 0：基礎強化 (Foundation) — 預估 4-6 週

**目標：** 修正現有短板，為後續功能打基礎

| 項目 | 說明 | 優先級 |
|------|------|--------|
| ~~執行引擎快取~~ | ~~節點級輸出快取，hash-based 變更偵測，增量執行~~ | ~~P0~~ 已完成 |
| ~~真正的執行取消~~ | ~~asyncio.Task cancellation, 可中斷的節點執行~~ | ~~P0~~ 已完成 |
| ~~錯誤處理增強~~ | ~~節點級重試、失敗繼續、錯誤分支~~ | ~~P0~~ 已完成 |
| ~~並行節點執行~~ | ~~拓撲排序後，同層級節點並行執行~~ | ~~P1~~ 已完成 |
| SQLite/PostgreSQL 儲存 | 替換 JSON 檔案存儲 (Graph, 執行記錄, 使用者設定) | P1 |
| ~~完整測試套件~~ | ~~後端單元測試 + 整合測試, 前端元件測試~~ | ~~P1~~ 已完成 |
| Docker 化 | Dockerfile + docker-compose (前端 + 後端 + DB) | P1 |
| ~~日誌系統~~ | ~~結構化日誌 (JsonFormatter), 取代 print()~~ | ~~P2~~ 已完成 |

### Phase 1：核心 AI/ML 能力 — 預估 6-8 週

**目標：** 成為有競爭力的 AI/ML 管線工具

| 項目 | 說明 | 優先級 |
|------|------|--------|
| GPU 智慧管理 | 自動裝置分配、VRAM 監控、模型卸載 | P0 |
| LLM 推理節點 | OpenAI/Anthropic/HuggingFace/Ollama API 整合 | P0 |
| Embedding 節點 | 文字向量化 (OpenAI/Sentence-Transformers/local) | P0 |
| 向量資料庫節點 | ChromaDB/Pinecone/FAISS 整合 | P0 |
| RAG 管線節點 | Document Loader/Text Splitter/Retriever/Prompt Template | P0 |
| MLflow 整合 | 實驗追蹤、模型登錄 (透過專用節點) | P1 |
| HuggingFace 整合 | 模型下載/推理/微調節點 | P1 |
| 更多傳統 ML 節點 | scikit-learn 節點 (分類/迴歸/聚類/前處理) | P1 |
| 資料視覺化增強 | 互動式圖表 (訓練曲線/混淆矩陣/ROC/特徵重要性) | P2 |
| Prompt Engineering 節點 | Template/Chain/Output Parser | P2 |

### Phase 2：專業化功能 — 預估 8-10 週

**目標：** 從原型工具升級為專業平台

| 項目 | 說明 | 優先級 |
|------|------|--------|
| 使用者認證 | OAuth2/JWT, 使用者管理 | P0 |
| 工作區與專案 | 多專案管理, 專案級設定 | P0 |
| 工作流版本控制 | Git-like 版本歷史, diff 檢視, 分支/合併 | P1 |
| Python SDK | `pip install codefyui` + Python API 操作 | P1 |
| Node Package Manager | 社群節點安裝/更新/管理（類似 ComfyUI Manager） | P1 |
| 排程執行 | Cron 排程、事件觸發、Webhook | P1 |
| AI Agent 節點 | Agent 編排, Tool 使用, Memory, Planning | P1 |
| 模型部署節點 | ONNX 匯出, TorchServe, FastAPI endpoint 生成 | P2 |
| 資料集管理 | 資料版本, 標註, 探索 | P2 |
| Diffusion 模型節點 | SD/SDXL/Flux 整合 (如果定位包含圖像生成) | P2 |

### Phase 3：企業級與生態 — 預估 10-12 週

**目標：** 適合團隊和企業使用

| 項目 | 說明 | 優先級 |
|------|------|--------|
| 團隊協作 | 即時協作編輯, 評論, 審核 | P0 |
| RBAC 權限系統 | 角色權限, 專案權限, 節點權限 | P0 |
| Kubernetes 部署 | Helm Chart, 分散式執行 | P1 |
| 監控 Dashboard | 執行歷史, 資源使用, 告警 | P1 |
| 節點市場 (Marketplace) | 社群節點發布/搜尋/安裝 | P1 |
| API Gateway | 將工作流發布為 REST API | P1 |
| 審計日誌 | 操作記錄, 合規追蹤 | P2 |
| SSO 整合 | SAML, LDAP | P2 |
| 多租戶 | 組織隔離 | P2 |
| 外掛系統 | 前端/後端外掛 API | P2 |

---

## 7. 技術架構建議

### 7.1 執行引擎升級（最關鍵）

現有架構的核心問題是序列執行且無快取。建議重新設計：

```
┌─────────────────────────────────────────────────┐
│              Execution Engine v2                │
│                                                 │
│  ┌───────────┐  ┌───────────┐  ┌─────────────┐ │
│  │  Graph    │  │  Cache    │  │  Scheduler  │ │
│  │  Compiler │→│  Manager  │→│  (async)    │ │
│  │           │  │  (hash)   │  │             │ │
│  └───────────┘  └───────────┘  └──────┬──────┘ │
│                                       │        │
│                    ┌──────────────────┼──────┐ │
│                    ▼                  ▼      │ │
│              ┌──────────┐      ┌──────────┐  │ │
│              │  Worker  │      │  Worker  │  │ │
│              │  Pool    │      │  Pool    │  │ │
│              │ (CPU)    │      │ (GPU)    │  │ │
│              └──────────┘      └──────────┘  │ │
│                                              │ │
│  ┌───────────────────────────────────────────┘ │
│  │  Progress Reporter (WebSocket)              │
│  └─────────────────────────────────────────────┘
│                                                 │
│  Key Features:                                  │
│  - Hash-based 變更偵測 (節點 params + 輸入 hash) │
│  - 並行執行同層級節點                              │
│  - GPU Worker Pool (VRAM 感知排程)               │
│  - 可中斷執行 (asyncio.Task.cancel)             │
│  - 執行歷史記錄到 DB                              │
└─────────────────────────────────────────────────┘
```

### 7.2 節點系統升級

```python
# 建議的 BaseNode v2 — 新增快取、進度回報、驗證
class BaseNode(ABC):
    NODE_NAME: str = ""
    CATEGORY: str = ""
    DESCRIPTION: str = ""
    CACHEABLE: bool = True  # 新增：是否可快取

    @classmethod
    def define_inputs(cls) -> list[PortDefinition]: ...

    @classmethod
    def define_outputs(cls) -> list[PortDefinition]: ...

    @classmethod
    def define_params(cls) -> list[ParamDefinition]: ...

    @classmethod
    def validate_params(cls, params: dict) -> list[str]:
        """新增：參數驗證，回傳錯誤列表"""
        return []

    async def execute(self, inputs, params, context: ExecutionContext):
        """新增：async 執行、ExecutionContext 提供進度回報/快取/日誌"""
        ...

    def compute_hash(self, inputs_hash: dict, params: dict) -> str:
        """新增：計算節點輸出的 hash，用於快取判斷"""
        ...
```

### 7.3 前端架構升級建議

| 現況 | 建議 | 理由 |
|------|------|------|
| ~~Inline styles~~ | ~~CSS Modules（已遷移）~~ | ~~已完成~~ |
| 無路由 | React Router | 多頁面（Editor/Dashboard/Settings） |
| ~~window.prompt/alert~~ | ~~自訂 Modal 元件~~ | ~~已部分改善（CustomNodeManager Modal）~~ |
| localStorage | IndexedDB + 後端 DB | 大型圖表、可靠性 |
| 固定深色主題 | 主題系統（明/暗） | 使用者偏好 |
| 無快捷鍵系統 | 完整快捷鍵框架 | 專業工具必備 |

### 7.4 後端架構升級建議

| 現況 | 建議 | 理由 |
|------|------|------|
| JSON 檔案儲存 | SQLAlchemy + PostgreSQL/SQLite | 查詢、並發、完整性 |
| 無認證 | FastAPI Security + JWT/OAuth2 | 多使用者、安全性 |
| ~~print() 日誌~~ | ~~結構化日誌（已實作 JsonFormatter）~~ | ~~已完成~~ |
| 無任務隊列 | Celery/ARQ + Redis | 長時間執行、排程 |
| 無 API 版本管理 | API v1 前綴 + 版本策略 | 向後相容 |
| 無設定管理 | 分層設定 (env/file/DB) | 部署靈活性 |

### 7.5 建議的整體架構演進

```
Phase 0-1 (簡單部署):
  Browser → Nginx → Frontend (React)
                  → Backend (FastAPI + SQLite)
                  → Redis (快取/任務隊列)

Phase 2 (專業部署):
  Browser → Nginx/Traefik
          → Frontend (React, CDN)
          → API Server (FastAPI, 多實例)
          → Worker Pool (GPU nodes)
          → PostgreSQL
          → Redis
          → Object Storage (S3/MinIO — 模型/資料集)

Phase 3 (企業部署):
  Browser → Load Balancer
          → API Gateway (認證/限流)
          → Frontend (CDN)
          → API Cluster (K8s)
          → GPU Worker Cluster (K8s)
          → PostgreSQL (HA)
          → Redis Cluster
          → Object Storage
          → Prometheus/Grafana (監控)
          → ELK/Loki (日誌)
```

---

## 8. 風險評估

### 8.1 技術風險

| 風險 | 影響 | 可能性 | 緩解策略 |
|------|------|--------|---------|
| 執行引擎重寫複雜度 | 高 | 高 | 漸進式改造，先加快取再加並行 |
| GPU 管理跨平台問題 | 中 | 高 | 抽象層設計, 針對 CUDA/MPS/CPU 各自實作 |
| 社群節點安全性 | 高 | 中 | 沙盒執行、程式碼審核、簽章機制 |
| 前端效能(大型圖) | 中 | 中 | React Flow 虛擬化、lazy rendering |
| WebSocket 擴縮性 | 中 | 中 | WebSocket 連線管理器、Redis pub/sub |

### 8.2 產品風險

| 風險 | 影響 | 可能性 | 緩解策略 |
|------|------|--------|---------|
| 定位過廣 | 高 | 高 | 先聚焦 2-3 個場景做深，逐步擴展 |
| 與 ComfyUI 直接競爭 | 中 | 中 | 差異化定位（通用 AI/ML vs 圖像生成） |
| 社群建設困難 | 高 | 中 | 提供優秀的節點開發體驗、完善文件 |
| 企業功能分散注意力 | 中 | 中 | Phase 3 才開始企業功能 |

### 8.3 建議的初期聚焦場景

考慮到資源限制，建議先聚焦以下 **2 個場景**：

1. **LLM/RAG 應用建構** — 市場增長最快，與 Langflow/Flowise 競爭
   - 目標：讓使用者用拖放方式建構 RAG 管線和 AI Agent
   - 優勢：CodefyUI 已有訓練管線，可覆蓋 Langflow 做不到的微調場景

2. **ML 模型訓練管線** — 差異化優勢，競品較少
   - 目標：視覺化設計模型、配置訓練、追蹤實驗
   - 優勢：已有的 CNN/RNN/Transformer/RL 節點基礎

---

## 9. 附錄：競品功能對照表

| 功能 | CodefyUI | ComfyUI | n8n | Langflow | Dify | Kubeflow | Airflow |
|------|----------|---------|-----|----------|------|----------|---------|
| 視覺化圖形編輯 | V | V | V | V | V | 部分 | 部分 |
| 節點拖放 | V | V | V | V | V | X | X |
| 類型安全連線 | V | V | V | V | V | N/A | N/A |
| 增量執行/快取 | V (hash-based + dirty tracking) | V | X | X | X | X | X |
| GPU 管理 | 基本 | 進階 | X | X | X | V | X |
| 自訂節點 | V | V | V | V | V | V | V |
| 社群節點市場 | X | V | V | V | V | 部分 | V |
| 實驗追蹤 | X | X | X | X | X | V | X |
| LLM 節點 | X | 社群 | V | V | V | X | X |
| RAG 管線 | X | X | V | V | V | X | X |
| AI Agent 編排 | X | X | V | V | V | X | X |
| MCP 支援 | X | X | V | V | X | X | X |
| 使用者認證 | X | X | V | V | V | V | V |
| 團隊協作 | X | X | V | X | V | V | V |
| 排程執行 | X | X | V | X | X | V | V |
| Docker 部署 | X | V | V | V | V | V | V |
| K8s 部署 | X | 社群 | V | V | V | V | V |
| REST API | V | V | V | V | V | V | V |
| Python SDK | X | X | X | V | V | V | V |
| WebSocket 即時 | V | V | X | V | V | X | X |
| 多分頁工作區 | V | X | X | X | X | X | X |
| Preset/子圖 | V | V | V | V | V | V | X |
| i18n 多語言 | V | 社群 | V | V | V | X | V |
| 錯誤處理/重試 | V (三種模式) | 部分 | V | 部分 | V | V | V |
| 資料版本控制 | X | X | X | X | X | V | X |
| 模型部署 | X | X | X | 部分 | 部分 | V | X |
| 開源授權 | MIT | GPL-3 | Fair-Code | MIT | Apache-2 | Apache-2 | Apache-2 |
| **GitHub Stars** | — | 92.5k | 40k | 100k | 55k | 14k | 40k |

---

## 總結

CodefyUI 目前處於 **有良好架構設計且基礎設施大幅完善的早期原型** 階段。核心的節點式圖形編輯、類型系統、Preset 系統設計良好，且已完成執行引擎升級（快取、並行、取消、錯誤恢復、部分重新執行）、自訂節點管理 GUI、模型權重管理 API、快速節點搜尋、CLI 執行器、結構化日誌、CSS Modules 遷移、測試套件建立等基礎強化工作。

**最建議的下一步：**

1. **Phase 0（大部分已完成）** — ~~執行引擎快取~~ + Docker 化 + ~~測試套件~~ + ~~Custom Node Manager~~ + ~~模型管理 API~~ + ~~CLI Runner~~（剩餘：Docker 化 + DB 儲存）
2. **Phase 1** — LLM/RAG 節點 + MLflow 整合（進入最大市場需求）
3. **Phase 2** — 使用者認證 + Python SDK + 節點包管理器（專業化）
4. **Phase 3** — 團隊協作 + K8s 部署 + 節點市場（企業化）

CodefyUI 最大的差異化機會在於：**同時覆蓋 ML 訓練管線 + LLM/GenAI 應用建構**，這是目前沒有任何單一工具做到的。ComfyUI 專注圖像生成，Langflow 專注 LLM，Kubeflow 專注 MLOps — CodefyUI 可以成為統一的視覺化 AI 工作台。
