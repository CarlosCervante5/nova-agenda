import fs from 'fs';
import path from 'path';
import multer from 'multer';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const KINDS = new Set(['logo', 'cover', 'avatar', 'loyalty', 'image']);

function isProd() {
  return process.env.NODE_ENV === 'production';
}

let resolvedDir: string | null = null;

export function getUploadDir() {
  if (process.env.UPLOAD_DIR?.trim()) return process.env.UPLOAD_DIR.trim();
  if (isProd()) return '/data/uploads';
  return path.join(process.cwd(), 'uploads');
}

export function ensureUploadDir(dir = getUploadDir()) {
  if (resolvedDir) return resolvedDir;
  try {
    fs.mkdirSync(dir, { recursive: true });
    resolvedDir = dir;
    return dir;
  } catch (error) {
    if (!isProd()) throw error;
    const fallback = path.join(process.cwd(), 'uploads');
    console.warn(`[uploads] No se pudo usar ${dir}, se usa ${fallback}. Monta un volumen en /data en Railway.`);
    fs.mkdirSync(fallback, { recursive: true });
    resolvedDir = fallback;
    return fallback;
  }
}

function safeKind(raw?: string) {
  const kind = String(raw || 'image').toLowerCase();
  return KINDS.has(kind) ? kind : 'image';
}

export function createUploader() {
  const root = ensureUploadDir();

  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      const user = (req as { user?: { clientId?: string; id?: string } }).user;
      const folder = user?.clientId || user?.id || 'shared';
      const dest = path.join(root, folder);
      try {
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
      } catch (error) {
        cb(error as Error, dest);
      }
    },
    filename: (req, file, cb) => {
      const ext = MIME_TO_EXT[file.mimetype] || path.extname(file.originalname).toLowerCase() || '.jpg';
      const kind = safeKind(typeof req.query.kind === 'string' ? req.query.kind : undefined);
      cb(null, `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (MIME_TO_EXT[file.mimetype]) return cb(null, true);
      cb(new Error('Solo se permiten imágenes JPG, PNG, WEBP o GIF (máx. 5 MB).'));
    },
  });
}

export function publicUploadUrl(file: Express.Multer.File) {
  const folder = path.basename(path.dirname(file.path));
  return `/api/uploads/files/${folder}/${file.filename}`;
}
