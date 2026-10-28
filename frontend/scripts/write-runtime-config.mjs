import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = resolve(scriptDirectory, '../public');
const outputPath = resolve(publicDirectory, 'runtime-config.js');
const mode = process.argv[2];
const configuredUrl = process.env.API_BASE_URL?.trim();
const apiBaseUrl =
  configuredUrl || (mode === 'development' ? 'http://localhost:8000' : '');

if (apiBaseUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(apiBaseUrl);
  } catch {
    throw new Error('API_BASE_URL debe ser una URL absoluta.');
  }

  const isLocalHttp =
    parsedUrl.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(parsedUrl.hostname);
  if (parsedUrl.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('API_BASE_URL debe usar HTTPS, excepto en localhost.');
  }
  if (parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new Error('API_BASE_URL no puede contener credenciales, query ni fragmento.');
  }
}

await mkdir(publicDirectory, { recursive: true });
await writeFile(
  outputPath,
  `window.__APP_CONFIG__ = Object.freeze({ apiBaseUrl: ${JSON.stringify(
    apiBaseUrl.replace(/\/+$/, '')
  )} });\n`,
  'utf8'
);
