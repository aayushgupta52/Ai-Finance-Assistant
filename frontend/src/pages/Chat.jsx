import { useEffect, useRef, useState } from 'react';
import { streamChat } from '../services/chat.js';

const STORAGE_KEY = 'finbot_chat_v1';
const MAX_STORED = 100;

const SUGGESTIONS = [
  'How can I save more this month?',
  'What are my top expenses?',
  'How much tax can I save?',
  'Suggest a SIP for ₹5000/month',
];

const loadHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
};

export default function Chat() {
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  // Persist (trimmed) history and keep the view pinned to the latest message.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (text) => {
    const content = text.trim();
    if (!content || busy) return;
    setInput('');

    const history = [...messages, { role: 'user', content }];
    // Add an empty assistant turn we stream tokens into.
    setMessages([...history, { role: 'assistant', content: '' }]);
    setBusy(true);

    const append = (chunk) =>
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: next[next.length - 1].content + chunk,
        };
        return next;
      });

    await streamChat(history, {
      onToken: append,
      onError: (msg) => append(`\n\n⚠️ ${msg}`),
    });
    setBusy(false);
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">FinBot</h1>
          <p className="text-sm text-slate-500">Your AI finance assistant</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-sm text-slate-400 hover:text-red-600"
          >
            Clear chat
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 p-4 ring-1 ring-slate-200 dark:ring-slate-700"
      >
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center">
            <div className="text-center">
              <p className="mb-4 text-sm text-slate-400">Ask me anything about your money 💸</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-full border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:border-brand hover:text-brand-dark"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                  m.role === 'user'
                    ? 'bg-brand text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              >
                {m.content || (busy && i === messages.length - 1 ? '…' : '')}
              </div>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question…"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-brand px-5 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
