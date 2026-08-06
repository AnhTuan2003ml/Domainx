from routes import accounting, ai, auth, chat, company_data, employees, sales_migration, support, system, users

ROUTERS = (system, auth, users, chat, support, employees, company_data, accounting, sales_migration, ai)


def dispatch(method, handler, route, parsed):
    function_name = f"handle_{method.lower()}"
    for router in ROUTERS:
        route_handler = getattr(router, function_name, None)
        if route_handler and route_handler(handler, route, parsed):
            return True
    return False
