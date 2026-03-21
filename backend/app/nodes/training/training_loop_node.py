import logging
from typing import Any

from ...core.node_base import BaseNode, DataType, ParamDefinition, ParamType, PortDefinition

logger = logging.getLogger(__name__)


class TrainingLoopNode(BaseNode):
    NODE_NAME = "TrainingLoop"
    CATEGORY = "Training"
    DESCRIPTION = "Run a training loop over a dataloader for a given number of epochs"

    @classmethod
    def define_inputs(cls) -> list[PortDefinition]:
        return [
            PortDefinition(name="model", data_type=DataType.MODEL, description="Model to train"),
            PortDefinition(name="dataloader", data_type=DataType.DATALOADER, description="Training data loader"),
            PortDefinition(name="optimizer", data_type=DataType.OPTIMIZER, description="Optimizer for parameter updates"),
            PortDefinition(name="loss_fn", data_type=DataType.LOSS_FN, description="Loss function"),
        ]

    @classmethod
    def define_outputs(cls) -> list[PortDefinition]:
        return [
            PortDefinition(name="model", data_type=DataType.MODEL, description="Trained model"),
            PortDefinition(name="losses", data_type=DataType.TENSOR, description="Loss history tensor (one value per epoch)"),
        ]

    @classmethod
    def define_params(cls) -> list[ParamDefinition]:
        return [
            ParamDefinition(name="epochs", param_type=ParamType.INT, default=5, description="Number of training epochs", min_value=1),
            ParamDefinition(
                name="device",
                param_type=ParamType.SELECT,
                default="cpu",
                description="Device to train on",
                options=["cpu", "cuda"],
            ),
        ]

    def execute(self, inputs: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
        import torch

        model = inputs["model"]
        dataloader = inputs["dataloader"]
        optimizer = inputs["optimizer"]
        loss_fn = inputs["loss_fn"]
        epochs = params.get("epochs", 5)
        device = params.get("device", "cpu")

        if device == "cuda" and not torch.cuda.is_available():
            logger.warning("CUDA not available, falling back to CPU")
            device = "cpu"

        model = model.to(device)
        model.train()

        epoch_losses = []

        for epoch in range(epochs):
            running_loss = 0.0
            batch_count = 0

            for batch_data in dataloader:
                if isinstance(batch_data, (list, tuple)) and len(batch_data) == 2:
                    data, targets = batch_data
                    data = data.to(device)
                    targets = targets.to(device)
                else:
                    data = batch_data.to(device) if hasattr(batch_data, "to") else batch_data
                    targets = None

                optimizer.zero_grad()

                outputs = model(data)

                if targets is not None:
                    loss = loss_fn(outputs, targets)
                else:
                    loss = loss_fn(outputs)

                loss.backward()
                optimizer.step()

                running_loss += loss.item()
                batch_count += 1

            avg_loss = running_loss / max(batch_count, 1)
            epoch_losses.append(avg_loss)
            logger.info("Epoch %d/%d - Loss: %.4f", epoch + 1, epochs, avg_loss)

        losses_tensor = torch.tensor(epoch_losses, dtype=torch.float32)

        return {"model": model, "losses": losses_tensor}
