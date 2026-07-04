import multer from 'multer';
import { fail } from '../utils/response.js';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

// Keep the file in memory — it's streamed straight to storage, never to disk
// inside the request handler.
const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    cb(new Error('Unsupported file type. Upload a PDF or image (PNG/JPG/WEBP).'));
  },
});

// Wraps multer so its errors return clean JSON instead of hitting the generic
// 500 handler.
export const uploadSingle = (req, res, next) => {
  multerInstance.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return fail(res, 'File too large (max 10MB).', 413);
    }
    return fail(res, err.message || 'Upload failed', 400);
  });
};
