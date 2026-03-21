import logging
from typing import Any

from ...core.node_base import BaseNode, DataType, ParamDefinition, ParamType, PortDefinition

logger = logging.getLogger(__name__)


class ModelLoaderNode(BaseNode):
    NODE_NAME = "ModelLoader"
    CATEGORY = "IO"
    DESCRIPTION = "Load model weights from a .pt/.pth file into a model, or load a full saved model"

    @classmethod
    def define_inputs(cls) -> list[PortDefinition]:
        return [
            PortDefinition(
                name="model",
                data_type=DataType.MODEL,
                description="Model architecture to load weights into (required for state_dict mode)",
                optional=True,
            ),
        ]

    @classmethod
    def define_outputs(cls) -> list[PortDefinition]:
        return [
            PortDefinition(name="model", data_type=DataType.MODEL, description="Model with loaded weights"),
        ]

    @classmethod
    def define_params(cls) -> list[ParamDefinition]:
        return [
            ParamDefinition(
                name="path",
                param_type=ParamType.STRING,
                default="model_weights.pt",
                description="Path to the weights file (.pt or .pth)",
            ),
            ParamDefinition(
                name="load_mode",
                param_type=ParamType.SELECT,
                default="state_dict",
                description="Load mode: state_dict (requires model input) or full_model",
                options=["state_dict", "full_model"],
            ),
            ParamDefinition(
                name="device",
                param_type=ParamType.SELECT,
                default="cpu",
                description="Device to load weights onto",
                options=["cpu", "cuda"],
            ),
            ParamDefinition(
                name="strict",
                param_type=ParamType.BOOL,
                default=True,
                description="Whether to strictly enforce that the keys in state_dict match (state_dict mode only)",
            ),
        ]

    def execute(self, inputs: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
        import torch
        from pathlib import Path

        from ...config import settings

        path = params.get("path", "model_weights.pt")
        load_mode = params.get("load_mode", "state_dict")
        device = params.get("device", "cpu")
        strict = params.get("strict", True)

        if device == "cuda" and not torch.cuda.is_available():
            logger.warning("CUDA not available, falling back to CPU")
            device = "cpu"

        p = Path(path)
        if not p.is_absolute():
            p = settings.MODELS_DIR / p
        if not p.exists():
            raise FileNotFoundError(f"Weights file not found: {p}")

        if load_mode == "state_dict":
            model = inputs.get("model")
            if model is None:
                raise ValueError(
                    "state_dict mode requires a model input. "
                    "Connect a SequentialModel or other model node, or use full_model mode."
                )
            state_dict = torch.load(str(p), map_location=device, weights_only=True)
            model.load_state_dict(state_dict, strict=strict)
            model = model.to(device)
            param_count = sum(p_.numel() for p_ in model.parameters())
            logger.info("Loaded state_dict from %s (%s parameters, strict=%s)", p, f"{param_count:,}", strict)
        else:
            model = torch.load(str(p), map_location=device, weights_only=False)
            model = model.to(device)
            logger.info("Loaded full model from %s", p)

        return {"model": model}
