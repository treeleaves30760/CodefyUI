from __future__ import annotations

import importlib
import inspect
import logging
import pkgutil
from pathlib import Path
from typing import Type

from .node_base import BaseNode

logger = logging.getLogger(__name__)


class NodeRegistry:
    def __init__(self) -> None:
        self._nodes: dict[str, Type[BaseNode]] = {}

    @property
    def nodes(self) -> dict[str, Type[BaseNode]]:
        return dict(self._nodes)

    def register(self, node_cls: Type[BaseNode]) -> None:
        name = node_cls.NODE_NAME
        if not name:
            raise ValueError(f"{node_cls.__name__} has no NODE_NAME")
        self._nodes[name] = node_cls

    def get(self, name: str) -> Type[BaseNode] | None:
        return self._nodes.get(name)

    def discover(self, package_path: Path, package_name: str) -> int:
        count = 0
        if not package_path.exists():
            return count
        for importer, modname, ispkg in pkgutil.walk_packages(
            [str(package_path)], prefix=package_name + "."
        ):
            try:
                module = importlib.import_module(modname)
            except Exception as e:
                logger.warning("Failed to import %s: %s", modname, e)
                continue
            for _, obj in inspect.getmembers(module, inspect.isclass):
                if (
                    issubclass(obj, BaseNode)
                    and obj is not BaseNode
                    and obj.NODE_NAME
                ):
                    self.register(obj)
                    count += 1
        return count

    def clear(self) -> None:
        self._nodes.clear()


registry = NodeRegistry()
