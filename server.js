const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { customAlphabet } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;
const createCode = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 7);
const databasePath = process.env.DATABASE_PATH || path.join(__dirname, 'links.db');
const database = new sqlite3.Database(databasePath);

database.serialize(() => {
  database.run(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      original_url TEXT NOT NULL,
      clicks INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function validUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function findByCode(code) {
  return new Promise((resolve, reject) => {
    database.get('SELECT * FROM links WHERE code = ?', [code], (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

app.post('/api/shorten', async (request, response) => {
  const originalUrl = String(request.body?.url || '').trim();
  if (!validUrl(originalUrl)) {
    return response.status(400).json({ error: 'Enter a valid http:// or https:// URL.' });
  }

  let code = createCode();
  try {
    while (await findByCode(code)) code = createCode();
    database.run(
      'INSERT INTO links (code, original_url) VALUES (?, ?)',
      [code, originalUrl],
      function (error) {
        if (error) return response.status(500).json({ error: 'Could not save this link.' });
        response.status(201).json({
          code,
          originalUrl,
          shortUrl: `${request.protocol}://${request.get('host')}/${code}`,
          createdAt: new Date().toISOString()
        });
      }
    );
  } catch {
    response.status(500).json({ error: 'Could not create a short link.' });
  }
});

app.get('/api/links', (request, response) => {
  database.all(
    'SELECT code, original_url AS originalUrl, clicks, created_at AS createdAt FROM links ORDER BY id DESC',
    (error, rows) => {
      if (error) return response.status(500).json({ error: 'Could not load recent links.' });
      response.json(rows.map((link) => ({ ...link, shortUrl: `${request.protocol}://${request.get('host')}/${link.code}` })));
    }
  );
});

app.get('/api/health', (request, response) => response.json({ status: 'ok', database: 'connected' }));

app.get('/:code', async (request, response, next) => {
  if (request.params.code.includes('.')) return next();
  try {
    const link = await findByCode(request.params.code);
    if (!link) return response.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    database.run('UPDATE links SET clicks = clicks + 1 WHERE code = ?', [link.code]);
    response.redirect(link.original_url);
  } catch {
    response.status(500).send('Unable to redirect right now.');
  }
});

app.listen(PORT, () => console.log(`Linkloom running at http://localhost:${PORT}`));