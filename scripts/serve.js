import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.ics': 'text/calendar; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};

const server = http.createServer((request, response) => {
  let requestedPath;
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    requestedPath = decodeURIComponent(url.pathname);
  } catch (error) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }

  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.resolve(ROOT, `.${path.sep}${safePath}`);
  const relative = path.relative(ROOT, filePath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  response.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-cache'
  });

  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!response.headersSent) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    response.end();
  });
  stream.pipe(response);
});

server.listen(PORT, () => {
  console.log(`HabiStride running at http://localhost:${PORT}`);
});
