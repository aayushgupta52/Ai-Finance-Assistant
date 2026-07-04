import { prisma } from '../config/prisma.js';

// UTC [start, end) bounds for a given month (month is 1-12).
export const monthBounds = (year, month) => ({
  start: new Date(Date.UTC(year, month - 1, 1)),
  end: new Date(Date.UTC(year, month, 1)),
});

// Aggregates a user's finances for one month into a compact object that the AI
// prompts and health-score logic both consume.
export const getMonthlySummary = async (userId, { year, month } = {}) => {
  const now = new Date();
  const y = year ?? now.getUTCFullYear();
  const m = month ?? now.getUTCMonth() + 1;
  const { start, end } = monthBounds(y, m);
  const dateRange = { gte: start, lt: end };

  const [grouped, incomeAgg, expenseAgg, subsTotal, goals] = await Promise.all([
    prisma.expense.groupBy({
      by: ['category'],
      where: { userId, date: dateRange },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.income.aggregate({ where: { userId, date: dateRange }, _sum: { amount: true } }),
    prisma.expense.aggregate({
      where: { userId, date: dateRange },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.expense.aggregate({
      where: { userId, date: dateRange, category: 'Subscription' },
      _sum: { amount: true },
    }),
    prisma.goal.findMany({
      where: { userId, isCompleted: false },
      select: { name: true, targetAmount: true, savedAmount: true },
    }),
  ]);

  const byCategory = grouped
    .map((g) => ({
      category: g.category,
      total: g._sum.amount ?? 0,
      count: g._count._all,
    }))
    .sort((a, b) => b.total - a.total);

  const income = incomeAgg._sum.amount ?? 0;
  const expenseTotal = expenseAgg._sum.amount ?? 0;
  const subscriptions = subsTotal._sum.amount ?? 0;

  return {
    year: y,
    month: m,
    income,
    expenseTotal,
    transactionCount: expenseAgg._count._all,
    subscriptions,
    savingsRate: income > 0 ? (income - expenseTotal) / income : 0,
    byCategory,
    topCategories: byCategory.slice(0, 5).map((c) => c.category),
    goals: goals.map((g) => g.name),
  };
};

// Health-score input metrics derived from a monthly summary.
export const computeHealthMetrics = (summary) => ({
  savingsRate: Number(summary.savingsRate.toFixed(3)),
  subscriptionLoad:
    summary.income > 0 ? Number((summary.subscriptions / summary.income).toFixed(3)) : 0,
  expenseToIncome:
    summary.income > 0 ? Number((summary.expenseTotal / summary.income).toFixed(3)) : null,
  categorySpread: summary.byCategory.length,
  topCategories: summary.byCategory.slice(0, 3),
});
