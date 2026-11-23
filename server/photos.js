'use strict';
// Búsqueda de fotos de referencia a través del servidor, para que la clave de
// Pexels viva aquí (variable PEXELS_API_KEY) y no haga falta pegarla en cada dispositivo.

const TTL = 60 * 60 * 1000;
const MAX_CACHE = 500;

function pexelsProvider(key, fetchFn = fetch) {
  return async (q) => {
    const r = await fetchFn('https://api.pexels.com/v1/search?per_page=40&query=' + encodeURIComponent(q),
      { headers: { Authorization: key } });
    if (!r.ok) throw new Error('pexels ' + r.status);
    const j = await r.json();
    return (j.photos || []).map((p) => ({
      id: 'px' + p.id, src: p.src.large2x || p.src.large, thumb: p.src.medium,
      title: p.alt || '', by: p.photographer || '', lic: 'Licencia Pexels',
      link: p.url, from: 'Pexels', w: p.width, h: p.height,
    }));
  };
}

// providers: lista de funciones q => Promise<foto[]>. Un proveedor que falla se ignora.
function createPhotos({ providers, now = Date.now }) {
  const cache = new Map();
  return async function search(q) {
    const hit = cache.get(q);
    if (hit && now() - hit.t < TTL) return hit.photos;
    const res = await Promise.allSettled(providers.map((p) => p(q)));
    const photos = res.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    // Solo se cachea si algún proveedor respondió, para no guardar un fallo puntual.
    if (res.some((r) => r.status === 'fulfilled')) {
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
      cache.set(q, { t: now(), photos });
    }
    return photos;
  };
}

module.exports = { pexelsProvider, createPhotos };
