#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT_DIR = path.resolve('icons');
const BG = [94, 106, 210];
const FG = [255, 255, 255];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const offset = y * (width * 4 + 1);
    raw[offset] = 0;
    rgba.copy(raw, offset + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function insideRoundedRect(x, y, width, height, radius) {
  const rx = Math.min(Math.max(x, radius), width - radius);
  const ry = Math.min(Math.max(y, radius), height - radius);
  return Math.hypot(x - rx, y - ry) <= radius;
}

function createIcon(size, { maskable = false, fullSquare = false } = {}) {
  const ss = 3;
  const big = size * ss;
  const radius = fullSquare ? 0 : big * 0.22;
  const stroke = big * (maskable ? 0.09 : 0.095);
  const points = maskable
    ? [[0.32, 0.53], [0.45, 0.66], [0.68, 0.4]]
    : [[0.29, 0.53], [0.44, 0.67], [0.71, 0.36]];
  const segments = [
    [points[0], points[1]],
    [points[1], points[2]]
  ].map(([a, b]) => [a[0] * big, a[1] * big, b[0] * big, b[1] * big]);

  const bigBuffer = new Float64Array(big * big * 4);
  for (let y = 0; y < big; y += 1) {
    for (let x = 0; x < big; x += 1) {
      const i = (y * big + x) * 4;
      const inShape = fullSquare || insideRoundedRect(x + 0.5, y + 0.5, big, big, radius);
      if (!inShape) continue;

      let color = BG;
      const onCheck = segments.some(([x1, y1, x2, y2]) => (
        distanceToSegment(x + 0.5, y + 0.5, x1, y1, x2, y2) <= stroke / 2
      ));
      if (onCheck) color = FG;
      bigBuffer[i] = color[0];
      bigBuffer[i + 1] = color[1];
      bigBuffer[i + 2] = color[2];
      bigBuffer[i + 3] = 255;
    }
  }

  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const i = (((y * ss + sy) * big) + (x * ss + sx)) * 4;
          const alpha = bigBuffer[i + 3] / 255;
          r += bigBuffer[i] * alpha;
          g += bigBuffer[i + 1] * alpha;
          b += bigBuffer[i + 2] * alpha;
          a += alpha;
        }
      }
      const samples = ss * ss;
      const o = (y * size + x) * 4;
      out[o] = a ? Math.round(r / a) : 0;
      out[o + 1] = a ? Math.round(g / a) : 0;
      out[o + 2] = a ? Math.round(b / a) : 0;
      out[o + 3] = Math.round((a / samples) * 255);
    }
  }

  return encodePng(size, size, out);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const icons = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-512-maskable.png', 512, { maskable: true, fullSquare: true }],
  ['apple-touch-icon.png', 180, { fullSquare: true }]
];

for (const [name, size, options] of icons) {
  const png = createIcon(size, options);
  fs.writeFileSync(path.join(OUT_DIR, name), png);
  console.log(`wrote icons/${name} (${png.length} bytes)`);
}
