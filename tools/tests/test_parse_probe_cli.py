"""The provider probe is a local, explicitly configured command."""
import os
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROBE = ROOT / 'tools/parse-floor-probe.py'


class ParseProbeCommandTests(unittest.TestCase):
    def invoke(self, *args):
        return subprocess.run([sys.executable, "-S", str(PROBE), *args], cwd=ROOT,
                              env={'PATH': os.environ.get('PATH', '/usr/bin:/bin')},
                              capture_output=True, text=True, timeout=15)

    def test_help_works_without_credentials_or_host_files(self):
        result = self.invoke('--help')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('--fixture', result.stdout)

    def test_fixture_is_explicit(self):
        result = self.invoke()
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn('--fixture', result.stderr)

    def test_provider_key_must_be_supplied_by_the_caller(self):
        result = self.invoke('--fixture', 'mock-api/tests/fixtures/albaran-fixture.png')
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn('PARSEWISE_API_KEY', result.stderr)
        self.assertNotIn('/srv/', result.stderr)
