import assert from 'node:assert/strict';

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8787';
const roomId = crypto.randomUUID();
const hostKey = `${crypto.randomUUID()}${crypto.randomUUID()}`;
const mcKey = `${crypto.randomUUID()}${crypto.randomUUID()}`;
const wrongKey = `${crypto.randomUUID()}${crypto.randomUUID()}`;
const path = `${base}/rooms/${roomId}`;
const request = async (action, method = 'GET', key = '', body) => {
  const response = await fetch(`${path}${action}`, {
    method,
    headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
};
const snapshot = (changes = {}) => ({
  version: 2, title: 'Integration draw', subtitle: '', theme: 'Event Night', backgroundImage: '',
  logo: null, winnersHistory: [], operationMode: 'standard', lastAssignmentResult: null,
  drawMode: 'numbers', maxDigits: 2,
  live: { drawing: false, charging: false, chargeProgress: 0, currentPrize: 'First', displayValue: '00',
    lockedDigitCount: 0, lockedDigits: '', grandFinalePhase: 'idle', celebrationIndex: 0,
    celebrationPlaying: true, showConfetti: false, remoteControlReady: true, completedPrizeCount: 0,
    prizeCount: 2, totalEntries: 10, remainingEntriesCount: 10, ...changes },
  updatedAt: new Date().toISOString(),
});
const clients = [];
async function connect() {
  const socket = new WebSocket(path.replace(/^http/, 'ws') + '/socket');
  const queue = [];
  const listeners = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const index = listeners.findIndex((item) => item.type === message.type);
    if (index >= 0) listeners.splice(index, 1)[0].resolve(message);
    else queue.push(message);
  });
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const client = {
    socket,
    send: (message) => socket.send(JSON.stringify(message)),
    next: (type) => {
      const index = queue.findIndex((message) => message.type === type);
      if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
      return Promise.race([
        new Promise((resolve) => listeners.push({ type, resolve })),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 5000)),
      ]);
    },
  };
  clients.push(client);
  await client.next('state');
  return client;
}

try {
  const createdAt = Date.now();
  const creation = await request('', 'POST', '', { hostKey });
  assert.equal(creation.status, 201);
  assert.ok(creation.body.expiresAt >= createdAt + 7 * 24 * 60 * 60 * 1000);
  assert.ok(creation.body.expiresAt <= Date.now() + 7 * 24 * 60 * 60 * 1000);
  assert.equal((await request('', 'POST', '', { hostKey })).status, 409);
  assert.equal((await request('/mc', 'PUT', wrongKey, { mcKey })).status, 403);
  assert.equal((await request('/mc', 'PUT', hostKey, { mcKey })).status, 200);

  const audience = await connect();
  const host = await connect();
  audience.send({ type: 'publish', baseRevision: 0, snapshot: snapshot() });
  assert.equal((await audience.next('error')).message, 'Read only.');
  host.send({ type: 'auth', key: hostKey });
  assert.equal((await host.next('authorized')).revision, 0);
  host.send({ type: 'publish', baseRevision: 0, snapshot: snapshot() });
  assert.equal((await host.next('published')).revision, 1);
  let audienceState;
  do { audienceState = await audience.next('state'); } while (audienceState.revision < 1);
  assert.equal(audienceState.snapshot.title, 'Integration draw');
  assert.equal(audienceState.hostOnline, true);
  assert.equal((await request('/snapshot')).body.revision, 1);

  const commandId = crypto.randomUUID();
  assert.equal((await request('/request', 'POST', wrongKey, { commandId, revision: 1 })).status, 403);
  assert.equal((await request('/request', 'POST', mcKey, { commandId, revision: 0 })).body.accepted, false);
  assert.equal((await request('/request', 'POST', mcKey, { commandId, revision: 1 })).body.accepted, true);
  assert.equal((await host.next('draw-request')).commandId, commandId);
  assert.equal((await request('/request', 'POST', mcKey, { commandId, revision: 1 })).body.accepted, false);
  assert.equal((await request('/request', 'POST', mcKey, { commandId: crypto.randomUUID(), revision: 1 })).body.accepted, false);
  host.send({ type: 'publish', baseRevision: 1, snapshot: snapshot({ drawing: true, lockedDigitCount: 1, lockedDigits: '4', displayValue: '42' }) });
  assert.equal((await host.next('published')).revision, 2);
  assert.equal((await request('/request', 'POST', mcKey, { commandId: crypto.randomUUID(), revision: 2 })).body.accepted, false);
  host.send({ type: 'publish', baseRevision: 1, snapshot: snapshot() });
  assert.equal((await host.next('stale')).revision, 2);
  host.send({ type: 'publish', baseRevision: 2, snapshot: snapshot({ drawing: true, lockedDigitCount: 1, lockedDigits: '9', displayValue: '92' }) });
  assert.equal((await host.next('error')).message, 'Locked digits cannot change.');

  host.socket.close();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal((await request('/snapshot')).body.hostOnline, false);
  const reconnect = await connect();
  reconnect.send({ type: 'auth', key: hostKey });
  assert.equal((await reconnect.next('authorized')).revision, 2);
  assert.equal((await request('/snapshot')).body.hostOnline, true);
  assert.equal((await request('/close', 'POST', hostKey)).status, 200);
  assert.equal((await request('/snapshot')).status, 410);
  assert.equal((await audience.next('closed')).type, 'closed');
  if (base.includes('127.0.0.1') || base.includes('localhost')) {
    const expiringId = crypto.randomUUID();
    const expiringPath = `${base}/rooms/${expiringId}`;
    const expiringCreate = await fetch(expiringPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hostKey }) });
    assert.equal(expiringCreate.status, 201);
    const explorer = `${base}/cdn-cgi/local/explorer/api`;
    const namespaces = await (await fetch(`${explorer}/workers/durable_objects/namespaces`)).json();
    const namespace = namespaces.result.find((item) => item.class === 'DrawRoom');
    assert.ok(namespace);
    const query = await fetch(`${explorer}/workers/durable_objects/namespaces/${namespace.id}/query`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durable_object_name: expiringId, queries: [{ sql: 'UPDATE room SET expires_at = ? WHERE id = 1', params: [Date.now() - 1] }] }),
    });
    assert.equal(query.status, 200);
    assert.equal((await fetch(`${expiringPath}/snapshot`)).status, 410);
  }
  console.log('Worker integration passed: room creation, authorization, read-only audience, independent socket sync, reconnect, host presence, command deduplication, stale and drawing rejection, digit lock, seven-day expiry policy, and close.');
} finally {
  clients.forEach(({ socket }) => socket.close());
}
