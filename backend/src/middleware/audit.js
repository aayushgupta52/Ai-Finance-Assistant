import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';

const SENSITIVE_KEYS = ['password', 'passwordHash', 'panNumber', 'token', 'refreshToken'];

const maskSensitive = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = {};
  for (const [key, val] of Object.entries(obj)) {
    clone[key] = SENSITIVE_KEYS.includes(key) ? '***' : val;
  }
  return clone;
};

// Records an audit log entry. Safe to call fire-and-forget — failures are
// logged but never block the request.
export const writeAuditLog = async ({ req, action, resource, resourceId, details }) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id ?? null,
        action,
        resource,
        resourceId: resourceId ?? null,
        // Native Json column on PostgreSQL — store the object directly.
        details: details ? maskSensitive(details) : undefined,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
      },
    });
  } catch (err) {
    logger.error(`[audit] failed to write log: ${err.message}`);
  }
};
