"""
Server-Sent Events: an in-memory pub/sub keyed by user id.

Single-process only (fine for one Render instance). Browsers can't set headers on EventSource,
so clients first POST for a short-lived one-time ticket and open the stream with it, which keeps
the long-lived JWT out of URLs and access logs.
"""

import asyncio
import json
import secrets
import time
from collections import defaultdict
from typing import Any, Dict, Iterable, Optional, Set, Tuple

TICKET_TTL_SECONDS = 60
QUEUE_SIZE = 100


class EventBroker:
    def __init__(self):
        self._subscribers: Dict[str, Set[asyncio.Queue]] = defaultdict(set)
        self._tickets: Dict[str, Tuple[str, float]] = {}

    def issue_ticket(self, user_id: str) -> str:
        now = time.monotonic()
        self._tickets = {t: v for t, v in self._tickets.items() if v[1] > now}
        ticket = secrets.token_urlsafe(24)
        self._tickets[ticket] = (user_id, now + TICKET_TTL_SECONDS)
        return ticket

    def redeem_ticket(self, ticket: str) -> Optional[str]:
        entry = self._tickets.pop(ticket, None)
        if not entry or entry[1] < time.monotonic():
            return None
        return entry[0]

    def subscribe(self, user_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_SIZE)
        self._subscribers[user_id].add(queue)
        return queue

    def unsubscribe(self, user_id: str, queue: asyncio.Queue) -> None:
        self._subscribers[user_id].discard(queue)
        if not self._subscribers[user_id]:
            self._subscribers.pop(user_id, None)

    def is_online(self, user_id: str) -> bool:
        return bool(self._subscribers.get(user_id))

    def publish(self, user_ids: Iterable[str], event: str, data: Dict[str, Any]) -> None:
        message = f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"
        for user_id in set(user_ids):
            for queue in list(self._subscribers.get(user_id, ())):
                try:
                    queue.put_nowait(message)
                except asyncio.QueueFull:
                    pass  # a stalled client will resync on reconnect


broker = EventBroker()
