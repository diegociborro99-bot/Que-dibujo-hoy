'use strict';
const express = require('express');
const { hashPassword, checkPassword, signToken, verifyToken } = require('./auth');
const { cleanPayload, merge } = require('./sync');

const USER_RE = /^[a-z0-9_.-]{3,30}$/;

// Limitador sencillo en memoria para registro y login: máx. 20 intentos / 10 min por IP.
function limiter(max = 20, windowMs = 10 * 60 * 1000) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now(), k = req.ip;
    const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
    arr.push(now); hits.set(k, arr);
    if (hits.size > 5000) for (const [key, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(key);
    next();
  };
}

function createApp({ pool, secret, allowedOrigin }) {
  if (!secret || secret.length < 16) throw new Error('JWT_SECRET demasiado corto');
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use((req, res, next) => {
    const o = req.headers.origin;
    const ok = allowedOrigin === '*' || (o && allowedOrigin.split(',').map((s) => s.trim()).includes(o));
    if (ok) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin === '*' ? '*' : o);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/health', (req, res) => res.json({ ok: true }));

  const authLimit = limiter();
  const creds = (req) => {
    const u = String(req.body?.username || '').trim().toLowerCase();
    const p = String(req.body?.password || '');
    return { u, p };
  };

  app.post('/auth/register', authLimit, async (req, res, next) => {
    try {
      const { u, p } = creds(req);
      if (!USER_RE.test(u)) return res.status(400).json({ error: 'El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.' });
      if (p.length < 8 || p.length > 200) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
      const r = await pool.query(
        'INSERT INTO users (username, pass_hash) VALUES ($1,$2) ON CONFLICT (username) DO NOTHING RETURNING id',
        [u, hashPassword(p)]);
      if (!r.rows.length) return res.status(409).json({ error: 'Ese usuario ya existe.' });
      res.status(201).json({ token: signToken(r.rows[0].id, secret), username: u });
    } catch (e) { next(e); }
  });

  app.post('/auth/login', authLimit, async (req, res, next) => {
    try {
      const { u, p } = creds(req);
      const r = await pool.query('SELECT id, pass_hash FROM users WHERE username=$1', [u]);
      // Se hace el hash aunque el usuario no exista para no revelar su existencia por tiempo.
      const ok = r.rows.length ? checkPassword(p, r.rows[0].pass_hash) : (checkPassword(p, hashPassword('x')), false);
      if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
      res.json({ token: signToken(r.rows[0].id, secret), username: u });
    } catch (e) { next(e); }
  });

  const requireAuth = (req, res, next) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    const uid = m && verifyToken(m[1], secret);
    if (!uid) return res.status(401).json({ error: 'Sesión caducada.' });
    req.uid = uid; next();
  };

  // Lee el estado guardado del usuario dentro de una transacción ya abierta.
  async function load(c, uid) {
    const s = await c.query('SELECT idx, idx_at, cleared_at FROM sync_state WHERE user_id=$1', [uid]);
    const d = await c.query('SELECT data FROM drawings WHERE user_id=$1', [uid]);
    const row = s.rows[0] || {};
    return {
      drawings: d.rows.map((r) => r.data),
      clearedAt: Number(row.cleared_at || 0), idx: row.idx || 0, idxAt: Number(row.idx_at || 0),
    };
  }

  async function syncTx(uid, incoming) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      // Serializa las sincronizaciones del mismo usuario.
      await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [uid]);
      const stored = await load(c, uid);
      const out = incoming ? merge(stored, incoming) : stored;
      if (incoming) {
        await c.query(
          `INSERT INTO sync_state (user_id, idx, idx_at, cleared_at) VALUES ($1,$2,$3,$4)
           ON CONFLICT (user_id) DO UPDATE SET idx=$2, idx_at=$3, cleared_at=$4`,
          [uid, out.idx, out.idxAt, out.clearedAt]);
        await c.query('DELETE FROM drawings WHERE user_id=$1 AND (d <= $2 OR NOT (id = ANY($3)))',
          [uid, out.clearedAt, out.drawings.map((x) => x.id)]);
        for (const x of out.drawings) {
          await c.query(
            `INSERT INTO drawings (user_id, id, d, data) VALUES ($1,$2,$3,$4)
             ON CONFLICT (user_id, id) DO UPDATE SET d=$3, data=$4`,
            [uid, x.id, x.d, x]);
        }
      }
      await c.query('COMMIT');
      return out;
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
    finally { c.release(); }
  }

  app.get('/sync', requireAuth, async (req, res, next) => {
    try { res.json(await syncTx(req.uid, null)); } catch (e) { next(e); }
  });
  app.post('/sync', requireAuth, async (req, res, next) => {
    try { res.json(await syncTx(req.uid, cleanPayload(req.body))); } catch (e) { next(e); }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Demasiados datos.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON no válido.' });
    console.error(err);
    res.status(500).json({ error: 'Error del servidor.' });
  });
  return app;
}

module.exports = { createApp };
