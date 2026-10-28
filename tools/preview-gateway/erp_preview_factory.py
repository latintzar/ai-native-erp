"""Private operator factory; environment is supplied by the owner/service manager."""
from gateway.app import create_app
from gateway.config import Config
from erp_copilot_preview import registry

def factory():
    config=Config.from_env()
    return create_app(config,registry(config))
