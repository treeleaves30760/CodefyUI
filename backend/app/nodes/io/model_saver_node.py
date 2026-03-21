import logging
from typing import Any

from ...core.node_base import BaseNode, DataType, ParamDefinition, ParamType, PortDefinition

logger = logging.getLogger(__name__)


class ModelSaverNode(BaseNode):
    NODE_NAME = "ModelSaver"
    CATEGORY = "IO"
    DESCRIPTION = "Save model weights (state_dict) to a .pt/.pth file"

    @classmethod
    def define_inputs(cls) -> list[PortDefinition]:
        return [
            PortDefinition(name="model", data_type=DataType.MODEL, description="Trained model to save"),
        ]

    @classmethod
    def define_outputs(cls) -> list[PortDefinition]:
        return [
            PortDefinition(name="path", data_type=DataType.STRING, description="Path to the saved file"),
            PortDefinition(name="model", data_type=DataType.MODEL, description="Pass-through model (for chaining)"),
        ]

    @classmethod
    def define_params(cls) -> list[ParamDefinition]:
        return [
            ParamDefinition(
                name="path",
                param_type=ParamType.STRING,
                default="model_weights.pt",
                description="Output file path (.pt or .pth)",
            ),
            ParamDefinition(
                name="save_mode",
                param_type=ParamType.SELECT,
                default="state_dict",
                description="Save mode: state_dict (recommended) or full model",
                options=["state_dict", "full_model"],
            ),
        ]

    def execute(self, inputs: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
        import torch
        from pathlib import Path

        from ...config import settings

        model = inputs["model"]
        path = params.get("path", "model_weights.pt")
        save_mode = params.get("save_mode", "state_dict")

        p = Path(path)
        if not p.is_absolute():
            p = settings.MODELS_DIR / p
        p.parent.mkdir(parents=True, exist_ok=True)

        if save_mode == "state_dict":
            torch.save(model.state_dict(), str(p))
            param_count = sum(p_.numel() for p_ in model.parameters())
            logger.info("Saved state_dict to %s (%s parameters)", p, f"{param_count:,}")
        else:
            torch.save(model, str(p))
            logger.info("Saved full model to %s", p)

        return {"path": str(p), "model": model}
