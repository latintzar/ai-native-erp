"""Safety/lifecycle boundary checks; full backend proofs run through the company CLI."""

from __future__ import annotations

import copy
import io
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

import testdata_adapter as adapter


@pytest.fixture
def request_data(tmp_path):
    tmp_path.chmod(0o700)
    return {
        "protocol": 1,
        "operation": "create",
        "run_id": "unit-run",
        "environment": "development",
        "state_dir": str(tmp_path),
        "scenario": {"id": "harbor-v1"},
        "resources": {},
        "config": {"effects": "capture"},
    }


def reserve(request):
    directory, scenario = adapter.validate_request(request)
    return adapter.reserve(request, scenario, directory)


@pytest.mark.parametrize(
    "field,value",
    [
        ("environment", "production"),
        ("environment", "staging"),
        ("config", {"effects": "send"}),
        ("config", {"DATABASE_URL": "postgresql://elsewhere/live"}),
        ("run_id", "../foreign"),
        ("operation", "drop-all"),
        ("protocol", 2),
    ],
)
def test_refuses_uncommissioned_input_before_reserving(request_data, field, value):
    request_data[field] = value
    with pytest.raises(adapter.Refusal):
        adapter.validate_request(request_data)
    assert not (Path(request_data["state_dir"]) / adapter.OWNER_FILE).exists()


def test_scenario_accepts_only_reviewed_synthetic_dataset(request_data):
    fixture = adapter.scenario_for(request_data["scenario"])
    assert fixture["synthetic"] is True
    assert all(c["email"].endswith("@example.invalid") for c in fixture["customers"])
    assert all(c["phone"].startswith("+120255501") for c in fixture["customers"])
    modified = copy.deepcopy(fixture)
    modified["customers"][0]["phone"] = "+34600000000"
    with pytest.raises(adapter.Refusal):
        adapter.scenario_for(modified)


def test_private_ownership_journal_precedes_docker_and_recovers_without_receipt(request_data):
    owner = reserve(request_data)
    path = Path(request_data["state_dir"]) / adapter.OWNER_FILE
    assert path.stat().st_mode & 0o777 == 0o600
    assert adapter.read_private(path) == owner
    assert reserve(request_data) == owner
    public = adapter.resources_for(owner)
    assert all(secret not in json.dumps(public) for secret in owner["passwords"].values())
    request_data["operation"] = "delete"
    assert reserve(request_data) == owner


def test_refuses_copied_resource_receipt(request_data):
    owner = reserve(request_data)
    request_data["resources"] = {**adapter.resources_for(owner), "owner_id": "f" * 32}
    with pytest.raises(adapter.Refusal, match="receipt"):
        reserve(request_data)


def test_stored_scenario_corruption_is_refused(request_data):
    owner = reserve(request_data)
    owner["scenario"]["customers"][0]["phone"] = "+34600000000"
    adapter.write_private(Path(owner["state_dir"]) / adapter.OWNER_FILE, owner)
    with pytest.raises(adapter.Refusal, match="fingerprint"):
        reserve(request_data)


def test_refuses_moved_or_different_run_marker(request_data):
    reserve(request_data)
    request_data["run_id"] = "different-run"
    with pytest.raises(adapter.Refusal, match="journal"):
        reserve(request_data)


def test_refuses_symlink_and_shared_state_directory(request_data, tmp_path):
    tmp_path.chmod(0o755)
    with pytest.raises(adapter.Refusal, match="private"):
        adapter.validate_request(request_data)
    tmp_path.chmod(0o700)
    target = tmp_path / "actual"
    target.mkdir(mode=0o700)
    alias = tmp_path / "alias"
    alias.symlink_to(target)
    request_data["state_dir"] = str(alias)
    with pytest.raises(adapter.Refusal, match="symlink"):
        adapter.validate_request(request_data)


def test_cleanup_uses_stored_scenario_even_after_bundled_fixture_revision(request_data, monkeypatch):
    owner = reserve(request_data)
    monkeypatch.setattr(
        adapter, "scenario_for", lambda _: (_ for _ in ()).throw(AssertionError("current fixture read"))
    )
    request_data["operation"] = "delete"
    request_data["scenario"] = {}
    assert reserve(request_data) == owner


def inventory(owner):
    project = owner["project"]
    labels = {**adapter.labels_for(owner), "com.docker.compose.project": project}
    return {
        "container": [
            {
                "Id": "container-id",
                "Name": "/" + project + "-db-1",
                "Config": {"Labels": {**labels, "com.docker.compose.service": "db"}},
                "State": {"Running": True},
                "Mounts": [
                    {"Type": "volume", "Name": project + "_data", "Destination": "/var/lib/postgresql/data"}
                ],
                "NetworkSettings": {
                    "Networks": {project + "_default": {}},
                    "Ports": {"5432/tcp": [{"HostIp": "127.0.0.1", "HostPort": "54321"}]},
                },
            }
        ],
        "volume": [{"Name": project + "_data", "Labels": labels}],
        "network": [{"Id": "network-id", "Name": project + "_default", "Labels": labels}],
    }


def fake_docker(objects, calls):
    def run(*args, **kwargs):
        calls.append(args)
        kind, operation = args[:2]
        if operation == "ls":
            return "\n".join(item.get("Id", item["Name"]) for item in objects[kind])
        if operation == "inspect":
            return json.dumps(objects[kind])
        if operation == "rm":
            objects[kind].clear()
            return ""
        raise AssertionError(args)

    return run


@pytest.mark.parametrize("kind", ["container", "volume", "network"])
def test_delete_refuses_foreign_ownership_before_any_mutation(request_data, monkeypatch, kind):
    owner = reserve(request_data)
    objects = inventory(owner)
    labels = objects[kind][0]["Config"]["Labels"] if kind == "container" else objects[kind][0]["Labels"]
    labels[adapter.LABEL_PREFIX + "owner"] = "foreign-owner"
    cluster, calls = adapter.Cluster(owner), []
    monkeypatch.setattr(cluster, "docker", fake_docker(objects, calls))
    with pytest.raises(adapter.Refusal, match="labels"):
        cluster.delete()
    assert not any(call[1] == "rm" for call in calls)


def test_recovery_delete_uses_only_verified_resource_ids(request_data, monkeypatch):
    owner = reserve(request_data)
    objects, calls = inventory(owner), []
    cluster = adapter.Cluster(owner)
    monkeypatch.setattr(cluster, "docker", fake_docker(objects, calls))
    # A changed Compose template does not control deletion.
    (Path(owner["state_dir"]) / adapter.COMPOSE_FILE).write_text("tampered")
    result = cluster.delete()
    assert result == {"state": "deleted", "owned_resources_remaining": 0}
    assert [call for call in calls if call[1] == "rm"] == [
        ("container", "rm", "--force", "container-id"),
        ("volume", "rm", owner["project"] + "_data"),
        ("network", "rm", "network-id"),
    ]
    assert cluster.delete() == result


def test_same_named_volume_without_project_label_is_refused(request_data, monkeypatch):
    owner = reserve(request_data)
    objects, calls = inventory(owner), []
    objects["container"] = []
    objects["network"] = []
    objects["volume"][0]["Labels"] = {}
    cluster = adapter.Cluster(owner)
    ordinary = fake_docker(objects, calls)

    def docker(*args, **kwargs):
        if args[1] == "ls" and "label=com.docker.compose.project=" in args[-1]:
            return ""
        return ordinary(*args, **kwargs)

    monkeypatch.setattr(cluster, "docker", docker)
    with pytest.raises(adapter.Refusal, match="labels"):
        cluster.inspect_owned()


def test_refuses_replaced_container_and_public_port(request_data, monkeypatch):
    owner = reserve(request_data)
    objects = inventory(owner)
    owner["container_id"] = "original-container"
    cluster = adapter.Cluster(owner)
    monkeypatch.setattr(cluster, "docker", fake_docker(objects, []))
    with pytest.raises(adapter.Refusal, match="replaced"):
        cluster.port()
    owner["container_id"] = "container-id"
    objects["container"][0]["NetworkSettings"]["Ports"]["5432/tcp"][0]["HostIp"] = "0.0.0.0"
    with pytest.raises(adapter.Refusal, match="loopback"):
        cluster.port()


def test_protocol_failure_returns_one_json_and_redacts_ambient_secrets(request_data):
    request_data["environment"] = "production"
    secret = "test-never-emit-this-secret"
    env = {
        **os.environ,
        "DATABASE_URL": "postgresql://user:" + secret + "@elsewhere/production",
        "ANTHROPIC_API_KEY": secret,
    }
    result = subprocess.run(
        [sys.executable, str(adapter.BACKEND / "testdata_adapter.py")],
        input=json.dumps(request_data),
        text=True,
        capture_output=True,
        env=env,
    )
    assert result.returncode == 1
    assert len(result.stdout.splitlines()) == 1
    assert json.loads(result.stdout)["ok"] is False
    assert secret not in result.stdout + result.stderr


def test_delete_recovers_engine_interruption_before_adapter_reservation(request_data):
    request_data["operation"] = "delete"
    result = subprocess.run(
        [sys.executable, str(adapter.BACKEND / "testdata_adapter.py")],
        input=json.dumps(request_data),
        text=True,
        capture_output=True,
    )
    assert result.returncode == 0
    assert json.loads(result.stdout) == {
        "ok": True,
        "resources": {},
        "result": {"state": "deleted", "owned_resources_remaining": 0},
    }


def test_partial_startup_returns_recovery_identity_after_journaling(request_data, monkeypatch, capsys):
    monkeypatch.setattr(sys, "stdin", io.StringIO(json.dumps(request_data)))
    monkeypatch.setattr(
        adapter.Cluster, "inspect_owned", lambda _: {kind: [] for kind in ("container", "volume", "network")}
    )

    def fail_after_journal(cluster, *args, **kwargs):
        saved = adapter.read_private(Path(request_data["state_dir"]) / adapter.OWNER_FILE)
        assert saved["phase"] == "initializing"
        assert saved["project"] == cluster.project
        raise adapter.Refusal("simulated local startup interruption")

    monkeypatch.setattr(adapter.Cluster, "compose", fail_after_journal)
    assert adapter.main() == 1
    output = capsys.readouterr()
    response = json.loads(output.out)
    assert response["ok"] is False
    owner = reserve(request_data)
    assert response["resources"] == adapter.resources_for(owner)
    assert all(secret not in output.out + output.err for secret in owner["passwords"].values())


def test_backend_capture_environment_and_socket_boundary():
    # An isolated interpreter avoids changing the pytest process's product configuration.
    script = """
import os, socket
import testdata_adapter as adapter
calls = []
socket.socket.connect = lambda self, address: calls.append(("connect", address))
socket.socket.connect_ex = lambda self, address: calls.append(("connect_ex", address))
owner = {"tenant_slug": "synthetic_test", "passwords": {
    "owner": "local-owner", "runtime": "local-runtime", "control": "local-control"}}
adapter.isolate_backend_environment(owner, 54321)
assert "ANTHROPIC_API_KEY" not in os.environ
assert "AWS_SECRET_ACCESS_KEY" not in os.environ
assert "SUPABASE_SERVICE_ROLE_KEY" not in os.environ
assert os.environ["DATABASE_URL"] == "postgresql://testdata_owner:local-owner@127.0.0.1:54321/testdata"
assert os.environ["RUNTIME_DATABASE_URL"] == "postgresql://rocoto_rt:local-runtime@127.0.0.1:54321/testdata"
assert os.environ["CONTROL_DATABASE_URL"] == "postgresql://rocoto_ctrl:local-control@127.0.0.1:54321/testdata"
assert os.environ["ROCOTO_EGRESS_SANDBOX"] == "1"
assert os.environ["ROCOTO_REQUIRE_RLS"] == "true"
with socket.socket() as sock:
    for method in (sock.connect, sock.connect_ex):
        for address in (("example.com", 443), ("127.0.0.1", 54322), ("::1", 54321), "/tmp/provider.sock"):
            try:
                method(address)
            except adapter.Refusal:
                pass
            else:
                raise AssertionError("foreign connection reached the socket")
        method(("127.0.0.1", 54321))
assert calls == [("connect", ("127.0.0.1", 54321)), ("connect_ex", ("127.0.0.1", 54321))]
print("capture boundary proved")
"""
    env = {
        **os.environ,
        "DATABASE_URL": "postgresql://ambient:secret@production/live",
        "ANTHROPIC_API_KEY": "ambient-secret",
        "AWS_SECRET_ACCESS_KEY": "ambient-secret",
        "SUPABASE_SERVICE_ROLE_KEY": "ambient-secret",
    }
    result = subprocess.run(
        [sys.executable, "-c", script], cwd=adapter.BACKEND, env=env, text=True, capture_output=True
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout == "capture boundary proved\n"
    assert "ambient-secret" not in result.stdout + result.stderr
