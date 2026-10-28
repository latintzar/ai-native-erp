"""Gallery release behavior: preserved references, closed artifact boundary, recovery."""

import hashlib
import importlib.util
import io
import json
import pathlib
import sys
import tarfile
import tempfile
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[2]
KIT = ROOT / "deploy/kit"
sys.path.insert(0, str(KIT))
from package import ENTRIES, PROTECTED, package, validate_compatibility  # noqa: E402

spec = importlib.util.spec_from_file_location("kit_publisher_test", KIT / "publish.py")
assert spec is not None and spec.loader is not None
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)
sys.path.remove(str(KIT))


class GalleryPublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = pathlib.Path(self.temp.name)
        self.dist = self.base / "dist"
        self.live = self.base / "live"
        self.release = self.base / "release"
        self.dist.mkdir()
        self.live.mkdir()
        self.source = "a" * 40
        self.expected = {}
        for name in PROTECTED:
            path = self.live / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("preserved:" + name)
            self.expected[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        (self.dist / "index.html").write_text(
            '<title>Rocoto design system</title><script src="/assets/gallery.js"></script>'
        )
        (self.dist / "app.html").write_text(
            '<meta name="referrer" content="no-referrer">'
            '<meta http-equiv="refresh" content="0;url=https://demo.soyrocoto.com/cedar/">'
        )
        (self.dist / "kit-version.json").write_text(
            json.dumps({"surface": "rocoto-kit", "sourceCommit": self.source})
        )
        (self.dist / "assets").mkdir()
        (self.dist / "assets/gallery.js").write_text("gallery")
        (self.live / "assets").mkdir()
        (self.live / "assets/old-candidate.js").write_text("old reference")

    def prepare(self):
        package(self.dist, self.release, self.source, "main", self.expected)

    def test_gallery_publish_preserves_candidate_snapshot_and_other_entries(self):
        self.prepare()
        publisher.publish(self.release, self.live)
        self.assertEqual((self.live / "index.html").read_bytes(), (self.dist / "index.html").read_bytes())
        self.assertIn("https://demo.soyrocoto.com/cedar/", (self.live / "app.html").read_text())
        self.assertEqual((self.release / "previous/app.html").read_text(), "preserved:app.html")
        self.assertEqual((self.live / "assets/old-candidate.js").read_text(), "old reference")
        for name in PROTECTED:
            if name not in ENTRIES:
                self.assertEqual(publisher.sha(self.live / name), self.expected[name])

    def test_candidate_bundle_is_refused_as_gallery(self):
        (self.dist / "app.html").write_text('<script src="/assets/gallery.js"></script>')
        with self.assertRaisesRegex(ValueError, "compatibility"):
            self.prepare()

    def test_fault_during_entry_activation_restores_both_old_entries(self):
        self.prepare()
        original = publisher.atomic_copy

        def fail_once(source, target):
            if source == self.release / "staged/app.html":
                raise OSError("injected disk failure")
            return original(source, target)

        with (
            mock.patch.object(publisher, "atomic_copy", side_effect=fail_once),
            self.assertRaisesRegex(OSError, "injected"),
        ):
            publisher.publish(self.release, self.live)
        for name in PROTECTED:
            self.assertEqual(publisher.sha(self.live / name), self.expected[name])
        self.assertFalse((self.live / "kit-version.json").exists())
        self.assertFalse((self.live / ".kit-publication.json").exists())

    def test_unsafe_archive_stops_before_published_entries(self):
        self.prepare()
        with tarfile.open(self.release / "payload.tar.gz", "w:gz") as archive:
            item = tarfile.TarInfo("../escape")
            item.size = 1
            archive.addfile(item, io.BytesIO(b"x"))
        with self.assertRaisesRegex(ValueError, "archive member"):
            publisher.publish(self.release, self.live)
        self.assertEqual(publisher.sha(self.live / "index.html"), self.expected["index.html"])
        self.assertFalse((self.base / "escape").exists())

    def test_compatibility_keeps_old_origin_credentials_out_of_transition(self):
        source = (ROOT / "app/tools/build-kit.mjs").read_text()
        document = source.split("writeFileSync(resolve(out, 'app.html'), `", 1)[1].split("`);", 1)[0]
        validate_compatibility(document)
        self.assertNotIn("location.search", document)
        self.assertNotIn("location.hash", document)
        with self.assertRaisesRegex(ValueError, "compatibility"):
            validate_compatibility(
                document.replace(
                    "0;url=https://demo.soyrocoto.com/cedar/",
                    "0;url=https://demo.soyrocoto.com/cedar/?token=secret",
                )
            )
        with self.assertRaisesRegex(ValueError, "compatibility"):
            validate_compatibility(document.replace('content="no-referrer"', 'content="unsafe-url"'))

    def test_target_requires_named_development_receipt_and_matching_entry(self):
        target_spec = importlib.util.spec_from_file_location(
            "cedar_target_test", KIT / "verify-cedar-target.py"
        )
        target = importlib.util.module_from_spec(target_spec)
        target_spec.loader.exec_module(target)
        base = "https://demo.soyrocoto.com/cedar/"
        body = b"named Cedar entry"
        valid = {
            "surface": "cedar",
            "environment": "development",
            "sourceCommit": "a" * 40,
            "entrySha256": hashlib.sha256(body).hexdigest(),
        }
        for override, error in [
            ({}, None),
            ({"environment": "staging"}, "development"),
            ({"surface": "rocoto-kit"}, "development"),
            ({"entrySha256": "b" * 64}, "differs"),
        ]:
            record = {**valid, **override}

            def fetch(url, timeout, record=record):
                self.assertEqual(timeout, 20)
                self.assertIn(url, [base, base + "prototype.json"])
                return io.BytesIO(json.dumps(record).encode() if url.endswith("prototype.json") else body)

            with mock.patch.object(target.urllib.request, "urlopen", side_effect=fetch):
                if error:
                    with self.assertRaisesRegex(ValueError, error):
                        target.verify()
                else:
                    target.verify()
        with (
            mock.patch.object(target.urllib.request, "urlopen", side_effect=OSError("destination absent")),
            self.assertRaisesRegex(OSError, "destination absent"),
        ):
            target.verify()

    def test_journal_and_backup_directories_sync_before_entry_replacement(self):
        self.prepare()
        events = []
        copy = publisher.atomic_copy
        sync = publisher.sync_directory
        write = publisher.atomic_json

        def copied(source, target):
            copy(source, target)
            events.append(("copy", str(target)))

        def synced(path):
            sync(path)
            events.append(("sync", str(path)))

        def journaled(path, value):
            write(path, value)
            events.append(("json", str(path)))

        with (
            mock.patch.object(publisher, "atomic_copy", side_effect=copied),
            mock.patch.object(publisher, "sync_directory", side_effect=synced),
            mock.patch.object(publisher, "atomic_json", side_effect=journaled),
        ):
            publisher.publish(self.release, self.live)
        first_entry = events.index(("copy", str(self.live / "index.html")))
        ready = events.index(("json", str(self.live / ".kit-publication.json")))
        self.assertLess(ready, first_entry)
        self.assertIn(("sync", str(self.release / "previous")), events[:ready])
        self.assertIn(("sync", str(self.release.parent)), events[:ready])
        self.assertIn(("sync", str(self.live)), events[:ready])
        self.assertEqual(events[-1], ("sync", str(self.live)))

    def test_missing_gallery_entry_asset_is_refused(self):
        (self.dist / "assets/gallery.js").unlink()
        with self.assertRaisesRegex(ValueError, "referenced asset"):
            self.prepare()

    def test_resource_collision_stops_before_entries_change(self):
        (self.live / "assets/gallery.js").write_text("existing unrelated bytes")
        self.prepare()
        with self.assertRaisesRegex(ValueError, "resource differs"):
            publisher.publish(self.release, self.live)
        self.assertEqual(publisher.sha(self.live / "index.html"), self.expected["index.html"])

    def test_interrupted_activation_requires_and_supports_recovery(self):
        self.prepare()
        # Emulate process death after entry write: no exception handler runs in a killed process.
        original = publisher.atomic_copy

        def stop(source, target):
            if source == self.release / "staged/app.html":
                raise OSError("process died")
            return original(source, target)

        with (
            mock.patch.object(publisher, "atomic_copy", side_effect=stop),
            mock.patch.object(publisher, "recover"),
            self.assertRaises(OSError),
        ):
            publisher.publish(self.release, self.live)
        with self.assertRaisesRegex(RuntimeError, "incomplete"):
            publisher.publish(self.release, self.live)
        publisher.recover(self.release, self.live)
        for name in PROTECTED:
            self.assertEqual(publisher.sha(self.live / name), self.expected[name])


if __name__ == "__main__":
    unittest.main()
