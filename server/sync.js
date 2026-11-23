'use strict';
// Reglas de fusión del historial. Funciones puras, sin acceso a base de datos.

const MAX_DRAWINGS = 2000;
const ID_RE = /^[A-Za-z0-9_-]{6,40}$/;

const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

function cleanImg(img) {
  if (!img || typeof img !== 'object') return null;
  const out = {
    src: str(img.src, 1000), thumb: str(img.thumb, 1000), title: str(img.title, 200),
    by: str(img.by, 200), lic: str(img.lic, 60), link: str(img.link, 1000), from: str(img.from, 40),
  };
  return /^https?:\/\//.test(out.src) ? out : null;
}

// Devuelve un dibujo saneado o null si no es válido.
function cleanDrawing(x) {
  if (!x || typeof x !== 'object' || !ID_RE.test(x.id || '')) return null;
  const d = Number(x.d);
  if (!Number.isFinite(d) || d <= 0) return null;
  return {
    id: x.id, cat: str(x.cat, 20), es: str(x.es, 200), en: str(x.en, 200),
    m: str(x.m, 20), d: Math.floor(d), img: cleanImg(x.img),
  };
}

// Normaliza el cuerpo recibido del cliente.
function cleanPayload(b) {
  b = b && typeof b === 'object' ? b : {};
  const drawings = (Array.isArray(b.drawings) ? b.drawings : []).slice(0, MAX_DRAWINGS)
    .map(cleanDrawing).filter(Boolean);
  const int = (v) => (Number.isFinite(+v) && +v >= 0 ? Math.floor(+v) : 0);
  return {
    drawings,
    clearedAt: int(b.clearedAt),
    idx: Math.min(int(b.idx), 6),
    idxAt: int(b.idxAt),
  };
}

// Fusiona el estado guardado con el recibido. Ambos con la forma de cleanPayload.
// - clearedAt: gana el mayor; los dibujos con fecha <= clearedAt se descartan.
// - dibujos: unión por id.
// - idx: gana el cambio más reciente (idxAt).
function merge(stored, incoming) {
  const clearedAt = Math.max(stored.clearedAt, incoming.clearedAt);
  const map = new Map();
  for (const x of [...stored.drawings, ...incoming.drawings]) {
    if (x.d > clearedAt) map.set(x.id, x);
  }
  const drawings = [...map.values()].sort((a, b) => a.d - b.d).slice(-MAX_DRAWINGS);
  const useIn = incoming.idxAt > stored.idxAt;
  return {
    drawings, clearedAt,
    idx: useIn ? incoming.idx : stored.idx,
    idxAt: useIn ? incoming.idxAt : stored.idxAt,
  };
}

module.exports = { cleanPayload, merge, MAX_DRAWINGS };
