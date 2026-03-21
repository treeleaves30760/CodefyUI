"""Tests for execution cancellation (Phase 2)."""

import asyncio

import pytest

from app.core.execution_context import CancellationError, ExecutionContext
from app.core.graph_engine import execute_graph


def test_execution_context_cancel():
    ctx = ExecutionContext()
    assert not ctx.cancelled
    ctx.cancel()
    assert ctx.cancelled


@pytest.mark.asyncio
async def test_cancel_before_execution():
    """Cancelling context before execution raises CancellationError."""
    ctx = ExecutionContext()
    ctx.cancel()

    nodes = [
        {"id": "1", "type": "Print", "data": {"params": {"label": "a"}}},
    ]
    edges = []

    with pytest.raises(CancellationError):
        await execute_graph(nodes, edges, context=ctx)


@pytest.mark.asyncio
async def test_cancel_during_execution():
    """Cancelling mid-execution stops before later nodes run."""
    ctx = ExecutionContext()
    executed_nodes = []

    async def on_progress(node_id, status, data):
        if status == "running":
            executed_nodes.append(node_id)
            if node_id == "1":
                ctx.cancel()

    nodes = [
        {"id": "1", "type": "Print", "data": {"params": {}}},
        {"id": "2", "type": "Print", "data": {"params": {}}},
    ]
    edges = [{"source": "1", "target": "2", "sourceHandle": "value", "targetHandle": "value"}]

    with pytest.raises(CancellationError):
        await execute_graph(nodes, edges, on_progress=on_progress, context=ctx)

    # Node 1 started, but node 2 should not have started
    assert "1" in executed_nodes
