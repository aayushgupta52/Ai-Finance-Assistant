import { useCallback, useEffect, useRef, useState } from 'react';
import { documentApi } from '../services/api.js';
import { formatDate } from '../utils/format.js';

const STATUS_STYLE = {
  pending: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  processing: 'bg-amber-100 text-amber-700',
  done: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp';
const isActive = (s) => s === 'pending' || s === 'processing';

export default function Upload() {
  const [docs, setDocs] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    const { documents } = await documentApi.list();
    setDocs(documents);
    return documents;
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  // Poll every 3s while any document is still pending/processing.
  useEffect(() => {
    if (!docs.some((d) => isActive(d.status))) return;
    const t = setInterval(() => load().catch(() => {}), 3000);
    return () => clearInterval(t);
  }, [docs, load]);

  const handleFiles = async (fileList) => {
    const file = fileList?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      await documentApi.upload(file);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const reprocess = async (id) => {
    await documentApi.reprocess(id);
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Upload statements</h1>
        <p className="text-sm text-slate-500">
          Drop a bank statement or receipt — our AI extracts and categorizes the transactions.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
          dragging ? 'border-brand bg-brand/5' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-brand'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {uploading ? 'Uploading…' : 'Drag & drop or click to browse'}
        </p>
        <p className="mt-1 text-xs text-slate-400">PDF, PNG, JPG or WEBP · max 10MB</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Document list */}
      <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Your uploads</h2>
        {docs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nothing uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{d.fileName}</p>
                  <p className="text-xs text-slate-400">
                    {formatDate(d.createdAt)} ·{' '}
                    {d.status === 'done'
                      ? `${d.transactionsFound} transaction${d.transactionsFound === 1 ? '' : 's'}`
                      : d.fileType.toUpperCase()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLE[d.status] || 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isActive(d.status) && (
                      <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-current align-middle" />
                    )}
                    {d.status}
                  </span>
                  {(d.status === 'failed' || d.status === 'done') && (
                    <button
                      onClick={() => reprocess(d.id)}
                      className="text-xs text-slate-400 hover:text-brand-dark"
                      title="Reprocess"
                    >
                      ↻
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
