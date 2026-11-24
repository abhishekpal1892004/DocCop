import express, { Router } from 'express';
import { handleCalendlyWebhook } from './calendlyWebhook.controller.js';

const router = Router();

router.post('/', express.raw({ type: 'application/json', limit: '256kb' }), handleCalendlyWebhook);

export default router;
