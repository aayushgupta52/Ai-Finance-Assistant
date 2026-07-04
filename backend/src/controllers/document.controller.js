import { prisma } from '../config/prisma.js';
import { ok, created, asyncHandler, ApiError } from '../utils/response.js';
import { uploadFile } from '../services/cloudinary.service.js';
import { enqueueDocument } from '../queues/document.queue.js';
import { writeAuditLog } from '../middleware/audit.js';

const fileTypeFromMime = (mime) => (mime === 'application/pdf' ? 'pdf' : 'image');

// POST /api/documents/upload — multipart "file" field.
export const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded (expected field "file")');

  const fileType = fileTypeFromMime(req.file.mimetype);
  const { url } = await uploadFile(req.file.buffer, {
    filename: req.file.originalname,
    fileType,
  });

  const doc = await prisma.document.create({
    data: {
      userId: req.user.id,
      fileUrl: url,
      fileType,
      fileName: req.file.originalname,
      status: 'pending',
    },
  });

  const mode = await enqueueDocument(doc.id);
  writeAuditLog({ req, action: 'document.upload', resource: 'document', resourceId: doc.id });

  return created(res, { document: doc, processing: mode }, 'Upload received — processing started');
});

// GET /api/documents — list the user's uploads, newest first.
export const listDocuments = asyncHandler(async (req, res) => {
  const documents = await prisma.document.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      status: true,
      transactionsFound: true,
      processedAt: true,
      createdAt: true,
    },
  });
  return ok(res, { documents });
});

// GET /api/documents/:id/status — lightweight polling endpoint.
export const documentStatus = asyncHandler(async (req, res) => {
  const doc = await prisma.document.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true, status: true, transactionsFound: true, processedAt: true },
  });
  if (!doc) throw new ApiError(404, 'Document not found');
  return ok(res, { document: doc });
});

// POST /api/documents/:id/reprocess — re-run the pipeline on an existing doc.
export const reprocessDocument = asyncHandler(async (req, res) => {
  const doc = await prisma.document.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!doc) throw new ApiError(404, 'Document not found');

  await prisma.document.update({
    where: { id: doc.id },
    data: { status: 'pending', transactionsFound: 0, processedAt: null },
  });
  const mode = await enqueueDocument(doc.id);
  writeAuditLog({ req, action: 'document.reprocess', resource: 'document', resourceId: doc.id });

  return ok(res, { document: { id: doc.id, status: 'pending' }, processing: mode }, 'Reprocessing started');
});
