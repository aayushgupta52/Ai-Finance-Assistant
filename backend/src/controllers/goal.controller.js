import { prisma } from '../config/prisma.js';
import { ok, created, asyncHandler, ApiError } from '../utils/response.js';
import { writeAuditLog } from '../middleware/audit.js';

// Recommends a monthly saving and an equivalent SIP to hit the target on time.
// SIP assumes a conservative 12% annual return compounded monthly.
const withProjections = (goal) => {
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const monthsLeft = Math.max(
    1,
    Math.ceil((new Date(goal.targetDate) - Date.now()) / (1000 * 60 * 60 * 24 * 30))
  );
  const monthlyTarget = Math.round(remaining / monthsLeft);

  const r = 0.12 / 12;
  const n = monthsLeft;
  // Solve the SIP future-value formula for the monthly contribution.
  const factor = ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  const sipRecommended = factor > 0 ? Math.round(remaining / factor) : monthlyTarget;

  return { ...goal, remaining, monthsLeft, monthlyTarget, sipRecommended };
};

// GET /api/goals
export const listGoals = asyncHandler(async (req, res) => {
  const goals = await prisma.goal.findMany({
    where: { userId: req.user.id },
    orderBy: [{ isCompleted: 'asc' }, { targetDate: 'asc' }],
  });
  return ok(res, { goals: goals.map(withProjections) });
});

// POST /api/goals
export const createGoal = asyncHandler(async (req, res) => {
  const goal = await prisma.goal.create({
    data: { ...req.body, userId: req.user.id },
  });
  writeAuditLog({ req, action: 'goal.create', resource: 'goal', resourceId: goal.id });
  return created(res, { goal: withProjections(goal) }, 'Goal created');
});

// PUT /api/goals/:id
export const updateGoal = asyncHandler(async (req, res) => {
  const existing = await prisma.goal.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Goal not found');

  const goal = await prisma.goal.update({
    where: { id: req.params.id },
    data: req.body,
  });
  writeAuditLog({ req, action: 'goal.update', resource: 'goal', resourceId: goal.id });
  return ok(res, { goal: withProjections(goal) }, 'Goal updated');
});

// PUT /api/goals/:id/progress — add (or remove) a saved amount.
export const addGoalProgress = asyncHandler(async (req, res) => {
  const existing = await prisma.goal.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!existing) throw new ApiError(404, 'Goal not found');

  const savedAmount = Math.max(0, existing.savedAmount + req.body.amount);
  const isCompleted = savedAmount >= existing.targetAmount;

  const goal = await prisma.goal.update({
    where: { id: req.params.id },
    data: { savedAmount, isCompleted },
  });
  writeAuditLog({
    req,
    action: 'goal.progress',
    resource: 'goal',
    resourceId: goal.id,
    details: { amount: req.body.amount },
  });
  return ok(res, { goal: withProjections(goal) }, isCompleted ? 'Goal reached! 🎉' : 'Progress saved');
});

// DELETE /api/goals/:id
export const deleteGoal = asyncHandler(async (req, res) => {
  const existing = await prisma.goal.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'Goal not found');

  await prisma.goal.delete({ where: { id: req.params.id } });
  writeAuditLog({ req, action: 'goal.delete', resource: 'goal', resourceId: req.params.id });
  return ok(res, null, 'Goal deleted');
});
