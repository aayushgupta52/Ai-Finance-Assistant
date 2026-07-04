import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { downloadFile } from './cloudinary.service.js';
import { extractText } from './ocr.service.js';
import { callGroqJSON, isGroqConfigured } from './groq.service.js';
import { EXTRACTION_PROMPT } from '../constants/prompts.js';
import { CATEGORY_NAMES } from '../constants/categories.js';

const MAX_TEXT_FOR_AI = 6000; // keep the prompt within token limits
const VALID_CATEGORIES = new Set(CATEGORY_NAMES);

const safeDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

// Turns AI-extracted rows into Expense (debit) and Income (credit) records.
const persistTransactions = async (userId, transactions, source) => {
  const expenses = [];
  const incomes = [];

  for (const t of transactions) {
    const amount = Math.abs(Number(t.amount));
    if (!amount || Number.isNaN(amount)) continue;
    const date = safeDate(t.date);
    const description = t.description?.slice(0, 280) || null;

    if (t.type === 'credit') {
      incomes.push({ userId, amount, source: 'Other', description, date });
    } else {
      expenses.push({
        userId,
        amount,
        category: VALID_CATEGORIES.has(t.category) ? t.category : 'Other',
        description,
        merchant: t.merchant?.slice(0, 120) || null,
        date,
        source,
      });
    }
  }

  const [e, i] = await Promise.all([
    expenses.length
      ? prisma.expense.createMany({ data: expenses })
      : Promise.resolve({ count: 0 }),
    incomes.length
      ? prisma.income.createMany({ data: incomes })
      : Promise.resolve({ count: 0 }),
  ]);

  return e.count + i.count;
};

// Full pipeline: download -> extract text -> AI parse -> persist -> update doc.
// Invoked by the BullMQ worker, or inline when no queue is available.
export const processDocument = async (documentId) => {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    logger.warn(`[doc] ${documentId} not found`);
    return;
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'processing' },
  });

  try {
    const buffer = await downloadFile(doc.fileUrl);
    const text = await extractText(buffer, doc.fileType);

    let transactionsFound = 0;
    if (text && isGroqConfigured()) {
      const parsed = await callGroqJSON(EXTRACTION_PROMPT, text.slice(0, MAX_TEXT_FOR_AI));
      const transactions = Array.isArray(parsed?.transactions) ? parsed.transactions : [];
      transactionsFound = await persistTransactions(doc.userId, transactions, doc.fileType);
    } else if (!isGroqConfigured()) {
      logger.warn(`[doc] ${documentId}: text extracted but GROQ_API_KEY missing — skipping parse`);
    }

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'done',
        extractedText: text ? text.slice(0, 10000) : null,
        transactionsFound,
        processedAt: new Date(),
      },
    });
    logger.info(`[doc] ${documentId} done — ${transactionsFound} transactions`);
  } catch (err) {
    logger.error(`[doc] ${documentId} failed: ${err.message}`);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'failed', processedAt: new Date() },
    });
    throw err; // let the worker mark the job failed / retry
  }
};
