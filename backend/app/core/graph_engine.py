from __future__ import annotations

import asyncio
import logging
import traceback
from collections import defaultdict, deque
from typing import Any, Callable

from .node_base import BaseNode
from .node_registry import registry
from .type_system import is_compatible

logger = logging.getLogger(__name__)


class GraphValidationError(Exception):
    pass


def expand_presets(
    nodes: list[dict],
    edges: list[dict],
) -> tuple[list[dict], list[dict], dict[str, str]]:
    """Expand preset nodes into their sub-graph of real nodes.

    Returns (expanded_nodes, expanded_edges, internal_to_preset_map).
    internal_to_preset_map maps internal node IDs to the preset node ID they came from.
    """
    from .preset_registry import preset_registry

    expanded_nodes: list[dict] = []
    expanded_edges: list[dict] = list(edges)
    internal_to_preset: dict[str, str] = {}

    for node in nodes:
        node_type: str = node.get("type", "")
        if not node_type.startswith("preset:"):
            expanded_nodes.append(node)
            continue

        preset_name = node_type[len("preset:"):]
        preset = preset_registry.get(preset_name)
        if not preset:
            raise GraphValidationError(f"Unknown preset: {preset_name}")

        preset_node_id = node["id"]
        internal_params = node.get("data", {}).get("internalParams", {})

        # Build a map of exposed port name -> internal node:port
        input_map: dict[str, tuple[str, str]] = {}
        for ep in preset.exposed_inputs:
            full_id = f"{preset_node_id}__{ep.internal_node}"
            input_map[ep.name] = (full_id, ep.internal_port)

        output_map: dict[str, tuple[str, str]] = {}
        for ep in preset.exposed_outputs:
            full_id = f"{preset_node_id}__{ep.internal_node}"
            output_map[ep.name] = (full_id, ep.internal_port)

        # Add internal nodes with unique IDs
        for internal_node in preset.nodes:
            full_id = f"{preset_node_id}__{internal_node.id}"
            # Merge default params with user overrides
            params = dict(internal_node.params)
            if internal_node.id in internal_params:
                params.update(internal_params[internal_node.id])
            expanded_nodes.append({
                "id": full_id,
                "type": internal_node.type,
                "position": node.get("position", {"x": 0, "y": 0}),
                "data": {"params": params},
            })
            internal_to_preset[full_id] = preset_node_id

        # Add internal edges with remapped IDs
        for internal_edge in preset.edges:
            expanded_edges.append({
                "source": f"{preset_node_id}__{internal_edge.source}",
                "target": f"{preset_node_id}__{internal_edge.target}",
                "sourceHandle": internal_edge.sourceHandle,
                "targetHandle": internal_edge.targetHandle,
            })

        # Remap external edges connected to this preset node
        new_edges = []
        for edge in expanded_edges:
            new_edge = dict(edge)
            # Remap edges where this preset is the target
            if edge.get("target") == preset_node_id:
                target_handle = edge.get("targetHandle", "")
                if target_handle in input_map:
                    internal_id, internal_port = input_map[target_handle]
                    new_edge["target"] = internal_id
                    new_edge["targetHandle"] = internal_port
            # Remap edges where this preset is the source
            if edge.get("source") == preset_node_id:
                source_handle = edge.get("sourceHandle", "")
                if source_handle in output_map:
                    internal_id, internal_port = output_map[source_handle]
                    new_edge["source"] = internal_id
                    new_edge["sourceHandle"] = internal_port
            new_edges.append(new_edge)
        expanded_edges = new_edges

    return expanded_nodes, expanded_edges, internal_to_preset


def validate_graph(nodes: list[dict], edges: list[dict]) -> list[str]:
    """Validate a graph definition. Returns list of errors (empty = valid)."""
    errors: list[str] = []
    node_map = {n["id"]: n for n in nodes}

    for edge in edges:
        src = node_map.get(edge["source"])
        tgt = node_map.get(edge["target"])
        if not src or not tgt:
            errors.append(f"Edge references missing node: {edge}")
            continue

        src_cls = registry.get(src["type"])
        tgt_cls = registry.get(tgt["type"])
        if not src_cls or not tgt_cls:
            errors.append(f"Unknown node type: {src['type']} or {tgt['type']}")
            continue

        src_port = edge.get("sourceHandle", "")
        tgt_port = edge.get("targetHandle", "")
        src_outputs = {p.name: p for p in src_cls.define_outputs()}
        tgt_inputs = {p.name: p for p in tgt_cls.define_inputs()}

        if src_port not in src_outputs:
            errors.append(f"Invalid output port '{src_port}' on {src['type']}")
            continue
        if tgt_port not in tgt_inputs:
            errors.append(f"Invalid input port '{tgt_port}' on {tgt['type']}")
            continue

        if not is_compatible(src_outputs[src_port].data_type, tgt_inputs[tgt_port].data_type):
            errors.append(
                f"Type mismatch: {src['type']}.{src_port} ({src_outputs[src_port].data_type}) "
                f"-> {tgt['type']}.{tgt_port} ({tgt_inputs[tgt_port].data_type})"
            )

    # Cycle detection via topological sort
    if _has_cycle(nodes, edges):
        errors.append("Graph contains a cycle")

    return errors


def _has_cycle(nodes: list[dict], edges: list[dict]) -> bool:
    in_degree: dict[str, int] = {n["id"]: 0 for n in nodes}
    adj: dict[str, list[str]] = defaultdict(list)

    for edge in edges:
        adj[edge["source"]].append(edge["target"])
        if edge["target"] in in_degree:
            in_degree[edge["target"]] += 1

    queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
    visited = 0
    while queue:
        node = queue.popleft()
        visited += 1
        for neighbor in adj[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return visited != len(nodes)


def topological_sort(nodes: list[dict], edges: list[dict]) -> list[str]:
    """Kahn's algorithm. Returns ordered node IDs."""
    in_degree: dict[str, int] = {n["id"]: 0 for n in nodes}
    adj: dict[str, list[str]] = defaultdict(list)

    for edge in edges:
        adj[edge["source"]].append(edge["target"])
        if edge["target"] in in_degree:
            in_degree[edge["target"]] += 1

    queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
    order: list[str] = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in adj[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(order) != len(nodes):
        raise GraphValidationError("Graph contains a cycle")

    return order


def topological_levels(nodes: list[dict], edges: list[dict]) -> list[list[str]]:
    """Kahn's algorithm returning nodes grouped by DAG level for parallel execution."""
    in_degree: dict[str, int] = {n["id"]: 0 for n in nodes}
    adj: dict[str, list[str]] = defaultdict(list)

    for edge in edges:
        adj[edge["source"]].append(edge["target"])
        if edge["target"] in in_degree:
            in_degree[edge["target"]] += 1

    queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
    levels: list[list[str]] = []

    while queue:
        level = list(queue)
        levels.append(level)
        next_queue: deque[str] = deque()
        for node in level:
            for neighbor in adj[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    next_queue.append(neighbor)
        queue = next_queue

    total = sum(len(lv) for lv in levels)
    if total != len(nodes):
        raise GraphValidationError("Graph contains a cycle")

    return levels


async def execute_graph(
    nodes: list[dict],
    edges: list[dict],
    on_progress: Callable[[str, str, dict[str, Any] | None], Any] | None = None,
    context: "ExecutionContext | None" = None,
    error_mode: str = "fail_fast",
    max_retries: int = 0,
    cache: "ExecutionCache | None" = None,
) -> dict[str, Any]:
    """Execute the graph with parallel levels, cancellation, error recovery, and caching.

    Args:
        nodes: Graph node definitions.
        edges: Graph edge definitions.
        on_progress: Callback(node_id, status, data).
        context: ExecutionContext for cancellation support.
        error_mode: 'fail_fast', 'continue', or 'retry'.
        max_retries: Number of retries when error_mode is 'retry'.
        cache: Optional ExecutionCache for skipping unchanged nodes.
    """
    from .execution_context import CancellationError

    # Expand preset nodes iteratively (handles nested presets)
    internal_to_preset: dict[str, str] = {}
    expanded_nodes, expanded_edges = nodes, edges
    for _ in range(10):  # max nesting depth
        has_preset = any(n.get("type", "").startswith("preset:") for n in expanded_nodes)
        if not has_preset:
            break
        expanded_nodes, expanded_edges, mapping = expand_presets(expanded_nodes, expanded_edges)
        internal_to_preset.update(mapping)

    errors = validate_graph(expanded_nodes, expanded_edges)
    if errors:
        raise GraphValidationError("; ".join(errors))

    levels = topological_levels(expanded_nodes, expanded_edges)
    node_map = {n["id"]: n for n in expanded_nodes}

    # Build edge lookup: target_id -> list of (source_id, source_handle, target_handle)
    incoming: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    for edge in expanded_edges:
        incoming[edge["target"]].append(
            (edge["source"], edge.get("sourceHandle", ""), edge.get("targetHandle", ""))
        )

    outputs: dict[str, dict[str, Any]] = {}
    node_errors: dict[str, str] = {}  # node_id -> error message
    node_cache_keys: dict[str, str] = {}  # node_id -> cache key

    max_workers = context.max_workers if context else 4
    semaphore = asyncio.Semaphore(max_workers)

    async def _execute_single_node(node_id: str) -> None:
        """Execute one node with cancellation, caching, and error recovery."""
        if context and context.cancelled:
            raise CancellationError()

        node_def = node_map[node_id]
        node_type = node_def["type"]
        params = node_def.get("data", {}).get("params", {})
        progress_id = internal_to_preset.get(node_id, node_id)

        node_cls = registry.get(node_type)
        if not node_cls:
            raise GraphValidationError(f"Unknown node type: {node_type}")

        # Gather inputs from upstream edges
        inputs: dict[str, Any] = {}
        has_failed_input = False
        for src_id, src_handle, tgt_handle in incoming.get(node_id, []):
            if src_id in node_errors:
                has_failed_input = True
                break
            if src_id in outputs and src_handle in outputs[src_id]:
                inputs[tgt_handle] = outputs[src_id][src_handle]

        # Skip if upstream failed (in continue/retry mode)
        if has_failed_input:
            node_errors[node_id] = "skipped: upstream node failed"
            if on_progress:
                await _maybe_await(on_progress(progress_id, "skipped", None))
            return

        # Check cache
        if cache is not None:
            upstream_keys = []
            for src_id, _, _ in incoming.get(node_id, []):
                if src_id in node_cache_keys:
                    upstream_keys.append(node_cache_keys[src_id])
            cache_key = cache.compute_key(node_type, params, upstream_keys)
            node_cache_keys[node_id] = cache_key
            cached = cache.get(cache_key)
            if cached is not None:
                outputs[node_id] = cached
                if on_progress:
                    await _maybe_await(on_progress(progress_id, "cached", cached))
                return

        if on_progress:
            await _maybe_await(on_progress(progress_id, "running", None))

        attempts = max_retries + 1 if error_mode == "retry" else 1
        last_error: Exception | None = None

        for attempt in range(attempts):
            if context and context.cancelled:
                raise CancellationError()
            try:
                async with semaphore:
                    instance = node_cls()
                    loop = asyncio.get_event_loop()
                    result = await loop.run_in_executor(None, instance.execute, inputs, params)
                outputs[node_id] = result
                if cache is not None and node_id in node_cache_keys:
                    cache.put(node_cache_keys[node_id], result)
                if on_progress:
                    await _maybe_await(on_progress(progress_id, "completed", result))
                return
            except Exception as e:
                last_error = e
                if attempt < attempts - 1:
                    await asyncio.sleep(0.5 * (attempt + 1))  # backoff

        # All attempts failed
        assert last_error is not None
        if error_mode == "fail_fast":
            if on_progress:
                await _maybe_await(
                    on_progress(progress_id, "error", {"error": str(last_error), "traceback": traceback.format_exc()})
                )
            raise last_error
        else:
            # continue or retry-exhausted
            node_errors[node_id] = str(last_error)
            if on_progress:
                await _maybe_await(
                    on_progress(progress_id, "error", {"error": str(last_error), "traceback": traceback.format_exc()})
                )

    # Execute level by level
    for level in levels:
        if context and context.cancelled:
            raise CancellationError()

        if len(level) == 1:
            await _execute_single_node(level[0])
        else:
            # Run independent nodes in this level concurrently
            tasks = [asyncio.create_task(_execute_single_node(nid)) for nid in level]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for i, result in enumerate(results):
                if isinstance(result, CancellationError):
                    raise result
                if isinstance(result, Exception):
                    if error_mode == "fail_fast":
                        # Cancel remaining tasks
                        for t in tasks:
                            t.cancel()
                        raise result

    return outputs


async def _maybe_await(val: Any) -> Any:
    if asyncio.iscoroutine(val):
        return await val
    return val


# Avoid circular import at module level — these are imported lazily inside execute_graph
if False:  # TYPE_CHECKING
    from .cache import ExecutionCache
    from .execution_context import ExecutionContext
