import Joi from 'joi';

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

const baseGoal = {
  name: Joi.string().trim().min(2).max(80),
  targetAmount: Joi.number().positive().precision(2),
  savedAmount: Joi.number().min(0).precision(2),
  targetDate: Joi.date().iso().greater('now'),
  category: Joi.string().valid(...GOAL_CATEGORIES),
};

export const createGoalSchema = Joi.object({
  ...baseGoal,
  name: baseGoal.name.required(),
  targetAmount: baseGoal.targetAmount.required(),
  targetDate: baseGoal.targetDate.required(),
  category: baseGoal.category.default('Other'),
  savedAmount: baseGoal.savedAmount.default(0),
});

export const updateGoalSchema = Joi.object({
  ...baseGoal,
  targetDate: Joi.date().iso(), // allow past dates on edit without erroring
  isCompleted: Joi.boolean(),
}).min(1);

// Add (or subtract, with a negative) to the saved amount.
export const goalProgressSchema = Joi.object({
  amount: Joi.number().precision(2).invalid(0).required(),
});

export { GOAL_CATEGORIES };
