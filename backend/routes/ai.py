from services import ai_service


def handle_post(handler, route, _parsed):
    if route != "/api/ai/messages":
        return False
    user = handler.require_user()
    if not user:
        return True
    body = handler.read_json()
    if body is None:
        return True
    try:
        handler.send_json(ai_service.send_message(body))
    except ValueError as exc:
        handler.send_json({"error": str(exc)}, 400)
    except RuntimeError as exc:
        handler.send_json({"error": str(exc)}, 503)
    return True
