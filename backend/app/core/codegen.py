"""Generate a standalone Python script from a CodefyUI graph."""

from __future__ import annotations

import json
from typing import Any


# ── Per-node-type code generators ─────────────────────────────────

def _var(nid: str) -> str:
    return nid.replace("-", "_")


def _gen_sequential_model(var: str, params: dict) -> list[str]:
    layers_json = params.get("layers", "[]")
    layers = json.loads(layers_json) if isinstance(layers_json, str) else layers_json
    lines = [f"# Build nn.Sequential model"]
    layer_strs: list[str] = []
    for layer in layers:
        t = layer.get("type", "")
        p = {k: v for k, v in layer.items() if k != "type"}
        activations = {
            "ReLU", "GELU", "Sigmoid", "Tanh", "LeakyReLU",
            "ELU", "SiLU", "Mish", "SELU", "PReLU", "Hardswish",
        }
        if t == "Softmax":
            layer_strs.append("nn.Softmax(dim=-1)")
        elif t in activations:
            if t in ("ReLU", "LeakyReLU", "ELU", "SiLU", "Mish", "SELU", "Hardswish"):
                layer_strs.append(f"nn.{t}(inplace=True)")
            else:
                layer_strs.append(f"nn.{t}()")
        else:
            args = ", ".join(f"{k}={v!r}" for k, v in p.items())
            layer_strs.append(f"nn.{t}({args})")
    lines.append(f"{var} = nn.Sequential(")
    for i, s in enumerate(layer_strs):
        comma = "," if i < len(layer_strs) - 1 else ","
        lines.append(f"    {s}{comma}")
    lines.append(")")
    return lines


def _gen_dataset(var: str, params: dict) -> list[str]:
    name = params.get("name", "MNIST")
    split = params.get("split", "train")
    data_dir = params.get("data_dir", "./data")
    is_train = "true" if split == "train" else "false"
    return [
        f"transform_{_var(var)} = transforms.Compose([transforms.ToTensor(), transforms.Normalize((0.5,), (0.5,))])",
        f"{var} = datasets.{name}({data_dir!r}, train={is_train.capitalize()}, download=True, transform=transform_{_var(var)})",
    ]


def _gen_dataloader(var: str, params: dict, inputs: dict[str, str]) -> list[str]:
    bs = params.get("batch_size", 64)
    shuffle = params.get("shuffle", True)
    nw = params.get("num_workers", 0)
    dataset_var = inputs.get("dataset", "dataset")
    return [f"{var} = DataLoader({dataset_var}, batch_size={bs}, shuffle={shuffle}, num_workers={nw})"]


def _gen_optimizer(var: str, params: dict, inputs: dict[str, str]) -> list[str]:
    opt_type = params.get("type", "Adam")
    lr = params.get("lr", 0.001)
    wd = params.get("weight_decay", 0.0)
    model_var = inputs.get("model", "model")
    args = f"{model_var}.parameters(), lr={lr}"
    if wd:
        args += f", weight_decay={wd}"
    return [f"{var} = optim.{opt_type}({args})"]


def _gen_loss(var: str, params: dict) -> list[str]:
    loss_type = params.get("type", "CrossEntropyLoss")
    return [f"{var} = nn.{loss_type}()"]


def _gen_training_loop(var: str, params: dict, inputs: dict[str, str]) -> list[str]:
    epochs = params.get("epochs", 5)
    device = params.get("device", "cpu")
    model_var = inputs.get("model", "model")
    loader_var = inputs.get("dataloader", "dataloader")
    opt_var = inputs.get("optimizer", "optimizer")
    loss_var = inputs.get("loss_fn", "loss_fn")
    lines = [
        f"# Training loop",
        f"device = {device!r}",
        f"{model_var} = {model_var}.to(device)",
        f"{model_var}.train()",
        f"epoch_losses = []",
        f"for epoch in range({epochs}):",
        f"    running_loss = 0.0",
        f"    batch_count = 0",
        f"    for batch_data in {loader_var}:",
        f"        if isinstance(batch_data, (list, tuple)) and len(batch_data) == 2:",
        f"            data, targets = batch_data",
        f"            data, targets = data.to(device), targets.to(device)",
        f"        else:",
        f"            data = batch_data.to(device) if hasattr(batch_data, 'to') else batch_data",
        f"            targets = None",
        f"        {opt_var}.zero_grad()",
        f"        outputs = {model_var}(data)",
        f"        loss = {loss_var}(outputs, targets) if targets is not None else {loss_var}(outputs)",
        f"        loss.backward()",
        f"        {opt_var}.step()",
        f"        running_loss += loss.item()",
        f"        batch_count += 1",
        f"    avg_loss = running_loss / max(batch_count, 1)",
        f"    epoch_losses.append(avg_loss)",
        f'    print(f"Epoch {{epoch + 1}}/{epochs} — Loss: {{avg_loss:.4f}}")',
        f"{var}_losses = torch.tensor(epoch_losses)",
    ]
    return lines


def _gen_model_saver(var: str, params: dict, inputs: dict[str, str]) -> list[str]:
    path = params.get("path", "model_weights.pt")
    mode = params.get("save_mode", "state_dict")
    model_var = inputs.get("model", "model")
    if mode == "state_dict":
        return [f"torch.save({model_var}.state_dict(), {path!r})", f'print(f"Model saved to {path}")']
    return [f"torch.save({model_var}, {path!r})", f'print(f"Model saved to {path}")']


def _gen_model_loader(var: str, params: dict, inputs: dict[str, str]) -> list[str]:
    path = params.get("path", "model_weights.pt")
    mode = params.get("load_mode", "state_dict")
    device = params.get("device", "cpu")
    model_var = inputs.get("model", "model")
    if mode == "state_dict":
        return [
            f"state_dict = torch.load({path!r}, map_location={device!r}, weights_only=True)",
            f"{model_var}.load_state_dict(state_dict)",
            f"{model_var} = {model_var}.to({device!r})",
        ]
    return [f"{model_var} = torch.load({path!r}, map_location={device!r}, weights_only=False)"]


def _gen_inference(var: str, params: dict, inputs: dict[str, str]) -> list[str]:
    device = params.get("device", "cpu")
    model_var = inputs.get("model", "model")
    input_var = inputs.get("input", "input_tensor")
    return [
        f"{model_var} = {model_var}.to({device!r})",
        f"{input_var} = {input_var}.to({device!r})",
        f"{model_var}.eval()",
        f"with torch.no_grad():",
        f"    {var} = {model_var}({input_var})",
        f'print(f"Output shape: {{{var}.shape}")',
    ]


def _gen_visualize(var: str, params: dict, inputs: dict[str, str]) -> list[str]:
    title = params.get("title", "Plot")
    plot_type = params.get("plot_type", "line")
    data_var = inputs.get("data", "data")
    lines = [
        f"import matplotlib.pyplot as plt",
        f"plt.figure(figsize=(8, 5))",
    ]
    if plot_type == "line":
        lines.append(f"plt.plot({data_var}.cpu().numpy() if hasattr({data_var}, 'cpu') else {data_var})")
    else:
        lines.append(f"plt.bar(range(len({data_var})), {data_var}.cpu().numpy() if hasattr({data_var}, 'cpu') else {data_var})")
    lines += [
        f"plt.title({title!r})",
        f"plt.tight_layout()",
        f"plt.show()",
    ]
    return lines


def _gen_print(var: str, params: dict, inputs: dict[str, str]) -> list[str]:
    label = params.get("label", "")
    val_var = inputs.get("value", "value")
    if label:
        return [f'print(f"[{label}] {{{val_var}}}")']
    return [f"print({val_var})"]


# ── Generator dispatch ────────────────────────────────────────────

_GENERATORS: dict[str, Any] = {
    "SequentialModel": lambda v, p, i: _gen_sequential_model(v, p),
    "Dataset": lambda v, p, i: _gen_dataset(v, p),
    "DataLoader": _gen_dataloader,
    "Optimizer": _gen_optimizer,
    "Loss": lambda v, p, i: _gen_loss(v, p),
    "TrainingLoop": _gen_training_loop,
    "ModelSaver": _gen_model_saver,
    "ModelLoader": _gen_model_loader,
    "Inference": _gen_inference,
    "Visualize": _gen_visualize,
    "Print": _gen_print,
}


# ── Main entry point ─────────────────────────────────────────────

def generate_python(
    nodes: list[dict],
    edges: list[dict],
    order: list[str],
    name: str = "Untitled",
) -> str:
    """Generate a runnable Python script from graph data."""

    node_map = {n["id"]: n for n in nodes}

    # Build input mapping: for each node, which output vars feed into which inputs
    input_mapping: dict[str, dict[str, str]] = {n["id"]: {} for n in nodes}
    # Also track which output port var name to use
    output_vars: dict[str, dict[str, str]] = {}

    for nid in order:
        node = node_map[nid]
        ntype = node["type"]
        var = _var(nid)

        # Determine output variable names
        out_map: dict[str, str] = {}
        if ntype == "SequentialModel":
            out_map["model"] = var
        elif ntype == "Dataset":
            out_map["dataset"] = var
        elif ntype == "DataLoader":
            out_map["dataloader"] = var
        elif ntype == "Optimizer":
            out_map["optimizer"] = var
        elif ntype == "Loss":
            out_map["loss_fn"] = var
        elif ntype == "TrainingLoop":
            model_in = input_mapping[nid].get("model", "model")
            out_map["model"] = model_in
            out_map["losses"] = f"{var}_losses"
        elif ntype == "ModelLoader":
            model_in = input_mapping[nid].get("model", "model")
            out_map["model"] = model_in
        elif ntype == "ModelSaver":
            model_in = input_mapping[nid].get("model", "model")
            out_map["model"] = model_in
            out_map["path"] = f'"{node.get("data", {}).get("params", {}).get("path", "model_weights.pt")}"'
        elif ntype == "Inference":
            out_map["output"] = var
            out_map["model"] = input_mapping[nid].get("model", "model")
        elif ntype == "Visualize":
            out_map["image"] = f"{var}_img"
        elif ntype == "Print":
            pass
        else:
            out_map["output"] = var

        output_vars[nid] = out_map

        # Wire edges from this node to downstream nodes
        for edge in edges:
            if edge["source"] == nid:
                target = edge["target"]
                src_handle = edge.get("sourceHandle", "output")
                tgt_handle = edge.get("targetHandle", "input")
                var_name = out_map.get(src_handle, var)
                if target in input_mapping:
                    input_mapping[target][tgt_handle] = var_name

    # Collect needed imports
    needs_torch = False
    needs_nn = False
    needs_optim = False
    needs_dataloader = False
    needs_datasets = False
    needs_transforms = False

    for nid in order:
        ntype = node_map[nid]["type"]
        if ntype in ("SequentialModel", "Loss", "TrainingLoop", "Inference"):
            needs_torch = True
            needs_nn = True
        if ntype == "Optimizer":
            needs_torch = True
            needs_optim = True
        if ntype == "Dataset":
            needs_datasets = True
            needs_transforms = True
        if ntype == "DataLoader":
            needs_dataloader = True
        if ntype in ("ModelSaver", "ModelLoader", "TrainingLoop"):
            needs_torch = True

    # Build header
    header: list[str] = [
        f'"""',
        f"{name}",
        f"Auto-generated by CodefyUI",
        f'"""',
        f"",
    ]
    if needs_torch:
        header.append("import torch")
    if needs_nn:
        header.append("import torch.nn as nn")
    if needs_optim:
        header.append("import torch.optim as optim")
    if needs_dataloader:
        header.append("from torch.utils.data import DataLoader")
    if needs_datasets:
        header.append("from torchvision import datasets")
    if needs_transforms:
        header.append("from torchvision import transforms")
    header.append("")

    # Generate body
    body: list[str] = []
    for nid in order:
        node = node_map[nid]
        ntype = node["type"]
        params = node.get("data", {}).get("params", {})
        var = _var(nid)
        inputs = input_mapping.get(nid, {})

        gen = _GENERATORS.get(ntype)
        if gen:
            body.append(f"")
            body.extend(gen(var, params, inputs))
        else:
            body.append(f"")
            body.append(f"# {ntype} (id: {nid}) — no codegen template, implement manually")
            body.append(f"# params: {params}")

    return "\n".join(header + body) + "\n"
