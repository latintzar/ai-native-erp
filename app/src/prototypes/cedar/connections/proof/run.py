"""Run the private Cedar proof with explicit company-scoped environment input only."""

import argparse
import os
import stat
from pathlib import Path

from dotenv import dotenv_values
from service import PREFIX, Config, create_app


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--port", type=int, default=4182)
    args = parser.parse_args()
    if args.env_file:
        path = args.env_file.expanduser()
        if (
            path.is_symlink()
            or not path.is_file()
            or path.stat().st_uid != os.getuid()
            or (stat.S_IMODE(path.stat().st_mode) & 0o077)
        ):
            parser.error("The environment file requires current-user ownership and private 0600 permissions.")
        values = dotenv_values(path, interpolate=False)
        allowed = {PREFIX + name.upper() for name in Config.__dataclass_fields__}
        for name, value in values.items():
            if name in allowed and value is not None:
                os.environ[name] = value
    config = Config.from_env()
    missing = config.blockers()
    if args.preflight:
        for key in missing:
            print(key)
        return 1 if missing else 0
    if not 1024 <= args.port <= 65535:
        parser.error("Choose a port between 1024 and 65535.")
    import uvicorn

    # The commissioned HTTPS reverse proxy terminates TLS; the proof binds only to localhost.
    uvicorn.run(create_app(config), host="127.0.0.1", port=args.port, access_log=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
