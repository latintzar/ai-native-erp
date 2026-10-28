"""Promotion verifies exact staged bytes and measured scoped processing evidence."""

from __future__ import annotations

import copy
import datetime as dt
import hashlib
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("staging_proof", ROOT / "deploy/product/staging-proof.py")
assert spec and spec.loader
proof_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof_module)


def seal(output):
    return {
        "output": output,
        "sha256": hashlib.sha256(
            json.dumps(output, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest(),
        "record": "https://github.com/Rocoto-Labs/rocoto/issues/123#issuecomment-1",
    }


class StagingProof(unittest.TestCase):
    def setUp(self):
        self.now = dt.datetime(2026, 9, 9, tzinfo=dt.timezone.utc)
        self.metadata = {
            "commit": "a" * 40,
            "files": {"backend/app.py": "b" * 64, "backend/operator-ui/operator.html": "c" * 64},
        }
        digest = proof_module.product_digest(self.metadata["files"])
        self.health = {
            "ok": True,
            "release_commit": self.metadata["commit"],
            "release_product_sha256": digest,
        }
        identity = {
            "source_commit": self.metadata["commit"],
            "environment": "staging",
            "tenant_id": "synthetic-proof",
        }
        self.proof = {
            "schema": 1,
            "environment": "staging",
            "source_commit": self.metadata["commit"],
            "product_sha256": digest,
            "staging_origin": proof_module.ORIGIN,
            "verified_at": self.now.isoformat(),
            "evidence": {
                "authentication": seal(
                    identity
                    | {
                        "http_status": 200,
                        "identity_provider": "supabase",
                        "subject_id": "subject",
                        "session_subject_id": "subject",
                    }
                ),
                "worker": seal(
                    identity
                    | {
                        "status": "completed",
                        "job_id": "job",
                        "processed_objects": 3,
                        "effect_mode": "capture",
                    }
                ),
                "effects": seal(
                    identity
                    | {"job_id": "job", "attempted_count": 2, "captured_count": 2, "provider_deliveries": 0}
                ),
            },
        }

    def validate(self):
        return proof_module.validate(self.metadata, self.health, self.proof, self.now)

    def test_exact_product_proof_passes_and_demo_bytes_do_not_define_product(self):
        self.assertTrue(self.validate()["ok"])
        extra = self.metadata["files"] | {"demo/index.html": "d" * 64, "mock-api/app/main.py": "e" * 64}
        self.assertEqual(proof_module.product_digest(extra), self.proof["product_sha256"])

    def test_source_artifact_identity_and_stale_evidence_refuse(self):
        for field, bad in (("release_commit", "f" * 40), ("release_product_sha256", "f" * 64), ("ok", False)):
            with self.subTest(field=field):
                original = self.health[field]
                self.health[field] = bad
                with self.assertRaises(ValueError):
                    self.validate()
                self.health[field] = original
        for stamp in (self.now - dt.timedelta(days=8), self.now + dt.timedelta(seconds=1)):
            self.proof["verified_at"] = stamp.isoformat()
            with self.assertRaises(ValueError):
                self.validate()

    def test_tampered_output_and_bare_success_refuse(self):
        self.proof["evidence"]["worker"]["output"]["processed_objects"] = 9000
        with self.assertRaises(ValueError):
            self.validate()
        self.proof["evidence"] = {"ok": True}
        with self.assertRaises(ValueError):
            self.validate()

    def test_consistent_scope_and_complete_captured_effect_audit_required(self):
        original = copy.deepcopy(self.proof)
        for area, field, bad in (
            ("authentication", "session_subject_id", "other"),
            ("worker", "tenant_id", "other"),
            ("worker", "effect_mode", "enabled"),
            ("worker", "processed_objects", True),
            ("effects", "captured_count", 1),
            ("effects", "provider_deliveries", 1),
            ("effects", "job_id", "other"),
            ("effects", "attempted_count", 0),
        ):
            with self.subTest(area=area, field=field):
                self.proof = copy.deepcopy(original)
                output = self.proof["evidence"][area]["output"]
                output[field] = bad
                self.proof["evidence"][area] = seal(output)
                with self.assertRaises(ValueError):
                    self.validate()


if __name__ == "__main__":
    unittest.main()
