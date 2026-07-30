from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from config import (
    AI_REQUEST_TIMEOUT_SECONDS,
    ANTHROPIC_API_KEY,
    ANTHROPIC_API_VERSION,
    ANTHROPIC_MODEL,
)


ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"


def _validated_payload(data):
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("Trợ lý AI chưa được cấu hình API key trên máy chủ.")
    if not isinstance(data, dict):
        raise ValueError("Dữ liệu yêu cầu AI không hợp lệ.")
    messages = data.get("messages")
    if not isinstance(messages, list) or not messages:
        raise ValueError("Yêu cầu AI phải có ít nhất một tin nhắn.")
    if len(messages) > 80:
        raise ValueError("Lịch sử hội thoại quá dài. Hãy bắt đầu một hội thoại mới.")

    max_tokens = int(data.get("max_tokens") or 2048)
    max_tokens = max(128, min(max_tokens, 8192))
    payload = {
        "model": str(data.get("model") or ANTHROPIC_MODEL),
        "max_tokens": max_tokens,
        "messages": messages,
    }
    system = data.get("system")
    if system:
        payload["system"] = system
    temperature = data.get("temperature")
    if temperature is not None:
        payload["temperature"] = max(0.0, min(float(temperature), 1.0))
    return payload


def send_message(data):
    payload = _validated_payload(data)
    request = Request(
        ANTHROPIC_MESSAGES_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": ANTHROPIC_API_VERSION,
        },
    )
    try:
        with urlopen(request, timeout=AI_REQUEST_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        try:
            remote = json.loads(exc.read().decode("utf-8"))
            message = remote.get("error", {}).get("message") or remote.get("error")
        except Exception:
            message = None
        raise RuntimeError(message or f"Nhà cung cấp AI trả về lỗi HTTP {exc.code}.") from exc
    except URLError as exc:
        raise RuntimeError("Không kết nối được tới nhà cung cấp AI.") from exc
