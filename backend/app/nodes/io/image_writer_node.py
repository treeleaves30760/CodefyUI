import logging
from typing import Any

from ...core.node_base import BaseNode, DataType, ParamDefinition, ParamType, PortDefinition

logger = logging.getLogger(__name__)


class ImageWriterNode(BaseNode):
    NODE_NAME = "ImageWriter"
    CATEGORY = "IO"
    DESCRIPTION = "Save a tensor as an image file (PNG, JPEG, etc.)"

    @classmethod
    def define_inputs(cls) -> list[PortDefinition]:
        return [
            PortDefinition(name="image", data_type=DataType.IMAGE, description="Image tensor (C, H, W) or (H, W)"),
        ]

    @classmethod
    def define_outputs(cls) -> list[PortDefinition]:
        return [
            PortDefinition(name="path", data_type=DataType.STRING, description="Path to the saved image"),
        ]

    @classmethod
    def define_params(cls) -> list[ParamDefinition]:
        return [
            ParamDefinition(
                name="path",
                param_type=ParamType.STRING,
                default="output.png",
                description="Output file path",
            ),
            ParamDefinition(
                name="format",
                param_type=ParamType.SELECT,
                default="PNG",
                description="Image format",
                options=["PNG", "JPEG", "BMP", "TIFF"],
            ),
        ]

    def execute(self, inputs: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
        from pathlib import Path

        from torchvision.utils import save_image

        image = inputs["image"]
        path = params.get("path", "output.png")
        fmt = params.get("format", "PNG")

        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)

        # Ensure correct extension
        ext_map = {"PNG": ".png", "JPEG": ".jpg", "BMP": ".bmp", "TIFF": ".tiff"}
        expected_ext = ext_map.get(fmt, ".png")
        if p.suffix.lower() != expected_ext:
            p = p.with_suffix(expected_ext)

        # Handle batched tensors: save first image
        if image.dim() == 4:
            image = image[0]

        save_image(image, str(p))
        logger.info("Saved image to %s", p)

        return {"path": str(p)}
