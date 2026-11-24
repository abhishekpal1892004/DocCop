import { Router } from 'express';
import { requireActiveAccount, requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  getMyTickets,
  getTicketDetails,
  postCreateTicket,
  postReplyTicket,
} from './support.controller.js';
import {
  createTicketBodySchema,
  replyTicketBodySchema,
  ticketIdParamSchema,
} from './support.validation.js';

const router = Router();

router.use(requireAuth, requireActiveAccount);

router.post('/tickets', validate({ body: createTicketBodySchema }), postCreateTicket);
router.get('/tickets/my', getMyTickets);
router.get('/tickets/:id', validate({ params: ticketIdParamSchema }), getTicketDetails);
router.post(
  '/tickets/:id/reply',
  validate({ params: ticketIdParamSchema, body: replyTicketBodySchema }),
  postReplyTicket
);

export default router;
