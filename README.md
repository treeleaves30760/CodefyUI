# CodefyUI

[![zh-TW](https://img.shields.io/badge/語言-繁體中文-blue)](./README_zh-TW.md)

A visual, node-based deep learning pipeline builder. Design CNN, RNN, Transformer, and RL architectures by dragging nodes onto a canvas, connecting them into a DAG, and executing the pipeline — all from the browser.

![CodefyUI Screenshot](Assets/UI.png)

## Features

- **Visual Graph Editor** — Drag-and-drop nodes, connect ports with type-safe edges, real-time validation
- **59 Built-in Nodes** across 11 categories (CNN, RNN, Transformer, RL, Data, Training, IO, Control, Utility, Normalization, Tensor Operations)
- **Preset System** — Pre-built model templates for quick start; export your own subgraphs as reusable presets
- **Multi-Tab Workspace** — Multiple independent canvases, each with its own execution context
- **WebSocket Execution** — Real-time per-node progress, Print node output displayed in the Execution Log panel
- **Partial Re-Execution** — Dirty node tracking: only re-runs changed nodes and their downstream dependencies
- **Quick Node Search** — Double-click the canvas to open an instant search panel for adding nodes and presets
- **Custom Node Manager** — GUI for uploading, enabling/disabling, and deleting custom nodes
- **Model File Management** — Upload, list, and delete model weight files (.pt, .pth, .safetensors, .ckpt, .bin) via REST API
- **CLI Graph Runner** — Execute graph.json directly from the command line with `run_graph.py`
- **Results Panel** — Tabbed panel (Execution Log / Training), resizable, with live loss chart
- **i18n** — English and 繁體中文, with responsive `rem`-based font sizing
- **Persistence** — Auto-saves all tabs to `localStorage`; import/export graph JSON files
- **Dark Theme** — Fully styled dark UI with color-coded categories

## Quick Start

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"       # Core + test deps
pip install -e ".[ml]"        # PyTorch, torchvision, gymnasium (needed for execution)
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). The frontend proxies API/WS requests to the backend at `:8000`.

### CLI Execution

Run a graph directly from the command line without starting the server:

```bash
cd backend
python run_graph.py ../examples/Usage_Example/CNN-MNIST/TrainCNN-MNIST/graph.json
python run_graph.py ../examples/Model_Architecture/ResNet-SkipConnection-CNN/graph.json --validate-only
```

## Architecture

```
frontend/   React 19 · TypeScript · React Flow 12 · Zustand 5 · Vite 6
backend/    Python 3.10+ · FastAPI · PyTorch
```

| Principle | Detail |
|-----------|--------|
| **Backend-authoritative** | `GET /api/nodes` returns all node definitions. Adding a backend node auto-appears in the UI. |
| **Single BaseNode component** | One React component renders all node types, parameterized by backend definitions. |
| **WebSocket execution** | `ws://host/ws/execution` streams per-node status. REST handles graph CRUD. |
| **Topological execution** | Kahn's algorithm for DAG sort + cycle detection. Parallel execution of independent nodes. |

## Built-in Nodes

| Category | Nodes | Count |
|----------|-------|-------|
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

## Examples

Pre-built example workflows organized in `examples/`:

| Category | Examples |
|----------|----------|
| **Model Architecture** | ResNet, ConvNeXt, EfficientNet, ViT, SwinTransformer, BERT, GPT, LLaMA, DiT, LSTM TimeSeries, BiGRU SpeechRecognition, Seq2Seq Attention, DQN Atari, PPO Robotics |
| **Usage Example** | CNN-MNIST Training, CNN-MNIST Inference |

## Custom Nodes

Drop a `.py` file in `backend/app/custom_nodes/` extending `BaseNode`:

```python
from app.core.node_base import BaseNode, DataType, PortDefinition

class MyNode(BaseNode):
    NODE_NAME = "MyNode"
    CATEGORY = "Custom"
    DESCRIPTION = "Does something"

    @classmethod
    def define_inputs(cls):
        return [PortDefinition(name="input", data_type=DataType.TENSOR)]

    @classmethod
    def define_outputs(cls):
        return [PortDefinition(name="output", data_type=DataType.TENSOR)]

    def execute(self, inputs, params):
        return {"output": inputs["input"]}
```

Hot-reload via `POST /api/nodes/reload` or the **Reload Nodes** button in the toolbar. Or use the **Custom Node Manager** GUI to upload, enable/disable, and delete custom nodes.

## Key Bindings

| Action | Key |
|--------|-----|
| Delete node | `Delete` |
| Multi-select | `Shift` + click |
| Quick add node | Double-click canvas |
| Rename node | Right-click → Rename |
| Duplicate node | Right-click → Duplicate |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/nodes` | GET | List all node definitions |
| `/api/nodes/reload` | POST | Hot-reload all nodes |
| `/api/presets` | GET | List preset definitions |
| `/api/presets/create` | POST | Create a new preset from selected nodes |
| `/api/graph/validate` | POST | Validate a graph |
| `/api/graph/save` | POST | Save a graph |
| `/api/graph/load/{name}` | GET | Load a saved graph |
| `/api/graph/list` | GET | List saved graphs |
| `/api/graph/export` | POST | Export graph as Python script |
| `/api/custom-nodes` | GET | List custom nodes |
| `/api/custom-nodes/upload` | POST | Upload a custom node |
| `/api/custom-nodes/toggle` | POST | Enable/disable a custom node |
| `/api/custom-nodes/{filename}` | DELETE | Delete a custom node |
| `/api/models` | GET | List uploaded model files |
| `/api/models/upload` | POST | Upload a model weight file |
| `/api/models/{filename}` | DELETE | Delete a model file |
| `/ws/execution` | WebSocket | Real-time graph execution |

## Tests

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

## License

MIT
