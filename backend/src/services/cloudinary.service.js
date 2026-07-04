import { v2 as cloudinary } from 'cloudinary';
import { promises as fs } from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const configured = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);

if (configured) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
  logger.info('[storage] Cloudinary configured');
} else {
  logger.warn('[storage] Cloudinary not configured — files saved to local ./uploads');
}

export const isCloudConfigured = () => configured;

// Local fallback directory (used in dev without Cloudinary creds).
const UPLOAD_DIR = path.resolve('uploads');
const LOCAL_PREFIX = 'local://';

const uploadToCloudinary = (buffer, { fileType }) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: fileType === 'pdf' ? 'raw' : 'image', folder: 'fintrack' },
      (err, result) =>
        err ? reject(err) : resolve({ url: result.secure_url, publicId: result.public_id })
    );
    stream.end(buffer);
  });

// Persists an uploaded file and returns a stable reference.
export const uploadFile = async (buffer, { filename, fileType }) => {
  if (configured) return uploadToCloudinary(buffer, { fileType });

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const safe = `${Date.now()}-${filename.replace(/[^\w.\-]/g, '_')}`;
  await fs.writeFile(path.join(UPLOAD_DIR, safe), buffer);
  return { url: `${LOCAL_PREFIX}${safe}`, publicId: null };
};

// Retrieves a previously stored file as a Buffer, from either backend.
export const downloadFile = async (url) => {
  if (url.startsWith(LOCAL_PREFIX)) {
    const name = url.slice(LOCAL_PREFIX.length);
    return fs.readFile(path.join(UPLOAD_DIR, name));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download file (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
};
