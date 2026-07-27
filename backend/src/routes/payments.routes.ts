import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { requireAuth, requireRoles } from '../security/auth';
import { AuthRequest } from '../types';
import { asyncHandler, httpError, validate } from '../utils/http';

export const paymentsRouter = Router();

const upsertPaymentSchema = z.object({
  userId: z.string().uuid(),
  seasonId: z.string().uuid().nullable().optional(),
  referenceMonth: z.string().regex(/^\d{4}-\d{2}-01$/),
  dueDate: z.string().date().optional(),
  amountCents: z.number().int().min(0),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID', 'LATE', 'WAIVED']),
  paidAmountCents: z.number().int().min(0).optional(),
  paidAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional()
});
const generateMonthlyPaymentsSchema = z.object({
  seasonId: z.string().uuid().nullable().optional(),
  referenceMonth: z.string().regex(/^\d{4}-\d{2}-01$/).optional(),
  startMonth: z.string().regex(/^\d{4}-\d{2}-01$/).optional(),
  months: z.number().int().min(1).max(24).default(1),
  userIds: z.array(z.string().uuid()).max(300).optional(),
  dueDate: z.string().date(),
  amountCents: z.number().int().min(0),
  notes: z.string().max(500).nullable().optional()
}).refine((body) => body.referenceMonth || body.startMonth, 'Informe o mês inicial da geração.');

const paymentSelect = `p.id, p.user_id AS "userId", u.name AS "userName", p.season_id AS "seasonId", p.reference_month AS "referenceMonth",
      p.due_date AS "dueDate", p.amount_cents AS "amountCents", p.paid_amount_cents AS "paidAmountCents",
      GREATEST(p.amount_cents - p.paid_amount_cents, 0)::INTEGER AS "balanceCents",
      CASE
        WHEN p.status = 'PAID' THEN 'PAID'
        WHEN p.status = 'WAIVED' THEN 'WAIVED'
        WHEN p.paid_amount_cents > 0 THEN 'PARTIAL'
        WHEN p.due_date < CURRENT_DATE THEN 'LATE'
        ELSE p.status
      END AS status,
      p.paid_at AS "paidAt",
      (p.status = 'PAID' AND p.paid_amount_cents >= p.amount_cents AND p.paid_at IS NOT NULL AND p.paid_at::DATE < p.due_date) AS "earnsPoint",
      p.notes`;

paymentsRouter.use(requireAuth);

paymentsRouter.get('/', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT ${paymentSelect}
     FROM payments p
     JOIN users u ON u.id = p.user_id
     WHERE ($1::UUID IS NULL OR p.season_id = $1) AND ($2::TEXT IS NULL OR p.status = $2)
     ORDER BY p.reference_month DESC, p.due_date ASC, u.name ASC`,
    [req.query.seasonId || null, req.query.status || null]
  );
  res.json(result.rows);
}));

paymentsRouter.get('/summary', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT
      COALESCE(sum(amount_cents), 0)::INTEGER AS "totalCents",
      COALESCE(sum(paid_amount_cents), 0)::INTEGER AS "paidCents",
      COALESCE(sum(GREATEST(amount_cents - paid_amount_cents, 0)) FILTER (WHERE status NOT IN ('PAID', 'WAIVED')), 0)::INTEGER AS "openCents",
      count(*)::INTEGER AS total,
      count(*) FILTER (WHERE status = 'PAID')::INTEGER AS paid,
      count(*) FILTER (WHERE status = 'WAIVED')::INTEGER AS waived,
      count(*) FILTER (WHERE status = 'PENDING' AND due_date >= CURRENT_DATE)::INTEGER AS pending,
      count(*) FILTER (WHERE status = 'LATE' OR (status IN ('PENDING', 'PARTIAL') AND due_date < CURRENT_DATE))::INTEGER AS late,
      count(*) FILTER (WHERE status = 'PAID' AND paid_amount_cents >= amount_cents AND paid_at IS NOT NULL AND paid_at::DATE < due_date)::INTEGER AS "earlyPoints"
     FROM payments
     WHERE ($1::UUID IS NULL OR season_id = $1)`,
    [req.query.seasonId || null]
  );
  res.json(result.rows[0]);
}));

paymentsRouter.get('/me', asyncHandler(async (req: AuthRequest, res) => {
  const result = await query(
    `SELECT ${paymentSelect}
     FROM payments p
     JOIN users u ON u.id = p.user_id
     WHERE p.user_id = $1
     ORDER BY reference_month DESC, due_date ASC
     LIMIT 18`,
    [req.user?.id]
  );
  res.json(result.rows);
}));

paymentsRouter.put('/', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req: AuthRequest, res) => {
  const body = validate(upsertPaymentSchema, req.body);
  const dueDate = body.dueDate ?? body.referenceMonth;
  const existingPayment = await query<{ id: string; paid_amount_cents: number }>('SELECT id, paid_amount_cents FROM payments WHERE user_id = $1 AND reference_month = $2', [body.userId, body.referenceMonth]);
  const previousPaidAmountCents = existingPayment.rows[0]?.paid_amount_cents ?? 0;
  const paidAmountCents = body.status === 'WAIVED' ? 0 : body.status === 'PAID' ? body.amountCents : body.status === 'PARTIAL' ? Math.min(body.amountCents, previousPaidAmountCents + (body.paidAmountCents ?? 0)) : 0;
  const status = body.status === 'WAIVED' ? 'WAIVED' : paidAmountCents >= body.amountCents && body.amountCents > 0 ? 'PAID' : paidAmountCents > 0 ? 'PARTIAL' : body.status === 'LATE' ? 'LATE' : 'PENDING';
  const paidAt = body.paidAt ?? (paidAmountCents > 0 ? new Date().toISOString() : null);
  const result = await query(
    `INSERT INTO payments (user_id, season_id, reference_month, due_date, amount_cents, paid_amount_cents, status, paid_at, notes, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (user_id, reference_month) DO UPDATE SET
      season_id = EXCLUDED.season_id,
      due_date = EXCLUDED.due_date,
      amount_cents = EXCLUDED.amount_cents,
      paid_amount_cents = EXCLUDED.paid_amount_cents,
      status = EXCLUDED.status,
      paid_at = EXCLUDED.paid_at,
      notes = EXCLUDED.notes,
      recorded_by = EXCLUDED.recorded_by,
      updated_at = now()
     RETURNING id, user_id AS "userId", season_id AS "seasonId", reference_month AS "referenceMonth", due_date AS "dueDate", amount_cents AS "amountCents", paid_amount_cents AS "paidAmountCents", GREATEST(amount_cents - paid_amount_cents, 0)::INTEGER AS "balanceCents", status, paid_at AS "paidAt", (status = 'PAID' AND paid_amount_cents >= amount_cents AND paid_at IS NOT NULL AND paid_at::DATE < due_date) AS "earnsPoint", notes`,
    [body.userId, body.seasonId ?? null, body.referenceMonth, dueDate, body.amountCents, paidAmountCents, status, paidAt, body.notes ?? null, req.user?.id]
  );
  const payment = result.rows[0];
  const cashDeltaCents = paidAmountCents - previousPaidAmountCents;
  if (cashDeltaCents !== 0) {
    await query(
      `INSERT INTO cash_entries (entry_type, entry_date, description, amount_cents, payment_id, recorded_by)
       SELECT $1, $2::DATE, $3 || to_char($4::DATE, 'MM/YYYY') || ' - ' || u.name, $5, $6, $7
       FROM users u
       WHERE u.id = $8`,
      [cashDeltaCents > 0 ? 'REVENUE' : 'EXPENSE', (paidAt ?? new Date().toISOString()).slice(0, 10), cashDeltaCents > 0 ? 'Mens. ' : 'Estorno Mens. ', body.referenceMonth, Math.abs(cashDeltaCents), payment.id, req.user?.id, body.userId]
    );
  }
  res.json(payment);
}));

paymentsRouter.post('/generate-month', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req: AuthRequest, res) => {
  const body = validate(generateMonthlyPaymentsSchema, req.body);
  const startMonth = body.startMonth ?? body.referenceMonth;
  if (!startMonth) throw httpError(400, 'Informe o mês inicial da geração.');
  const userIds = body.userIds?.length ? body.userIds : null;
  const result = await query<{ id: string }>(
    `WITH months AS (
       SELECT ($2::DATE + (interval '1 month' * gs.month_offset))::DATE AS reference_month,
         ($3::DATE + (interval '1 month' * gs.month_offset))::DATE AS due_date
       FROM generate_series(0, $7::INTEGER - 1) AS gs(month_offset)
     ), target_users AS (
       SELECT id FROM users
       WHERE active = TRUE AND role = 'ATLETA' AND ($8::UUID[] IS NULL OR id = ANY($8::UUID[]))
     )
     INSERT INTO payments (user_id, season_id, reference_month, due_date, amount_cents, paid_amount_cents, status, paid_at, notes, recorded_by)
     SELECT target_users.id, $1, months.reference_month, months.due_date, $4, 0, 'PENDING', NULL, $5, $6
     FROM target_users
     CROSS JOIN months
     ON CONFLICT (user_id, reference_month) DO UPDATE SET
       season_id = COALESCE(payments.season_id, EXCLUDED.season_id),
       due_date = EXCLUDED.due_date,
       amount_cents = EXCLUDED.amount_cents,
       notes = COALESCE(EXCLUDED.notes, payments.notes),
       recorded_by = EXCLUDED.recorded_by,
       updated_at = now()
     WHERE payments.status NOT IN ('PAID', 'WAIVED')
     RETURNING id`,
    [body.seasonId ?? null, startMonth, body.dueDate, body.amountCents, body.notes ?? null, req.user?.id, body.months, userIds]
  );
  res.status(201).json({ generated: result.rowCount });
}));
