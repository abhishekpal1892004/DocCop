import { Router } from 'express';
import { getMetrics, live, ready } from './health.controller.js';

const router = Router();

router.get('/live', live);
router.get('/ready', ready);
router.get('/metrics', getMetrics);

export default router;
