import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { loadTypeScript } from './ts-module.mjs';

const records = new Map();
const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
globalThis.location = new URL('https://demo.soyrocoto.com/cedar/');
globalThis.localStorage = storage;
globalThis.window = Object.assign(new EventTarget(), { location, localStorage: storage, setTimeout, clearTimeout });
const api = loadTypeScript('src/prototypes/cedar/cedar-channel-api.ts', 'cedar-channel-api-test');
const key = 'rocoto-cedar-channel-access-v1:https://demo.soyrocoto.com';
const workspace = { workspace_id: 'a'.repeat(32), access_token: 'a'.repeat(64), expires_at: 4000000000 };
const turn = () => new Promise(resolve => setTimeout(resolve, 0));
beforeEach(() => { api.resetChannelWorkspace(); records.clear(); storage.setItem(key, JSON.stringify(workspace)); });

test('a workspace reset rejects a late JSON body and aborts the request', async () => {
  let finishBody, signal;
  globalThis.fetch = async (_, options) => {
    signal = options.signal;
    return { ok: true, json: () => new Promise(resolve => { finishBody = resolve; }) };
  };
  const pending = api.channelApi('/email/status');
  const rejected = assert.rejects(pending, error => error.status === 409);
  while (!finishBody) await turn();
  api.resetChannelWorkspace();
  assert.equal(signal.aborted, true);
  finishBody({ accounts: [{ label: 'Private old mailbox' }] });
  await rejected;
  assert.equal(records.has(key), false);
});

test('a different tab changing account access clears views and rejects an old download', async () => {
  let finishBlob, resetCount = 0;
  const reset = () => { resetCount++; };
  window.addEventListener('rocoto:channel-workspace-reset', reset);
  globalThis.fetch = async () => ({ ok: true, blob: () => new Promise(resolve => { finishBlob = resolve; }) });
  const pending = api.channelDownload('/documents/source/file');
  const rejected = assert.rejects(pending, error => error.status === 409);
  while (!finishBlob) await turn();
  const replacement = { ...workspace, workspace_id: 'b'.repeat(32), access_token: 'b'.repeat(64) };
  storage.setItem(key, JSON.stringify(replacement));
  const event = new Event('storage'); Object.defineProperty(event, 'key', { value: key }); window.dispatchEvent(event);
  finishBlob(new Blob(['old private document']));
  await rejected;
  assert.equal(resetCount, 1);
  assert.deepEqual(await api.channelWorkspace(), replacement);
  window.removeEventListener('rocoto:channel-workspace-reset', reset);
});

test('an expired server response preserves saved access and never allocates another account', async () => {
  let calls = 0;
  globalThis.fetch = async url => { calls++; assert.match(url, /email\/status$/); return new Response(JSON.stringify({ detail: 'Renew authorization' }), { status: 401 }); };
  await assert.rejects(api.channelApi('/email/status'), error => error.status === 401);
  assert.equal(calls, 1); assert.equal(JSON.parse(storage.getItem(key)).workspace_id, workspace.workspace_id);
});

test('a public runtime pin cannot carry the private access token to another origin', async () => {
  storage.setItem('rocoto-runtime-base', 'https://external.example');
  let requests = 0; globalThis.fetch = async () => { requests++; throw new Error('unexpected fetch'); };
  await assert.rejects(api.channelApi('/email/status'), error => error.status === 400);
  assert.equal(requests, 0);
  storage.removeItem('rocoto-runtime-base');
});
