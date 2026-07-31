def handle_get(handler, route, _parsed):
    if route != "/api/health":
        return False
    handler.send_json({
        "ok": True,
        "service": "domix-backend",
        "database": handler.database_backend(),
        "databaseIdentity": handler.database_identity(),
        "storageMode": "primary-postgresql-only",
    })
    return True
