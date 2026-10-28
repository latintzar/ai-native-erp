"""JSON-safe values shared by product HTTP adapters."""


def json_safe(obj):
    import datetime as _dt

    if isinstance(obj, list):
        return [json_safe(x) for x in obj]
    if isinstance(obj, dict):
        return {k: json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (_dt.datetime, _dt.date)):
        return obj.isoformat()
    return obj
