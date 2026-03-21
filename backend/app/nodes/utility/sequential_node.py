"""
SequentialModel node — the bridge between layer nodes (TENSOR world) and
training nodes (MODEL world).

It reads a JSON layer specification and builds a real nn.Sequential that
can be passed to Optimizer and TrainingLoop.  Users describe the architecture
with familiar parameters; no Python coding required.
"""

import logging
from typing import Any

from ...core.node_base import BaseNode, DataType, ParamDefinition, ParamType, PortDefinition

logger = logging.getLogger(__name__)


# ── Supported layer builders ────────────────────────────────────

def _build_layer(cfg: dict) -> "torch.nn.Module":
    """Convert a single layer dict into an nn.Module."""
    import torch.nn as nn

    t = cfg.get("type", "")
    p = {k: v for k, v in cfg.items() if k != "type"}

    builders: dict[str, type] = {
        "Conv2d": nn.Conv2d,
        "Conv1d": nn.Conv1d,
        "ConvTranspose2d": nn.ConvTranspose2d,
        "BatchNorm2d": nn.BatchNorm2d,
        "BatchNorm1d": nn.BatchNorm1d,
        "LayerNorm": nn.LayerNorm,
        "GroupNorm": nn.GroupNorm,
        "InstanceNorm2d": nn.InstanceNorm2d,
        "MaxPool2d": nn.MaxPool2d,
        "AvgPool2d": nn.AvgPool2d,
        "AdaptiveAvgPool2d": nn.AdaptiveAvgPool2d,
        "Dropout": nn.Dropout,
        "Linear": nn.Linear,
        "Flatten": nn.Flatten,
        "Embedding": nn.Embedding,
    }

    # Activation functions
    activations: dict[str, nn.Module] = {
        "ReLU": nn.ReLU(inplace=True),
        "GELU": nn.GELU(),
        "Sigmoid": nn.Sigmoid(),
        "Tanh": nn.Tanh(),
        "LeakyReLU": nn.LeakyReLU(inplace=True),
        "ELU": nn.ELU(inplace=True),
        "SiLU": nn.SiLU(inplace=True),
        "Mish": nn.Mish(inplace=True),
        "SELU": nn.SELU(inplace=True),
        "PReLU": nn.PReLU(),
        "Hardswish": nn.Hardswish(inplace=True),
        "Softmax": nn.Softmax(dim=-1),
    }
    if t in activations:
        return activations[t]

    cls = builders.get(t)
    if cls is None:
        raise ValueError(f"SequentialModel: unknown layer type '{t}'")
    return cls(**p)


class SequentialModelNode(BaseNode):
    NODE_NAME = "SequentialModel"
    CATEGORY = "Training"
    DESCRIPTION = (
        "Build an nn.Sequential model visually. "
        "Double-click to open the architecture editor and drag-and-drop layers. "
        "Outputs a MODEL that can be connected to Optimizer and TrainingLoop."
    )

    @classmethod
    def define_inputs(cls) -> list[PortDefinition]:
        return []  # no tensor input — purely declarative

    @classmethod
    def define_outputs(cls) -> list[PortDefinition]:
        return [
            PortDefinition(name="model", data_type=DataType.MODEL, description="Built nn.Sequential model"),
        ]

    @classmethod
    def define_params(cls) -> list[ParamDefinition]:
        return [
            ParamDefinition(
                name="layers",
                param_type=ParamType.STRING,
                default=(
                    '[{"type":"Conv2d","in_channels":1,"out_channels":32,"kernel_size":3,"padding":1},'
                    '{"type":"ReLU"},'
                    '{"type":"MaxPool2d","kernel_size":2,"stride":2},'
                    '{"type":"Conv2d","in_channels":32,"out_channels":64,"kernel_size":3,"padding":1},'
                    '{"type":"ReLU"},'
                    '{"type":"MaxPool2d","kernel_size":2,"stride":2},'
                    '{"type":"Flatten"},'
                    '{"type":"Linear","in_features":3136,"out_features":128},'
                    '{"type":"ReLU"},'
                    '{"type":"Linear","in_features":128,"out_features":10}]'
                ),
                description="JSON array of layer dicts. Each dict needs a 'type' key plus constructor kwargs.",
            ),
        ]

    def execute(self, inputs: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
        import json

        import torch.nn as nn

        layers_str = params.get("layers", "[]")
        layer_defs = json.loads(layers_str)

        modules = [_build_layer(cfg) for cfg in layer_defs]
        model = nn.Sequential(*modules)

        total = sum(p.numel() for p in model.parameters())
        logger.info("Built model with %d layers, %s parameters", len(modules), f"{total:,}")

        return {"model": model}
