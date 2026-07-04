import { useEffect, useState } from 'react';
import { goalApi } from '../services/api.js';
import { formatINR, formatDate } from '../utils/format.js';
import Field, { inputClass } from '../components/Field.jsx';

const GOAL_CATEGORIES = [
  'Emergency Fund',
  'Vacation',
  'Gadget',
  'Vehicle',
  'Home',
  'Education',
  'Wedding',
  'Retirement',
  'Other',
];

function Card({ title, children }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
      {title && <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>}
      {children}
    </section>
  );
}

function GoalCard({ goal, onAdd, onDelete }) {
  const pct = Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100));
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200">{goal.name}</p>
          <p className="text-xs text-slate-400">
            {goal.category} · by {formatDate(goal.targetDate)}
          </p>
        </div>
        {goal.isCompleted ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Done 🎉
          </span>
        ) : (
          <button
            onClick={() => onDelete(goal.id)}
            className="text-xs text-slate-400 hover:text-red-600"
          >
            Remove
          </button>
        )}
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {formatINR(goal.savedAmount)} of {formatINR(goal.targetAmount)} · {pct}%
      </p>

      {!goal.isCompleted && (
        <>
          <p className="mt-2 text-xs text-slate-400">
            Save {formatINR(goal.monthlyTarget)}/mo · SIP ≈ {formatINR(goal.sipRecommended)}/mo
          </p>
          <div className="mt-3 flex gap-2">
            {[500, 1000, 5000].map((amt) => (
              <button
                key={amt}
                onClick={() => onAdd(goal.id, amt)}
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              >
                +{formatINR(amt)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    targetAmount: '',
    targetDate: '',
    category: 'Emergency Fund',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const data = await goalApi.list();
    setGoals(data.goals);
    setLoading(false);
  };

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await goalApi.create({
        name: form.name,
        targetAmount: Number(form.targetAmount),
        targetDate: new Date(form.targetDate).toISOString(),
        category: form.category,
      });
      setForm({ name: '', targetAmount: '', targetDate: '', category: 'Emergency Fund' });
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not create goal');
    } finally {
      setSaving(false);
    }
  };

  const addProgress = async (id, amount) => {
    await goalApi.addProgress(id, amount);
    refresh();
  };
  const remove = async (id) => {
    await goalApi.remove(id);
    refresh();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Goals</h1>
        <p className="text-sm text-slate-500">Save towards what matters, with AI-suggested SIPs.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Your goals">
            {loading ? (
              <p className="py-6 text-center text-slate-400">Loading…</p>
            ) : goals.length === 0 ? (
              <p className="py-6 text-center text-slate-400">No goals yet. Create one to start.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {goals.map((g) => (
                  <GoalCard key={g.id} goal={g} onAdd={addProgress} onDelete={remove} />
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card title="New goal">
          <form onSubmit={submit} className="space-y-3">
            <Field label="Name">
              <input
                required
                className={inputClass}
                placeholder="e.g. Goa trip"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Target amount (₹)">
              <input
                type="number"
                min="1"
                required
                className={inputClass}
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
              />
            </Field>
            <Field label="Target date">
              <input
                type="date"
                required
                className={inputClass}
                value={form.targetDate}
                onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {GOAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Creating…' : 'Create goal'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
