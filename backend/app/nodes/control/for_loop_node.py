from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any

from ...core.node_base import BaseNode, DataType, ParamDefinition, ParamType, PortDefinition

logger = logging.getLogger(__name__)


class ForLoopNode(BaseNode):
    NODE_NAME = "ForLoop"
    CATEGORY = "Control"
    DESCRIPTION = (
        "Execute a subgraph (preset) N times. "
        "Each iteration feeds the previous output as the next input. "
        "Specify the subgraph by its preset name."
    )

    @classmethod
    def define_inputs(cls) -> list[PortDefinition]:
        return [
            PortDefinition(name="initial", data_type=DataType.ANY, description="Initial data for the first iteration"),
        ]

    @classmethod
    def define_outputs(cls) -> list[PortDefinition]:
        return [
            PortDefinition(name="output", data_type=DataType.ANY, description="Result after all iterations"),
            PortDefinition(name="count", data_type=DataType.SCALAR, description="Iterations completed"),
        ]

    @classmethod
    def define_params(cls) -> list[ParamDefinition]:
        return [
            ParamDefinition(
                name="subgraph",
                param_type=ParamType.STRING,
                default="",
                description="Name of the preset/subgraph to execute each iteration",
            ),
            ParamDefinition(
                name="iterations",
                param_type=ParamType.INT,
                default=1,
                description="Number of iterations",
                min_value=1,
            ),
        ]

    def execute(self, inputs: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
        from ...core.graph_engine import topological_sort
        from ...core.node_registry import registry as node_registry
        from ...core.preset_registry import preset_registry

        subgraph_name = params.get("subgraph", "")
        iterations = params.get("iterations", 1)

        if not subgraph_name:
            raise ValueError("subgraph parameter is required")

        preset = preset_registry.get(subgraph_name)
        if not preset:
            raise ValueError(f"Subgraph '{subgraph_name}' not found")
        if not preset.exposed_inputs:
            raise ValueError(f"Subgraph '{subgraph_name}' has no exposed inputs")
        if not preset.exposed_outputs:
            raise ValueError(f"Subgraph '{subgraph_name}' has no exposed outputs")

        # Use first exposed input/output for the iterative data path
        in_port = preset.exposed_inputs[0]
        out_port = preset.exposed_outputs[0]

        # Prepare the sub-graph structure (reused each iteration)
        nodes_list = [
            {"id": n.id, "type": n.type, "data": {"params": dict(n.params)}}
            for n in preset.nodes
        ]
        edges_list = [
            {
                "source": e.source,
                "target": e.target,
                "sourceHandle": e.sourceHandle,
                "targetHandle": e.targetHandle,
            }
            for e in preset.edges
        ]
        order = topological_sort(nodes_list, edges_list)
        node_map = {n["id"]: n for n in nodes_list}

        incoming: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
        for edge in edges_list:
            incoming[edge["target"]].append(
                (edge["source"], edge["sourceHandle"], edge["targetHandle"])
            )

        current_data = inputs.get("initial")

        for i in range(iterations):
            node_outputs: dict[str, dict[str, Any]] = {}

            for node_id in order:
                node_def = node_map[node_id]
                node_cls = node_registry.get(node_def["type"])
                if not node_cls:
                    raise ValueError(f"Unknown node type in subgraph: {node_def['type']}")

                node_inputs: dict[str, Any] = {}
                for src_id, src_handle, tgt_handle in incoming.get(node_id, []):
                    if src_id in node_outputs and src_handle in node_outputs[src_id]:
                        node_inputs[tgt_handle] = node_outputs[src_id][src_handle]

                # Inject the iterative data into the exposed input node
                if node_id == in_port.internal_node:
                    node_inputs[in_port.internal_port] = current_data

                instance = node_cls()
                result = instance.execute(node_inputs, node_def.get("data", {}).get("params", {}))
                node_outputs[node_id] = result

            # Extract output for next iteration
            out = node_outputs.get(out_port.internal_node, {}).get(out_port.internal_port)
            if out is None:
                raise ValueError(
                    f"Subgraph did not produce output '{out_port.name}' in iteration {i + 1}"
                )
            current_data = out
            logger.info("Iteration %d/%d complete", i + 1, iterations)

        return {"output": current_data, "count": float(iterations)}
