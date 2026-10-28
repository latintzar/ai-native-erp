"""Source ownership selects independent publications; renames and shared imports retain their owners."""

from __future__ import annotations

import importlib.util
import pathlib
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("changed_targets", ROOT / "deploy/product/changed-targets.py")
assert SPEC and SPEC.loader
selector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(selector)


class ChangedTargets(unittest.TestCase):
    def test_independent_source_ownership(self):
        examples = [
            ({"app/src/prototypes/cedar/view.tsx"}, (True, False)),
            ({"app/src/prototypes/maple/view.tsx"}, (True, False)),
            ({"mock-api/app/main.py"}, (True, False)),
            ({"backend/worker.py"}, (False, True)),
            ({"app/src/operator/main.tsx"}, (False, True)),
            ({"app/operator.html"}, (False, True)),
            ({"app/src/rocoto-theme.ts"}, (True, True)),
            ({"app/package-lock.json"}, (True, True)),
            ({"app/public/brand/logo.svg"}, (True, False)),
            ({"app/src/kit/App.tsx", "app/tools/build-kit.mjs"}, (False, False)),
            (
                {"docs/research.md", "backend/README.md", "app/.env.example", "company/VENDORS.md"},
                (False, False),
            ),
        ]
        for paths, expected in examples:
            with self.subTest(paths=paths):
                actual = selector.select(paths, selector.OPERATOR_INPUTS | {"app/src/rocoto-theme.ts"})
                self.assertEqual(tuple(actual.values()), expected)

    def test_git_renames_deletes_and_actual_operator_imports(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)

            def git(*args):
                return (
                    subprocess.check_output(["git", "-C", str(root), *args], stderr=subprocess.DEVNULL)
                    .decode()
                    .strip()
                )

            def put(name, text):
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text)

            def commit():
                git("add", "-A")
                git("commit", "-qm", "fixture")
                return git("rev-parse", "HEAD")

            git("init", "-q")
            git("config", "user.email", "test@example.invalid")
            git("config", "user.name", "Fixture")
            put("app/operator.html", '<script src="/src/operator/main.tsx"></script>')
            put("app/src/operator/main.tsx", 'import { shared } from "../shared";')
            put("app/src/shared.ts", "export const shared = 1;")
            put("backend/old.py", "old")
            base = commit()
            put("app/src/shared.ts", "export const shared = 2;")
            shared = commit()
            self.assertEqual(
                selector.changed_targets(root, base, shared), {"development": True, "staging": True}
            )
            put("app/src/prototypes/cedar/main.tsx", "candidate")
            candidate = commit()
            self.assertEqual(
                selector.changed_targets(root, shared, candidate), {"development": True, "staging": False}
            )
            put("app/src/prototypes/maple/runtime.py", "old")
            (root / "backend/old.py").unlink()
            renamed = commit()
            self.assertEqual(
                selector.changed_targets(root, candidate, renamed), {"development": True, "staging": True}
            )
            put("app/src/operator/main.tsx", "// dependency removed")
            (root / "app/src/shared.ts").unlink()
            removed = commit()
            self.assertEqual(
                selector.changed_targets(root, renamed, removed), {"development": True, "staging": True}
            )
            with self.assertRaisesRegex(ValueError, "first baseline"):
                selector.changed_targets(root, "0" * 40, removed)
            with self.assertRaisesRegex(ValueError, "history"):
                selector.changed_targets(root, "f" * 40, removed)
            with self.assertRaisesRegex(ValueError, "ancestor"):
                selector.changed_targets(root, removed, base)


if __name__ == "__main__":
    unittest.main()
