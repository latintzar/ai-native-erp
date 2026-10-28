"""The direct authorization probe uses synthetic exchanges and leaves account records alone."""
import asyncio
import json
import logging
import sqlite3
from dataclasses import replace
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import connection_probe as probe
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from service import Config, Graph, GraphError, create_app

ORIGIN = 'https://cedar-demo.soyrocoto.com'
START = '/api/proof/whatsapp/redirect/start'


def config_at(tmp_path):
    return Config(app_id='123', app_secret='synthetic-app-secret', config_id='456',
        public_origin=ORIGIN, verify_token='synthetic-verify-token',
        encryption_key=Fernet.generate_key().decode(), state_dir=str(tmp_path / 'private'))


def test_start_opens_configured_meta_dialog_with_fixed_same_window_return(tmp_path):
    config = config_at(tmp_path)
    client = TestClient(create_app(config), base_url=ORIGIN, headers={'Origin': ORIGIN})
    response = client.get(START, follow_redirects=False)
    assert response.status_code == 303
    url = urlsplit(response.headers['location'])
    query = parse_qs(url.query)
    assert url.netloc == 'www.facebook.com'
    assert url.path == '/v26.0/dialog/oauth'
    assert query['client_id'] == ['123']
    assert query['config_id'] == ['456']
    assert query['response_type'] == ['code']
    assert query['redirect_uri'] == ['https://demo.soyrocoto.com/']
    assert json.loads(query['extras'][0])['featureType'] == 'whatsapp_business_app_onboarding'
    assert query['state'][0].startswith('bodega-direct-')


COMPLETE = '/api/proof/whatsapp/redirect/complete'
RESULT = '/api/proof/whatsapp/redirect/result'
RESTART = '/api/proof/whatsapp/redirect/restart'
RESULT_URL = 'https://demo.soyrocoto.com/bodega-pay-later/?connection-test=direct&returned=1'


class FakeGraph:
    def __init__(self, error=None):
        self.calls = []
        self.error = error

    async def exchange(self, code, redirect_uri=None):
        self.calls.append((code, redirect_uri))
        if self.error:
            raise self.error
        return 'secret-provider-access-token'


def setup(tmp_path, graph=None):
    config = config_at(tmp_path)
    graph = graph or FakeGraph()
    app = create_app(config, graph)
    client = TestClient(app, base_url=ORIGIN, headers={'Origin': ORIGIN})
    return config, graph, app, client


def launch(client):
    response = client.get(START, follow_redirects=False)
    assert response.status_code == 303
    state = parse_qs(urlsplit(response.headers['location']).query)['state'][0]
    return state, response


def test_attempt_cookie_is_independent_secure_httponly_lax(tmp_path):
    _, _, _, client = setup(tmp_path)
    _, response = launch(client)
    cookie = response.headers['set-cookie']
    assert cookie.startswith(probe.COOKIE + '=')
    assert 'HttpOnly' in cookie and 'Secure' in cookie and 'SameSite=lax' in cookie
    assert 'Path=/' in cookie and 'Max-Age=86400' in cookie
    assert 'Domain=' not in cookie
    assert '__Host-cedar_session' not in response.headers.get('set-cookie', '')


@pytest.mark.parametrize('headers', [{}, {'Origin': 'https://elsewhere.example'}])
def test_internal_start_requires_existing_provider_origin(tmp_path, headers):
    config = config_at(tmp_path)
    client = TestClient(create_app(config), base_url=ORIGIN)
    assert client.get(START, headers=headers).status_code == 403


def test_callback_requires_state_and_its_original_cookie(tmp_path):
    config, graph, app, client = setup(tmp_path)
    state, _ = launch(client)
    other = TestClient(app, base_url=ORIGIN, headers={'Origin': ORIGIN})
    assert other.post(COMPLETE, json={'state': state, 'code': 'secret-code'}).status_code == 403
    other_state, _ = launch(other)
    assert client.post(COMPLETE, json={'state': other_state, 'code': 'secret-code'}).status_code == 403
    assert not graph.calls
    assert client.get(RESULT).json()['status'] == 'pending'


def test_expired_attempt_cannot_exchange_a_code(tmp_path, monkeypatch):
    _, graph, _, client = setup(tmp_path)
    state, _ = launch(client)
    cookie = client.cookies.get(probe.COOKIE)
    later = probe.time.time() + probe.TTL + 1
    monkeypatch.setattr(probe.time, 'time', lambda: later)
    assert client.post(COMPLETE, json={'state': state, 'code': 'secret-code'},
                       headers={'Cookie': f'{probe.COOKIE}={cookie}'}).status_code == 410
    assert client.get(RESULT).json()['status'] == 'expired'
    assert not graph.calls


def test_exchange_uses_exact_registered_return_discards_token_and_replay_is_idempotent(tmp_path, caplog):
    config, graph, app, client = setup(tmp_path)
    account = app.state.store
    account.bind({'wabaId': '101', 'phoneId': '202', 'number': '15550000001',
                  'name': 'Synthetic shop', 'coexistence': True}, 'original-account-token', True)
    with account.db() as db:
        before = db.execute('SELECT key,body FROM kv ORDER BY key').fetchall()
        before = [(row[0], bytes(row[1])) for row in before]
    with caplog.at_level(logging.INFO, logger='uvicorn.error'):
        state, _ = launch(client)
        response = client.post(COMPLETE, json={'state': state, 'code': 'secret-one-use-code'})
        assert response.status_code == 200 and response.json() == {'ok': True}
        assert client.post(COMPLETE, json={'state': state, 'code': 'different-code'}).json() == {'ok': True}
    assert graph.calls == [('secret-one-use-code', 'https://demo.soyrocoto.com/')]
    result = client.get(RESULT).json()
    assert result['status'] == 'authorized'
    assert set(result) == {'status', 'runId'}
    with account.db() as db:
        after = [(row[0], bytes(row[1])) for row in db.execute('SELECT key,body FROM kv ORDER BY key')]
    assert after == before
    database = (Path(config.state_dir) / 'connection-probe.sqlite3').read_bytes()
    private_values = [
        'secret-one-use-code', 'secret-provider-access-token', state, client.cookies.get(probe.COOKIE),
    ]
    for private in private_values:
        assert private not in caplog.text
        assert private.encode() not in database
    assert 'code_exchanged' in caplog.text
    assert account.get('token') == 'original-account-token'


def test_result_survives_service_restart(tmp_path):
    config, graph, _, client = setup(tmp_path)
    state, _ = launch(client)
    client.post(COMPLETE, json={'state': state, 'code': 'code'})
    cookie = client.cookies.get(probe.COOKIE)
    restarted = TestClient(create_app(config, FakeGraph()), base_url=ORIGIN,
                           headers={'Origin': ORIGIN, 'Cookie': f'{probe.COOKIE}={cookie}'})
    assert restarted.get(RESULT).json()['status'] == 'authorized'


@pytest.mark.parametrize('error, expected_code', [
    (GraphError('190'), '190'),
    (RuntimeError('private-token-in-provider-failure'), None),
    (GraphError('private-token-in-provider-failure'), None),
])
def test_provider_failure_is_sanitized_and_saved_without_reexchange(tmp_path, caplog, error, expected_code):
    graph = FakeGraph(error)
    _, _, _, client = setup(tmp_path, graph)
    with caplog.at_level(logging.INFO, logger='uvicorn.error'):
        state, _ = launch(client)
        assert client.post(COMPLETE, json={'state': state, 'code': 'private-code'}).json() == {'ok': True}
        assert client.post(COMPLETE, json={'state': state, 'code': 'private-code'}).json() == {'ok': True}
    result = client.get(RESULT).json()
    assert result['status'] == 'failed'
    assert result.get('providerCode') == expected_code
    assert 'private-token-in-provider-failure' not in caplog.text + json.dumps(result)
    assert 'private-code' not in caplog.text + json.dumps(result)
    assert len(graph.calls) == 1


def test_cancelled_attempt_skips_exchange_and_returns_only_status(tmp_path):
    _, graph, _, client = setup(tmp_path)
    state, _ = launch(client)
    assert client.post(COMPLETE, json={'state': state, 'cancelled': True}).json() == {'ok': True}
    assert client.get(RESULT).json()['status'] == 'cancelled'
    assert not graph.calls


def test_start_limits_are_global_and_persisted_across_restarts(tmp_path, monkeypatch):
    monkeypatch.setattr(probe, 'STARTS_PER_MINUTE', 1)
    config, _, _, client = setup(tmp_path)
    launch(client)
    other = TestClient(create_app(config), base_url=ORIGIN, headers={'Origin': ORIGIN})
    assert other.get(START, follow_redirects=False).status_code == 429


def test_expired_rows_are_pruned_before_starting_again(tmp_path, monkeypatch):
    config, _, _, client = setup(tmp_path)
    launch(client)
    later = probe.time.time() + 3601
    monkeypatch.setattr(probe.time, 'time', lambda: later)
    response = client.post(RESTART, follow_redirects=False)
    assert response.status_code == 303
    with sqlite3.connect(Path(config.state_dir) / 'connection-probe.sqlite3') as db:
        assert db.execute('SELECT COUNT(*) FROM attempts').fetchone()[0] == 1


def test_reopening_keeps_original_url_cookie_run_and_deadline(tmp_path, monkeypatch):
    config, _, _, client = setup(tmp_path)
    _, first = launch(client)
    cookie = client.cookies.get(probe.COOKIE)
    run_id = client.get(RESULT).json()['runId']
    with sqlite3.connect(Path(config.state_dir) / 'connection-probe.sqlite3') as db:
        deadline = db.execute('SELECT expires FROM attempts').fetchone()[0]
    later = probe.time.time() + 100
    monkeypatch.setattr(probe.time, 'time', lambda: later)
    monkeypatch.setattr(probe, 'STARTS_PER_MINUTE', 0)
    again = client.get(START, follow_redirects=False)
    assert again.status_code == 303
    assert again.headers['location'] == first.headers['location']
    assert 'set-cookie' not in again.headers
    assert client.cookies.get(probe.COOKIE) == cookie
    assert client.get(RESULT).json()['runId'] == run_id
    with sqlite3.connect(Path(config.state_dir) / 'connection-probe.sqlite3') as db:
        assert db.execute('SELECT expires FROM attempts').fetchall() == [(deadline,)]


def test_original_url_survives_service_restart_and_configuration_changes(tmp_path):
    config, _, _, client = setup(tmp_path)
    state, first = launch(client)
    cookie = client.cookies.get(probe.COOKIE)
    changed = replace(config, app_id='987', config_id='654', graph_version='v25.0')
    restarted = TestClient(create_app(changed, FakeGraph()), base_url=ORIGIN,
                           headers={'Origin': ORIGIN, 'Cookie': f'{probe.COOKIE}={cookie}'})
    resumed = restarted.get(START, follow_redirects=False)
    assert resumed.headers['location'] == first.headers['location']
    database = (Path(config.state_dir) / 'connection-probe.sqlite3').read_bytes()
    assert state.encode() not in database
    assert first.headers['location'].encode() not in database
    assert cookie.encode() not in database


def test_reopening_logs_only_original_run_and_resume_event(tmp_path, caplog):
    _, _, _, client = setup(tmp_path)
    with caplog.at_level(logging.INFO, logger='uvicorn.error'):
        state, first = launch(client)
        run_id = client.get(RESULT).json()['runId']
        client.get(START, follow_redirects=False)
        client.post(COMPLETE, json={'state': state, 'cancelled': True})
        client.get(START, follow_redirects=False)
    events = [json.loads(record.message) for record in caplog.records
              if record.name == 'uvicorn.error' and 'bodega_connection_probe' in record.message]
    assert [event['event'] for event in events] == ['start', 'resume_requested', 'callback',
                                                  'cancelled', 'resume_requested']
    assert {event['runId'] for event in events} == {run_id}
    assert state not in caplog.text
    assert client.cookies.get(probe.COOKIE) not in caplog.text
    assert first.headers['location'] not in caplog.text


def test_damaged_saved_url_returns_expired_presentation_without_replacing_attempt(tmp_path):
    config, graph, _, client = setup(tmp_path)
    state, _ = launch(client)
    with sqlite3.connect(Path(config.state_dir) / 'connection-probe.sqlite3') as db:
        db.execute('UPDATE attempts SET launch_url=?', (b'damaged-ciphertext',))
    response = client.get(START, follow_redirects=False)
    assert response.headers['location'] == RESULT_URL
    assert client.get(RESULT).json()['status'] == 'expired'
    assert client.post(COMPLETE, json={'state': state, 'code': 'original-code'}).status_code == 200
    assert graph.calls == [('original-code', probe.REDIRECT_URI)]


@pytest.mark.parametrize('outcome', ['expired', 'unknown', 'authorized', 'cancelled', 'processing'])
def test_existing_attempt_requires_result_or_explicit_restart(tmp_path, monkeypatch, outcome):
    config, graph, _, client = setup(tmp_path)
    state, first = launch(client)
    cookie = client.cookies.get(probe.COOKIE)
    if outcome in ('authorized', 'cancelled'):
        payload = ({'state': state, 'code': 'one-use-code'} if outcome == 'authorized'
                   else {'state': state, 'cancelled': True})
        assert client.post(COMPLETE, json=payload).status_code == 200
    elif outcome == 'processing':
        with sqlite3.connect(Path(config.state_dir) / 'connection-probe.sqlite3') as db:
            db.execute('UPDATE attempts SET claimed=1')
    elif outcome == 'expired':
        later = probe.time.time() + probe.TTL + 1
        monkeypatch.setattr(probe.time, 'time', lambda: later)
    else:
        with sqlite3.connect(Path(config.state_dir) / 'connection-probe.sqlite3') as db:
            db.execute('DELETE FROM attempts')
    response = client.get(START, follow_redirects=False)
    assert response.status_code == 303
    assert response.headers['location'] == RESULT_URL
    assert 'set-cookie' not in response.headers
    assert client.cookies.get(probe.COOKIE) == cookie
    assert client.get(RESULT).json()['status'] == ('expired' if outcome == 'unknown' else outcome)
    with sqlite3.connect(Path(config.state_dir) / 'connection-probe.sqlite3') as db:
        assert db.execute('SELECT COUNT(*) FROM attempts').fetchone()[0] == (0 if outcome == 'unknown' else 1)
    assert len(graph.calls) == (1 if outcome == 'authorized' else 0)
    restarted = client.post(RESTART, follow_redirects=False)
    assert restarted.status_code == 303
    assert restarted.headers['location'] != first.headers['location']
    assert client.cookies.get(probe.COOKIE) != cookie
    assert client.get(RESULT).json()['status'] == 'pending'


@pytest.mark.parametrize('headers', [{}, {'Origin': 'https://elsewhere.example'}])
def test_restart_requires_same_origin_post(tmp_path, headers):
    config = config_at(tmp_path)
    client = TestClient(create_app(config), base_url=ORIGIN)
    assert client.post(RESTART, headers=headers, follow_redirects=False).status_code == 403
    assert client.get(RESTART, headers={'Origin': ORIGIN}, follow_redirects=False).status_code == 405
    with sqlite3.connect(Path(config.state_dir) / 'connection-probe.sqlite3') as db:
        assert db.execute('SELECT COUNT(*) FROM attempts').fetchone()[0] == 0


def test_legacy_attempt_migration_preserves_callback_but_requires_explicit_restart(tmp_path):
    config, graph, _, client = setup(tmp_path)
    state, _ = launch(client)
    cookie = client.cookies.get(probe.COOKIE)
    database = Path(config.state_dir) / 'connection-probe.sqlite3'
    with sqlite3.connect(database) as db:
        db.execute('ALTER TABLE attempts DROP COLUMN launch_url')
    restarted = TestClient(create_app(config, graph), base_url=ORIGIN,
                           headers={'Origin': ORIGIN, 'Cookie': f'{probe.COOKIE}={cookie}'})
    response = restarted.get(START, follow_redirects=False)
    assert response.headers['location'] == RESULT_URL
    assert restarted.get(RESULT).json()['status'] == 'expired'
    assert restarted.post(COMPLETE, json={'state': state, 'code': 'legacy-code'}).status_code == 200
    assert graph.calls == [('legacy-code', probe.REDIRECT_URI)]
    assert restarted.get(RESULT).json()['status'] == 'authorized'


@pytest.mark.parametrize('body', [
    {'state': 'private-state', 'code': 'private-code'},
    {'state': 'bodega-direct-' + 'a' * 43, 'code': 'private-code', 'access_token': 'private-token'},
    {'state': 'bodega-direct-' + 'a' * 43, 'code': 'private-code', 'cancelled': True},
])
def test_invalid_callback_fields_are_refused_without_echo(tmp_path, body, caplog):
    _, graph, _, client = setup(tmp_path)
    response = client.post(COMPLETE, json=body)
    assert response.status_code == 422
    assert 'private-' not in response.text + caplog.text
    assert not graph.calls


def test_chunked_callback_body_is_bounded(tmp_path):
    _, graph, _, client = setup(tmp_path)
    def chunks():
        yield b' ' * probe.MAX_BODY
        yield b'x'
    assert client.post(COMPLETE, content=chunks()).status_code == 413
    assert not graph.calls


def test_probe_routes_are_exclusive_to_commissioned_development_service(tmp_path):
    config = replace(config_at(tmp_path), public_origin='https://api.soyrocoto.com')
    client = TestClient(create_app(config), base_url=config.public_origin,
                        headers={'Origin': config.public_origin})
    assert client.get(START, follow_redirects=False).status_code == 404


def test_graph_exchange_option_preserves_existing_sdk_protocol(tmp_path):
    graph = Graph(config_at(tmp_path))
    calls = []
    async def request(*args, **kwargs):
        calls.append(kwargs['params'])
        return {'access_token': 'synthetic-token'}
    graph.request = request
    asyncio.run(graph.exchange('first'))
    asyncio.run(graph.exchange('second', redirect_uri=probe.REDIRECT_URI))
    assert 'redirect_uri' not in calls[0]
    assert calls[1]['redirect_uri'] == probe.REDIRECT_URI


def test_unconfigured_service_creates_no_probe_files(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    config = replace(config_at(tmp_path), state_dir='')
    client = TestClient(create_app(config), base_url=ORIGIN, headers={'Origin': ORIGIN})
    assert client.get(START, follow_redirects=False).status_code == 404
    assert list(tmp_path.iterdir()) == []
