from fastapi import Response
from typing import AsyncGenerator, Any

class EventSourceResponse(Response):
    media_type = "text/event-stream"

    def __init__(
        self,
        content: AsyncGenerator[str, Any],
        status_code: int = 200,
        headers: dict = None,
    ):
        super().__init__(
            content=content,
            status_code=status_code,
            headers=headers or {},
        )
        self.init_streaming()

    def init_streaming(self):
        self.headers.setdefault("Cache-Control", "no-cache")
        self.headers.setdefault("Connection", "keep-alive")
        self.headers.setdefault("X-Accel-Buffering", "no")

    async def stream_response(self, send) -> None:
        await send({
            "type": "http.response.start",
            "status": self.status_code,
            "headers": self.raw_headers,
        })

        async for chunk in self.content:
            if not isinstance(chunk, bytes):
                chunk = chunk.encode("utf-8")
            await send({
                "type": "http.response.body",
                "body": chunk,
                "more_body": True,
            })

        await send({
            "type": "http.response.body",
            "body": b"",
            "more_body": False,
        }) 