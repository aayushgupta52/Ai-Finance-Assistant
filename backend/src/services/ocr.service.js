import { logger } from '../utils/logger.js';

// Heavy libraries (pdf-parse, tesseract.js, sharp) are imported lazily so the
// API server and tests boot even if a native binary failed to install. Only the
// document processor actually pulls them in.

// Extract text from a PDF buffer.
// NB: import the lib entry directly — pdf-parse's index.js runs debug code that
// tries to read a sample file when required as a module.
export const extractPdfText = async (buffer) => {
  const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
  const data = await pdfParse(buffer);
  return data.text || '';
};

// OCR an image buffer. Sharp pre-processing improves accuracy but is optional.
export const extractImageText = async (buffer) => {
  let image = buffer;
  try {
    const { default: sharp } = await import('sharp');
    image = await sharp(buffer).grayscale().normalize().toBuffer();
  } catch (err) {
    logger.warn(`[ocr] sharp pre-processing skipped: ${err.message}`);
  }

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng'); // add 'hin' once the model is bundled
  try {
    const { data } = await worker.recognize(image);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
};

// Routes to the right extractor based on the stored file type.
export const extractText = async (buffer, fileType) =>
  fileType === 'pdf' ? extractPdfText(buffer) : extractImageText(buffer);
