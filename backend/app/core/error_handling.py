"""Error recovery types for graph execution."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


class ErrorMode(str, Enum):
    FAIL_FAST = "fail_fast"
    CONTINUE = "continue"
    RETRY = "retry"


@dataclass
class NodeError:
    """Represents a failed node execution."""

    node_id: str
    error: str
    traceback: str | None = None


def is_node_error(value: Any) -> bool:
    return isinstance(value, NodeError)
