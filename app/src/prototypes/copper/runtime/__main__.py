"""Initialize and run Copper with an isolated private configuration file."""
from __future__ import annotations

import argparse
import os
import secrets
import stat
import sys
import tempfile
from pathlib import Path

import uvicorn
from cryptography.fernet import Fernet

from .config import Settings

DEFAULT_CONFIG = Path.home() / ".config/rocoto/copper.env"
DEFAULT_STATE = Path.home() / ".local/state/rocoto/copper"
_ALLOWED = {
    "COPPER_STATE_DIR", "COPPER_PUBLIC_ORIGIN", "COPPER_ADMIN_TOKEN", "COPPER_ENCRYPTION_KEY",
    "COPPER_ALLOW_LIVE", "COPPER_MP_CLIENT_ID", "COPPER_MP_CLIENT_SECRET", "COPPER_MP_WEBHOOK_SECRET",
    "COPPER_POLL_SECONDS", "CEDAR_ALLOWED_ORIGINS", "CEDAR_SAMPLE_BANK",
}
_REQUIRED = {"COPPER_STATE_DIR", "COPPER_PUBLIC_ORIGIN", "COPPER_ADMIN_TOKEN", "COPPER_ENCRYPTION_KEY"}


def _private_directory(path: Path) -> None:
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = path.stat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError("private_directory_required")


def _settings(values: dict[str, str]) -> Settings:
    if values.get("COPPER_ALLOW_LIVE", "0") not in {"0", "1"}:
        raise ValueError("invalid_live_mode")
    if values.get("CEDAR_SAMPLE_BANK", "0") not in {"0", "1"}:
        raise ValueError("invalid_sample_bank_mode")
    return Settings(
        state_dir=Path(values["COPPER_STATE_DIR"]).expanduser().absolute(),
        public_origin=values["COPPER_PUBLIC_ORIGIN"].rstrip("/"),
        admin_token=values["COPPER_ADMIN_TOKEN"],
        encryption_key=values["COPPER_ENCRYPTION_KEY"],
        allow_live=values.get("COPPER_ALLOW_LIVE", "0") == "1",
        sample_bank=values.get("CEDAR_SAMPLE_BANK", "0") == "1",
        mp_client_id=values.get("COPPER_MP_CLIENT_ID", ""),
        mp_client_secret=values.get("COPPER_MP_CLIENT_SECRET", ""),
        mp_webhook_secret=values.get("COPPER_MP_WEBHOOK_SECRET", ""),
        poll_seconds=int(values.get("COPPER_POLL_SECONDS", "60")),
        cedar_allowed_origins=tuple(value.strip() for value in values.get("CEDAR_ALLOWED_ORIGINS", "").split(",") if value.strip()),
    )


def load_settings(config_file: Path) -> Settings:
    """Read literal KEY=value lines. The file is configuration, never shell code."""
    descriptor = os.open(config_file, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, encoding="utf-8") as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise ValueError("private_config_required")
        content = stream.read(65537)
    if len(content) > 65536:
        raise ValueError("config_size")
    values = {}
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name, separator, value = line.partition("=")
        if not separator or name not in _ALLOWED or name in values:
            raise ValueError("invalid_config_line")
        values[name] = value
    settings = _settings(values)
    _private_directory(settings.state_dir)
    return settings


def initialize(config_file: Path, state_dir: Path, public_origin: str) -> None:
    """Publish a complete mode-0600 file atomically, preserving any existing file."""
    config_file = config_file.expanduser().absolute()
    state_dir = state_dir.expanduser().absolute()
    values = {
        "COPPER_STATE_DIR": str(state_dir),
        "COPPER_PUBLIC_ORIGIN": public_origin.rstrip("/"),
        "COPPER_ADMIN_TOKEN": secrets.token_urlsafe(48),
        "COPPER_ENCRYPTION_KEY": Fernet.generate_key().decode(),
        "COPPER_ALLOW_LIVE": "0",
        "CEDAR_SAMPLE_BANK": "0",
        "CEDAR_ALLOWED_ORIGINS": "",
    }
    if any("\n" in value or "\r" in value for value in values.values()):
        raise ValueError("invalid_configuration_value")
    _settings(values)
    _private_directory(config_file.parent)
    _private_directory(state_dir)
    descriptor, temporary = tempfile.mkstemp(prefix=".copper-init-", dir=config_file.parent)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write("# Cedar collection development/demo configuration. Keep this file private.\n")
            for name, value in values.items():
                stream.write(f"{name}={value}\n")
            stream.flush()
            os.fsync(stream.fileno())
        # Linking creates the destination atomically and fails if a file already exists.
        os.link(temporary, config_file, follow_symlinks=False)
        directory_fd = os.open(config_file.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        Path(temporary).unlink(missing_ok=True)


def application():
    """Uvicorn factory, shared by the CLI and a commissioned process manager."""
    from .cedar_service import create_app

    os.umask(0o077)
    try:
        settings = launch_settings()
    except (OSError, ValueError, KeyError):
        raise RuntimeError("Copper requires a valid private configuration file") from None
    return create_app(settings)


def launch_settings(config_file: Path | None = None) -> Settings:
    """Use an explicit file, commissioned environment, or the local private file."""
    if config_file is not None:
        return load_settings(config_file.expanduser().absolute())
    configured_file = os.environ.get("COPPER_CONFIG_FILE")
    if configured_file:
        return load_settings(Path(configured_file).expanduser().absolute())
    if _REQUIRED.issubset(os.environ):
        settings = _settings({key: os.environ[key] for key in _ALLOWED if key in os.environ})
        _private_directory(settings.state_dir)
        return settings
    return load_settings(DEFAULT_CONFIG)


def main() -> int:
    parser = argparse.ArgumentParser(description="Copper isolated payment integration prototype")
    commands = parser.add_subparsers(dest="command", required=True)
    configured_file = Path(os.environ.get("COPPER_CONFIG_FILE", str(DEFAULT_CONFIG)))
    init = commands.add_parser("init", help="create a private sandbox configuration and state directory")
    init.add_argument("--config", type=Path, default=configured_file)
    init.add_argument("--state-dir", type=Path, default=DEFAULT_STATE)
    init.add_argument("--public-origin", default="http://127.0.0.1:8795")
    serve = commands.add_parser("serve", help="serve the prototype on loopback")
    serve.add_argument("--config", type=Path, default=None)
    serve.add_argument("--host", choices=("127.0.0.1", "::1"), default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8795)
    args = parser.parse_args()
    os.umask(0o077)
    try:
        if args.command == "init":
            config_file = args.config.expanduser().absolute()
            initialize(config_file, args.state_dir, args.public_origin)
            print("Private sandbox configuration initialized. "
                  "Retrieve its operator token in your private editor.")
            print(f"Configuration: {config_file}")
            return 0
        if not 1 <= args.port <= 65535:
            raise ValueError("invalid_port")
        launch_settings(args.config)
        if args.config is not None:
            os.environ["COPPER_CONFIG_FILE"] = str(args.config.expanduser().absolute())
        uvicorn.run("runtime.__main__:application", factory=True, host=args.host, port=args.port,
                    access_log=False, log_level="warning")
        return 0
    except FileExistsError:
        print("Existing configuration preserved. Use serve to start it.", file=sys.stderr)
    except (OSError, ValueError, KeyError):
        print("Review the private configuration, directory permissions and command options.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
