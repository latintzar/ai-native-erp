"""The environment is explicit configuration, with production flags agreeing at import."""

import os
import subprocess
import sys
from pathlib import Path

import pytest


@pytest.mark.parametrize(
    "environment,prod,expected",
    [
        ("", "false", "development"),
        ("", "true", "production"),
        ("staging", "false", "staging"),
        ("production", "true", "production"),
        ("staging", "true", None),
        ("production", "false", None),
        ("typo", "false", None),
    ],
)
def test_environment_selection(environment, prod, expected):
    env = {**os.environ, "ROCOTO_ENVIRONMENT": environment, "IS_PROD": prod}
    result = subprocess.run(
        [sys.executable, "-c", "import config; print(config.ENVIRONMENT)"],
        cwd=Path(__file__).resolve().parents[1],
        env=env,
        text=True,
        capture_output=True,
    )
    if expected:
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == expected
    else:
        assert result.returncode != 0
        assert "ROCOTO_ENVIRONMENT" in result.stderr
