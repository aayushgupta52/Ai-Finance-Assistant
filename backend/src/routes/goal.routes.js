import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  createGoalSchema,
  updateGoalSchema,
  goalProgressSchema,
} from '../validators/goal.validator.js';
import {
  listGoals,
  createGoal,
  updateGoal,
  addGoalProgress,
  deleteGoal,
} from '../controllers/goal.controller.js';

const router = Router();

router.use(authenticateJWT);

router.get('/', listGoals);
router.post('/', validate(createGoalSchema), createGoal);

router.put(
  '/:id/progress',
  validate(idParamSchema, 'params'),
  validate(goalProgressSchema),
  addGoalProgress
);
router.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateGoalSchema),
  updateGoal
);
router.delete('/:id', validate(idParamSchema, 'params'), deleteGoal);

export default router;
