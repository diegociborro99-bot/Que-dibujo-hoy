'use strict';
const crypto = require('crypto');

const TOKEN_DAYS = 90;

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return 's1$' + salt.toString('hex') + '$' + h.toString('hex');
}

function checkPassword(pw, stored) {
  const [v, saltHex, hashHex] = String(stored).split('$');
  if (v !== 's1' || !saltHex || !hashHex) return false;
  const h = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64);
  const want = Buffer.from(hashHex, 'hex');
  return want.length === h.length && crypto.timingSafeEqual(h, want);
}

const b64 = (b) => Buffer.from(b).toString('base64url');

function signToken(userId, secret) {
  const body = b64(JSON.stringify({ u: userId, e: Date.now() + TOKEN_DAYS * 864e5 }));
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + sig;
}

function verifyToken(token, secret) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const want = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.e > Date.now() ? p.u : null;
  } catch { return null; }
}

module.exports = { hashPassword, checkPassword, signToken, verifyToken };
