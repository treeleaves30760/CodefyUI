import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..core.cache import ExecutionCache
from ..core.execution_context import CancellationError, ExecutionContext
from ..core.graph_engine import GraphValidationError, execute_graph

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/execution")
async def websocket_execution(ws: WebSocket):
    await ws.accept()

    current_task: asyncio.Task | None = None
    current_context: ExecutionContext | None = None
    cache = ExecutionCache()

    try:
        while True:
            raw = await ws.receive_text()
            data = json.loads(raw)

            action = data.get("action")
            if action == "execute":
                # Cancel any existing execution first
                if current_task and not current_task.done():
                    if current_context:
                        current_context.cancel()
                    current_task.cancel()

                nodes = data.get("nodes", [])
                edges = data.get("edges", [])
                error_mode = data.get("error_mode", "fail_fast")
                max_retries = data.get("max_retries", 0)

                current_context = ExecutionContext()

                async def on_progress(node_id: str, status: str, result: dict[str, Any] | None) -> None:
                    msg: dict[str, Any] = {
                        "type": "node_status",
                        "node_id": node_id,
                        "status": status,
                    }
                    if result and status == "error":
                        msg["error"] = result.get("error", "")
                    if result and status == "completed":
                        # Forward log output (from Print node etc.)
                        if "__log__" in result:
                            msg["log"] = str(result["__log__"])
                        # Forward base64 image data so the frontend can display it
                        for key, val in result.items():
                            if key.startswith("__"):
                                continue
                            if isinstance(val, str) and len(val) > 200 and val[:20].isalnum():
                                msg["image"] = val
                                break
                    await ws.send_text(json.dumps(msg))

                async def _run() -> None:
                    try:
                        await ws.send_text(json.dumps({"type": "execution_start"}))
                        await execute_graph(
                            nodes,
                            edges,
                            on_progress=on_progress,
                            context=current_context,
                            error_mode=error_mode,
                            max_retries=max_retries,
                            cache=cache,
                        )
                        await ws.send_text(json.dumps({"type": "execution_complete"}))
                    except CancellationError:
                        await ws.send_text(json.dumps({"type": "execution_stopped"}))
                    except GraphValidationError as e:
                        await ws.send_text(json.dumps({"type": "execution_error", "error": str(e)}))
                    except Exception as e:
                        await ws.send_text(json.dumps({"type": "execution_error", "error": str(e)}))

                current_task = asyncio.create_task(_run())

            elif action == "stop":
                if current_context:
                    current_context.cancel()
                if current_task and not current_task.done():
                    current_task.cancel()
                else:
                    await ws.send_text(json.dumps({"type": "execution_stopped"}))

            elif action == "clear_cache":
                cache.clear()
                await ws.send_text(json.dumps({"type": "cache_cleared"}))

            else:
                await ws.send_text(json.dumps({"type": "error", "error": f"Unknown action: {action}"}))
    except WebSocketDisconnect:
        if current_context:
            current_context.cancel()
        if current_task and not current_task.done():
            current_task.cancel()
