"""vital_media_writable.py — THE SERVICE CAN ACTUALLY STORE THE BYTES IT PROMISES TO STORE.

THE INCIDENT THIS GATES (2026-08-13, found by Peter mid-demo AT A CUSTOMER). Every catalogue upload
in the demo answered «No he podido empezar a leerlo. Inténtalo otra vez.» The cause was not in the
code: `/opt/rocoto/media/intake` and `/opt/rocoto/media/onboarding` were owned by `root:root`, the
service runs as `founder`, and `brain/onboarding.py`'s `d.mkdir(parents=True, exist_ok=True)` could
not create a directory inside them. `create_intake` catches that exception and returns `ok:false`,
`intake_api` turns it into a 500, and the reader meets a sentence that names none of it.

HOW THE DIRECTORIES GOT THAT WAY — the reason this file exists rather than a one-line chown.
`app.py` runs `MEDIA_DIR.mkdir(parents=True, exist_ok=True)` AT IMPORT TIME, and the deploy
harness's import-check imported it over ssh AS ROOT. So the very machinery that proves a release is
safe was the thing quietly creating directories the released service could not write into. Both
ends are now fixed in `rocoto_deploy.sh` (import as `founder`; assert ownership before restart) —
but a permission is a property of a live box, not of a commit, and anything reaching that box as
root can undo it again. Only an assertion that runs against the real filesystem can tell.

WHY THE 90-VITAL SUITE WENT GREEN THROUGH THE WHOLE INCIDENT. The suite runs against a rehearsal
CLONE, and the clone's assertions travel through the DATABASE. `vital_demo_auth.py` says so in its
own words: a vital that wrote to the real `/opt/rocoto/media/intake` «would be deleting production
files», so it does not go near it. That caution is right and stays right — the answer is not to let
the suite loose on production media, but to write ONE probe that is provably confined:

  · every path it touches is `_PROBE_PREFIX`-named, created by this file, and removed in a `finally`
  · it never lists, reads, moves or deletes anything it did not itself create
  · it writes bytes and reads them back, because the permission bits are not the claim — the claim
    is that a write SUCCEEDS, and `os.access` famously lies about that under ACLs and read-only
    mounts alike.

RUN AS THE SERVICE USER OR NOT AT ALL. Run as root this vital passes on a box where the service
cannot write a thing, which is precisely the false green that let the incident reach a customer. It
therefore refuses to run as anyone but the user in `MEDIA_OWNER` (default `founder`), rather than
reporting a result it knows is meaningless.

This is the one vital that is EXPECTED to run against production, so it takes the opposite guard to
every other file in this directory: `guard_clone()` elsewhere refuses production; here the whole
point is the real box.
"""
from __future__ import annotations

import os
import pwd
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config  # noqa: E402

# The user the systemd unit runs as. Overridable so a differently-provisioned box can still gate,
# rather than being silently exempt.
MEDIA_OWNER = os.environ.get("ROCOTO_MEDIA_OWNER", "founder")

# Everything this vital creates carries this prefix, so cleanup can never widen into somebody's
# catalogue. A random suffix keeps two concurrent runs out of each other's way.
_PROBE_PREFIX = "vital_probe_"

R: list[bool] = []


def ck(name: str, ok: bool, detail: str = "") -> None:
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def guard_service_user() -> None:
    """The inverse of every other vital's `guard_clone`: this one MUST be the real box, as the real
    user. Root would pass on a box the service cannot write to at all."""
    me = pwd.getpwuid(os.geteuid()).pw_name
    if me != MEDIA_OWNER:
        print(f"REFUSED: this vital must run as {MEDIA_OWNER!r} (the service user), not {me!r}.")
        print(f"         Run it as: sudo -u {MEDIA_OWNER} PYTHONPATH=. python tests/{Path(__file__).name}")
        print("         Running it as root would pass on a box where the service cannot write.")
        sys.exit(2)


def probe(root: Path, label: str) -> None:
    """Create → write → read back → delete, inside a directory named only by us.

    The nested mkdir is the actual regression: `brain/onboarding.create_intake` does not write into
    `intake/`, it creates `intake/<intake_id>/` first. A parent that is `drwxr-xr-x root:root` lets
    `founder` list and read it — so anything checking for the directory's existence, or reading a
    file already inside it, is satisfied — and refuses the one operation the product needs.
    """
    d = root / f"{_PROBE_PREFIX}{secrets.token_hex(6)}"
    f = d / "probe.txt"
    payload = f"vital_media_writable {secrets.token_hex(8)}"
    try:
        try:
            d.mkdir(parents=True, exist_ok=False)
        except PermissionError as ex:
            owner = "?"
            try:
                owner = pwd.getpwuid(root.stat().st_uid).pw_name
            except Exception:  # noqa: BLE001
                pass
            ck(f"{label}: the service can create a directory under {root}", False,
               f"{type(ex).__name__} — {root} is owned by {owner!r}, "
               f"the service runs as {MEDIA_OWNER!r}. Fix: chown -R {MEDIA_OWNER}:{MEDIA_OWNER} {config.MEDIA_DIR}")
            return
        except FileNotFoundError as ex:
            ck(f"{label}: the service can create a directory under {root}", False,
               f"{type(ex).__name__} — {root.parent} does not exist")
            return
        ck(f"{label}: the service can create a directory under {root}", True)

        f.write_text(payload, encoding="utf-8")
        # READ IT BACK. A write that lands somewhere unreadable is not a stored file, and this is
        # exactly the shape `create_intake` needs: bytes in, bytes out later, same process user.
        ck(f"{label}: bytes written there survive a read-back", f.read_text("utf-8") == payload)
    except Exception as ex:  # noqa: BLE001
        ck(f"{label}: storing bytes under {root}", False, f"{type(ex).__name__}: {ex}")
    finally:
        # ONLY EVER OUR OWN. The name is checked again here rather than trusted from above, because
        # this branch runs on every path including the ones where something went wrong.
        try:
            if d.name.startswith(_PROBE_PREFIX) and d.is_dir():
                for child in d.iterdir():
                    child.unlink()
                d.rmdir()
        except Exception:  # noqa: BLE001
            print(f"       (probe dir left behind: {d} — harmless, but worth a look)")


def main() -> int:
    guard_service_user()
    media = Path(config.MEDIA_DIR)
    print(f"vital_media_writable — MEDIA_DIR={media} as {MEDIA_OWNER!r}\n")

    ck(f"{media} exists", media.is_dir(), str(media))
    if not media.is_dir():
        print("\nvital_media_writable: 0/1 — MEDIA_DIR is missing entirely")
        return 1

    # THE FOUR PLACES THE PRODUCT ACTUALLY STORES BYTES, each named where it is constructed:
    #   intake/      brain/onboarding.py:1701  — the catalogue upload that broke
    #   onboarding/  brain/onboarding.py:425   — the wizard's own uploads
    #   out/         app.py:95                 — outbound media Twilio fetches by URL
    # `intake` and `onboarding` are the two that were root-owned; `out` is here because it fails the
    # same way and is the one whose breakage a customer would see as a photo that never arrives.
    for sub, label in (("intake", "catalogue intake"),
                       ("onboarding", "wizard upload"),
                       ("out", "outbound media")):
        root = media / sub
        if not root.is_dir():
            # Created lazily by the app; the vital creates it the way the service would, which is
            # itself the thing under test.
            try:
                root.mkdir(parents=True, exist_ok=True)
            except Exception as ex:  # noqa: BLE001
                ck(f"{label}: {root} can be created", False, f"{type(ex).__name__}: {ex}")
                continue
        probe(root, label)

    # `version.json` is written into MEDIA_DIR itself rather than a subdirectory, so it is the one
    # check that proves the ROOT is writable and not merely its children.
    probe(media, "media root")

    ok = sum(R)
    total = len(R)
    print(f"\nvital_media_writable: {ok}/{total}" + (" green" if ok == total else " ❌"))
    return 0 if ok == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
