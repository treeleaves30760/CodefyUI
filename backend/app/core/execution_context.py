"""Execution context for tracking and cancelling graph runs."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import uuid4


@dataclass
class ExecutionContext:
    """Shared context for a single graph execution run."""

    execution_id: str = field(default_factory=lambda: str(uuid4()))
    max_workers: int = 4
    _cancel_event: asyncio.Event = field(default_factory=asyncio.Event)

    def cancel(self) -> None:
        """Signal cancellation."""
        self._cancel_event.set()

    @property
    def cancelled(self) -> bool:
        return self._cancel_event.is_set()


class CancellationError(Exception):
    """Raised when a graph execution is cancelled."""
