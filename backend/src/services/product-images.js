const fs = require('fs');
const path = require('path');

let sharp = null;
try {
  // Optional at runtime until dependency is installed.
  sharp = require('sharp');
} catch (error) {
  sharp = null;
}

const REPO_ROOT = path.resolve(__dirname, '../../..');
const PRODUCT_IMAGE_DIR = path.join(REPO_ROOT, 'public', 'productos');
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
const OUTPUT_SIZE = 1200;
const OUTPUT_QUALITY = 85;

function ensureSharpAvailable() {
  if (!sharp) {
    throw new Error('La carga local de imagenes requiere la dependencia sharp instalada.');
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeFileName(name) {
  return String(name || 'imagen')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'imagen';
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Formato de imagen invalido.');
  }

  const mimeType = String(match[1] || '').toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('Formato no permitido. Use JPG, PNG o WEBP.');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_ORIGINAL_BYTES) {
    throw new Error('La imagen supera el maximo permitido de 10MB.');
  }

  return { mimeType, buffer };
}

function isRemoteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function clearLocalProductImageDir(productId) {
  const dir = path.join(PRODUCT_IMAGE_DIR, String(productId));
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  ensureDir(dir);
  return dir;
}

function resolveExistingLocalPath(item) {
  if (item && item.ruta_local && fs.existsSync(item.ruta_local)) {
    return item.ruta_local;
  }
  const publicCandidate = item && item.url_publica && String(item.url_publica).startsWith('/productos/')
    ? path.join(REPO_ROOT, 'public', String(item.url_publica).replace(/^\/+/, '').replace(/\//g, path.sep))
    : '';
  return publicCandidate && fs.existsSync(publicCandidate) ? publicCandidate : '';
}

async function optimizeImageBuffer(buffer) {
  ensureSharpAvailable();
  return sharp(buffer)
    .rotate()
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      withoutEnlargement: false
    })
    .webp({ quality: OUTPUT_QUALITY })
    .toBuffer();
}

async function processProductImages(productId, images = []) {
  const normalized = (Array.isArray(images) ? images : [])
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          url_remote: item.trim(),
          es_principal: index === 0,
          orden: index
        };
      }
      return {
        ...item,
        es_principal: !!item.es_principal,
        orden: Number.isFinite(Number(item.orden)) ? Number(item.orden) : index
      };
    })
    .filter((item) => item && (item.upload_data || item.url_remote || item.url_publica || item.url_local));

  if (normalized.length > 0 && !normalized.some((item) => item.es_principal)) {
    normalized[0].es_principal = true;
  }

  const dir = clearLocalProductImageDir(productId);
  const result = [];
  let localIndex = 0;

  for (const item of normalized.sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))) {
    if (item.upload_data) {
      const { buffer } = parseDataUrl(item.upload_data);
      const optimized = await optimizeImageBuffer(buffer);
      localIndex += 1;
      const baseName = item.es_principal ? 'principal' : String(localIndex);
      const fileName = `${sanitizeFileName(baseName)}.webp`;
      const absolutePath = path.join(dir, fileName);
      fs.writeFileSync(absolutePath, optimized);
      result.push({
        nombre_archivo: fileName,
        ruta_local: absolutePath,
        url_publica: `/productos/${productId}/${fileName}`,
        url_local: absolutePath,
        url_remote: null,
        woocommerce_media_id: item.woocommerce_media_id || null,
        orden: Number(item.orden || 0),
        es_principal: item.es_principal ? 1 : 0,
        optimizada: true,
        origen: 'upload'
      });
      continue;
    }

    const existingLocalPath = resolveExistingLocalPath(item);
    if (existingLocalPath) {
      const optimized = await optimizeImageBuffer(fs.readFileSync(existingLocalPath));
      localIndex += 1;
      const baseName = item.es_principal ? 'principal' : String(localIndex);
      const fileName = `${sanitizeFileName(baseName)}.webp`;
      const absolutePath = path.join(dir, fileName);
      fs.writeFileSync(absolutePath, optimized);
      result.push({
        nombre_archivo: fileName,
        ruta_local: absolutePath,
        url_publica: `/productos/${productId}/${fileName}`,
        url_local: absolutePath,
        url_remote: item.url_remote || null,
        woocommerce_media_id: item.woocommerce_media_id || null,
        orden: Number(item.orden || 0),
        es_principal: item.es_principal ? 1 : 0,
        optimizada: true,
        origen: 'local'
      });
      continue;
    }

    const remote = item.url_remote || item.url_publica || item.url_local || null;
    if (remote && isRemoteHttpUrl(remote)) {
      result.push({
        nombre_archivo: item.nombre_archivo || path.basename(remote.split('?')[0] || 'imagen-remota'),
        ruta_local: null,
        url_publica: remote,
        url_local: null,
        url_remote: remote,
        woocommerce_media_id: item.woocommerce_media_id || null,
        orden: Number(item.orden || 0),
        es_principal: item.es_principal ? 1 : 0,
        optimizada: false,
        origen: 'url'
      });
    }
  }

  if (result.length > 0 && !result.some((item) => item.es_principal)) {
    result[0].es_principal = 1;
  }

  return result;
}

module.exports = {
  ALLOWED_MIME_TYPES,
  MAX_ORIGINAL_BYTES,
  OUTPUT_QUALITY,
  OUTPUT_SIZE,
  ensureSharpAvailable,
  isRemoteHttpUrl,
  parseDataUrl,
  processProductImages
};
