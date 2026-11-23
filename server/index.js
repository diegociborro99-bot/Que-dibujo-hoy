'use strict';
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { createApp } = require('./app');
const { pexelsProvider, createPhotos } = require('./photos');

(async () => {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL');
  if (!process.env.JWT_SECRET) throw new Error('Falta JWT_SECRET');
  const local = /localhost|127\.0\.0\.1|\.railway\.internal/.test(process.env.DATABASE_URL);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: local || process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false },
  });
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const photos = process.env.PEXELS_API_KEY
    ? createPhotos({ providers: [pexelsProvider(process.env.PEXELS_API_KEY)] }) : null;
  const app = createApp({
    pool, secret: process.env.JWT_SECRET, photos,
    allowedOrigin: process.env.ALLOWED_ORIGIN || 'https://diegociborro99-bot.github.io',
  });
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log('API escuchando en el puerto ' + port));
})().catch((e) => { console.error(e); process.exit(1); });
