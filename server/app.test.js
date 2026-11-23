'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { Pool } = require('pg');
const { createApp } = require('./app');
const { merge, cleanPayload } = require('./sync');

const dr = (id, d, extra = {}) => ({ id, d, cat: 'objeto', es: 'Una taza', en: 'cup', m: 'lapiz', img: null, ...extra });

test('merge: unión por id y respeta clearedAt', () => {
  const a = { drawings: [dr('aaaaaa', 100), dr('bbbbbb', 200)], clearedAt: 0, idx: 1, idxAt: 5 };
  const b = { drawings: [dr('bbbbbb', 200), dr('cccccc', 300)], clearedAt: 150, idx: 2, idxAt: 9 };
  const m = merge(a, b);
  assert.deepStrictEqual(m.drawings.map((x) => x.id), ['bbbbbb', 'cccccc']);
  assert.strictEqual(m.clearedAt, 150);
  assert.strictEqual(m.idx, 2);
});

test('cleanPayload: descarta dibujos inválidos y urls no http', () => {
  const p = cleanPayload({ drawings: [dr('x', 1), dr('okokok', 5, { img: { src: 'javascript:alert(1)' } }), null], idx: 99 });
  assert.strictEqual(p.drawings.length, 1);
  assert.strictEqual(p.drawings[0].img, null);
  assert.strictEqual(p.idx, 6);
});

const url = process.env.TEST_DATABASE_URL;
test('API de extremo a extremo', { skip: !url && 'sin TEST_DATABASE_URL' }, async (t) => {
  const pool = new Pool({ connectionString: url });
  await pool.query('DROP TABLE IF EXISTS drawings, sync_state, users CASCADE');
  await pool.query(fs.readFileSync(__dirname + '/schema.sql', 'utf8'));
  const app = createApp({ pool, secret: 'x'.repeat(32), allowedOrigin: 'https://ok.example' });
  const srv = app.listen(0);
  const base = 'http://127.0.0.1:' + srv.address().port;
  t.after(async () => { srv.close(); await pool.end(); });
  const call = async (path, body, token) => {
    const r = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => ({})), headers: r.headers };
  };

  assert.strictEqual((await call('/auth/register', { username: 'a', password: '12345678' })).status, 400);
  assert.strictEqual((await call('/auth/register', { username: 'diego', password: 'corta' })).status, 400);
  const reg = await call('/auth/register', { username: 'Diego', password: 'contraseña-larga' });
  assert.strictEqual(reg.status, 201);
  assert.strictEqual((await call('/auth/register', { username: 'diego', password: 'contraseña-larga' })).status, 409);
  assert.strictEqual((await call('/auth/login', { username: 'diego', password: 'mala-mala' })).status, 401);
  assert.strictEqual((await call('/auth/login', { username: 'nadie', password: 'mala-mala' })).status, 401);
  const login = await call('/auth/login', { username: 'diego', password: 'contraseña-larga' });
  assert.strictEqual(login.status, 200);

  assert.strictEqual((await call('/sync')).status, 401);
  assert.strictEqual((await call('/sync', null, 'basura')).status, 401);

  // Dispositivo A sube dos dibujos
  const A = reg.body.token, B = login.body.token;
  let r = await call('/sync', { drawings: [dr('aaaaaa', 100), dr('bbbbbb', 200)], idx: 2, idxAt: 10 }, A);
  assert.strictEqual(r.body.drawings.length, 2);
  // Dispositivo B sube uno distinto y recibe los tres
  r = await call('/sync', { drawings: [dr('cccccc', 300)], idx: 0, idxAt: 5 }, B);
  assert.deepStrictEqual(r.body.drawings.map((x) => x.id), ['aaaaaa', 'bbbbbb', 'cccccc']);
  assert.strictEqual(r.body.idx, 2, 'gana el cambio de idx más reciente');
  // Borrar historial desde A: B no lo resucita al sincronizar con datos viejos
  r = await call('/sync', { drawings: [], clearedAt: 400, idx: 3, idxAt: 20 }, A);
  assert.strictEqual(r.body.drawings.length, 0);
  r = await call('/sync', { drawings: [dr('aaaaaa', 100)], idx: 3, idxAt: 20 }, B);
  assert.strictEqual(r.body.drawings.length, 0);
  assert.strictEqual((await call('/sync', null, B)).body.clearedAt, 400);

  // Otro usuario no ve nada ajeno
  const o = await call('/auth/register', { username: 'otra', password: 'otra-contraseña' });
  await call('/sync', { drawings: [dr('dddddd', 500)] }, o.body.token);
  assert.deepStrictEqual((await call('/sync', null, A)).body.drawings, []);

  // La web se sirve en la raíz
  const home = await fetch(base + '/');
  assert.strictEqual(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  assert.match(await home.text(), /¿Qué dibujo hoy\?/);

  // CORS
  const pre = await fetch(base + '/sync', { method: 'OPTIONS', headers: { Origin: 'https://ok.example' } });
  assert.strictEqual(pre.headers.get('access-control-allow-origin'), 'https://ok.example');
  const bad = await fetch(base + '/health', { headers: { Origin: 'https://evil.example' } });
  assert.strictEqual(bad.headers.get('access-control-allow-origin'), null);
});
