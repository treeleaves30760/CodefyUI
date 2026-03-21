"""Tests for error recovery modes (Phase 3)."""

import pytest

from app.core.graph_engine import execute_graph
from app.core.node_base import BaseNode, DataType, PortDefinition
from app.core.node_registry import registry


class FailingNode(BaseNode):
    NODE_NAME = "_TestFailing"
    CATEGORY = "Test"
    DESCRIPTION = "Always fails"

    @classmethod
    def define_inputs(cls):
        return [PortDefinition(name="input", data_type=DataType.ANY, optional=True)]

    @classmethod
    def define_outputs(cls):
        return [PortDefinition(name="output", data_type=DataType.ANY)]

    def execute(self, inputs, params):
        raise RuntimeError("intentional failure")


@pytest.fixture(autouse=True)
def _register_failing_node():
    registry._nodes["_TestFailing"] = FailingNode
    yield
    registry._nodes.pop("_TestFailing", None)


@pytest.mark.asyncio
async def test_fail_fast_raises():
    """Default fail_fast mode should raise on first error."""
    nodes = [
        {"id": "1", "type": "_TestFailing", "data": {"params": {}}},
        {"id": "2", "type": "Print", "data": {"params": {}}},
    ]
    edges = [{"source": "1", "target": "2", "sourceHandle": "output", "targetHandle": "value"}]

    with pytest.raises(RuntimeError, match="intentional failure"):
        await execute_graph(nodes, edges, error_mode="fail_fast")


@pytest.mark.asyncio
async def test_continue_mode_skips_downstream():
    """Continue mode: failing node is recorded, downstream is skipped."""
    statuses = {}

    async def on_progress(node_id, status, data):
        statuses[node_id] = status

    nodes = [
        {"id": "1", "type": "_TestFailing", "data": {"params": {}}},
        {"id": "2", "type": "Print", "data": {"params": {}}},
    ]
    edges = [{"source": "1", "target": "2", "sourceHandle": "output", "targetHandle": "value"}]

    results = await execute_graph(nodes, edges, on_progress=on_progress, error_mode="continue")

    assert statuses.get("1") == "error"
    assert statuses.get("2") == "skipped"
    # Node 2 should not have output
    assert "2" not in results


@pytest.mark.asyncio
async def test_retry_mode():
    """Retry mode retries up to max_retries times before continuing."""
    call_count = 0

    class RetryNode(BaseNode):
        NODE_NAME = "_TestRetry"
        CATEGORY = "Test"
        DESCRIPTION = "Fails then succeeds"

        @classmethod
        def define_inputs(cls):
            return []

        @classmethod
        def define_outputs(cls):
            return [PortDefinition(name="out", data_type=DataType.ANY)]

        def execute(self, inputs, params):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise RuntimeError("not yet")
            return {"out": "ok"}

    registry._nodes["_TestRetry"] = RetryNode
    try:
        nodes = [{"id": "1", "type": "_TestRetry", "data": {"params": {}}}]
        results = await execute_graph(nodes, [], error_mode="retry", max_retries=3)
        assert results["1"]["out"] == "ok"
        assert call_count == 3
    finally:
        registry._nodes.pop("_TestRetry", None)
