import Groq from 'groq-sdk';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/response.js';

// Instantiate only when a key is present so the app runs fine without AI in dev.
const client = env.groq.apiKey ? new Groq({ apiKey: env.groq.apiKey }) : null;

if (!client) {
  logger.warn('[groq] disabled (missing GROQ_API_KEY) — AI endpoints will return 503');
}

export const isGroqConfigured = () => Boolean(client);

const ensureClient = () => {
  if (!client) throw new ApiError(503, 'AI service is not configured (missing GROQ_API_KEY)');
  return client;
};

// Single-shot completion. Returns the raw assistant message string.
export const callGroq = async (
  systemPrompt,
  userMessage,
  { json = false, temperature = 0.3, maxTokens = 2048 } = {}
) => {
  const res = await ensureClient().chat.completions.create({
    model: env.groq.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: json ? { type: 'json_object' } : undefined,
  });
  return res.choices[0]?.message?.content ?? '';
};

// Extracts a JSON object/array from a model response, tolerating stray prose
// or code fences that occasionally slip past json mode.
const parseJsonLoose = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.search(/[[{]/);
    const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
    if (start !== -1 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new ApiError(502, 'AI returned malformed JSON');
  }
};

export const callGroqJSON = async (systemPrompt, userMessage, opts = {}) => {
  const raw = await callGroq(systemPrompt, userMessage, { ...opts, json: true });
  return parseJsonLoose(raw);
};

// Returns an async-iterable streaming completion, or null if AI is disabled
// (callers handle the null case so they can still send an SSE fallback).
export const streamGroq = async ({ messages, temperature = 0.5, maxTokens = 1024 }) => {
  if (!client) return null;
  return client.chat.completions.create({
    model: env.groq.model,
    messages,
    stream: true,
    temperature,
    max_tokens: maxTokens,
  });
};
