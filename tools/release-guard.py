#!/usr/bin/env python3
"""Verify the declared human release principal before secrets reach a runner.

The Team plan uses admin-restricted tags. A separate non-admin agent identity is a prerequisite.
Tag restrictions enforce the role boundary. Commissioning verifies live settings with an admin
token; the workflow uses actor identity and holds until separate principals are configured.
"""

from __future__ import annotations

import json
import os
import re
import sys


def validate(agent: str, actor: str, approver: str) -> list[str]:
    errors = []
    login = r"[A-Za-z0-9][A-Za-z0-9-]{0,38}"
    if not re.fullmatch(login, agent) or not re.fullmatch(login, approver):
        errors.append("Configure ROCOTO_AGENT_LOGIN and ROCOTO_RELEASE_APPROVER after credential separation")
    if agent.casefold() == approver.casefold():
        errors.append("Agent and human release principals must be separate")
    if actor.casefold() != approver.casefold():
        errors.append("The release tag must be pushed by the configured human release principal")
    return errors


def main(*, product: bool = False) -> int:
    agent = os.environ.get("ROCOTO_AGENT_LOGIN", "")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]{0,38}", agent):
        print("Release held: set ROCOTO_AGENT_LOGIN after separating agent and human GitHub credentials.")
        return 1
    tag = os.environ.get("GITHUB_REF", "")
    pattern = r"refs/tags/vproduct-\d+\.\d+\.\d+" if product else r"refs/tags/v\d+\.\d+\.\d+"
    if os.environ.get("GITHUB_EVENT_NAME") != "push" or not re.fullmatch(pattern, tag):
        print("Release held: use the selected vproduct-X.Y.Z or kit vX.Y.Z tag push.")
        return 1
    try:
        with open(os.environ["GITHUB_EVENT_PATH"]) as event_file:
            event = json.load(event_file)
        if not isinstance(event, dict):
            print("Release held: expected a tag push event object.")
            return 1
        actor = os.environ["GITHUB_ACTOR"]
        sender = event.get("sender", {})
        if (
            sender.get("login", "").casefold() != actor.casefold()
            or sender.get("type") != "User"
            or event.get("deleted")
        ):
            print("Release held: expected a human user's tag push event.")
            return 1
        errors = validate(agent, actor, os.environ.get("ROCOTO_RELEASE_APPROVER", ""))
    except (OSError, ValueError, KeyError) as exc:
        print(f"Release held: event identity check failed ({type(exc).__name__}).")
        return 1
    for error in errors:
        print(f"Release held: {error}")
    if not errors:
        print("Release principal matches. Credential custody and tag restrictions require commissioning.")
    return int(bool(errors))


if __name__ == "__main__":
    sys.exit(main(product="--product" in sys.argv[1:]))
