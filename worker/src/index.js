import { DurableObject } from 'cloudflare:workers';
import { isValidPublicDrawState, MAX_PUBLIC_STATE_CHARS } from '../../src/utils/realtimeRoom.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY = /^[0-9a-f-]{64,100}$/i;
const COMMAND = ID;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (message, status = 400) => json({ error: message }, status);
const parse = async (request) => {
  if (Number(request.headers.get('Content-Length') || 0) > 850_000) throw new Error('Request too large.');
  const text = await request.text();
  if (text.length > 850_000) throw new Error('Request too large.');
  return JSON.parse(text);
};
const readBoundedBody = async (request) => {
  if (Number(request.headers.get('Content-Length') || 0) > 850_000) throw new Error('Request too large.');
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 850_000) { await reader.cancel(); throw new Error('Request too large.'); }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => { body.set(chunk, offset); offset += chunk.length; });
  return body;
};
const digest = async (value) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
};
const constantEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export class DrawRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS room (
      id INTEGER PRIMARY KEY CHECK (id = 1), host_hash TEXT NOT NULL, mc_hash TEXT,
      created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, closed INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 0, snapshot TEXT, host_seen INTEGER NOT NULL DEFAULT 0,
      pending_id TEXT, pending_at INTEGER NOT NULL DEFAULT 0
    )`);
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS commands (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL)');
  }

  row() { return this.ctx.storage.sql.exec('SELECT * FROM room WHERE id = 1').toArray()[0] || null; }
  active() {
    const room = this.row();
    if (!room) return [null, fail('Room not found.', 404)];
    if (room.closed) return [null, fail('Room closed.', 410)];
    if (Date.now() >= room.expires_at) { this.expire(); return [null, fail('Room expired.', 410)]; }
    return [room, null];
  }
  async authorized(request, field) {
    const key = request.headers.get('Authorization')?.replace(/^Bearer /i, '') || '';
    if (!KEY.test(key)) return [null, fail('Unauthorized.', 403)];
    const hash = await digest(key);
    const [room, error] = this.active();
    if (error) return [null, error];
    if (!room[field] || !constantEqual(hash, room[field])) {
      return [null, fail('Unauthorized.', 403)];
    }
    return [room, null];
  }
  sockets(role) {
    return this.ctx.getWebSockets().filter((ws) => ws.readyState === WebSocket.OPEN && ws.deserializeAttachment()?.role === role);
  }
  hostOnline(room = this.row()) {
    return Boolean(room && this.sockets('host').length && Date.now() - room.host_seen < 15000);
  }
  send(ws, message) { try { ws.send(JSON.stringify(message)); } catch { /* socket already closed */ } }
  broadcast(message) { this.ctx.getWebSockets().forEach((ws) => this.send(ws, message)); }
  roomMessage(room = this.row()) {
    return { type: 'state', status: room?.closed ? 'closed' : 'open', revision: room?.revision || 0,
      snapshot: room?.snapshot ? JSON.parse(room.snapshot) : null, hostOnline: this.hostOnline(room),
      hostSeen: room?.host_seen || 0, expiresAt: room?.expires_at || 0 };
  }
  expire() {
    this.ctx.storage.sql.exec('UPDATE room SET closed = 1, host_hash = \'\', mc_hash = NULL, snapshot = NULL, pending_id = NULL WHERE id = 1');
    this.ctx.storage.sql.exec('DELETE FROM commands');
    this.broadcast({ type: 'closed' });
    this.ctx.getWebSockets().forEach((ws) => { try { ws.close(1000, 'Room expired'); } catch {} });
  }
  async alarm() { this.expire(); }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/create' && request.method === 'POST') {
      let body;
      try { body = await parse(request); } catch { return fail('Invalid request.'); }
      if (!KEY.test(body?.hostKey)) return fail('Invalid host credential.');
      if (this.row()) return fail('Room already exists.', 409);
      const now = Date.now();
      const hash = await digest(body.hostKey);
      if (this.row()) return fail('Room already exists.', 409);
      this.ctx.storage.sql.exec('INSERT INTO room (id, host_hash, created_at, expires_at) VALUES (1, ?, ?, ?)', hash, now, now + WEEK_MS);
      await this.ctx.storage.setAlarm(now + WEEK_MS);
      return json({ created: true, expiresAt: now + WEEK_MS }, 201);
    }
    if (url.pathname === '/socket' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const [room, error] = this.active();
      if (error) return error;
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ role: 'audience' });
      this.send(server, this.roomMessage(room));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === '/snapshot' && request.method === 'GET') {
      const [room, error] = this.active();
      return error || json(this.roomMessage(room));
    }
    if (url.pathname === '/mc' && request.method === 'PUT') {
      let body;
      try { body = await parse(request); } catch { return fail('Invalid request.'); }
      if (!KEY.test(body?.mcKey)) return fail('Invalid MC credential.');
      const hash = await digest(body.mcKey);
      const [, error] = await this.authorized(request, 'host_hash');
      if (error) return error;
      this.ctx.storage.sql.exec('UPDATE room SET mc_hash = ?, pending_id = NULL WHERE id = 1', hash);
      return json({ enabled: true });
    }
    if (url.pathname === '/mc' && request.method === 'DELETE') {
      const [, error] = await this.authorized(request, 'host_hash');
      if (error) return error;
      this.ctx.storage.sql.exec('UPDATE room SET mc_hash = NULL, pending_id = NULL WHERE id = 1');
      return json({ enabled: false });
    }
    if (url.pathname === '/close' && request.method === 'POST') {
      const [, error] = await this.authorized(request, 'host_hash');
      if (error) return error;
      this.expire();
      return json({ closed: true });
    }
    if (url.pathname === '/request' && request.method === 'POST') {
      let body;
      try { body = await parse(request); } catch { return fail('Invalid request.'); }
      if (!COMMAND.test(body?.commandId) || !Number.isInteger(body?.revision)) return fail('Invalid command.');
      const [, error] = await this.authorized(request, 'mc_hash');
      if (error) return error;
      if (this.ctx.storage.sql.exec('SELECT id FROM commands WHERE id = ?', body.commandId).toArray().length) return json({ accepted: false, message: 'Duplicate draw request.' }, 409);
      const room = this.row();
      const state = room.snapshot ? JSON.parse(room.snapshot) : null;
      if (body.revision !== room.revision) return json({ accepted: false, message: 'Room state changed. Wait for the latest draw state.' }, 409);
      if (!this.hostOnline(room)) return json({ accepted: false, message: 'Host is offline.' }, 409);
      if (!state?.live?.remoteControlReady || state.live.drawing || state.live.charging || state.live.remainingEntriesCount <= 0 ||
        (state.operationMode === 'standard' && state.live.completedPrizeCount >= state.live.prizeCount)) return json({ accepted: false, message: 'The host is not ready for another draw.' }, 409);
      if (room.pending_id && Date.now() - room.pending_at < 15000) return json({ accepted: false, message: 'A draw request is already in progress.' }, 409);
      this.ctx.storage.sql.exec('INSERT INTO commands (id, created_at) VALUES (?, ?)', body.commandId, Date.now());
      this.ctx.storage.sql.exec('UPDATE room SET pending_id = ?, pending_at = ? WHERE id = 1', body.commandId, Date.now());
      this.sockets('host').forEach((ws) => this.send(ws, { type: 'draw-request', commandId: body.commandId }));
      return json({ accepted: true });
    }
    return fail('Not found.', 404);
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 850_000) { this.send(ws, { type: 'error', message: 'Invalid message.' }); return; }
    let message;
    try { message = JSON.parse(raw); } catch { this.send(ws, { type: 'error', message: 'Invalid message.' }); return; }
    let [room, roomError] = this.active();
    if (roomError) { this.send(ws, { type: 'closed' }); ws.close(1000, 'Room closed'); return; }
    if (message?.type === 'auth') {
      const hash = KEY.test(message.key) ? await digest(message.key) : '';
      [room, roomError] = this.active();
      if (roomError) { this.send(ws, { type: 'closed' }); ws.close(1000, 'Room closed'); return; }
      if (!hash || !constantEqual(hash, room.host_hash)) { this.send(ws, { type: 'error', message: 'Unauthorized.' }); ws.close(1008, 'Unauthorized'); return; }
      if (this.hostOnline(room) && this.sockets('host').some((other) => other !== ws)) {
        this.send(ws, { type: 'error', message: 'Another host tab is already connected.' });
        ws.close(1008, 'Host already connected');
        return;
      }
      this.sockets('host').filter((other) => other !== ws).forEach((other) => other.close(1000, 'Host reconnected'));
      ws.serializeAttachment({ role: 'host' });
      this.ctx.storage.sql.exec('UPDATE room SET host_seen = ? WHERE id = 1', Date.now());
      this.send(ws, { type: 'authorized', revision: room.revision, snapshot: room.snapshot ? JSON.parse(room.snapshot) : null, capabilities: ['winner-index'] });
      this.broadcast(this.roomMessage(this.row()));
      return;
    }
    if (ws.deserializeAttachment()?.role !== 'host') { this.send(ws, { type: 'error', message: 'Read only.' }); return; }
    if (message?.type === 'heartbeat') {
      this.ctx.storage.sql.exec('UPDATE room SET host_seen = ? WHERE id = 1', Date.now());
      this.broadcast({ type: 'presence', hostOnline: true, hostSeen: Date.now() });
      return;
    }
    if (message?.type !== 'publish' || !Number.isInteger(message.baseRevision) || !isValidPublicDrawState(message.snapshot) || JSON.stringify(message.snapshot).length > MAX_PUBLIC_STATE_CHARS) {
      this.send(ws, { type: 'error', message: 'Invalid public snapshot.' }); return;
    }
    if (message.baseRevision !== room.revision) { this.send(ws, { type: 'stale', revision: room.revision }); return; }
    const previous = room.snapshot ? JSON.parse(room.snapshot) : null;
    const oldDigits = previous?.live?.lockedDigits || '';
    const newDigits = message.snapshot?.live?.lockedDigits || '';
    const sameWinner = (message.snapshot.live?.drawingWinnerIndex || 0) <= (previous?.live?.drawingWinnerIndex || 0);
    if (previous?.live?.drawing && message.snapshot.live?.drawing && sameWinner && !newDigits.startsWith(oldDigits)) {
      this.send(ws, { type: 'error', message: 'Locked digits cannot change.' }); return;
    }
    const snapshot = JSON.stringify(message.snapshot);
    this.ctx.storage.sql.exec('UPDATE room SET revision = revision + 1, snapshot = ?, pending_id = CASE WHEN ? THEN NULL ELSE pending_id END, host_seen = ? WHERE id = 1', snapshot, Number(message.snapshot.live.drawing), Date.now());
    this.send(ws, { type: 'published', revision: room.revision + 1 });
    this.broadcast(this.roomMessage(this.row()));
  }
  webSocketClose(ws) {
    if (ws.deserializeAttachment()?.role === 'host') {
      this.broadcast({ type: 'presence', hostOnline: this.hostOnline(), hostSeen: this.row()?.host_seen || 0 });
    }
  }
  webSocketError(ws) { this.webSocketClose(ws); }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim());
    const headers = { 'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : '',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
    if (origin && !allowed.includes(origin)) return fail('Origin not allowed.', 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const path = new URL(request.url).pathname;
    if (path === '/health') return json({ ok: true });
    const match = path.match(/^\/rooms\/([0-9a-f-]{36})(?:\/(snapshot|socket|mc|request|close))?$/i);
    if (!match || !ID.test(match[1])) return fail('Not found.', 404);
    const target = env.ROOMS.getByName(match[1].toLowerCase());
    const internalUrl = new URL(`https://room.internal/${match[2] || 'create'}`);
    let routed;
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      routed = new Request(internalUrl, request);
    } else {
      let body;
      try { body = await readBoundedBody(request); } catch { return fail('Request too large.', 413); }
      const forwardedHeaders = new Headers(request.headers);
      forwardedHeaders.delete('Content-Length');
      routed = new Request(internalUrl, { method: request.method, headers: forwardedHeaders, body });
    }
    const response = await target.fetch(routed);
    if (response.status === 101) return response;
    const result = new Response(response.body, response);
    Object.entries(headers).forEach(([key, value]) => { if (value) result.headers.set(key, value); });
    return result;
  },
};
