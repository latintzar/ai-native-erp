"""Previously duplicated GET /avisos surfaces must remain independently routable."""
from fastapi import FastAPI

import sup_api


def test_routing_preferences_and_delivery_queue_have_distinct_openapi_operations():
    app = FastAPI()
    app.include_router(sup_api.router)
    paths = app.openapi()['paths']
    assert paths['/api/sup/avisos']['get']['operationId'].startswith('sup_aviso_routing_')
    assert paths['/api/sup/delivery/avisos']['get']['operationId'].startswith('sup_avisos_')
    keys = [(route.path, method) for route in sup_api.router.routes for method in route.methods]
    assert len(keys) == len(set(keys)), 'each method/path must have exactly one registered handler'
    assert paths['/api/sup/avisos/{moment}']['post']['operationId'].startswith('sup_avisos_set_')
    assert paths['/api/sup/aviso/{aviso_id}/opciones']['get']
    assert paths['/api/sup/aviso/{aviso_id}/resolver']['post']

    operations = [operation['operationId'] for path in paths.values() for method, operation in path.items()
                  if method in {'get', 'post', 'put', 'patch', 'delete'}]
    assert len(operations) == len(set(operations))
