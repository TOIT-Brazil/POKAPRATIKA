import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import type { QueryResult, QueryResultRow } from 'pg';
import { z } from 'zod';
import { pool, query } from '../db/pool';
import { requireAuth, requireRoles } from '../security/auth';
import { AuthRequest } from '../types';
import { buildTeamRotationPlan } from '../services/substitution';
import { asyncHandler, httpError, validate } from '../utils/http';

export const matchesRouter = Router();

const athletePositionSchema = z.enum(['GO', 'ZG', 'LD', 'LE', 'MD', 'MC', 'MA', 'AT']);
const guestIdentityPattern = /^guest:[a-z0-9-]{6,}$/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const guestPlayersMigrationFile = 'migrations/17_convidados_temporarios_sumula.sql';
const matchFieldLayoutMigrationFile = 'migrations/18_posicionamento_manual_sumula.sql';
const pregameMigrationFile = 'migrations/19_fluxo_pre_jogo_20_vagas.sql';
const pregameCapacity = 20;

const playerSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(2).max(120).optional(),
  position: athletePositionSchema.nullable().optional(),
  isGuest: z.boolean().optional(),
  team: z.enum(['A', 'B', 'PRESENTE_SEM_JOGAR']),
  roleInMatch: z.enum(['GOLEIRO', 'LINHA', 'PRESENTE_SEM_JOGAR']),
  drawOrder: z.number().int().min(1).nullable().optional(),
  rotationOrder: z.number().int().min(1).nullable().optional(),
  fieldLeft: z.number().min(0).max(100).nullable().optional(),
  fieldTop: z.number().min(0).max(100).nullable().optional(),
  startsOnBench: z.boolean().default(false),
  present: z.boolean().default(true)
}).superRefine((player, ctx) => {
  if (player.fieldLeft != null && player.team === 'A' && (player.fieldLeft < 8 || player.fieldLeft > 47)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Atleta do Time A precisa permanecer na metade esquerda do campo.' });
  }
  if (player.fieldLeft != null && player.team === 'B' && (player.fieldLeft < 53 || player.fieldLeft > 92)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Atleta do Time B precisa permanecer na metade direita do campo.' });
  }
  const guest = player.isGuest === true || guestIdentityPattern.test(player.userId);
  if (guest) {
    if (!guestIdentityPattern.test(player.userId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Convidado temporário precisa usar identificador guest:*.' });
    }
    if (!player.name?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Convidado temporário precisa ter nome.' });
    }
    if (!player.position) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Convidado temporário precisa ter posição original.' });
    }
    return;
  }

  if (!uuidPattern.test(player.userId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Atleta fixo da súmula precisa ter UUID válido.' });
  }
});

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe horário no formato HH:mm.');

const createMatchBaseSchema = z.object({
  seasonId: z.string().uuid().nullable().optional(),
  matchDate: z.string().date(),
  title: z.string().min(2),
  refereeName: z.string().max(120).nullable().optional(),
  teamAName: z.string().min(1).default('Time A'),
  teamBName: z.string().min(1).default('Time B'),
  scheduledStart: timeSchema.default('20:00'),
  scheduledEnd: timeSchema.default('21:00'),
  confirmationOpensHoursBefore: z.number().int().min(1).max(336).default(48),
  confirmationClosesHoursBefore: z.number().int().min(0).max(335).default(3),
  confirmationOpenAt: z.string().datetime().nullable().optional(),
  players: z.array(playerSchema).default([])
});
const createMatchSchema = createMatchBaseSchema.refine((body) => body.scheduledEnd > body.scheduledStart, { message: 'O horário final precisa ser maior que o início.' }).refine((body) => body.confirmationOpensHoursBefore > body.confirmationClosesHoursBefore, { message: 'A confirmação precisa abrir antes de fechar.' });
const lineupSchema = createMatchBaseSchema.omit({ seasonId: true }).partial({ matchDate: true, title: true, teamAName: true, teamBName: true, scheduledStart: true, scheduledEnd: true }).extend({ players: z.array(playerSchema).default([]) }).refine((body) => !body.scheduledStart || !body.scheduledEnd || body.scheduledEnd > body.scheduledStart, { message: 'O horário final precisa ser maior que o início.' });

const eventSchema = z.object({ userId: z.string().min(1), relatedUserId: z.string().min(1).nullable().optional(), eventType: z.enum(['GOL', 'GOL_CONTRA', 'ASSISTENCIA', 'CARTAO_AMARELO', 'CARTAO_VERMELHO', 'CARTAO_AZUL']), minute: z.number().int().min(0).max(180), clockSecond: z.number().int().min(0).max(10800).optional(), team: z.enum(['A', 'B']), occurredAt: z.string().datetime().nullable().optional() });
const scoreSchema = z.object({ teamAScore: z.number().int().min(0), teamBScore: z.number().int().min(0), events: z.array(eventSchema).default([]) });
const correctionSchema = scoreSchema.extend({ reason: z.string().min(5).max(500) });
const draftSchema = scoreSchema.extend({ clockSeconds: z.number().int().min(0).max(10800).default(0), clockRunning: z.boolean().default(false) });
const attendanceSchema = z.object({ responseStatus: z.enum(['JOGAR', 'PRESENTE_SEM_JOGAR', 'AUSENTE']), dinnerConfirmed: z.boolean().default(false), guestCount: z.number().int().min(0).max(20).default(0), notes: z.string().max(300).nullable().optional() });
const pregameGuestSchema = z.object({ name: z.string().trim().min(2).max(120), position: athletePositionSchema });
const pregameReplacementSchema = z.object({ outgoingKey: z.string().min(1), reserveKey: z.string().min(1).optional(), guest: pregameGuestSchema.optional() }).refine((body) => Boolean(body.reserveKey) !== Boolean(body.guest), { message: 'Informe um reserva existente ou um novo convidado.' });
const idParamSchema = z.object({ id: z.string().uuid() });
const manualScheduleBaseSchema = z.object({
  seasonId: z.string().uuid().nullable().optional(),
  matchDate: z.string().date(),
  title: z.string().min(2).default('Futebol de quarta'),
  refereeName: z.string().max(120).nullable().optional(),
  teamAName: z.string().min(1).default('Time A'),
  teamBName: z.string().min(1).default('Time B'),
  scheduledStart: timeSchema.default('20:00'),
  scheduledEnd: timeSchema.default('21:00'),
  confirmationOpensHoursBefore: z.number().int().min(1).max(336).default(48),
  confirmationClosesHoursBefore: z.number().int().min(0).max(335).default(3)
});
const manualScheduleSchema = manualScheduleBaseSchema.refine((body) => body.scheduledEnd > body.scheduledStart, { message: 'O horário final precisa ser maior que o início.' }).refine((body) => body.confirmationOpensHoursBefore > body.confirmationClosesHoursBefore, { message: 'A confirmação precisa abrir antes de fechar.' });
const recurringScheduleSchema = manualScheduleBaseSchema.omit({ matchDate: true }).extend({
  weekday: z.number().int().min(0).max(6).default(3),
  startDate: z.string().date(),
  endDate: z.string().date(),
  players: z.array(playerSchema).default([])
}).refine((body) => body.scheduledEnd > body.scheduledStart, { message: 'O horário final precisa ser maior que o início.' }).refine((body) => body.endDate >= body.startDate, { message: 'A data final precisa ser maior ou igual à inicial.' }).refine((body) => body.confirmationOpensHoursBefore > body.confirmationClosesHoursBefore, { message: 'A confirmação precisa abrir antes de fechar.' });
const schedulePatchSchema = manualScheduleBaseSchema.omit({ seasonId: true }).partial().refine((body) => !body.scheduledStart || !body.scheduledEnd || body.scheduledEnd > body.scheduledStart, { message: 'O horário final precisa ser maior que o início.' });

type MatchPlayerInput = z.infer<typeof playerSchema>;
type MatchEventInput = z.infer<typeof eventSchema>;
type QueryExecutor = <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
type PregameParticipant = {
  participantKey: string;
  userId: string | null;
  guestKey: string | null;
  name: string;
  position: z.infer<typeof athletePositionSchema>;
  source: 'CLUB' | 'GUEST';
};

function positionSequenceOrder(position: string | null | undefined): number {
  if (position === 'GO') return 0;
  if (position === 'LD') return 1;
  if (position === 'LE') return 2;
  if (position === 'ZG') return 3;
  if (position === 'MD') return 4;
  if (position === 'MC') return 5;
  if (position === 'MA') return 6;
  return 7;
}

function deterministicOrder(seed: string, scope: string, participantKey: string): string {
  return createHash('sha256').update(`${seed}:${scope}:${participantKey}`).digest('hex');
}

function drawPregameParticipants(participants: PregameParticipant[], seed: string): { selected: Array<PregameParticipant & { team: 'A' | 'B'; selectionOrder: number; startsOnBench: boolean; roleInMatch: 'GOLEIRO' | 'LINHA' }>; reserves: PregameParticipant[] } {
  if (participants.length < pregameCapacity) throw httpError(409, `O sorteio exige no mínimo ${pregameCapacity} participantes confirmados.`);
  const ordered = [...participants].sort((left, right) => deterministicOrder(seed, 'selection', left.participantKey).localeCompare(deterministicOrder(seed, 'selection', right.participantKey)));
  const goalkeepers = ordered.filter((participant) => participant.position === 'GO');

  const selected = ordered.slice(0, pregameCapacity);
  const selectedKeys = new Set(selected.map((participant) => participant.participantKey));
  for (const goalkeeper of goalkeepers) {
    if (selected.filter((participant) => participant.position === 'GO').length >= 2) break;
    let replaceIndex = -1;
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      if (selected[index].position !== 'GO') {
        replaceIndex = index;
        break;
      }
    }
    if (replaceIndex < 0) break;
    selectedKeys.delete(selected[replaceIndex].participantKey);
    selected[replaceIndex] = goalkeeper;
    selectedKeys.add(goalkeeper.participantKey);
  }

  const byPosition = [...selected].sort((left, right) => {
    const positionDifference = positionSequenceOrder(left.position) - positionSequenceOrder(right.position);
    return positionDifference || deterministicOrder(seed, 'teams', left.participantKey).localeCompare(deterministicOrder(seed, 'teams', right.participantKey));
  });
  const teamCounts = { A: 0, B: 0 };
  const goalkeeperCounts = { A: 0, B: 0 };
  const assigned = byPosition.map((participant) => {
    let team: 'A' | 'B';
    if (participant.position === 'GO' && goalkeeperCounts.A === 0) team = 'A';
    else if (participant.position === 'GO' && goalkeeperCounts.B === 0) team = 'B';
    else team = teamCounts.A <= teamCounts.B ? 'A' : 'B';
    teamCounts[team] += 1;
    const roleInMatch = participant.position === 'GO' && goalkeeperCounts[team] === 0 ? 'GOLEIRO' as const : 'LINHA' as const;
    if (roleInMatch === 'GOLEIRO') goalkeeperCounts[team] += 1;
    return { ...participant, team, roleInMatch };
  });
  for (const team of ['A', 'B'] as const) {
    if (assigned.some((participant) => participant.team === team && participant.roleInMatch === 'GOLEIRO')) continue;
    const fallbackGoalkeeper = assigned.find((participant) => participant.team === team);
    if (fallbackGoalkeeper) fallbackGoalkeeper.roleInMatch = 'GOLEIRO';
  }
  const teamOrder = { A: 0, B: 0 };
  const finalized = assigned.map((participant, index) => {
    teamOrder[participant.team] += 1;
    return { ...participant, selectionOrder: index + 1, startsOnBench: teamOrder[participant.team] > 7 };
  });
  return { selected: finalized, reserves: ordered.filter((participant) => !selectedKeys.has(participant.participantKey)) };
}

function buildConfirmationOpenAt(matchDate: string, scheduledStart: string, hoursBefore: number): string {
  const startsAt = new Date(`${matchDate}T${scheduledStart}:00-03:00`).getTime();
  return new Date(startsAt - hoursBefore * 60 * 60 * 1000).toISOString();
}

function buildConfirmationCloseAt(matchDate: string, scheduledStart: string, hoursBefore: number): string {
  const startsAt = new Date(`${matchDate}T${scheduledStart}:00-03:00`).getTime();
  return new Date(startsAt - hoursBefore * 60 * 60 * 1000).toISOString();
}

function ensureConfirmationWindowOrder(openAt: string, closeAt: string): void {
  if (new Date(closeAt).getTime() <= new Date(openAt).getTime()) throw httpError(400, 'A janela de confirmação precisa abrir antes de fechar. Ajuste as horas de abertura/fechamento.');
}

function confirmationWindowTimeCondition(matchColumns: Set<string>, alias = ''): string {
  if (!matchColumns.has('confirmation_open_at')) return 'TRUE';
  const prefix = alias ? `${alias}.` : '';
  const closeCondition = matchColumns.has('confirmation_close_at') ? ` AND (${prefix}confirmation_close_at IS NULL OR now() < ${prefix}confirmation_close_at)` : '';
  return `${prefix}confirmation_open_at <= now()${closeCondition}`;
}

function confirmationWindowExpression(matchColumns: Set<string>, alias = ''): string {
  const prefix = alias ? `${alias}.` : '';
  return `(${prefix}status = 'DRAFT' AND ${confirmationWindowTimeCondition(matchColumns, alias)})`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isGuestIdentity(value: string | null | undefined): boolean {
  return Boolean(value && guestIdentityPattern.test(value));
}

function isGuestPlayer(player: Pick<MatchPlayerInput, 'userId' | 'isGuest'>): boolean {
  return player.isGuest === true || isGuestIdentity(player.userId);
}

async function buildAutomaticInvitationPlayers(requestedPlayers: MatchPlayerInput[], execute: QueryExecutor = query): Promise<MatchPlayerInput[]> {
  const activeAthletes = await execute<{ id: string; name: string; position: string | null }>(
    `SELECT id, name, position
     FROM users
     WHERE active = TRUE
     ORDER BY name ASC`
  );
  const fixedPlayers: MatchPlayerInput[] = activeAthletes.rows.map((athlete, index) => ({
    userId: athlete.id,
    name: athlete.name,
    position: athletePositionSchema.safeParse(athlete.position).success ? athlete.position as MatchPlayerInput['position'] : 'MC',
    team: 'PRESENTE_SEM_JOGAR',
    roleInMatch: 'PRESENTE_SEM_JOGAR',
    drawOrder: index + 1,
    rotationOrder: null,
    startsOnBench: false,
    present: false
  }));
  const guestPlayers = requestedPlayers.filter(isGuestPlayer).map((player, index) => ({
    ...player,
    drawOrder: fixedPlayers.length + index + 1,
    present: false
  }));
  return [...fixedPlayers, ...guestPlayers];
}

async function getTableColumns(tableName: string): Promise<Set<string>> {
  const result = await query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function getMatchColumns(): Promise<Set<string>> {
  return getTableColumns('matches');
}

async function tableExists(tableName: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return result.rows[0]?.exists === true;
}

async function ensurePregameAvailable(): Promise<void> {
  if (!await tableExists('match_pregame_participants')) {
    throw httpError(409, `Fluxo pré-jogo indisponível: execute ${pregameMigrationFile} manualmente no PostgreSQL da Railway.`);
  }
}

async function activatePregame(execute: QueryExecutor, matchId: string, matchColumns: Set<string>): Promise<void> {
  if (!matchColumns.has('pregame_state') || !matchColumns.has('player_capacity')) return;
  await execute("UPDATE matches SET pregame_state = 'CONFIRMING', player_capacity = $2 WHERE id = $1", [matchId, pregameCapacity]);
}

async function lockScheduleSlot(execute: QueryExecutor, seasonId: string | null | undefined, matchDate: string, scheduledStart: string): Promise<void> {
  const slotKey = `${seasonId ?? 'sem-temporada'}|${matchDate}|${scheduledStart.slice(0, 5)}`;
  await execute('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [slotKey]);
}

async function findScheduleConflict(execute: QueryExecutor, seasonId: string | null | undefined, matchDate: string, scheduledStart: string, excludeMatchId?: string): Promise<string | null> {
  const result = await execute<{ id: string }>(
    `SELECT id
     FROM matches
     WHERE season_id IS NOT DISTINCT FROM $1::UUID
       AND match_date = $2
       AND scheduled_start = $3::TIME
       AND status <> 'CANCELLED'
       AND ($4::UUID IS NULL OR id <> $4::UUID)
     LIMIT 1`,
    [seasonId ?? null, matchDate, scheduledStart, excludeMatchId ?? null]
  );
  return result.rows[0]?.id ?? null;
}

function hasGuestPlayerSupport(columns: Set<string>): boolean {
  return columns.has('guest_key') && columns.has('guest_name') && columns.has('guest_position');
}

function hasGuestEventSupport(columns: Set<string>): boolean {
  return columns.has('guest_key') && columns.has('related_guest_key');
}

function hasFieldLayoutSupport(columns: Set<string>): boolean {
  return columns.has('field_left') && columns.has('field_top');
}

function ensureGuestPlayerSupport(players: MatchPlayerInput[], enabled: boolean): void {
  if (players.some(isGuestPlayer) && !enabled) {
    throw httpError(409, `Convidados temporários indisponíveis: execute ${guestPlayersMigrationFile} no PostgreSQL da Railway.`);
  }
}

function ensureGuestEventSupport(events: MatchEventInput[], enabled: boolean): void {
  const usesGuest = events.some((event) => isGuestIdentity(event.userId) || isGuestIdentity(event.relatedUserId ?? null));
  if (usesGuest && !enabled) {
    throw httpError(409, `Eventos com convidados temporários indisponíveis: execute ${guestPlayersMigrationFile} no PostgreSQL da Railway.`);
  }
}

function ensureFieldLayoutSupport(players: MatchPlayerInput[], enabled: boolean): void {
  const usesManualLayout = players.some((player) => player.fieldLeft != null || player.fieldTop != null);
  if (usesManualLayout && !enabled) {
    throw httpError(409, `Posicionamento manual da súmula indisponível: execute ${matchFieldLayoutMigrationFile} no PostgreSQL da Railway.`);
  }
}

function playerIdentitySql(alias = ''): string {
  const prefix = alias ? `${alias}.` : '';
  return `COALESCE(${prefix}user_id::text, ${prefix}guest_key)`;
}

function relatedIdentitySql(alias = ''): string {
  const prefix = alias ? `${alias}.` : '';
  return `COALESCE(${prefix}related_user_id::text, ${prefix}related_guest_key)`;
}

function mapPlayerForPersistence(player: MatchPlayerInput): { userId: string | null; guestKey: string | null; guestName: string | null; guestPosition: string | null; fieldLeft: number | null; fieldTop: number | null } {
  if (isGuestPlayer(player)) {
    return {
      userId: null,
      guestKey: player.userId,
      guestName: player.name?.trim() ?? null,
      guestPosition: player.position ?? null,
      fieldLeft: player.fieldLeft ?? null,
      fieldTop: player.fieldTop ?? null
    };
  }

  return {
    userId: player.userId,
    guestKey: null,
    guestName: null,
    guestPosition: null,
    fieldLeft: player.fieldLeft ?? null,
    fieldTop: player.fieldTop ?? null
  };
}

function mapEventForPersistence(event: MatchEventInput): { userId: string | null; guestKey: string | null; relatedUserId: string | null; relatedGuestKey: string | null } {
  return {
    userId: isGuestIdentity(event.userId) ? null : event.userId,
    guestKey: isGuestIdentity(event.userId) ? event.userId : null,
    relatedUserId: isGuestIdentity(event.relatedUserId ?? null) ? null : event.relatedUserId ?? null,
    relatedGuestKey: isGuestIdentity(event.relatedUserId ?? null) ? event.relatedUserId ?? null : null
  };
}

async function insertMatchPlayerRecord(execute: QueryExecutor, matchId: string, player: MatchPlayerInput, guestPlayerEnabled: boolean, fieldLayoutEnabled: boolean): Promise<void> {
  const persisted = mapPlayerForPersistence(player);
  if (guestPlayerEnabled && fieldLayoutEnabled) {
    await execute(
      `INSERT INTO match_players (match_id, user_id, guest_key, guest_name, guest_position, team, role_in_match, draw_order, rotation_order, field_left, field_top, starts_on_bench, present)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [matchId, persisted.userId, persisted.guestKey, persisted.guestName, persisted.guestPosition, player.team, player.roleInMatch, player.drawOrder ?? null, player.rotationOrder ?? null, persisted.fieldLeft, persisted.fieldTop, player.startsOnBench, player.present]
    );
    return;
  }

  if (guestPlayerEnabled) {
    await execute(
      `INSERT INTO match_players (match_id, user_id, guest_key, guest_name, guest_position, team, role_in_match, draw_order, rotation_order, starts_on_bench, present)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [matchId, persisted.userId, persisted.guestKey, persisted.guestName, persisted.guestPosition, player.team, player.roleInMatch, player.drawOrder ?? null, player.rotationOrder ?? null, player.startsOnBench, player.present]
    );
    return;
  }

  if (fieldLayoutEnabled) {
    await execute(
      `INSERT INTO match_players (match_id, user_id, team, role_in_match, draw_order, rotation_order, field_left, field_top, starts_on_bench, present)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [matchId, persisted.userId, player.team, player.roleInMatch, player.drawOrder ?? null, player.rotationOrder ?? null, persisted.fieldLeft, persisted.fieldTop, player.startsOnBench, player.present]
    );
    return;
  }

  await execute(
    `INSERT INTO match_players (match_id, user_id, team, role_in_match, draw_order, rotation_order, starts_on_bench, present)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [matchId, persisted.userId, player.team, player.roleInMatch, player.drawOrder ?? null, player.rotationOrder ?? null, player.startsOnBench, player.present]
  );
}

async function insertMatchEventRecord(execute: QueryExecutor, matchId: string, event: MatchEventInput, guestEventEnabled: boolean): Promise<void> {
  const persisted = mapEventForPersistence(event);
  if (guestEventEnabled) {
    await execute(
      `INSERT INTO match_events (match_id, user_id, guest_key, related_user_id, related_guest_key, event_type, minute, team, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::TIMESTAMPTZ, now()))`,
      [matchId, persisted.userId, persisted.guestKey, persisted.relatedUserId, persisted.relatedGuestKey, event.eventType, event.minute, event.team, event.occurredAt ?? null]
    );
    return;
  }

  await execute(
    'INSERT INTO match_events (match_id, user_id, related_user_id, event_type, minute, team, created_at) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::TIMESTAMPTZ, now()))',
    [matchId, persisted.userId, persisted.relatedUserId, event.eventType, event.minute, event.team, event.occurredAt ?? null]
  );
}

async function getPersistedMatchPlayers(matchId: string): Promise<Array<{ userId: string; team: string; roleInMatch: string; present: boolean; startsOnBench: boolean }>> {
  const columns = await getTableColumns('match_players');
  const result = hasGuestPlayerSupport(columns)
    ? await query<{ userId: string; team: string; roleInMatch: string; present: boolean; startsOnBench: boolean }>(
      `SELECT ${playerIdentitySql()} AS "userId", team, role_in_match AS "roleInMatch", present, starts_on_bench AS "startsOnBench"
       FROM match_players
       WHERE match_id = $1`,
      [matchId]
    )
    : await query<{ userId: string; team: string; roleInMatch: string; present: boolean; startsOnBench: boolean }>(
      'SELECT user_id AS "userId", team, role_in_match AS "roleInMatch", present, starts_on_bench AS "startsOnBench" FROM match_players WHERE match_id = $1',
      [matchId]
    );
  return result.rows;
}

async function getPersistedMatchEvents(matchId: string): Promise<Array<{ userId: string; relatedUserId: string | null; team: string }>> {
  const columns = await getTableColumns('match_events');
  const result = hasGuestEventSupport(columns)
    ? await query<{ userId: string; relatedUserId: string | null; team: string }>(
      `SELECT ${playerIdentitySql()} AS "userId", ${relatedIdentitySql()} AS "relatedUserId", team
       FROM match_events
       WHERE match_id = $1`,
      [matchId]
    )
    : await query<{ userId: string; relatedUserId: string | null; team: string }>(
      'SELECT user_id AS "userId", related_user_id AS "relatedUserId", team FROM match_events WHERE match_id = $1',
      [matchId]
    );
  return result.rows;
}

async function getMatchEventTimeline(matchId: string): Promise<Array<{ userId: string; relatedUserId: string | null; eventType: string; minute: number; team: string; createdAt: string }>> {
  const columns = await getTableColumns('match_events');
  const result = hasGuestEventSupport(columns)
    ? await query<{ userId: string; relatedUserId: string | null; eventType: string; minute: number; team: string; createdAt: string }>(
      `SELECT ${playerIdentitySql()} AS "userId", ${relatedIdentitySql()} AS "relatedUserId", event_type AS "eventType", minute, team, created_at AS "createdAt"
       FROM match_events
       WHERE match_id = $1
       ORDER BY minute ASC, created_at ASC`,
      [matchId]
    )
    : await query<{ userId: string; relatedUserId: string | null; eventType: string; minute: number; team: string; createdAt: string }>(
      'SELECT user_id AS "userId", related_user_id AS "relatedUserId", event_type AS "eventType", minute, team, created_at AS "createdAt" FROM match_events WHERE match_id = $1 ORDER BY minute ASC, created_at ASC',
      [matchId]
    );
  return result.rows;
}

async function ensureScheduleAvailable(): Promise<void> {
  const matchColumns = await getMatchColumns();
  if (!matchColumns.has('confirmation_open_at') || !matchColumns.has('confirmation_opens_hours_before') || !matchColumns.has('confirmation_opened_at') || !matchColumns.has('confirmation_close_at') || !matchColumns.has('confirmation_closes_hours_before') || !await tableExists('match_schedule_rules')) {
    throw httpError(409, 'Agenda de confirmações indisponível: execute migrations/12_agendamento_confirmacao_jogos.sql e migrations/16_fechamento_automatico_confirmacao_jogos.sql no PostgreSQL da Railway.');
  }
}

async function validatePlayersInput(players: MatchPlayerInput[]): Promise<void> {
  const userIds = players.map((player) => player.userId);
  if (new Set(userIds).size !== userIds.length) throw httpError(400, 'A súmula não pode repetir o mesmo atleta.');
  const fixedUserIds = players.filter((player) => !isGuestPlayer(player)).map((player) => player.userId);
  if (fixedUserIds.length) {
    const activeUsers = await query<{ id: string }>('SELECT id FROM users WHERE id = ANY($1::UUID[]) AND active = TRUE', [fixedUserIds]);
    if (activeUsers.rowCount !== fixedUserIds.length) throw httpError(400, 'Todos os atletas fixos da súmula precisam estar ativos.');
  }
  for (const player of players) {
    if (player.team === 'PRESENTE_SEM_JOGAR' && player.roleInMatch !== 'PRESENTE_SEM_JOGAR') throw httpError(400, 'Atleta presente sem jogar precisa ter papel PRESENTE_SEM_JOGAR.');
    if (player.team !== 'PRESENTE_SEM_JOGAR' && player.roleInMatch === 'PRESENTE_SEM_JOGAR') throw httpError(400, 'Atleta escalado em time precisa ser GOLEIRO ou LINHA.');
  }
}

async function validateConfirmedPlayersForTeams(matchId: string, players: MatchPlayerInput[]): Promise<void> {
  const assignedUserIds = players
    .filter((player) => !isGuestPlayer(player) && (player.team === 'A' || player.team === 'B'))
    .map((player) => player.userId);
  if (!assignedUserIds.length) return;

  const confirmed = await query<{ userId: string }>(
    `SELECT user_id AS "userId"
     FROM match_attendance_responses
     WHERE match_id = $1
       AND user_id = ANY($2::UUID[])
       AND response_status = 'JOGAR'`,
    [matchId, assignedUserIds]
  );
  if (confirmed.rowCount !== assignedUserIds.length) {
    throw httpError(409, 'O sorteio só pode incluir atletas convocados que confirmaram presença para jogar.');
  }
}

async function validateLineupReady(matchId: string): Promise<void> {
  const players = await getPersistedMatchPlayers(matchId);
  const starters = players.filter((player) => player.present && !player.startsOnBench && (player.team === 'A' || player.team === 'B'));
  for (const team of ['A', 'B']) {
    const teamPlayers = starters.filter((player) => player.team === team);
    const goalkeepers = teamPlayers.filter((player) => player.roleInMatch === 'GOLEIRO').length;
    const linePlayers = teamPlayers.filter((player) => player.roleInMatch === 'LINHA').length;
    if (goalkeepers !== 1) throw httpError(400, `O time ${team} precisa ter exatamente 1 goleiro antes de iniciar o jogo.`);
    if (linePlayers < 6) throw httpError(400, `O time ${team} precisa ter pelo menos 6 jogadores de linha antes de iniciar o jogo.`);
  }
}

async function normalizePersistedOperationalRoles(matchId: string): Promise<void> {
  const matchPlayerColumns = await getTableColumns('match_players');
  const guestPlayerEnabled = hasGuestPlayerSupport(matchPlayerColumns);
  const players = guestPlayerEnabled
    ? await query<{
      userId: string;
      team: 'A' | 'B' | 'PRESENTE_SEM_JOGAR';
      roleInMatch: 'GOLEIRO' | 'LINHA' | 'PRESENTE_SEM_JOGAR';
      startsOnBench: boolean;
      present: boolean;
      position: string | null;
      drawOrder: number | null;
      rotationOrder: number | null;
    }>(
      `SELECT ${playerIdentitySql('mp')} AS "userId", mp.team, mp.role_in_match AS "roleInMatch", mp.starts_on_bench AS "startsOnBench", mp.present,
              COALESCE(mp.guest_position, u.position) AS position, mp.draw_order AS "drawOrder", mp.rotation_order AS "rotationOrder"
       FROM match_players mp
       LEFT JOIN users u ON u.id = mp.user_id
       WHERE mp.match_id = $1`,
      [matchId]
    )
    : await query<{
      userId: string;
      team: 'A' | 'B' | 'PRESENTE_SEM_JOGAR';
      roleInMatch: 'GOLEIRO' | 'LINHA' | 'PRESENTE_SEM_JOGAR';
      startsOnBench: boolean;
      present: boolean;
      position: string | null;
      drawOrder: number | null;
      rotationOrder: number | null;
    }>(
      `SELECT mp.user_id AS "userId", mp.team, mp.role_in_match AS "roleInMatch", mp.starts_on_bench AS "startsOnBench", mp.present, u.position,
              mp.draw_order AS "drawOrder", mp.rotation_order AS "rotationOrder"
       FROM match_players mp
       JOIN users u ON u.id = mp.user_id
       WHERE mp.match_id = $1`,
      [matchId]
    );

  const updates: Array<{ userId: string; roleInMatch: 'GOLEIRO' | 'LINHA'; startsOnBench: boolean }> = [];

  const compareOperationalOrder = (
    left: { startsOnBench: boolean; position: string | null; rotationOrder: number | null; drawOrder: number | null; userId: string },
    right: { startsOnBench: boolean; position: string | null; rotationOrder: number | null; drawOrder: number | null; userId: string }
  ) => {
    const starterDiff = Number(left.startsOnBench) - Number(right.startsOnBench);
    if (starterDiff !== 0) return starterDiff;
    const leftRotation = left.rotationOrder ?? left.drawOrder ?? Number.MAX_SAFE_INTEGER;
    const rightRotation = right.rotationOrder ?? right.drawOrder ?? Number.MAX_SAFE_INTEGER;
    if (leftRotation !== rightRotation) return leftRotation - rightRotation;
    const positionDiff = positionSequenceOrder(left.position) - positionSequenceOrder(right.position);
    if (positionDiff !== 0) return positionDiff;
    return left.userId.localeCompare(right.userId);
  };

  for (const team of ['A', 'B'] as const) {
    const teamPlayers = players.rows
      .filter((player) => player.team === team && player.present)
      .sort(compareOperationalOrder);

    if (!teamPlayers.length) continue;

    const starters = teamPlayers.filter((player) => !player.startsOnBench);
    const goalkeeperCandidate = starters.find((player) => player.roleInMatch === 'GOLEIRO')
      ?? starters.find((player) => player.position === 'GO')
      ?? starters[0]
      ?? teamPlayers.find((player) => player.roleInMatch === 'GOLEIRO')
      ?? teamPlayers.find((player) => player.position === 'GO')
      ?? teamPlayers[0];

    const lineCandidates = teamPlayers
      .filter((player) => player.userId !== goalkeeperCandidate?.userId)
      .sort(compareOperationalOrder);
    const starterIds = new Set<string>([
      ...(goalkeeperCandidate ? [goalkeeperCandidate.userId] : []),
      ...lineCandidates.slice(0, 6).map((player) => player.userId)
    ]);

    for (const player of teamPlayers) {
      updates.push({
        userId: player.userId,
        roleInMatch: player.userId === goalkeeperCandidate?.userId ? 'GOLEIRO' : 'LINHA',
        startsOnBench: !starterIds.has(player.userId)
      });
    }
  }

  if (!updates.length) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const update of updates) {
      if (guestPlayerEnabled && isGuestIdentity(update.userId)) {
        await client.query(
          `UPDATE match_players
           SET role_in_match = $3,
               starts_on_bench = $4
           WHERE match_id = $1 AND guest_key = $2`,
          [matchId, update.userId, update.roleInMatch, update.startsOnBench]
        );
      } else {
        await client.query(
          `UPDATE match_players
           SET role_in_match = $3,
               starts_on_bench = $4
           WHERE match_id = $1 AND user_id = $2::UUID`,
          [matchId, update.userId, update.roleInMatch, update.startsOnBench]
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function validateLineupAgainstEvents(matchId: string, players: MatchPlayerInput[]): Promise<void> {
  const events = await getPersistedMatchEvents(matchId);
  if (!events.length) return;
  const playerMap = new Map(players.map((player) => [player.userId, player]));
  for (const event of events) {
    const player = playerMap.get(event.userId);
    if (!player || player.team === 'PRESENTE_SEM_JOGAR' || player.team !== event.team) throw httpError(409, 'Não é possível salvar escalação incompatível com eventos já lançados na súmula.');
    if (event.relatedUserId && !playerMap.has(event.relatedUserId)) throw httpError(409, 'Não é possível remover atleta relacionado a evento já lançado.');
  }
}

async function validateDraftSafety(matchId: string, body: z.infer<typeof draftSchema>): Promise<void> {
  const match = await query<{ status: string }>('SELECT status FROM matches WHERE id = $1', [matchId]);
  if (!match.rowCount) throw httpError(404, 'Súmula não encontrada.');
  if (match.rows[0].status === 'CONFIRMED') throw httpError(409, 'Súmula confirmada não recebe rascunho operacional. Use correção auditada.');
  if (match.rows[0].status === 'CANCELLED') throw httpError(409, 'Súmula cancelada não recebe rascunho operacional.');

  const eventColumns = await getTableColumns('match_events');
  ensureGuestEventSupport(body.events, hasGuestEventSupport(eventColumns));

  const players = await getPersistedMatchPlayers(matchId);
  const playerMap = new Map(players.map((player) => [player.userId, player]));
  for (const event of body.events) {
    const player = playerMap.get(event.userId);
    if (!player || !player.present || player.team === 'PRESENTE_SEM_JOGAR') throw httpError(400, 'O rascunho contém evento de atleta que não está escalado para jogar.');
    if (player.team !== event.team) throw httpError(400, 'O time do evento no rascunho precisa ser igual ao time do atleta.');
    if (event.relatedUserId) {
      const relatedPlayer = playerMap.get(event.relatedUserId);
      if (!relatedPlayer || !relatedPlayer.present || relatedPlayer.team === 'PRESENTE_SEM_JOGAR') throw httpError(400, 'Atleta relacionado no rascunho precisa estar escalado para jogar.');
      if (event.relatedUserId === event.userId) throw httpError(400, 'Atleta relacionado no rascunho não pode ser o próprio autor do evento.');
      if (relatedPlayer.team !== event.team) throw httpError(400, 'Atleta relacionado no rascunho precisa estar no mesmo time do evento.');
    }
  }
}

async function validateScoreSheet(matchId: string, body: z.infer<typeof scoreSchema>, allowConfirmed = false): Promise<void> {
  const match = await query<{ status: string; started_at: string | null }>('SELECT status, started_at FROM matches WHERE id = $1', [matchId]);
  if (!match.rowCount) throw httpError(404, 'Súmula não encontrada.');
  if (match.rows[0].status === 'CONFIRMED' && !allowConfirmed) throw httpError(409, 'Súmula já confirmada não pode ser alterada sem correção auditada.');
  if (match.rows[0].status === 'CANCELLED') throw httpError(409, 'Súmula cancelada não pode ser alterada.');
  if (!allowConfirmed && !['RUNNING', 'SUBMITTED'].includes(match.rows[0].status)) throw httpError(409, 'A súmula só pode ser submetida depois do botão Jogo iniciado.');
  if (!allowConfirmed && !match.rows[0].started_at) throw httpError(409, 'A súmula precisa ter início oficial registrado antes da submissão.');
  await validateLineupReady(matchId);

  const eventColumns = await getTableColumns('match_events');
  ensureGuestEventSupport(body.events, hasGuestEventSupport(eventColumns));

  const players = await getPersistedMatchPlayers(matchId);
  const playerMap = new Map(players.map((player) => [player.userId, player]));
  const playableTeams = new Set(players.filter((player) => player.present && (player.team === 'A' || player.team === 'B')).map((player) => player.team));
  if (!playableTeams.has('A') || !playableTeams.has('B')) throw httpError(400, 'A súmula precisa ter atletas presentes nos times A e B.');

  for (const event of body.events) {
    const player = playerMap.get(event.userId);
    if (!player || !player.present || player.team === 'PRESENTE_SEM_JOGAR') throw httpError(400, 'Todos os eventos precisam pertencer a atletas escalados para jogar.');
    if (player.team !== event.team) throw httpError(400, 'O time do evento precisa ser igual ao time do atleta na súmula.');
    if (event.relatedUserId) {
      const relatedPlayer = playerMap.get(event.relatedUserId);
      if (!relatedPlayer || !relatedPlayer.present || relatedPlayer.team === 'PRESENTE_SEM_JOGAR') throw httpError(400, 'Atleta relacionado no evento precisa estar escalado para jogar.');
      if (event.relatedUserId === event.userId) throw httpError(400, 'Atleta relacionado no evento não pode ser o próprio autor.');
      if (relatedPlayer.team !== event.team) throw httpError(400, 'Atleta relacionado no evento precisa estar no mesmo time do evento.');
    }
  }

  const goalsA = body.events.filter((event) => (event.eventType === 'GOL' && event.team === 'A') || (event.eventType === 'GOL_CONTRA' && event.team === 'B')).length;
  const goalsB = body.events.filter((event) => (event.eventType === 'GOL' && event.team === 'B') || (event.eventType === 'GOL_CONTRA' && event.team === 'A')).length;
  if (goalsA !== body.teamAScore || goalsB !== body.teamBScore) throw httpError(400, 'O placar precisa bater com a quantidade de gols lançados por time.');
}

async function createAutomaticSuspensions(matchId: string): Promise<void> {
  const matchResult = await query<{ season_id: string | null }>('SELECT season_id FROM matches WHERE id = $1', [matchId]);
  const seasonId = matchResult.rows[0]?.season_id ?? null;

  await query(
    `INSERT INTO athlete_suspensions (user_id, season_id, trigger_match_id, reason)
     SELECT DISTINCT user_id, $2, $1, 'CARTAO_VERMELHO'
     FROM match_events
     WHERE match_id = $1 AND event_type = 'CARTAO_VERMELHO' AND user_id IS NOT NULL
     ON CONFLICT (user_id, trigger_match_id, reason) DO NOTHING`,
    [matchId, seasonId]
  );

  const yellowCandidates = await query<{ user_id: string }>(
    `SELECT DISTINCT me.user_id
     FROM match_events me
     WHERE me.match_id = $1 AND me.event_type = 'CARTAO_AMARELO' AND me.user_id IS NOT NULL`,
    [matchId]
  );

  for (const candidate of yellowCandidates.rows) {
    const total = await query<{ total: string }>(
      `SELECT count(*) AS total
       FROM (
        SELECT me.id
        FROM match_events me
        JOIN matches m ON m.id = me.match_id
        WHERE me.user_id = $1
          AND me.event_type = 'CARTAO_AMARELO'
          AND m.status = 'CONFIRMED'
          AND ($2::UUID IS NULL OR m.season_id = $2)
          AND NOT EXISTS (
            SELECT 1
            FROM athlete_suspensions s
            WHERE s.user_id = me.user_id
              AND s.reason = 'ACUMULO_3_CARTOES'
              AND s.created_at > me.created_at
          )
       ) cards`,
      [candidate.user_id, seasonId]
    );

    if (Number(total.rows[0].total) >= 3) {
      await query(
        `INSERT INTO athlete_suspensions (user_id, season_id, trigger_match_id, reason)
         VALUES ($1, $2, $3, 'ACUMULO_3_CARTOES')
         ON CONFLICT (user_id, trigger_match_id, reason) DO NOTHING`,
        [candidate.user_id, seasonId, matchId]
      );
    }
  }
}

matchesRouter.use(requireAuth);

matchesRouter.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const matchColumns = await getMatchColumns();
  const hasAttendance = await tableExists('match_attendance_responses');
  const hasPregameParticipants = matchColumns.has('pregame_state') && await tableExists('match_pregame_participants');
  const confirmationOpenExpression = confirmationWindowExpression(matchColumns, 'm');
  const scheduleSelect = [
    matchColumns.has('scheduled_start') ? 'm.scheduled_start AS "scheduledStart"' : 'TIME \'20:00\' AS "scheduledStart"',
    matchColumns.has('scheduled_end') ? 'm.scheduled_end AS "scheduledEnd"' : 'TIME \'21:00\' AS "scheduledEnd"',
    matchColumns.has('confirmation_open_at') ? 'm.confirmation_open_at AS "confirmationOpenAt"' : 'NULL::TIMESTAMPTZ AS "confirmationOpenAt"',
    matchColumns.has('confirmation_opens_hours_before') ? 'm.confirmation_opens_hours_before AS "confirmationOpensHoursBefore"' : '48::INTEGER AS "confirmationOpensHoursBefore"',
    matchColumns.has('confirmation_close_at') ? 'm.confirmation_close_at AS "confirmationCloseAt"' : 'NULL::TIMESTAMPTZ AS "confirmationCloseAt"',
    matchColumns.has('confirmation_closes_hours_before') ? 'm.confirmation_closes_hours_before AS "confirmationClosesHoursBefore"' : '3::INTEGER AS "confirmationClosesHoursBefore"',
    matchColumns.has('confirmation_opened_at') ? 'm.confirmation_opened_at AS "confirmationOpenedAt"' : 'NULL::TIMESTAMPTZ AS "confirmationOpenedAt"',
    matchColumns.has('schedule_source') ? 'm.schedule_source AS "scheduleSource"' : '\'MANUAL\' AS "scheduleSource"',
    `${confirmationOpenExpression} AS "confirmationOpen"`,
    matchColumns.has('pregame_state') ? 'm.pregame_state AS "pregameState"' : 'NULL::TEXT AS "pregameState"',
    matchColumns.has('player_capacity') ? 'm.player_capacity AS "playerCapacity"' : 'NULL::INTEGER AS "playerCapacity"',
    matchColumns.has('drawn_at') ? 'm.drawn_at AS "drawnAt"' : 'NULL::TIMESTAMPTZ AS "drawnAt"'
  ];
  const attendanceJoin = hasAttendance
    ? `LEFT JOIN LATERAL (
         SELECT
          count(*) FILTER (WHERE response_status = 'JOGAR')::INTEGER AS playing,
          count(*) FILTER (WHERE response_status = 'PRESENTE_SEM_JOGAR')::INTEGER AS present_only,
          count(*) FILTER (WHERE response_status = 'AUSENTE')::INTEGER AS absent,
          COALESCE(sum(CASE WHEN dinner_confirmed THEN 1 + guest_count ELSE 0 END), 0)::INTEGER AS dinner_people,
          max(response_status) FILTER (WHERE user_id = $2::UUID) AS my_status
         FROM match_attendance_responses
         WHERE match_id = m.id
       ) att ON TRUE`
    : '';
  const attendanceSelect = hasAttendance
    ? 'COALESCE(att.playing, 0) AS "attendancePlaying", COALESCE(att.present_only, 0) AS "attendancePresentOnly", COALESCE(att.absent, 0) AS "attendanceAbsent", COALESCE(att.dinner_people, 0) AS "attendanceDinnerPeople", att.my_status AS "myAttendanceStatus"'
    : '0::INTEGER AS "attendancePlaying", 0::INTEGER AS "attendancePresentOnly", 0::INTEGER AS "attendanceAbsent", 0::INTEGER AS "attendanceDinnerPeople", NULL::TEXT AS "myAttendanceStatus"';
  const pregameEligibleSelect = hasPregameParticipants
    ? `CASE
         WHEN m.pregame_state = 'DRAWN' THEN (
           SELECT count(*)::INTEGER
           FROM match_pregame_participants mpp
           WHERE mpp.match_id = m.id AND mpp.participant_status IN ('SELECTED', 'RESERVE')
         )
         ELSE ${hasAttendance ? 'COALESCE(att.playing, 0)' : '0'} + (
           SELECT count(*)::INTEGER
           FROM match_pregame_participants mpp
           WHERE mpp.match_id = m.id AND mpp.source = 'GUEST' AND mpp.participant_status <> 'REPLACED'
         )
       END AS "pregameEligibleCount"`
    : `${hasAttendance ? 'COALESCE(att.playing, 0)' : '0'}::INTEGER AS "pregameEligibleCount"`;
  const result = await query(
    `SELECT m.id, m.season_id AS "seasonId", m.match_date AS "matchDate", m.title, m.referee_name AS "refereeName", m.status,
      m.team_a_name AS "teamAName", m.team_b_name AS "teamBName", m.team_a_score AS "teamAScore", m.team_b_score AS "teamBScore", m.created_at AS "createdAt",
      ${scheduleSelect.join(', ')}, ${attendanceSelect}, ${pregameEligibleSelect},
      (SELECT count(*)::INTEGER FROM users invited WHERE invited.active = TRUE) AS "invitedCount",
      EXISTS (SELECT 1 FROM users invited WHERE invited.id = $2::UUID AND invited.active = TRUE) AS "isInvited"
     FROM matches m
     ${attendanceJoin}
    WHERE ($1::UUID IS NULL OR m.season_id = $1)
    ORDER BY m.match_date DESC, m.created_at DESC
     LIMIT 80`,
    [req.query.seasonId || null, req.user?.id]
  );
  res.json(result.rows);
}));

matchesRouter.get('/confirmation-prompt', asyncHandler(async (req: AuthRequest, res) => {
  const matchColumns = await getMatchColumns();
  const hasAttendance = await tableExists('match_attendance_responses');
  const seasonId = req.query.seasonId || null;
  const userId = req.user?.id;
  const orderStart = matchColumns.has('scheduled_start') ? 'm.scheduled_start' : 'TIME \'20:00\'';
  const openCondition = confirmationWindowTimeCondition(matchColumns, 'm');

  if (!userId || !hasAttendance) {
    res.json({ kind: null, match: null });
    return;
  }

  const scheduleSelect = [
    matchColumns.has('scheduled_start') ? 'm.scheduled_start AS "scheduledStart"' : 'TIME \'20:00\' AS "scheduledStart"',
    matchColumns.has('scheduled_end') ? 'm.scheduled_end AS "scheduledEnd"' : 'TIME \'21:00\' AS "scheduledEnd"',
    matchColumns.has('confirmation_open_at') ? 'm.confirmation_open_at AS "confirmationOpenAt"' : 'NULL::TIMESTAMPTZ AS "confirmationOpenAt"',
    matchColumns.has('confirmation_opens_hours_before') ? 'm.confirmation_opens_hours_before AS "confirmationOpensHoursBefore"' : '48::INTEGER AS "confirmationOpensHoursBefore"',
    matchColumns.has('confirmation_close_at') ? 'm.confirmation_close_at AS "confirmationCloseAt"' : 'NULL::TIMESTAMPTZ AS "confirmationCloseAt"',
    matchColumns.has('confirmation_closes_hours_before') ? 'm.confirmation_closes_hours_before AS "confirmationClosesHoursBefore"' : '3::INTEGER AS "confirmationClosesHoursBefore"',
    matchColumns.has('confirmation_opened_at') ? 'm.confirmation_opened_at AS "confirmationOpenedAt"' : 'NULL::TIMESTAMPTZ AS "confirmationOpenedAt"',
    matchColumns.has('schedule_source') ? 'm.schedule_source AS "scheduleSource"' : '\'MANUAL\' AS "scheduleSource"',
    `(m.status = 'DRAFT' AND ${openCondition}) AS "confirmationOpen"`
  ];
  const attendanceSelect = 'COALESCE(att.playing, 0) AS "attendancePlaying", COALESCE(att.present_only, 0) AS "attendancePresentOnly", COALESCE(att.absent, 0) AS "attendanceAbsent", COALESCE(att.dinner_people, 0) AS "attendanceDinnerPeople", att.my_status AS "myAttendanceStatus"';
  const baseSelect = `SELECT m.id, m.season_id AS "seasonId", m.match_date AS "matchDate", m.title, m.referee_name AS "refereeName", m.status,
      m.team_a_name AS "teamAName", m.team_b_name AS "teamBName", m.team_a_score AS "teamAScore", m.team_b_score AS "teamBScore", m.created_at AS "createdAt",
      ${scheduleSelect.join(', ')}, ${attendanceSelect}
     FROM matches m
     LEFT JOIN LATERAL (
       SELECT
        count(*) FILTER (WHERE response_status = 'JOGAR')::INTEGER AS playing,
        count(*) FILTER (WHERE response_status = 'PRESENTE_SEM_JOGAR')::INTEGER AS present_only,
        count(*) FILTER (WHERE response_status = 'AUSENTE')::INTEGER AS absent,
        COALESCE(sum(CASE WHEN dinner_confirmed THEN 1 + guest_count ELSE 0 END), 0)::INTEGER AS dinner_people,
        max(response_status) FILTER (WHERE user_id = $2::UUID) AS my_status
       FROM match_attendance_responses
       WHERE match_id = m.id
     ) att ON TRUE`;
  const responsePrompt = await query(
    `${baseSelect}
     WHERE ($1::UUID IS NULL OR m.season_id = $1)
       AND m.status = 'DRAFT'
       AND ${openCondition}
      AND EXISTS (SELECT 1 FROM users invited WHERE invited.id = $2::UUID AND invited.active = TRUE)
       AND NOT EXISTS (
         SELECT 1
         FROM match_attendance_responses mar
         WHERE mar.match_id = m.id
           AND mar.user_id = $2::UUID
       )
    ORDER BY m.match_date ASC, ${orderStart} ASC NULLS LAST, m.created_at ASC
     LIMIT 1`,
    [seasonId, userId]
  );

  if (responsePrompt.rowCount) {
    res.json({ kind: 'ATTENDANCE', match: responsePrompt.rows[0] });
    return;
  }

  res.json({ kind: null, match: null });
}));

matchesRouter.post('/', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req: AuthRequest, res) => {
  const body = validate(createMatchSchema, req.body);
  const requestedPlayers = (body.players ?? []).map((player) => ({ ...player, startsOnBench: player.startsOnBench ?? false, present: false }));
  const players = await buildAutomaticInvitationPlayers(requestedPlayers);
  await validatePlayersInput(players);
  const matchPlayerColumns = await getTableColumns('match_players');
  const guestPlayerEnabled = hasGuestPlayerSupport(matchPlayerColumns);
  const fieldLayoutEnabled = hasFieldLayoutSupport(matchPlayerColumns);
  ensureGuestPlayerSupport(players, guestPlayerEnabled);
  ensureFieldLayoutSupport(players, fieldLayoutEnabled);
  const seasonResult = body.seasonId ? await query('SELECT id FROM seasons WHERE id = $1 AND status = \'OPEN\'', [body.seasonId]) : { rowCount: 0 };
  const seasonId = seasonResult.rowCount ? body.seasonId : null;
  const matchColumns = await getMatchColumns();
  const scheduledStart = body.scheduledStart ?? '20:00';
  const scheduledEnd = body.scheduledEnd ?? '21:00';
  const confirmationOpensHoursBefore = body.confirmationOpensHoursBefore ?? 48;
  const confirmationClosesHoursBefore = body.confirmationClosesHoursBefore ?? 3;
  const confirmationOpenAt = body.confirmationOpenAt ?? buildConfirmationOpenAt(body.matchDate, scheduledStart, confirmationOpensHoursBefore);
  const confirmationCloseAt = buildConfirmationCloseAt(body.matchDate, scheduledStart, confirmationClosesHoursBefore);
  ensureConfirmationWindowOrder(confirmationOpenAt, confirmationCloseAt);
  const hasFullConfirmationWindow = matchColumns.has('confirmation_open_at') && matchColumns.has('confirmation_opens_hours_before') && matchColumns.has('confirmation_close_at') && matchColumns.has('confirmation_closes_hours_before');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (hasFullConfirmationWindow) {
      await lockScheduleSlot(client.query.bind(client), seasonId, body.matchDate, scheduledStart);
      if (await findScheduleConflict(client.query.bind(client), seasonId, body.matchDate, scheduledStart)) {
        throw httpError(409, 'Já existe um jogo nesta temporada, data e horário. Abra a Agenda para revisar.');
      }
    }
    const match = await client.query<{ id: string }>(
      hasFullConfirmationWindow
        ? `INSERT INTO matches (season_id, match_date, title, referee_name, team_a_name, team_b_name, scheduled_start, scheduled_end, confirmation_open_at, confirmation_opens_hours_before, confirmation_close_at, confirmation_closes_hours_before, schedule_source, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::TIME, $8::TIME, $9::TIMESTAMPTZ, $10, $11::TIMESTAMPTZ, $12, 'MANUAL', $13)
       RETURNING id`
        : `INSERT INTO matches (season_id, match_date, title, referee_name, team_a_name, team_b_name, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      hasFullConfirmationWindow
        ? [seasonId, body.matchDate, body.title, body.refereeName ?? null, body.teamAName, body.teamBName, scheduledStart, scheduledEnd, confirmationOpenAt, confirmationOpensHoursBefore, confirmationCloseAt, confirmationClosesHoursBefore, req.user?.id]
        : [seasonId, body.matchDate, body.title, body.refereeName ?? null, body.teamAName, body.teamBName, req.user?.id]
    );

    for (const player of players) {
      await insertMatchPlayerRecord(client.query.bind(client), match.rows[0].id, player, guestPlayerEnabled, fieldLayoutEnabled);
    }
    await activatePregame(client.query.bind(client), match.rows[0].id, matchColumns);
    await client.query('COMMIT');
    res.status(201).json({ id: match.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

matchesRouter.patch('/:id/lineup', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req, res) => {
  const body = validate(lineupSchema, req.body);
  const requestedPlayers = (body.players ?? []).map((player) => ({ ...player, startsOnBench: player.startsOnBench ?? false, present: player.present ?? true }));
  const players = requestedPlayers.some((player) => !isGuestPlayer(player)) ? requestedPlayers : await buildAutomaticInvitationPlayers(requestedPlayers);
  await validatePlayersInput(players);
  const matchPlayerColumns = await getTableColumns('match_players');
  const guestPlayerEnabled = hasGuestPlayerSupport(matchPlayerColumns);
  const fieldLayoutEnabled = hasFieldLayoutSupport(matchPlayerColumns);
  ensureGuestPlayerSupport(players, guestPlayerEnabled);
  ensureFieldLayoutSupport(players, fieldLayoutEnabled);
  await validateConfirmedPlayersForTeams(req.params.id, players);
  await validateLineupAgainstEvents(req.params.id, players);
  const matchColumns = await getMatchColumns();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const match = await client.query<{ status: string; pregameState: string | null }>(
      `SELECT status, ${matchColumns.has('pregame_state') ? 'pregame_state' : 'NULL::TEXT'} AS "pregameState" FROM matches WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (!match.rowCount) throw httpError(404, 'Súmula não encontrada.');
    if (match.rows[0].status === 'CONFIRMED') throw httpError(409, 'Súmula confirmada não permite edição direta da escalação. Use correção auditada.');
    if (match.rows[0].status === 'CANCELLED') throw httpError(409, 'Súmula cancelada não permite edição da escalação.');
    if (match.rows[0].pregameState === 'DRAWN') {
      const fixedTeams = await client.query<{ participantKey: string; team: 'A' | 'B' }>(
        `SELECT participant_key AS "participantKey", team
         FROM match_pregame_participants
         WHERE match_id = $1 AND participant_status = 'SELECTED'`,
        [req.params.id]
      );
      const submittedTeams = new Map(players.filter((player) => player.team === 'A' || player.team === 'B').map((player) => [player.userId, player.team]));
      if (submittedTeams.size !== fixedTeams.rows.length || fixedTeams.rows.some((participant) => submittedTeams.get(participant.participantKey) !== participant.team)) {
        throw httpError(409, 'Os times foram congelados pelo sorteio. Use a substituição do pré-jogo para trocar ausências sem ressorteio.');
      }
    }

    await client.query(
      `UPDATE matches
       SET match_date = COALESCE($2, match_date),
           title = COALESCE($3, title),
           referee_name = COALESCE($4, referee_name),
           team_a_name = COALESCE($5, team_a_name),
           team_b_name = COALESCE($6, team_b_name),
           updated_at = now()
       WHERE id = $1`,
      [req.params.id, body.matchDate ?? null, body.title ?? null, body.refereeName ?? null, body.teamAName ?? null, body.teamBName ?? null]
    );
    await client.query('DELETE FROM match_players WHERE match_id = $1', [req.params.id]);
    for (const player of players) {
      await insertMatchPlayerRecord(client.query.bind(client), req.params.id, player, guestPlayerEnabled, fieldLayoutEnabled);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json({ ok: true });
}));

matchesRouter.post('/schedule/manual', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req: AuthRequest, res) => {
  await ensureScheduleAvailable();
  const body = validate(manualScheduleSchema, req.body);
  const seasonResult = body.seasonId ? await query('SELECT id FROM seasons WHERE id = $1 AND status = \'OPEN\'', [body.seasonId]) : { rowCount: 0 };
  const seasonId = seasonResult.rowCount ? body.seasonId : null;
  const scheduledStart = body.scheduledStart ?? '20:00';
  const scheduledEnd = body.scheduledEnd ?? '21:00';
  const confirmationOpensHoursBefore = body.confirmationOpensHoursBefore ?? 48;
  const confirmationClosesHoursBefore = body.confirmationClosesHoursBefore ?? 3;
  const confirmationOpenAt = buildConfirmationOpenAt(body.matchDate, scheduledStart, confirmationOpensHoursBefore);
  const confirmationCloseAt = buildConfirmationCloseAt(body.matchDate, scheduledStart, confirmationClosesHoursBefore);
  ensureConfirmationWindowOrder(confirmationOpenAt, confirmationCloseAt);
  const matchPlayerColumns = await getTableColumns('match_players');
  const guestPlayerEnabled = hasGuestPlayerSupport(matchPlayerColumns);
  const fieldLayoutEnabled = hasFieldLayoutSupport(matchPlayerColumns);
  const players = await buildAutomaticInvitationPlayers([]);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockScheduleSlot(client.query.bind(client), seasonId, body.matchDate, scheduledStart);
    if (await findScheduleConflict(client.query.bind(client), seasonId, body.matchDate, scheduledStart)) {
      throw httpError(409, 'Já existe um jogo nesta temporada, data e horário. Abra o agendamento existente para revisar.');
    }
    const result = await client.query<{ id: string }>(
      `INSERT INTO matches (season_id, match_date, title, referee_name, team_a_name, team_b_name, scheduled_start, scheduled_end, confirmation_open_at, confirmation_opens_hours_before, confirmation_close_at, confirmation_closes_hours_before, schedule_source, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::TIME, $8::TIME, $9::TIMESTAMPTZ, $10, $11::TIMESTAMPTZ, $12, 'MANUAL', $13)
       RETURNING id`,
      [seasonId, body.matchDate, body.title, body.refereeName ?? null, body.teamAName, body.teamBName, scheduledStart, scheduledEnd, confirmationOpenAt, confirmationOpensHoursBefore, confirmationCloseAt, confirmationClosesHoursBefore, req.user?.id]
    );
    for (const player of players) {
      await insertMatchPlayerRecord(client.query.bind(client), result.rows[0].id, player, guestPlayerEnabled, fieldLayoutEnabled);
    }
    await activatePregame(client.query.bind(client), result.rows[0].id, await getMatchColumns());
    await client.query('COMMIT');
    res.status(201).json({ id: result.rows[0].id, confirmationOpenAt, confirmationCloseAt });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

matchesRouter.post('/schedule/recurring', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req: AuthRequest, res) => {
  await ensureScheduleAvailable();
  const body = validate(recurringScheduleSchema, req.body);
  const requestedPlayers = (body.players ?? []).map((player) => ({ ...player, startsOnBench: player.startsOnBench ?? false, present: false }));
  const players = await buildAutomaticInvitationPlayers(requestedPlayers);
  await validatePlayersInput(players);
  const matchPlayerColumns = await getTableColumns('match_players');
  const guestPlayerEnabled = hasGuestPlayerSupport(matchPlayerColumns);
  const fieldLayoutEnabled = hasFieldLayoutSupport(matchPlayerColumns);
  ensureGuestPlayerSupport(players, guestPlayerEnabled);
  ensureFieldLayoutSupport(players, fieldLayoutEnabled);
  const scheduledStart = body.scheduledStart ?? '20:00';
  const scheduledEnd = body.scheduledEnd ?? '21:00';
  const confirmationOpensHoursBefore = body.confirmationOpensHoursBefore ?? 48;
  const confirmationClosesHoursBefore = body.confirmationClosesHoursBefore ?? 3;
  const start = new Date(`${body.startDate}T12:00:00-03:00`);
  const end = new Date(`${body.endDate}T12:00:00-03:00`);
  if ((end.getTime() - start.getTime()) / 86400000 > 370) throw httpError(400, 'Gere no máximo 12 meses de jogos por vez.');
  const seasonResult = body.seasonId ? await query('SELECT id FROM seasons WHERE id = $1 AND status = \'OPEN\'', [body.seasonId]) : { rowCount: 0 };
  const seasonId = seasonResult.rowCount ? body.seasonId : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rule = await client.query<{ id: string }>(
      `INSERT INTO match_schedule_rules (season_id, title, weekday, scheduled_start, scheduled_end, confirmation_opens_hours_before, confirmation_closes_hours_before, start_date, end_date, referee_name, team_a_name, team_b_name, created_by)
       VALUES ($1, $2, $3, $4::TIME, $5::TIME, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [seasonId, body.title, body.weekday, scheduledStart, scheduledEnd, confirmationOpensHoursBefore, confirmationClosesHoursBefore, body.startDate, body.endDate, body.refereeName ?? null, body.teamAName, body.teamBName, req.user?.id]
    );
    let generated = 0;
    let skipped = 0;
    for (let day = start; day <= end; day = addDays(day, 1)) {
      if (day.getUTCDay() !== body.weekday) continue;
      const matchDate = formatDate(day);
      await lockScheduleSlot(client.query.bind(client), seasonId, matchDate, scheduledStart);
      if (await findScheduleConflict(client.query.bind(client), seasonId, matchDate, scheduledStart)) {
        skipped += 1;
        continue;
      }
      const confirmationOpenAt = buildConfirmationOpenAt(matchDate, scheduledStart, confirmationOpensHoursBefore);
      const confirmationCloseAt = buildConfirmationCloseAt(matchDate, scheduledStart, confirmationClosesHoursBefore);
      ensureConfirmationWindowOrder(confirmationOpenAt, confirmationCloseAt);
      const generatedMatch = await client.query<{ id: string }>(
        `INSERT INTO matches (season_id, match_date, title, referee_name, team_a_name, team_b_name, scheduled_start, scheduled_end, confirmation_open_at, confirmation_opens_hours_before, confirmation_close_at, confirmation_closes_hours_before, schedule_source, schedule_rule_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7::TIME, $8::TIME, $9::TIMESTAMPTZ, $10, $11::TIMESTAMPTZ, $12, 'RECURRING', $13, $14)
         RETURNING id`,
        [seasonId, matchDate, body.title, body.refereeName ?? null, body.teamAName, body.teamBName, scheduledStart, scheduledEnd, confirmationOpenAt, confirmationOpensHoursBefore, confirmationCloseAt, confirmationClosesHoursBefore, rule.rows[0].id, req.user?.id]
      );
      for (const player of players) {
        await insertMatchPlayerRecord(client.query.bind(client), generatedMatch.rows[0].id, player, guestPlayerEnabled, fieldLayoutEnabled);
      }
      await activatePregame(client.query.bind(client), generatedMatch.rows[0].id, await getMatchColumns());
      generated += 1;
    }
    await client.query('COMMIT');
    res.status(201).json({ ruleId: rule.rows[0].id, generated, skipped });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

matchesRouter.patch('/:id/schedule', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req, res) => {
  await ensureScheduleAvailable();
  const params = validate(idParamSchema, req.params);
  const body = validate(schedulePatchSchema, req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query<{ seasonId: string | null; matchDate: string; scheduledStart: string; scheduledEnd: string; confirmationOpensHoursBefore: number; confirmationClosesHoursBefore: number; status: string }>('SELECT season_id AS "seasonId", match_date::TEXT AS "matchDate", scheduled_start::TEXT AS "scheduledStart", scheduled_end::TEXT AS "scheduledEnd", confirmation_opens_hours_before AS "confirmationOpensHoursBefore", confirmation_closes_hours_before AS "confirmationClosesHoursBefore", status FROM matches WHERE id = $1 FOR UPDATE', [params.id]);
    if (!current.rowCount) throw httpError(404, 'Jogo agendado não encontrado.');
    if (current.rows[0].status !== 'DRAFT') throw httpError(409, 'Somente jogos em rascunho podem ter agenda editada.');
    const matchDate = body.matchDate ?? current.rows[0].matchDate;
    const scheduledStart = body.scheduledStart ?? current.rows[0].scheduledStart.slice(0, 5);
    const scheduledEnd = body.scheduledEnd ?? current.rows[0].scheduledEnd.slice(0, 5);
    if (scheduledEnd <= scheduledStart) throw httpError(400, 'O horário final precisa ser maior que o início.');
    const confirmationOpensHoursBefore = body.confirmationOpensHoursBefore ?? current.rows[0].confirmationOpensHoursBefore ?? 48;
    const confirmationClosesHoursBefore = body.confirmationClosesHoursBefore ?? current.rows[0].confirmationClosesHoursBefore ?? 3;
    if (confirmationOpensHoursBefore <= confirmationClosesHoursBefore) throw httpError(400, 'A confirmação precisa abrir antes de fechar.');
    await lockScheduleSlot(client.query.bind(client), current.rows[0].seasonId, matchDate, scheduledStart);
    if (await findScheduleConflict(client.query.bind(client), current.rows[0].seasonId, matchDate, scheduledStart, params.id)) {
      throw httpError(409, 'Já existe outro jogo nesta temporada, data e horário.');
    }
    const confirmationOpenAt = buildConfirmationOpenAt(matchDate, scheduledStart, confirmationOpensHoursBefore);
    const confirmationCloseAt = buildConfirmationCloseAt(matchDate, scheduledStart, confirmationClosesHoursBefore);
    ensureConfirmationWindowOrder(confirmationOpenAt, confirmationCloseAt);
    const result = await client.query(
      `UPDATE matches
       SET match_date = $2,
           title = COALESCE($3, title),
           referee_name = COALESCE($4, referee_name),
           team_a_name = COALESCE($5, team_a_name),
           team_b_name = COALESCE($6, team_b_name),
           scheduled_start = $7::TIME,
           scheduled_end = $8::TIME,
           confirmation_open_at = $9::TIMESTAMPTZ,
           confirmation_opens_hours_before = $10,
           confirmation_close_at = $11::TIMESTAMPTZ,
           confirmation_closes_hours_before = $12,
           confirmation_opened_at = CASE WHEN confirmation_opened_at IS NOT NULL AND $9::TIMESTAMPTZ > now() THEN NULL ELSE confirmation_opened_at END,
           updated_at = now()
       WHERE id = $1 AND status = 'DRAFT'
       RETURNING id, confirmation_open_at AS "confirmationOpenAt", confirmation_opens_hours_before AS "confirmationOpensHoursBefore", confirmation_close_at AS "confirmationCloseAt", confirmation_closes_hours_before AS "confirmationClosesHoursBefore"`,
      [params.id, matchDate, body.title ?? null, body.refereeName ?? null, body.teamAName ?? null, body.teamBName ?? null, scheduledStart, scheduledEnd, confirmationOpenAt, confirmationOpensHoursBefore, confirmationCloseAt, confirmationClosesHoursBefore]
    );
    if (!result.rowCount) throw httpError(409, 'Não foi possível editar o jogo agendado.');
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

matchesRouter.delete('/:id/schedule', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req, res) => {
  await ensureScheduleAvailable();
  const params = validate(idParamSchema, req.params);
  const result = await query('DELETE FROM matches WHERE id = $1 AND status = \'DRAFT\' RETURNING id', [params.id]);
  if (!result.rowCount) throw httpError(409, 'Somente jogos em rascunho podem ser removidos da agenda.');
  res.json({ ok: true });
}));

matchesRouter.post('/:id/open-confirmation', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req: AuthRequest, res) => {
  await ensureScheduleAvailable();
  const params = validate(idParamSchema, req.params);
  const result = await query(
    `UPDATE matches
     SET confirmation_opened_at = now(),
         confirmation_opened_by = $2,
         confirmation_open_at = LEAST(COALESCE(confirmation_open_at, now()), now()),
         updated_at = now()
     WHERE id = $1
       AND status = 'DRAFT'
       AND (confirmation_close_at IS NULL OR now() < confirmation_close_at)
     RETURNING id, confirmation_open_at AS "confirmationOpenAt", confirmation_close_at AS "confirmationCloseAt", confirmation_opened_at AS "confirmationOpenedAt"`,
    [params.id, req.user?.id]
  );
  if (!result.rowCount) throw httpError(409, 'Somente jogos em rascunho e ainda dentro da janela configurada podem abrir confirmação.');
  res.json(result.rows[0]);
}));

matchesRouter.get('/:id/pregame', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req: AuthRequest, res) => {
  const params = validate(idParamSchema, req.params);
  await ensurePregameAvailable();
  const match = await query<{
    id: string;
    status: string;
    pregameState: string | null;
    playerCapacity: number | null;
    confirmationCloseAt: string | null;
    drawnAt: string | null;
  }>(
    `SELECT id, status, pregame_state AS "pregameState", player_capacity AS "playerCapacity",
      confirmation_close_at AS "confirmationCloseAt", drawn_at AS "drawnAt"
     FROM matches
     WHERE id = $1`,
    [params.id]
  );
  if (!match.rowCount) throw httpError(404, 'Partida não encontrada.');
  if (!match.rows[0].pregameState) throw httpError(409, 'Esta partida pertence ao fluxo legado de escalação.');

  const club = await query<{
    participantKey: string;
    userId: string;
    name: string;
    position: z.infer<typeof athletePositionSchema>;
    updatedAt: string;
  }>(
    `SELECT u.id::TEXT AS "participantKey", u.id AS "userId", u.name,
      CASE WHEN u.position IN ('GO', 'ZG', 'LD', 'LE', 'MD', 'MC', 'MA', 'AT') THEN u.position ELSE 'MC' END AS position,
      mar.updated_at AS "updatedAt"
     FROM match_attendance_responses mar
     JOIN users u ON u.id = mar.user_id AND u.active = TRUE
     WHERE mar.match_id = $1 AND mar.response_status = 'JOGAR'
     ORDER BY mar.updated_at ASC, u.name ASC`,
    [params.id]
  );
  const participants = await query(
    `SELECT participant_key AS "participantKey", user_id AS "userId", guest_key AS "guestKey", name_snapshot AS name,
      position, source, participant_status AS status, selection_order AS "selectionOrder", reserve_order AS "reserveOrder", team,
      replaced_by_key AS "replacedByKey"
     FROM match_pregame_participants
     WHERE match_id = $1
     ORDER BY selection_order NULLS LAST, reserve_order NULLS LAST, created_at ASC`,
    [params.id]
  );
  const guestCount = participants.rows.filter((participant: any) => participant.source === 'GUEST' && participant.status !== 'REPLACED').length;
  const confirmedCount = club.rowCount ?? 0;
  const totalEligible = confirmedCount + (match.rows[0].drawnAt ? 0 : guestCount);
  const confirmationClosed = Boolean(match.rows[0].confirmationCloseAt && Date.now() >= new Date(match.rows[0].confirmationCloseAt).getTime());
  const computedState = match.rows[0].drawnAt
    ? 'DRAWN'
    : !confirmationClosed
      ? 'CONFIRMING'
      : totalEligible >= pregameCapacity
        ? 'READY_TO_DRAW'
        : 'COMPLETING';
  res.json({
    state: computedState,
    capacity: match.rows[0].playerCapacity ?? pregameCapacity,
    confirmationCloseAt: match.rows[0].confirmationCloseAt,
    drawnAt: match.rows[0].drawnAt,
    clubConfirmed: club.rows,
    participants: participants.rows,
    confirmedCount,
    guestCount,
    eligibleCount: match.rows[0].drawnAt ? participants.rows.filter((participant: any) => participant.status === 'SELECTED' || participant.status === 'RESERVE').length : totalEligible,
    missingCount: Math.max(0, pregameCapacity - totalEligible)
  });
}));

matchesRouter.post('/:id/pregame/guests', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req: AuthRequest, res) => {
  const params = validate(idParamSchema, req.params);
  const body = validate(pregameGuestSchema, req.body);
  await ensurePregameAvailable();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const match = await client.query<{ status: string; pregameState: string | null }>(
      `SELECT status, pregame_state AS "pregameState"
       FROM matches
       WHERE id = $1
       FOR UPDATE`,
      [params.id]
    );
    if (!match.rowCount) throw httpError(404, 'Partida não encontrada.');
    if (match.rows[0].status !== 'DRAFT') throw httpError(409, 'Suplentes só podem ser adicionados enquanto a partida estiver em rascunho.');
    const count = await client.query<{ total: number }>(
      `SELECT (
        SELECT count(*) FROM match_attendance_responses WHERE match_id = $1 AND response_status = 'JOGAR'
       ) + (
        SELECT count(*) FROM match_pregame_participants WHERE match_id = $1 AND source = 'GUEST' AND participant_status <> 'REPLACED'
       ) AS total`,
      [params.id]
    );
    const drawn = match.rows[0].pregameState === 'DRAWN';
    const reserveOrder = drawn
      ? await client.query<{ nextOrder: number }>(
          `SELECT COALESCE(max(reserve_order), 0)::INTEGER + 1 AS "nextOrder"
           FROM match_pregame_participants
           WHERE match_id = $1 AND participant_status = 'RESERVE'`,
          [params.id]
        )
      : null;
    const guestKey = `guest:${randomBytes(12).toString('hex')}`;
    await client.query(
      `INSERT INTO match_pregame_participants (match_id, participant_key, guest_key, name_snapshot, position, source, participant_status, reserve_order, created_by)
       VALUES ($1, $2, $2, $3, $4, 'GUEST', $5, $6, $7)`,
      [params.id, guestKey, body.name, body.position, drawn ? 'RESERVE' : 'ELIGIBLE', reserveOrder?.rows[0].nextOrder ?? null, req.user?.id]
    );
    if (!drawn) {
      await client.query(
        `UPDATE matches
         SET pregame_state = CASE
               WHEN clock_timestamp() < confirmation_close_at THEN 'CONFIRMING'
               WHEN $2 >= player_capacity THEN 'READY_TO_DRAW'
               ELSE 'COMPLETING'
             END,
             updated_at = now()
         WHERE id = $1`,
        [params.id, Number(count.rows[0].total) + 1]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ guestKey });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

matchesRouter.post('/:id/pregame/draw', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req: AuthRequest, res) => {
  const params = validate(idParamSchema, req.params);
  await ensurePregameAvailable();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const match = await client.query<{ status: string; pregameState: string | null }>(
      `SELECT status, pregame_state AS "pregameState"
       FROM matches
       WHERE id = $1 AND clock_timestamp() >= confirmation_close_at
       FOR UPDATE`,
      [params.id]
    );
    if (!match.rowCount) throw httpError(409, 'O sorteio só fica disponível depois do fechamento da confirmação em T-3h.');
    if (match.rows[0].status !== 'DRAFT') throw httpError(409, 'Somente partidas em rascunho podem ser sorteadas.');
    if (match.rows[0].pregameState === 'DRAWN') throw httpError(409, 'Os times desta partida já foram sorteados.');

    const club = await client.query<PregameParticipant>(
      `SELECT u.id::TEXT AS "participantKey", u.id AS "userId", NULL::TEXT AS "guestKey", u.name,
        CASE WHEN u.position IN ('GO', 'ZG', 'LD', 'LE', 'MD', 'MC', 'MA', 'AT') THEN u.position ELSE 'MC' END AS position,
        'CLUB'::TEXT AS source
       FROM match_attendance_responses mar
       JOIN users u ON u.id = mar.user_id AND u.active = TRUE
       WHERE mar.match_id = $1 AND mar.response_status = 'JOGAR'`,
      [params.id]
    );
    const guests = await client.query<PregameParticipant>(
      `SELECT participant_key AS "participantKey", NULL::UUID AS "userId", guest_key AS "guestKey", name_snapshot AS name, position, source
       FROM match_pregame_participants
       WHERE match_id = $1 AND source = 'GUEST' AND participant_status = 'ELIGIBLE'`,
      [params.id]
    );
    const seed = randomBytes(24).toString('hex');
    const draw = drawPregameParticipants([...club.rows, ...guests.rows], seed);
    const matchPlayerColumns = await getTableColumns('match_players');
    const guestPlayerEnabled = hasGuestPlayerSupport(matchPlayerColumns);
    const fieldLayoutEnabled = hasFieldLayoutSupport(matchPlayerColumns);
    ensureGuestPlayerSupport(draw.selected.map((participant) => ({ ...participant, userId: participant.participantKey, isGuest: participant.source === 'GUEST', roleInMatch: participant.roleInMatch, drawOrder: participant.selectionOrder, rotationOrder: participant.selectionOrder, present: true })), guestPlayerEnabled);

    await client.query('DELETE FROM match_pregame_participants WHERE match_id = $1 AND source = \'CLUB\'', [params.id]);
    await client.query("UPDATE match_pregame_participants SET participant_status = 'REPLACED', selection_order = NULL, reserve_order = NULL, team = NULL, updated_at = now() WHERE match_id = $1 AND source = 'GUEST'", [params.id]);
    await client.query('DELETE FROM match_players WHERE match_id = $1', [params.id]);
    for (const participant of draw.selected) {
      await client.query(
        `INSERT INTO match_pregame_participants (match_id, participant_key, user_id, guest_key, name_snapshot, position, source, participant_status, selection_order, team, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'SELECTED', $8, $9, $10)
         ON CONFLICT (match_id, participant_key) DO UPDATE SET participant_status = 'SELECTED', selection_order = EXCLUDED.selection_order,
           reserve_order = NULL, team = EXCLUDED.team, replaced_by_key = NULL, updated_at = now()`,
        [params.id, participant.participantKey, participant.userId, participant.guestKey, participant.name, participant.position, participant.source, participant.selectionOrder, participant.team, req.user?.id]
      );
      await insertMatchPlayerRecord(client.query.bind(client), params.id, {
        userId: participant.participantKey,
        name: participant.name,
        position: participant.position,
        isGuest: participant.source === 'GUEST',
        team: participant.team,
        roleInMatch: participant.roleInMatch,
        drawOrder: participant.selectionOrder,
        rotationOrder: participant.selectionOrder,
        startsOnBench: participant.startsOnBench,
        present: true
      }, guestPlayerEnabled, fieldLayoutEnabled);
    }
    for (const [index, participant] of draw.reserves.entries()) {
      await client.query(
        `INSERT INTO match_pregame_participants (match_id, participant_key, user_id, guest_key, name_snapshot, position, source, participant_status, reserve_order, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'RESERVE', $8, $9)
         ON CONFLICT (match_id, participant_key) DO UPDATE SET participant_status = 'RESERVE', selection_order = NULL,
           reserve_order = EXCLUDED.reserve_order, team = NULL, replaced_by_key = NULL, updated_at = now()`,
        [params.id, participant.participantKey, participant.userId, participant.guestKey, participant.name, participant.position, participant.source, index + 1, req.user?.id]
      );
    }
    await client.query(
      `UPDATE matches SET pregame_state = 'DRAWN', player_capacity = $2, roster_closed_at = COALESCE(roster_closed_at, now()),
       roster_closed_by = COALESCE(roster_closed_by, $3), drawn_at = now(), drawn_by = $3, draw_seed = $4, updated_at = now()
       WHERE id = $1`,
      [params.id, pregameCapacity, req.user?.id, seed]
    );
    await client.query('COMMIT');
    res.json({ selectedCount: draw.selected.length, reserveCount: draw.reserves.length });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

matchesRouter.post('/:id/pregame/replacements', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req: AuthRequest, res) => {
  const params = validate(idParamSchema, req.params);
  const body = validate(pregameReplacementSchema, req.body);
  await ensurePregameAvailable();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const match = await client.query<{ status: string; pregameState: string | null }>('SELECT status, pregame_state AS "pregameState" FROM matches WHERE id = $1 FOR UPDATE', [params.id]);
    if (!match.rowCount || match.rows[0].status !== 'DRAFT' || match.rows[0].pregameState !== 'DRAWN') throw httpError(409, 'Substituições exigem uma partida em rascunho com times sorteados.');
    const outgoing = await client.query<{ participantKey: string; selectionOrder: number; team: 'A' | 'B'; position: string }>(
      `SELECT participant_key AS "participantKey", selection_order AS "selectionOrder", team, position
       FROM match_pregame_participants WHERE match_id = $1 AND participant_key = $2 AND participant_status = 'SELECTED' FOR UPDATE`,
      [params.id, body.outgoingKey]
    );
    if (!outgoing.rowCount) throw httpError(404, 'Participante titular não encontrado no sorteio.');
    let replacement: PregameParticipant;
    if (body.reserveKey) {
      const reserve = await client.query<PregameParticipant>(
        `SELECT participant_key AS "participantKey", user_id AS "userId", guest_key AS "guestKey", name_snapshot AS name, position, source
         FROM match_pregame_participants WHERE match_id = $1 AND participant_key = $2 AND participant_status = 'RESERVE' FOR UPDATE`,
        [params.id, body.reserveKey]
      );
      if (!reserve.rowCount) throw httpError(404, 'Reserva disponível não encontrado.');
      replacement = reserve.rows[0];
    } else {
      const guestKey = `guest:${randomBytes(12).toString('hex')}`;
      replacement = { participantKey: guestKey, userId: null, guestKey, name: body.guest!.name, position: body.guest!.position, source: 'GUEST' };
    }
    if (replacement.position !== outgoing.rows[0].position) throw httpError(409, 'A substituição sem ressorteio exige a mesma posição do participante ausente.');
    const matchPlayerColumns = await getTableColumns('match_players');
    const guestPlayerEnabled = hasGuestPlayerSupport(matchPlayerColumns);
    const fieldLayoutEnabled = hasFieldLayoutSupport(matchPlayerColumns);
    ensureGuestPlayerSupport([{ userId: replacement.participantKey, isGuest: replacement.source === 'GUEST', name: replacement.name, position: replacement.position, team: outgoing.rows[0].team, roleInMatch: replacement.position === 'GO' ? 'GOLEIRO' : 'LINHA', startsOnBench: false, present: true }], guestPlayerEnabled);

    await client.query(
      `UPDATE match_pregame_participants SET participant_status = 'REPLACED', selection_order = NULL, team = NULL,
       replaced_by_key = $3, updated_at = now() WHERE match_id = $1 AND participant_key = $2`,
      [params.id, body.outgoingKey, replacement.participantKey]
    );
    await client.query(
      `INSERT INTO match_pregame_participants (match_id, participant_key, user_id, guest_key, name_snapshot, position, source, participant_status, selection_order, team, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'SELECTED', $8, $9, $10)
       ON CONFLICT (match_id, participant_key) DO UPDATE SET participant_status = 'SELECTED', selection_order = EXCLUDED.selection_order,
         reserve_order = NULL, team = EXCLUDED.team, replaced_by_key = NULL, updated_at = now()`,
      [params.id, replacement.participantKey, replacement.userId, replacement.guestKey, replacement.name, replacement.position, replacement.source, outgoing.rows[0].selectionOrder, outgoing.rows[0].team, req.user?.id]
    );
    await client.query(`DELETE FROM match_players WHERE match_id = $1 AND ${playerIdentitySql()} = $2`, [params.id, body.outgoingKey]);
    await insertMatchPlayerRecord(client.query.bind(client), params.id, {
      userId: replacement.participantKey,
      name: replacement.name,
      position: replacement.position,
      isGuest: replacement.source === 'GUEST',
      team: outgoing.rows[0].team,
      roleInMatch: replacement.position === 'GO' ? 'GOLEIRO' : 'LINHA',
      drawOrder: outgoing.rows[0].selectionOrder,
      rotationOrder: outgoing.rows[0].selectionOrder,
      startsOnBench: false,
      present: true
    }, guestPlayerEnabled, fieldLayoutEnabled);
    await client.query('COMMIT');
    res.json({ ok: true, replacementKey: replacement.participantKey });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

matchesRouter.get('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const params = validate(idParamSchema, req.params);
  const matchColumns = await getMatchColumns();
  const matchPlayerColumns = await getTableColumns('match_players');
  const matchEventColumns = await getTableColumns('match_events');
  const guestPlayerEnabled = hasGuestPlayerSupport(matchPlayerColumns);
  const confirmationOpenExpression = confirmationWindowExpression(matchColumns);
  const draftSelect = [
    matchColumns.has('draft_team_a_score') ? 'draft_team_a_score AS "draftTeamAScore"' : 'team_a_score AS "draftTeamAScore"',
    matchColumns.has('draft_team_b_score') ? 'draft_team_b_score AS "draftTeamBScore"' : 'team_b_score AS "draftTeamBScore"',
    matchColumns.has('draft_events') ? 'draft_events AS "draftEvents"' : '\'[]\'::JSONB AS "draftEvents"',
    matchColumns.has('draft_clock_seconds') ? 'draft_clock_seconds AS "draftClockSeconds"' : '0::INTEGER AS "draftClockSeconds"',
    matchColumns.has('draft_clock_running') ? 'draft_clock_running AS "draftClockRunning"' : 'FALSE AS "draftClockRunning"',
    matchColumns.has('draft_saved_at') ? 'draft_saved_at AS "draftSavedAt"' : 'NULL::TIMESTAMPTZ AS "draftSavedAt"'
  ];
  const scheduleSelect = [
    matchColumns.has('scheduled_start') ? 'scheduled_start AS "scheduledStart"' : 'TIME \'20:00\' AS "scheduledStart"',
    matchColumns.has('scheduled_end') ? 'scheduled_end AS "scheduledEnd"' : 'TIME \'21:00\' AS "scheduledEnd"',
    matchColumns.has('confirmation_open_at') ? 'confirmation_open_at AS "confirmationOpenAt"' : 'NULL::TIMESTAMPTZ AS "confirmationOpenAt"',
    matchColumns.has('confirmation_opens_hours_before') ? 'confirmation_opens_hours_before AS "confirmationOpensHoursBefore"' : '48::INTEGER AS "confirmationOpensHoursBefore"',
    matchColumns.has('confirmation_close_at') ? 'confirmation_close_at AS "confirmationCloseAt"' : 'NULL::TIMESTAMPTZ AS "confirmationCloseAt"',
    matchColumns.has('confirmation_closes_hours_before') ? 'confirmation_closes_hours_before AS "confirmationClosesHoursBefore"' : '3::INTEGER AS "confirmationClosesHoursBefore"',
    matchColumns.has('confirmation_opened_at') ? 'confirmation_opened_at AS "confirmationOpenedAt"' : 'NULL::TIMESTAMPTZ AS "confirmationOpenedAt"',
    matchColumns.has('schedule_source') ? 'schedule_source AS "scheduleSource"' : '\'MANUAL\' AS "scheduleSource"',
    `${confirmationOpenExpression} AS "confirmationOpen"`,
    matchColumns.has('pregame_state') ? 'pregame_state AS "pregameState"' : 'NULL::TEXT AS "pregameState"',
    matchColumns.has('player_capacity') ? 'player_capacity AS "playerCapacity"' : 'NULL::INTEGER AS "playerCapacity"',
    matchColumns.has('drawn_at') ? 'drawn_at AS "drawnAt"' : 'NULL::TIMESTAMPTZ AS "drawnAt"'
  ];
  const match = await query(
    `SELECT id, season_id AS "seasonId", match_date AS "matchDate", title, referee_name AS "refereeName", status,
      ${scheduleSelect.join(', ')}, started_at AS "startedAt", ended_at AS "endedAt",
      team_a_name AS "teamAName", team_b_name AS "teamBName", team_a_score AS "teamAScore", team_b_score AS "teamBScore",
      ${draftSelect.join(', ')},
      GREATEST(
        1,
        FLOOR(
          EXTRACT(
            EPOCH FROM (
              ((match_date + ${matchColumns.has('scheduled_end') ? 'scheduled_end' : "TIME '21:00'"}) AT TIME ZONE 'America/Sao_Paulo')
              - COALESCE(started_at, ((match_date + ${matchColumns.has('scheduled_start') ? 'scheduled_start' : "TIME '20:00'"}) AT TIME ZONE 'America/Sao_Paulo'))
            )
          ) / 60
        )
      )::INTEGER AS "availableMinutes"
     FROM matches WHERE id = $1`,
    [params.id]
  );
  if (!match.rowCount) throw httpError(404, 'Súmula não encontrada.');
  const players = guestPlayerEnabled
    ? await query(
      `SELECT mp.id, ${playerIdentitySql('mp')} AS "userId", COALESCE(u.name, mp.guest_name) AS name, u.avatar_data_url AS "avatarDataUrl",
        COALESCE(mp.guest_position, u.position) AS position, (mp.user_id IS NULL) AS "isGuest", mp.team, mp.role_in_match AS "roleInMatch",
        mp.draw_order AS "drawOrder", mp.rotation_order AS "rotationOrder", mp.field_left AS "fieldLeft", mp.field_top AS "fieldTop", mp.starts_on_bench AS "startsOnBench", mp.present
       FROM match_players mp
       LEFT JOIN users u ON u.id = mp.user_id
       WHERE mp.match_id = $1
       ORDER BY mp.team, mp.role_in_match, mp.rotation_order NULLS LAST, COALESCE(u.name, mp.guest_name)`,
      [params.id]
    )
    : await query(
      `SELECT mp.id, mp.user_id AS "userId", u.name, u.avatar_data_url AS "avatarDataUrl", u.position, FALSE AS "isGuest", mp.team, mp.role_in_match AS "roleInMatch",
        mp.draw_order AS "drawOrder", mp.rotation_order AS "rotationOrder", mp.field_left AS "fieldLeft", mp.field_top AS "fieldTop", mp.starts_on_bench AS "startsOnBench", mp.present
       FROM match_players mp JOIN users u ON u.id = mp.user_id
       WHERE mp.match_id = $1 ORDER BY mp.team, mp.role_in_match, mp.rotation_order NULLS LAST, u.name`,
      [params.id]
    );
  const events = hasGuestEventSupport(matchEventColumns)
    ? await query(`SELECT id, ${playerIdentitySql()} AS "userId", ${relatedIdentitySql()} AS "relatedUserId", event_type AS "eventType", minute, team, created_at AS "createdAt" FROM match_events WHERE match_id = $1 ORDER BY minute ASC, created_at ASC`, [params.id])
    : await query('SELECT id, user_id AS "userId", related_user_id AS "relatedUserId", event_type AS "eventType", minute, team, created_at AS "createdAt" FROM match_events WHERE match_id = $1 ORDER BY minute ASC, created_at ASC', [params.id]);
  const corrections = await tableExists('match_corrections')
    ? await query(
      `SELECT mc.id, mc.reason, mc.previous_team_a_score AS "previousTeamAScore", mc.previous_team_b_score AS "previousTeamBScore",
        mc.new_team_a_score AS "newTeamAScore", mc.new_team_b_score AS "newTeamBScore", mc.previous_events AS "previousEvents",
        mc.new_events AS "newEvents", mc.created_at AS "createdAt", u.name AS "correctedByName"
       FROM match_corrections mc
       JOIN users u ON u.id = mc.corrected_by
       WHERE mc.match_id = $1
       ORDER BY mc.created_at DESC`,
      [params.id]
    )
    : { rows: [] };
  const attendance = await tableExists('match_attendance_responses')
    ? await query(
      `SELECT mar.user_id AS "userId", u.name, u.position, u.avatar_data_url AS "avatarDataUrl",
        mar.response_status AS "responseStatus", mar.dinner_confirmed AS "dinnerConfirmed",
        mar.guest_count AS "guestCount", mar.notes, mar.updated_at AS "updatedAt"
       FROM match_attendance_responses mar
       JOIN users u ON u.id = mar.user_id
       WHERE mar.match_id = $1
       ORDER BY CASE mar.response_status WHEN 'JOGAR' THEN 1 WHEN 'PRESENTE_SEM_JOGAR' THEN 2 ELSE 3 END, u.name ASC`,
      [params.id]
    )
    : { rows: [] };
  const lineA = players.rows.filter((player: any) => player.team === 'A' && player.roleInMatch === 'LINHA' && player.rotationOrder && player.present !== false);
  const lineB = players.rows.filter((player: any) => player.team === 'B' && player.roleInMatch === 'LINHA' && player.rotationOrder && player.present !== false);
  let lineupVisible = true;
  if (match.rows[0].pregameState === 'DRAWN' && match.rows[0].status === 'DRAFT' && req.user?.role === 'ATLETA') {
    const access = await query<{ allowed: boolean }>(
      `SELECT
        clock_timestamp() >= (((match_date + scheduled_start) AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '1 hour')
        AND EXISTS (
          SELECT 1 FROM match_pregame_participants
          WHERE match_id = matches.id AND user_id = $2 AND participant_status IN ('SELECTED', 'RESERVE')
        ) AS allowed
       FROM matches WHERE id = $1`,
      [params.id, req.user.id]
    );
    lineupVisible = access.rows[0]?.allowed === true;
  }

  res.json({
    ...match.rows[0],
    lineupVisible,
    players: lineupVisible ? players.rows : [],
    events: events.rows,
    corrections: corrections.rows,
    attendance: attendance.rows,
    rotation: {
      A: buildTeamRotationPlan(lineA.map((player: any) => ({ id: player.userId, name: player.name, rotationOrder: player.rotationOrder, startsOnBench: player.startsOnBench })), match.rows[0].availableMinutes),
      B: buildTeamRotationPlan(lineB.map((player: any) => ({ id: player.userId, name: player.name, rotationOrder: player.rotationOrder, startsOnBench: player.startsOnBench })), match.rows[0].availableMinutes)
    }
  });
}));

matchesRouter.put('/:id/attendance/me', asyncHandler(async (req: AuthRequest, res) => {
  const params = validate(idParamSchema, req.params);
  const body = validate(attendanceSchema, req.body);
  if (!await tableExists('match_attendance_responses')) throw httpError(409, 'Confirmação de presença indisponível: execute migrations/11_confirmacao_presenca_jantar.sql no PostgreSQL da Railway.');

  const matchColumns = await getMatchColumns();
  const confirmationOpenSql = matchColumns.has('confirmation_open_at')
    ? `SELECT status, (${confirmationWindowTimeCondition(matchColumns)}) AS "confirmationOpen" FROM matches WHERE id = $1`
    : 'SELECT status, TRUE AS "confirmationOpen" FROM matches WHERE id = $1';
  const match = await query<{ status: string; confirmationOpen: boolean }>(
    confirmationOpenSql,
    [params.id]
  );
  if (!match.rowCount) throw httpError(404, 'Partida não encontrada.');
  if (match.rows[0].status !== 'DRAFT') throw httpError(409, 'A confirmação de presença só fica aberta enquanto a súmula está em rascunho.');
  if (!match.rows[0].confirmationOpen) throw httpError(409, 'A confirmação desta rodada não está aberta no momento. Verifique a janela de abertura e fechamento configurada pela coordenação.');

  const activeUser = await query(
    `SELECT 1 FROM users
     WHERE id = $1::UUID AND active = TRUE`,
    [req.user?.id]
  );
  if (!activeUser.rowCount) throw httpError(403, 'A confirmação de presença está disponível somente para usuários ativos.');

  const dinnerConfirmed = body.responseStatus !== 'AUSENTE' && body.dinnerConfirmed;
  const guestCount = dinnerConfirmed ? body.guestCount : 0;

  const result = await query(
    `INSERT INTO match_attendance_responses (match_id, user_id, response_status, dinner_confirmed, guest_count, notes, responded_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now(), now())
     ON CONFLICT (match_id, user_id) DO UPDATE SET
      response_status = EXCLUDED.response_status,
      dinner_confirmed = EXCLUDED.dinner_confirmed,
      guest_count = EXCLUDED.guest_count,
      notes = EXCLUDED.notes,
      updated_at = now()
     RETURNING user_id AS "userId", response_status AS "responseStatus", dinner_confirmed AS "dinnerConfirmed", guest_count AS "guestCount", notes, updated_at AS "updatedAt"`,
    [params.id, req.user?.id, body.responseStatus, dinnerConfirmed, guestCount, body.notes?.trim() || null]
  );
  res.json(result.rows[0]);
}));

matchesRouter.post('/:id/start', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req, res) => {
  await normalizePersistedOperationalRoles(req.params.id);
  await validateLineupReady(req.params.id);
  const result = await query("UPDATE matches SET status = 'RUNNING', started_at = clock_timestamp(), updated_at = clock_timestamp() WHERE id = $1 AND status = 'DRAFT' AND clock_timestamp() >= ((match_date + scheduled_start) AT TIME ZONE 'America/Sao_Paulo') AND clock_timestamp() < ((match_date + scheduled_end) AT TIME ZONE 'America/Sao_Paulo') RETURNING id, status, started_at AS \"startedAt\"", [req.params.id]);
  if (!result.rowCount) throw httpError(409, 'Somente súmulas em rascunho e dentro do horário agendado da quadra podem ser iniciadas.');
  res.json(result.rows[0]);
}));

matchesRouter.patch('/:id/draft', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req: AuthRequest, res) => {
  const parsedBody = validate(draftSchema, req.body);
  const body = { ...parsedBody, events: parsedBody.events ?? [], clockSeconds: parsedBody.clockSeconds ?? 0, clockRunning: parsedBody.clockRunning ?? false };
  await validateDraftSafety(req.params.id, body);
  const result = await query(
    `UPDATE matches
     SET draft_team_a_score = $2,
         draft_team_b_score = $3,
         draft_events = $4::JSONB,
         draft_clock_seconds = $5,
         draft_clock_running = $6,
         draft_saved_by = $7,
         draft_saved_at = now(),
         updated_at = now()
     WHERE id = $1 AND status IN ('DRAFT', 'RUNNING', 'SUBMITTED')
     RETURNING id, draft_saved_at AS "draftSavedAt"`,
    [req.params.id, body.teamAScore, body.teamBScore, JSON.stringify(body.events), body.clockSeconds, body.clockRunning, req.user?.id]
  );
  if (!result.rowCount) throw httpError(409, 'Somente súmulas em rascunho, em andamento ou submetidas recebem autosave.');
  res.json(result.rows[0]);
}));

matchesRouter.post('/:id/cancel', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE matches SET status = 'CANCELLED', updated_at = now()
     WHERE id = $1 AND status IN ('DRAFT', 'RUNNING', 'SUBMITTED')
     RETURNING id, status`,
    [req.params.id]
  );
  if (!result.rowCount) throw httpError(409, 'Somente súmulas não confirmadas podem ser canceladas. Súmula confirmada exige correção auditada.');
  res.json(result.rows[0]);
}));

matchesRouter.post('/:id/submit', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req, res) => {
  const parsedBody = validate(scoreSchema, req.body);
  const body = { ...parsedBody, events: parsedBody.events ?? [] };
  await validateScoreSheet(req.params.id, body);
  const matchEventColumns = await getTableColumns('match_events');
  const guestEventEnabled = hasGuestEventSupport(matchEventColumns);
  ensureGuestEventSupport(body.events, guestEventEnabled);
  await query('DELETE FROM match_events WHERE match_id = $1', [req.params.id]);
  for (const event of body.events ?? []) {
    await insertMatchEventRecord(query, req.params.id, event, guestEventEnabled);
  }
  const result = await query(
    `UPDATE matches SET status = 'SUBMITTED', team_a_score = $2, team_b_score = $3,
       draft_team_a_score = $2, draft_team_b_score = $3, draft_events = $4::JSONB, draft_saved_at = now(),
       ended_at = COALESCE(ended_at, now()), updated_at = now()
     WHERE id = $1 AND status IN ('RUNNING', 'SUBMITTED') AND started_at IS NOT NULL
     RETURNING id, status, team_a_score AS "teamAScore", team_b_score AS "teamBScore"`,
    [req.params.id, body.teamAScore, body.teamBScore, JSON.stringify(body.events)]
  );
  if (!result.rowCount) throw httpError(409, 'Somente súmulas iniciadas oficialmente podem ser submetidas.');
  res.json(result.rows[0]);
}));

matchesRouter.post('/:id/confirm', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req: AuthRequest, res) => {
  await validateLineupReady(req.params.id);
  const result = await query(
    `UPDATE matches SET status = 'CONFIRMED', confirmed_by = $2, updated_at = now()
     WHERE id = $1 AND status = 'SUBMITTED' AND started_at IS NOT NULL
     RETURNING id, status`,
    [req.params.id, req.user?.id]
  );
  if (!result.rowCount) throw httpError(409, 'Submeta e revise a súmula antes de confirmar a pontuação.');
  await createAutomaticSuspensions(req.params.id);
  res.json(result.rows[0]);
}));

matchesRouter.post('/:id/correct', requireRoles('ADMIN', 'COORDENADOR'), asyncHandler(async (req: AuthRequest, res) => {
  const parsedBody = validate(correctionSchema, req.body);
  const body = { ...parsedBody, events: parsedBody.events ?? [] };
  await validateScoreSheet(req.params.id, body, true);
  if (!await tableExists('match_corrections')) throw httpError(409, 'Correção auditada indisponível: execute migrations/10_correcoes_auditadas_sumula.sql no PostgreSQL da Railway.');
  const matchEventColumns = await getTableColumns('match_events');
  const guestEventEnabled = hasGuestEventSupport(matchEventColumns);
  ensureGuestEventSupport(body.events, guestEventEnabled);

  const match = await query<{ team_a_score: number; team_b_score: number; status: string }>('SELECT team_a_score, team_b_score, status FROM matches WHERE id = $1', [req.params.id]);
  if (match.rows[0].status !== 'CONFIRMED') throw httpError(409, 'Correção auditada é exclusiva para súmulas já confirmadas.');

  const previousEvents = await getMatchEventTimeline(req.params.id);
  await query(
    `INSERT INTO match_corrections (match_id, corrected_by, reason, previous_team_a_score, previous_team_b_score, new_team_a_score, new_team_b_score, previous_events, new_events)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::JSONB, $9::JSONB)`,
    [req.params.id, req.user?.id, body.reason.trim(), match.rows[0].team_a_score, match.rows[0].team_b_score, body.teamAScore, body.teamBScore, JSON.stringify(previousEvents), JSON.stringify(body.events)]
  );

  await query('DELETE FROM match_events WHERE match_id = $1', [req.params.id]);
  for (const event of body.events) {
    await insertMatchEventRecord(query, req.params.id, event, guestEventEnabled);
  }
  await query('DELETE FROM athlete_suspensions WHERE trigger_match_id = $1', [req.params.id]);
  await query('UPDATE matches SET team_a_score = $2, team_b_score = $3, updated_at = now() WHERE id = $1', [req.params.id, body.teamAScore, body.teamBScore]);
  await createAutomaticSuspensions(req.params.id);
  res.json({ ok: true });
}));
