import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { requireAuth, requireRoles } from '../security/auth';
import { AuthRequest } from '../types';
import { asyncHandler, validate } from '../utils/http';

export const cashRouter = Router();

const cashEntrySchema = z.object({
  entryType: z.enum(['REVENUE', 'EXPENSE']),
  entryDate: z.string().date(),
  description: z.string().trim().min(3).max(240),
  amountCents: z.number().int().positive()
});

const cashEntrySelect = `ce.id, ce.entry_type AS "entryType", ce.entry_date AS "entryDate", ce.description,
  ce.amount_cents AS "amountCents", ce.payment_id AS "paymentId", ce.recorded_by AS "recordedBy",
  recorder.name AS "recordedByName", ce.created_at AS "createdAt", ce.updated_at AS "updatedAt"`;

cashRouter.use(requireAuth, requireRoles('ADMIN', 'COORDENADOR'));

cashRouter.get('/', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT ${cashEntrySelect}
     FROM cash_entries ce
     LEFT JOIN users recorder ON recorder.id = ce.recorded_by
     WHERE ($1::DATE IS NULL OR ce.entry_date >= $1)
       AND ($2::DATE IS NULL OR ce.entry_date <= $2)
       AND ($3::TEXT IS NULL OR ce.entry_type = $3)
     ORDER BY ce.entry_date DESC, ce.created_at DESC
     LIMIT 500`,
    [req.query.from || null, req.query.to || null, req.query.entryType || null]
  );
  res.json(result.rows);
}));

cashRouter.get('/summary', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT
       COALESCE(sum(amount_cents) FILTER (WHERE entry_type = 'REVENUE'), 0)::INTEGER AS "revenueCents",
       COALESCE(sum(amount_cents) FILTER (WHERE entry_type = 'EXPENSE'), 0)::INTEGER AS "expenseCents",
       (COALESCE(sum(amount_cents) FILTER (WHERE entry_type = 'REVENUE'), 0) - COALESCE(sum(amount_cents) FILTER (WHERE entry_type = 'EXPENSE'), 0))::INTEGER AS "balanceCents",
       count(*)::INTEGER AS total
     FROM cash_entries
     WHERE ($1::DATE IS NULL OR entry_date >= $1)
       AND ($2::DATE IS NULL OR entry_date <= $2)`,
    [req.query.from || null, req.query.to || null]
  );
  res.json(result.rows[0]);
}));

cashRouter.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const body = validate(cashEntrySchema, req.body);
  const result = await query(
    `INSERT INTO cash_entries (entry_type, entry_date, description, amount_cents, recorded_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, entry_type AS "entryType", entry_date AS "entryDate", description, amount_cents AS "amountCents", payment_id AS "paymentId", recorded_by AS "recordedBy", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [body.entryType, body.entryDate, body.description, body.amountCents, req.user?.id]
  );
  res.status(201).json(result.rows[0]);
}));
