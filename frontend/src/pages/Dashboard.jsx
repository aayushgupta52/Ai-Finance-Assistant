import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth.js';
import { expenseApi } from '../services/api.js';
import { formatINR } from '../utils/format.js';
import ExpenseForm from '../components/ExpenseForm.jsx';
import QuickCapture from '../components/QuickCapture.jsx';
import ExpenseList from '../components/ExpenseList.jsx';
import CategoryDonut from '../components/CategoryDonut.jsx';
import TrendBars from '../components/TrendBars.jsx';

function Card({ title, action, children }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ total: 0, byCategory: [] });
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [list, sum, tr] = await Promise.all([
      expenseApi.list({ limit: 10 }),
      expenseApi.summary(),
      expenseApi.trends(),
    ]);
    setExpenses(list.items);
    setSummary(sum);
    setTrends(tr.trends);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  const handleDelete = async (id) => {
    await expenseApi.remove(id);
    refresh();
  };

  const topCategory = summary.byCategory?.[0];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500">Hi {user?.name?.split(' ')[0] || 'there'} 👋</p>
      </div>

      {loading ? (
        <p className="py-12 text-center text-slate-400">Loading your dashboard…</p>
      ) : (
        <div className="space-y-5">
          {/* Stat strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-xs font-medium uppercase text-slate-400">Spent this month</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {formatINR(summary.total)}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-slate-400">Top category</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {topCategory ? topCategory.category : '—'}
              </p>
              {topCategory && (
                <p className="text-sm text-slate-500">{formatINR(topCategory.total)}</p>
              )}
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-slate-400">Transactions</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {summary.byCategory?.reduce((n, c) => n + (c.count || 0), 0) || 0}
              </p>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card title="Spending by category">
              <CategoryDonut byCategory={summary.byCategory} />
            </Card>
            <Card title="6-month trend">
              <TrendBars trends={trends} />
            </Card>
          </div>

          {/* Quick capture: voice + UPI SMS */}
          <Card title="Quick add — speak or paste an SMS">
            <QuickCapture onAdded={refresh} />
          </Card>

          {/* Add expense */}
          <Card title="Add an expense">
            <ExpenseForm onAdded={refresh} />
          </Card>

          {/* Recent */}
          <Card title="Recent transactions">
            <ExpenseList items={expenses} onDelete={handleDelete} />
          </Card>
        </div>
      )}
    </div>
  );
}
