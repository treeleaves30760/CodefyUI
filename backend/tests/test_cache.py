"""Tests for node-level execution caching (Phase 5)."""

import pytest

from app.core.cache import ExecutionCache
from app.core.graph_engine import execute_graph


def test_cache_compute_key_deterministic():
    k1 = ExecutionCache.compute_key("Conv2d", {"in_channels": 3}, ["abc"])
    k2 = ExecutionCache.compute_key("Conv2d", {"in_channels": 3}, ["abc"])
    assert k1 == k2


def test_cache_different_params_different_key():
    k1 = ExecutionCache.compute_key("Conv2d", {"in_channels": 3}, [])
    k2 = ExecutionCache.compute_key("Conv2d", {"in_channels": 64}, [])
    assert k1 != k2


def test_cache_put_and_get():
    cache = ExecutionCache()
    cache.put("key1", {"output": 42})
    assert cache.get("key1") == {"output": 42}
    assert cache.get("missing") is None


def test_cache_lru_eviction():
    cache = ExecutionCache(max_entries=2)
    cache.put("a", {"v": 1})
    cache.put("b", {"v": 2})
    cache.put("c", {"v": 3})  # evicts "a"
    assert cache.get("a") is None
    assert cache.get("b") == {"v": 2}
    assert cache.get("c") == {"v": 3}


def test_cache_lru_access_refreshes():
    cache = ExecutionCache(max_entries=2)
    cache.put("a", {"v": 1})
    cache.put("b", {"v": 2})
    cache.get("a")  # refresh "a"
    cache.put("c", {"v": 3})  # should evict "b" (least recently used)
    assert cache.get("a") == {"v": 1}
    assert cache.get("b") is None


@pytest.mark.asyncio
async def test_cache_hit_skips_execution():
    """Second run with same params should hit cache."""
    cache = ExecutionCache()
    run_count = 0

    async def count_runs(node_id, status, data):
        nonlocal run_count
        if status == "completed":
            run_count += 1

    nodes = [{"id": "1", "type": "Print", "data": {"params": {"label": "test"}}}]
    edges = []

    await execute_graph(nodes, edges, on_progress=count_runs, cache=cache)
    assert run_count == 1

    # Reset counter
    cached_count = 0

    async def count_cached(node_id, status, data):
        nonlocal cached_count
        if status == "cached":
            cached_count += 1

    await execute_graph(nodes, edges, on_progress=count_cached, cache=cache)
    assert cached_count == 1


@pytest.mark.asyncio
async def test_cache_invalidation_on_param_change():
    """Changing params should cause a cache miss."""
    cache = ExecutionCache()

    nodes_v1 = [{"id": "1", "type": "Print", "data": {"params": {"label": "v1"}}}]
    nodes_v2 = [{"id": "1", "type": "Print", "data": {"params": {"label": "v2"}}}]

    await execute_graph(nodes_v1, [], cache=cache)

    statuses = {}

    async def track(node_id, status, data):
        statuses[node_id] = status

    await execute_graph(nodes_v2, [], on_progress=track, cache=cache)
    # Should NOT be cached since param changed
    assert statuses.get("1") == "completed"
