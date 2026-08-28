import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { MdFilterList, MdMenu, MdOutlineRestaurantMenu, MdSportsSoccer } from 'react-icons/md';
import { ApiClient } from './api';
import { AthletePosition, MatchListItem, PointSetting, Season, Standing, User } from './types';

const logoUrl = '/logo_playfield.png';
const paymentMonthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

type View = 'temporada' | 'partidas' | 'estatisticas' | 'agenda' | 'pagamentos' | 'premios' | 'usuarios' | 'admin';
type AuthPayload = { token: string; user: User };
type RankingPayload = {
  goals: Array<{ userId: string; name: string; goals: number; ownGoals: number; netGoals: number; gamesPlayed: number; average: string | number }>;
  assists: Array<{ userId: string; name: string; assists: number; gamesPlayed: number; average: string | number }>;
  presence: Array<{ userId: string; name: string; gamesPlayed: number; presences: number; total: number; percentage: string | number }>;
  cards: Array<{ userId: string; name: string; cardPoints: number; totalCards: number; gamesPlayed: number; average: string | number }>;
};
type AwardType = 'RANKING' | 'VOTACAO' | 'SORTEIO' | 'MANUAL';
type MetricCode = 'TOTAL_POINTS' | 'GOALS' | 'ASSISTS' | 'TOTAL_CARDS' | 'CARD_POINTS' | 'ASSIDUITY' | 'PRESENCE_PERCENTAGE' | 'WIN_PERCENTAGE' | 'WINS' | 'TEAM_GOAL_BALANCE' | 'NET_GOALS' | 'PAID_MONTHS';
type Suspension = { id: string; userName: string; reason: string; triggerMatchTitle: string; servedAt?: string | null };
type MatchEventDraft = { id?: string; userId: string; relatedUserId?: string | null; eventType: 'GOL' | 'GOL_CONTRA' | 'ASSISTENCIA' | 'CARTAO_AMARELO' | 'CARTAO_VERMELHO' | 'CARTAO_AZUL'; minute: number; clockSecond?: number; team?: 'A' | 'B' | null; occurredAt?: string | null; createdAt?: string | null };
type SheetActivityLogEntry = { id: string; message: string; createdAt: string };
type MatchCorrection = { id: string; reason: string; previousTeamAScore: number; previousTeamBScore: number; newTeamAScore: number; newTeamBScore: number; correctedByName: string; createdAt: string; previousEvents: MatchEventDraft[]; newEvents: MatchEventDraft[] };
type CareerProfile = {
  profile: User;
  totals: { totalPoints: number; presences: number; wins: number; draws: number; losses: number; goals: number; assists: number; yellowCards: number; redCards: number; blueCards: number; seasonsPlayed: number };
  seasons: Array<{ seasonId: string; seasonName: string; year: number; status: string; totalPoints: number; presences: number; wins: number; draws: number; losses: number; goals: number; assists: number; yellowCards: number; redCards: number; blueCards: number }>;
  awards: Array<{ id: string; seasonName: string; year: number; categoryCode: string; label: string; placement: number; source: string }>;
  badges: Array<{ id: string; code: string; label: string; icon?: string; color?: string; seasonId?: string | null }>;
  suspensions: Array<{ id: string; seasonName?: string | null; reason: string; servedAt?: string | null }>;
};
type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'LATE' | 'WAIVED';
type PaymentRecord = { id?: string; userId?: string; userName?: string; referenceMonth: string; dueDate: string; amountCents: number; paidAmountCents?: number; balanceCents?: number; status: PaymentStatus; paidAt?: string | null; earnsPoint: boolean; notes?: string | null };
type PaymentAthleteGroup = { key: string; userId?: string; userName: string; payments: PaymentRecord[]; openPayments: PaymentRecord[]; totalOpenCents: number; totalPaidCents: number; lastPaidPayment?: PaymentRecord | null; nextOpenPayment?: PaymentRecord | null; latePaymentsCount: number };
type PaymentSummary = { totalCents: number; paidCents: number; openCents: number; total: number; paid: number; pending: number; late: number; waived: number; earlyPoints: number };
type CashEntryType = 'REVENUE' | 'EXPENSE';
type CashEntry = { id: string; entryType: CashEntryType; entryDate: string; description: string; amountCents: number; paymentId?: string | null; recordedByName?: string | null; createdAt?: string; updatedAt?: string };
type CashSummary = { revenueCents: number; expenseCents: number; balanceCents: number; total: number };
type AwardCategory = { code: string; label: string; votingEnabled: boolean; awardType?: AwardType; voteSlots?: number; allowSelfVote?: boolean; badgeIcon?: string; badgeColor?: string };
type AwardSetting = AwardCategory & { adminOnly: boolean; active: boolean; awardType: AwardType; metricCode?: MetricCode | null; sortDirection: 'ASC' | 'DESC'; winnersCount: number; minGames: number; voteSlots: number; allowSelfVote: boolean; badgeIcon: string; badgeColor: string };
type AwardPendingSummary = { votingOpen: boolean; seasonName?: string | null; pending: Array<AwardCategory & { answeredSlots: number; completed: boolean }>; completed: Array<AwardCategory & { answeredSlots: number; completed: boolean }> };
type MyVote = { categoryCode: string; voteSlot: number; votedUserId: string };
type AwardResult = { categoryCode: string; label: string; voteSlot: number; userId: string; name: string; votes: number };
type AwardLeaderboard = { code: string; label: string; metricCode: MetricCode; sortDirection: 'ASC' | 'DESC'; winnersCount: number; minGames: number; badgeIcon: string; badgeColor: string; rows: Array<{ userId: string; name: string; value: string | number; gamesPlayed: number; totalPoints: number; position: number }> };
type StandingImportResult = { imported: Array<{ name: string; email: string; totalPoints: number }>; skipped: Array<{ identifier: string; reason: string }> };
type MatchDraftPlayer = { userId: string; name: string; email: string; position: AthletePosition; team: 'A' | 'B' | 'PRESENTE_SEM_JOGAR'; roleInMatch: 'GOLEIRO' | 'LINHA' | 'PRESENTE_SEM_JOGAR'; drawOrder: string; startsOnBench: boolean; present: boolean; isGuest?: boolean; fieldLeft?: number | null; fieldTop?: number | null };
type PositionBalanceGroup = 'GO' | 'DEFESA' | 'MEIO' | 'ATAQUE';
type AttendanceStatus = 'JOGAR' | 'PRESENTE_SEM_JOGAR' | 'AUSENTE';
type MatchAttendanceResponse = { userId: string; name: string; position: AthletePosition; avatarDataUrl?: string | null; responseStatus: AttendanceStatus; dinnerConfirmed: boolean; guestCount: number; notes?: string | null; updatedAt: string };
type ScheduleMode = 'manual' | 'recurring';
type SeasonStatsTab = 'GERAL' | 'ARTILHARIA' | 'ASSISTENCIAS' | 'CARTOES';

type MatchDetail = MatchListItem & {
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  availableMinutes?: number;
  draftTeamAScore?: number;
  draftTeamBScore?: number;
  draftEvents?: MatchEventDraft[];
  draftClockSeconds?: number;
  draftClockRunning?: boolean;
  draftSavedAt?: string | null;
  players: Array<{ userId: string; name: string; team: 'A' | 'B' | 'PRESENTE_SEM_JOGAR'; roleInMatch: string; drawOrder?: number | null; rotationOrder?: number | null; startsOnBench: boolean; present?: boolean; position?: AthletePosition | null; avatarDataUrl?: string | null; isGuest?: boolean; fieldLeft?: number | null; fieldTop?: number | null }>;
  events: Array<{ id?: string; userId: string; relatedUserId?: string | null; eventType: string; minute: number; clockSecond?: number; team?: 'A' | 'B' | null; occurredAt?: string | null; createdAt?: string | null }>;
  corrections: MatchCorrection[];
  attendance: MatchAttendanceResponse[];
  rotation: Record<'A' | 'B', { reserves: number; firstCycleMinutes: number; secondCycleMinutes: number; schedule: Array<{ minute: number; label: string; entering: string[]; leaving: string[] }> }>;
};

type SheetRotationStep = { minute: number; second: number; label: string; enteringIds: string[]; leavingIds: string[]; entering: string[]; leaving: string[] };
type SheetRotationPlan = { reserves: number; firstCycleMinutes: number; secondCycleMinutes: number; exchangeSize: number; schedule: SheetRotationStep[] };

const storageKey = 'pokapratika.auth';

function greatestCommonDivisor(left: number, right: number): number {
  let currentLeft = Math.abs(left);
  let currentRight = Math.abs(right);
  while (currentRight !== 0) {
    const next = currentLeft % currentRight;
    currentLeft = currentRight;
    currentRight = next;
  }
  return Math.max(1, currentLeft);
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampPitchSlot(team: 'A' | 'B', left: number, top: number) {
  const minLeft = team === 'A' ? 8 : 53;
  const maxLeft = team === 'A' ? 47 : 92;
  return {
    left: Number(clampValue(left, minLeft, maxLeft).toFixed(2)),
    top: Number(clampValue(top, 12, 88).toFixed(2))
  };
}

function buildSheetRotationPlan(players: Array<{ userId: string; name: string; rotationOrder: number; startsOnBench: boolean }>, availableMinutes: number): SheetRotationPlan {
  const ordered = [...players].sort((left, right) => left.rotationOrder - right.rotationOrder);
  const activeSlots = Math.min(6, ordered.length);
  const reserves = Math.max(0, ordered.length - activeSlots);
  if (reserves === 0 || ordered.length <= activeSlots) {
    return { reserves, firstCycleMinutes: 0, secondCycleMinutes: 0, exchangeSize: 0, schedule: [] };
  }

  const cycleShift = reserves;
  const cycleCount = ordered.length / greatestCommonDivisor(ordered.length, cycleShift);
  const availableSeconds = Math.max(60, availableMinutes * 60);
  const intervalSeconds = availableSeconds / cycleCount;
  const windowForStep = (stepIndex: number) => {
    const startIndex = (stepIndex * cycleShift) % ordered.length;
    return new Set(Array.from({ length: activeSlots }, (_item, index) => ordered[(startIndex + index) % ordered.length].userId));
  };

  const schedule = Array.from({ length: Math.max(0, cycleCount - 1) }, (_item, index) => {
    const currentWindow = windowForStep(index);
    const nextWindow = windowForStep(index + 1);
    const enteringPlayers = ordered.filter((player) => nextWindow.has(player.userId) && !currentWindow.has(player.userId));
    const leavingPlayers = ordered.filter((player) => currentWindow.has(player.userId) && !nextWindow.has(player.userId));
    const switchAtSeconds = Math.round(intervalSeconds * (index + 1));
    return {
      minute: Math.min(Math.max(0, availableMinutes - 1), Math.floor(switchAtSeconds / 60)),
      second: switchAtSeconds,
      label: `${index + 1}ª troca`,
      enteringIds: enteringPlayers.map((player) => player.userId),
      leavingIds: leavingPlayers.map((player) => player.userId),
      entering: enteringPlayers.map((player) => player.name),
      leaving: leavingPlayers.map((player) => player.name)
    };
  });

  return {
    reserves,
    firstCycleMinutes: Number((intervalSeconds / 60).toFixed(1)),
    secondCycleMinutes: 0,
    exchangeSize: reserves,
    schedule
  };
}

const athletePositionOptions: Array<{ value: AthletePosition; label: string }> = [
  { value: 'GO', label: 'GO • Goleiro' },
  { value: 'ZG', label: 'ZG • Zagueiro' },
  { value: 'LD', label: 'LD • Lateral direito' },
  { value: 'LE', label: 'LE • Lateral esquerdo' },
  { value: 'MD', label: 'MD • Meia defensor' },
  { value: 'MC', label: 'MC • Meio campo' },
  { value: 'MA', label: 'MA • Meia atacante' },
  { value: 'AT', label: 'AT • Atacante' }
];

const weekdayOptions = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' }
];

const metricOptions: Array<{ value: MetricCode; label: string; hint: string }> = [
  { value: 'TOTAL_POINTS', label: 'Pontuação total', hint: 'Usa a pontuação configurável da temporada' },
  { value: 'GOALS', label: 'Artilharia', hint: 'Soma gols marcados' },
  { value: 'ASSISTS', label: 'Assistências', hint: 'Soma assistências registradas' },
  { value: 'TOTAL_CARDS', label: 'Total de cartões', hint: 'Conta amarelos, azuis e vermelhos' },
  { value: 'CARD_POINTS', label: 'Peso dos cartões', hint: 'Usa o peso configurado por tipo de cartão' },
  { value: 'ASSIDUITY', label: 'Assiduidade', hint: 'Jogos + presença sem jogar' },
  { value: 'PRESENCE_PERCENTAGE', label: '% de presença', hint: 'Presença sobre jogos confirmados' },
  { value: 'WIN_PERCENTAGE', label: '% de aproveitamento', hint: 'Vitória/empate em pontos possíveis' },
  { value: 'WINS', label: 'Vitórias', hint: 'Quantidade de vitórias' },
  { value: 'TEAM_GOAL_BALANCE', label: 'Saldo de equipe', hint: 'Gols pró da equipe menos gols sofridos' },
  { value: 'NET_GOALS', label: 'Gols líquidos', hint: 'Gols marcados menos gols contra' },
  { value: 'PAID_MONTHS', label: 'Mensalidades em dia', hint: 'Pagamentos pontuáveis da temporada' }
];

function metricLabel(metricCode?: string | null): string {
  return metricOptions.find((item) => item.value === metricCode)?.label ?? 'Pontuação total';
}

function awardCodeFromLabel(label: string): string {
  const code = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return code || 'NOVA_REGRA';
}

function positionLabel(position?: AthletePosition | null): string {
  return athletePositionOptions.find((item) => item.value === position)?.label ?? 'MC • Meio campo';
}

function normalizeTableFilterValue(value: string | number | boolean | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function buildTableFilterOptions(values: Array<string | number | boolean | null | undefined>): string[] {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }));
}

function TableFilterHeader({
  label,
  menuKey,
  currentValue,
  options,
  activeMenu,
  searchValue,
  placeholder,
  onToggle,
  onSearchChange,
  onSelect,
  onClear
}: {
  label: string;
  menuKey: string;
  currentValue: string;
  options: string[];
  activeMenu: string | null;
  searchValue: string;
  placeholder: string;
  onToggle: (key: string) => void;
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
  onClear: () => void;
}) {
  const isOpen = activeMenu === menuKey;
  const inputValue = currentValue || searchValue;

  return <div className={`table-filter-anchor ${isOpen ? 'is-open' : ''}`}><button type="button" className={`table-filter-button ${currentValue ? 'is-active' : ''}`} onClick={() => onToggle(menuKey)} aria-label={`Filtrar ${label.toLowerCase()}`}><MdFilterList /></button><span>{label}</span>{isOpen && <div className="table-filter-popover"><div className="table-filter-popover-head"><strong>{label}</strong><button type="button" className="ghost small" onClick={onClear}>Limpar</button></div><input value={inputValue} onChange={(event) => { onSearchChange(event.target.value); onSelect(event.target.value); }} placeholder={placeholder} /></div>}</div>;
}

function positionBalanceGroup(position: AthletePosition): PositionBalanceGroup {
  if (position === 'GO') return 'GO';
  if (position === 'ZG' || position === 'LD' || position === 'LE') return 'DEFESA';
  if (position === 'MD' || position === 'MC' || position === 'MA') return 'MEIO';
  return 'ATAQUE';
}

function positionSequenceOrder(position?: AthletePosition | null): number {
  if (position === 'GO') return 0;
  if (position === 'LD') return 1;
  if (position === 'LE') return 2;
  if (position === 'ZG') return 3;
  if (position === 'MD') return 4;
  if (position === 'MC') return 5;
  if (position === 'MA') return 6;
  return 7;
}

function comparePlayersByOriginalPosition(left: { position: AthletePosition; name: string; drawOrder?: string | number | null }, right: { position: AthletePosition; name: string; drawOrder?: string | number | null }) {
  const positionDiff = positionSequenceOrder(left.position) - positionSequenceOrder(right.position);
  if (positionDiff !== 0) return positionDiff;
  const leftOrder = Number(left.drawOrder ?? Number.MAX_SAFE_INTEGER);
  const rightOrder = Number(right.drawOrder ?? Number.MAX_SAFE_INTEGER);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' });
}

function comparePlayersForPitchLayout(left: { position?: AthletePosition | null; name: string; drawOrder?: string | number | null; rotationOrder?: string | number | null }, right: { position?: AthletePosition | null; name: string; drawOrder?: string | number | null; rotationOrder?: string | number | null }) {
  const positionDiff = positionSequenceOrder(left.position ?? 'MC') - positionSequenceOrder(right.position ?? 'MC');
  if (positionDiff !== 0) return positionDiff;
  const leftOrder = Number(left.rotationOrder ?? left.drawOrder ?? Number.MAX_SAFE_INTEGER);
  const rightOrder = Number(right.rotationOrder ?? right.drawOrder ?? Number.MAX_SAFE_INTEGER);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' });
}

type TacticalPitchSlot = { left: number; top: number; preferredPositions: AthletePosition[] };

const balancedPositionOrder: AthletePosition[] = ['GO', 'ZG', 'LE', 'LD', 'MC', 'MD', 'MA', 'AT'];

const teamATacticalPitchSlots: TacticalPitchSlot[] = [
  { left: 20, top: 22, preferredPositions: ['LE', 'ZG', 'LD', 'MD', 'MC', 'MA', 'AT'] },
  { left: 20, top: 42, preferredPositions: ['ZG', 'LE', 'LD', 'MC', 'MD', 'MA', 'AT'] },
  { left: 20, top: 62, preferredPositions: ['ZG', 'LD', 'LE', 'MC', 'MD', 'MA', 'AT'] },
  { left: 20, top: 82, preferredPositions: ['LD', 'LE', 'ZG', 'MD', 'MC', 'MA', 'AT'] },
  { left: 33, top: 34, preferredPositions: ['MD', 'MC', 'MA', 'LE', 'ZG', 'LD', 'AT'] },
  { left: 33, top: 66, preferredPositions: ['MC', 'MD', 'MA', 'LD', 'ZG', 'LE', 'AT'] },
  { left: 44, top: 24, preferredPositions: ['MA', 'AT', 'MC', 'MD', 'LE', 'LD', 'ZG'] },
  { left: 44, top: 50, preferredPositions: ['AT', 'MA', 'MC', 'MD', 'ZG', 'LE', 'LD'] },
  { left: 44, top: 76, preferredPositions: ['MA', 'AT', 'MC', 'MD', 'LD', 'LE', 'ZG'] },
  { left: 28, top: 18, preferredPositions: ['MD', 'MC', 'MA', 'ZG', 'LE', 'LD', 'AT'] },
  { left: 28, top: 82, preferredPositions: ['MD', 'MC', 'MA', 'ZG', 'LD', 'LE', 'AT'] },
  { left: 46, top: 64, preferredPositions: ['AT', 'MA', 'MC', 'MD', 'LD', 'LE', 'ZG'] }
];

function tacticalGoalkeeperSlot(team: 'A' | 'B') {
  return team === 'A' ? { left: 11, top: 50 } : { left: 89, top: 50 };
}

function tacticalPitchSlots(team: 'A' | 'B') {
  if (team === 'A') return teamATacticalPitchSlots;
  return teamATacticalPitchSlots.map((slot) => ({
    left: 100 - slot.left,
    top: 100 - slot.top,
    preferredPositions: slot.preferredPositions
  }));
}

function assignPlayersToTacticalSlots<T extends { userId: string; name: string; position?: AthletePosition | null; roleInMatch?: string; drawOrder?: string | number | null; rotationOrder?: string | number | null }>(team: 'A' | 'B', starters: T[]) {
  const goalkeeper = starters.find((player) => player.roleInMatch === 'GOLEIRO')
    ?? starters.find((player) => (player.position ?? 'MC') === 'GO')
    ?? null;
  const outfieldPool = starters
    .filter((player) => player.userId !== goalkeeper?.userId)
    .sort(comparePlayersForPitchLayout);
  const slotPlan = tacticalPitchSlots(team).slice(0, outfieldPool.length);
  const remainingPlayers = [...outfieldPool];
  const assignments: Array<{ player: T; slot: { left: number; top: number } }> = [];

  if (goalkeeper) assignments.push({ player: goalkeeper, slot: tacticalGoalkeeperSlot(team) });

  for (const tacticalSlot of slotPlan) {
    let bestIndex = 0;
    let bestScore = Number.MAX_SAFE_INTEGER;

    for (let index = 0; index < remainingPlayers.length; index += 1) {
      const position = remainingPlayers[index].position ?? 'MC';
      const preferredIndex = tacticalSlot.preferredPositions.indexOf(position);
      const score = preferredIndex >= 0 ? preferredIndex : 100 + positionSequenceOrder(position);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    const [chosenPlayer] = remainingPlayers.splice(bestIndex, 1);
    if (chosenPlayer) assignments.push({ player: chosenPlayer, slot: { left: tacticalSlot.left, top: tacticalSlot.top } });
  }

  return assignments;
}

function rebalanceNaturalGoalkeepers<T extends { userId: string; team: 'A' | 'B' | 'PRESENTE_SEM_JOGAR'; position?: AthletePosition | null; roleInMatch: string; startsOnBench: boolean }>(list: T[]): T[] {
  for (const overloadedTeam of ['A', 'B'] as const) {
    const targetTeam = overloadedTeam === 'A' ? 'B' : 'A';
    const overloadedGoalkeepers = list.filter((player) => player.team === overloadedTeam && player.position === 'GO');
    const targetGoalkeepers = list.filter((player) => player.team === targetTeam && player.position === 'GO');
    if (overloadedGoalkeepers.length < 2 || targetGoalkeepers.length > 0) continue;

    const movingGoalkeeper = overloadedGoalkeepers.find((player) => player.roleInMatch !== 'GOLEIRO')
      ?? overloadedGoalkeepers.find((player) => player.startsOnBench)
      ?? overloadedGoalkeepers[overloadedGoalkeepers.length - 1];
    const swapCandidate = list.find((player) => player.team === targetTeam && player.position !== 'GO');

    if (!movingGoalkeeper || !swapCandidate) continue;

    return list.map((player) => {
      if (player.userId === movingGoalkeeper.userId) return { ...player, team: targetTeam };
      if (player.userId === swapCandidate.userId) return { ...player, team: overloadedTeam };
      return player;
    });
  }

  return list;
}

function normalizeDraftPlayersForLineup(list: MatchDraftPlayer[], options?: { preserveBenchAssignments?: boolean; preserveDrawOrder?: boolean }): MatchDraftPlayer[] {
  const balanced = rebalanceNaturalGoalkeepers(list);
  const teamBuckets: MatchDraftPlayer[] = [];
  const preserveBenchAssignments = options?.preserveBenchAssignments === true;
  const preserveDrawOrder = options?.preserveDrawOrder === true;

  for (const team of ['A', 'B'] as const) {
    const teamPlayers = [...balanced.filter((player) => player.team === team)].sort(comparePlayersByOriginalPosition);
    const explicitGoalkeeper = teamPlayers.find((player) => player.roleInMatch === 'GOLEIRO');
    const naturalGoalkeeper = teamPlayers.find((player) => player.position === 'GO');
    const goalkeeperId = explicitGoalkeeper?.userId ?? naturalGoalkeeper?.userId ?? null;
    let activeLineIndex = 0;

    for (const player of teamPlayers) {
      const isGoalkeeper = goalkeeperId === player.userId;
      teamBuckets.push({
        ...player,
        roleInMatch: isGoalkeeper ? 'GOLEIRO' : 'LINHA',
        startsOnBench: preserveBenchAssignments ? player.startsOnBench : isGoalkeeper ? false : activeLineIndex++ >= 6
      });
    }
  }

  const presentOnly = [...balanced.filter((player) => player.team === 'PRESENTE_SEM_JOGAR')]
    .sort(comparePlayersByOriginalPosition)
    .map((player) => ({ ...player, roleInMatch: 'PRESENTE_SEM_JOGAR' as const, startsOnBench: false }));

  return [...teamBuckets, ...presentOnly].map((player, index) => ({
    ...player,
    drawOrder: preserveDrawOrder && Number.isFinite(Number(player.drawOrder)) && Number(player.drawOrder) > 0 ? String(player.drawOrder) : String(index + 1)
  }));
}

function distributePlayersByPosition(list: MatchDraftPlayer[], randomize = true): MatchDraftPlayer[] {
  const playable = list.filter((player) => player.team !== 'PRESENTE_SEM_JOGAR');
  const presentOnly = list.filter((player) => player.team === 'PRESENTE_SEM_JOGAR');
  const teams: Record<'A' | 'B', MatchDraftPlayer[]> = { A: [], B: [] };
  const counts: Record<'A' | 'B', Record<PositionBalanceGroup, number>> = { A: { GO: 0, DEFESA: 0, MEIO: 0, ATAQUE: 0 }, B: { GO: 0, DEFESA: 0, MEIO: 0, ATAQUE: 0 } };
  const exactCounts: Record<'A' | 'B', Record<AthletePosition, number>> = {
    A: { GO: 0, ZG: 0, LD: 0, LE: 0, MD: 0, MC: 0, MA: 0, AT: 0 },
    B: { GO: 0, ZG: 0, LD: 0, LE: 0, MD: 0, MC: 0, MA: 0, AT: 0 }
  };

  for (const position of balancedPositionOrder) {
    const group = positionBalanceGroup(position);
    const groupPlayers = playable.filter((player) => player.position === position).sort(comparePlayersByOriginalPosition);
    const orderedGroup = randomize ? shuffleRows(groupPlayers) : groupPlayers;
    for (const player of orderedGroup) {
      const target = exactCounts.A[position] < exactCounts.B[position]
        ? 'A'
        : exactCounts.B[position] < exactCounts.A[position]
          ? 'B'
          : counts.A[group] < counts.B[group]
            ? 'A'
            : counts.B[group] < counts.A[group]
              ? 'B'
              : teams.A.length < teams.B.length
                ? 'A'
                : teams.B.length < teams.A.length
                  ? 'B'
                  : randomize && Math.random() >= 0.5
                    ? 'B'
                    : 'A';
      teams[target].push({ ...player, team: target });
      counts[target][group] += 1;
      exactCounts[target][position] += 1;
    }
  }

  return normalizeDraftPlayersForLineup([...teams.A, ...teams.B, ...presentOnly]);
}

function buildRegisteredRosterSeed(users: User[], attendance: MatchAttendanceResponse[], savedPlayers: MatchDetail['players']): MatchDraftPlayer[] {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const savedById = new Map(savedPlayers.map((player) => [player.userId, player]));
  const attendanceById = new Map(attendance.map((item) => [item.userId, item]));
  const baseRoster = users
    .filter((user) => user.active !== false && user.role === 'ATLETA')
    .map((user) => ({ id: user.id, name: user.name, email: user.email, position: user.position ?? 'MC', isGuest: false }))
    .sort(comparePlayersByOriginalPosition);
  const baseRosterIds = new Set(baseRoster.map((user) => user.id));
  const savedExtras = savedPlayers
    .filter((player) => !baseRosterIds.has(player.userId))
    .map((player) => {
      const user = usersById.get(player.userId);
      return { id: player.userId, name: user?.name ?? player.name, email: user?.email ?? '', position: player.position ?? user?.position ?? 'MC', isGuest: player.isGuest === true };
    });
  const fullRoster = [...baseRoster, ...savedExtras].sort(comparePlayersByOriginalPosition);

  const distributedBase = distributePlayersByPosition(fullRoster
    .filter((user) => attendanceById.get(user.id)?.responseStatus !== 'PRESENTE_SEM_JOGAR')
    .map((user) => ({
      userId: user.id,
      name: user.name,
      email: user.email,
      position: user.position,
      team: 'A' as const,
      roleInMatch: user.position === 'GO' ? 'GOLEIRO' as const : 'LINHA' as const,
      drawOrder: '0',
      startsOnBench: false,
      present: attendanceById.get(user.id)?.responseStatus === 'JOGAR',
      isGuest: user.isGuest === true,
      fieldLeft: null,
      fieldTop: null
    })), false);
  const distributedById = new Map(distributedBase.map((player) => [player.userId, player]));

  const seededPlayers = fullRoster.map((user) => {
    const attendanceStatus = attendanceById.get(user.id)?.responseStatus;
    const saved = savedById.get(user.id);

    if (attendanceStatus === 'PRESENTE_SEM_JOGAR') {
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        position: user.position,
        team: 'PRESENTE_SEM_JOGAR' as const,
        roleInMatch: 'PRESENTE_SEM_JOGAR' as const,
        drawOrder: String(saved?.drawOrder ?? 0),
        startsOnBench: false,
        present: true,
        isGuest: user.isGuest === true,
        fieldLeft: saved?.fieldLeft ?? null,
        fieldTop: saved?.fieldTop ?? null
      };
    }

    const fallback = distributedById.get(user.id);
    const savedTeam = saved?.team === 'A' || saved?.team === 'B' ? saved.team : fallback?.team ?? 'A';
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      position: user.position,
      team: savedTeam,
      roleInMatch: saved?.roleInMatch === 'GOLEIRO' ? 'GOLEIRO' as const : fallback?.roleInMatch ?? (user.position === 'GO' ? 'GOLEIRO' as const : 'LINHA' as const),
      drawOrder: String(saved?.drawOrder ?? fallback?.drawOrder ?? 0),
      startsOnBench: saved?.startsOnBench ?? fallback?.startsOnBench ?? false,
      present: attendanceStatus === 'JOGAR' ? true : attendanceStatus === 'AUSENTE' ? false : saved?.present === true,
      isGuest: user.isGuest === true || saved?.isGuest === true,
      fieldLeft: saved?.fieldLeft ?? fallback?.fieldLeft ?? null,
      fieldTop: saved?.fieldTop ?? fallback?.fieldTop ?? null
    };
  });

  return normalizeDraftPlayersForLineup(seededPlayers, { preserveBenchAssignments: savedPlayers.length > 0, preserveDrawOrder: savedPlayers.length > 0 });
}

function persistedPresenceForTeam(team: MatchDraftPlayer['team'] | MatchDetail['players'][number]['team']) {
  return team === 'A' || team === 'B' || team === 'PRESENTE_SEM_JOGAR';
}

function shuffleRows<T>(rows: T[]): T[] {
  return rows.map((row) => ({ row, sort: Math.random() })).sort((left, right) => left.sort - right.sort).map((item) => item.row);
}

function drawBalancedTeams(players: MatchDraftPlayer[]): MatchDraftPlayer[] {
  return distributePlayersByPosition(players, true);
}

function formatCardReason(reason: string) {
  return reason === 'CARTAO_VERMELHO' ? 'Vermelho direto' : 'Acúmulo de 3 amarelos';
}

function polarChartPoint(cx: number, cy: number, radius: number, angle: number) {
  return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`;
}

function eventLabel(event: string) {
  return event.replace('GOL_CONTRA', 'Gol contra').replace('CARTAO_', 'Cartão ').replace('GOL', 'Gol').replace('ASSISTENCIA', 'Assistência').toLowerCase();
}

function numberValue(value: string | number | undefined): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function formatAverage(value: string | number | undefined): string {
  return numberValue(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function normalizeDisplayDate(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function formatDateOnly(value?: string | null, fallback = '—'): string {
  const normalized = normalizeDisplayDate(value);
  if (!normalized) return fallback;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(`${normalized}T12:00:00-03:00`));
}

function formatDateDayMonth(value?: string | null, fallback = '—'): string {
  const normalized = normalizeDisplayDate(value);
  if (!normalized) return fallback;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(`${normalized}T12:00:00-03:00`));
}

function formatBrasiliaTime(value?: string | null): string {
  if (!value) return 'não iniciado';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
}

function formatBrasiliaClock(value?: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
}

function todayInputValue(): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function deriveOperationalClockSeconds(match: MatchDetail): number {
  if (typeof match.draftClockSeconds === 'number' && match.draftClockSeconds > 0) return match.draftClockSeconds;
  if (match.status === 'RUNNING' && match.startedAt) return Math.max(0, Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000));
  return 0;
}

function deriveOperationalClockRunning(match: MatchDetail): boolean {
  return typeof match.draftClockRunning === 'boolean' ? match.draftClockRunning : match.status === 'RUNNING';
}

function addDaysInput(days: number): string {
  const date = new Date(`${todayInputValue()}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekdayFromInputDate(value: string): number {
  const date = new Date(`${value}T12:00:00-03:00`);
  return Number.isNaN(date.getTime()) ? 3 : date.getUTCDay();
}

function matchDateLabel(match: MatchListItem): string {
  const date = formatDateOnly(match.matchDate, 'sem data');
  const start = match.scheduledStart?.slice(0, 5) ?? '20:00';
  const end = match.scheduledEnd?.slice(0, 5) ?? '21:00';
  return `${date} • ${start} - ${end}`;
}

function getMatchStartTime(match: MatchListItem): number {
  const date = match.matchDate?.slice(0, 10) || todayInputValue();
  const start = match.scheduledStart?.slice(0, 5) || '20:00';
  return new Date(`${date}T${start}:00-03:00`).getTime();
}

function sortMatchesByOperationalRelevance(matches: MatchListItem[]): MatchListItem[] {
  const now = Date.now();
  return [...matches].sort((left, right) => {
    const leftTime = getMatchStartTime(left);
    const rightTime = getMatchStartTime(right);
    const leftUpcoming = leftTime >= now && left.status !== 'CANCELLED';
    const rightUpcoming = rightTime >= now && right.status !== 'CANCELLED';
    if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
    return leftUpcoming ? leftTime - rightTime : rightTime - leftTime;
  });
}

function matchStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'Pré-jogo',
    RUNNING: 'Em andamento',
    SUBMITTED: 'Súmula enviada',
    CONFIRMED: 'Encerrado',
    CANCELLED: 'Cancelado'
  };
  return labels[status] ?? status;
}

function attendanceStatusLabel(status?: MatchListItem['myAttendanceStatus']): string {
  if (status === 'JOGAR') return 'Você confirmou que vai jogar';
  if (status === 'PRESENTE_SEM_JOGAR') return 'Você confirmou presença sem jogar';
  if (status === 'AUSENTE') return 'Você marcou ausência';
  return 'Sua resposta está pendente';
}

function attendanceActionLabel(status?: MatchListItem['myAttendanceStatus'] | null): string {
  if (status === 'JOGAR') return 'Confirmado: jogo ✓';
  if (status === 'PRESENTE_SEM_JOGAR') return 'Confirmado: presença ✓';
  if (status === 'AUSENTE') return 'Ausência salva ✓';
  return 'Confirmações';
}

function matchDateParts(match: MatchListItem): { day: string; month: string; weekday: string; time: string } {
  const date = new Date(`${match.matchDate?.slice(0, 10) || todayInputValue()}T12:00:00-03:00`);
  const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', weekday: 'short' });
  const parts = formatter.formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value.replace('.', '') ?? '';
  return {
    day: pick('day'),
    month: pick('month').toUpperCase(),
    weekday: pick('weekday').toUpperCase(),
    time: match.scheduledStart?.slice(0, 5) ?? '20:00'
  };
}

function matchRelativeLabel(match: MatchListItem): string {
  const today = new Date(`${todayInputValue()}T12:00:00-03:00`).getTime();
  const matchDay = new Date(`${match.matchDate?.slice(0, 10) || todayInputValue()}T12:00:00-03:00`).getTime();
  const diffDays = Math.round((matchDay - today) / 86400000);
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  if (diffDays > 1) return `Em ${diffDays} dias`;
  if (diffDays === -1) return 'Ontem';
  return `${Math.abs(diffDays)} dias atrás`;
}

function isMatchToday(match: MatchListItem): boolean {
  return match.matchDate?.slice(0, 10) === todayInputValue();
}

function isConfirmationReallyOpen(match: MatchListItem): boolean {
  return match.status === 'DRAFT' && match.confirmationOpen === true && !confirmationWindowHasEnded(match);
}

function confirmationWindowHasEnded(match: MatchListItem): boolean {
  return Boolean(match.confirmationCloseAt && Date.now() >= new Date(match.confirmationCloseAt).getTime());
}

function confirmationWindowScheduleLabel(match: MatchListItem): string {
  const opens = match.confirmationOpenAt ? formatBrasiliaTime(match.confirmationOpenAt) : 'abertura não definida';
  const closes = match.confirmationCloseAt ? formatBrasiliaTime(match.confirmationCloseAt) : 'fechamento não definido';
  return `abre ${opens} • fecha ${closes}`;
}

type SpreadsheetCell = string | number | boolean | null | undefined;

function spreadsheetLabel(label: string) {
  return label
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (value) => value.toUpperCase());
}

function spreadsheetCellValue(value: SpreadsheetCell) {
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return value ?? '';
}

function spreadsheetCellMeta(header: string, value: SpreadsheetCell): { value: string | number | Date; kind: 'text' | 'number' | 'currency' | 'date' | 'month' | 'status' } {
  const normalizedHeader = header.toLowerCase();
  const isCurrencyField = normalizedHeader.includes('valor') || normalizedHeader.includes('saldo') || normalizedHeader.includes('pago');
  const isStatusField = normalizedHeader.includes('status');
  const isMonthField = normalizedHeader === 'mes' || normalizedHeader.includes('mês') || normalizedHeader.includes('month');
  const isDateField = normalizedHeader.includes('data') || normalizedHeader.includes('venc') || normalizedHeader.includes('pagoem') || normalizedHeader.includes('pago em') || normalizedHeader.includes('date');

  if (typeof value === 'boolean') return { value: value ? 'Sim' : 'Não', kind: 'text' };
  if (typeof value === 'number') return { value, kind: isCurrencyField ? 'currency' : 'number' };
  if (typeof value !== 'string') return { value: value ?? '', kind: 'text' };

  const trimmedValue = value.trim();
  if (!trimmedValue) return { value: '', kind: 'text' };

  if (isMonthField && /^\d{4}-\d{2}$/.test(trimmedValue)) {
    const [year, month] = trimmedValue.split('-').map(Number);
    return { value: new Date(year, month - 1, 1), kind: 'month' };
  }

  if (isDateField && /^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    const [year, month, day] = trimmedValue.split('-').map(Number);
    return { value: new Date(year, month - 1, day), kind: 'date' };
  }

  if (isCurrencyField && /^-?\d+(?:\.\d+)?$/.test(trimmedValue)) {
    return { value: Number(trimmedValue), kind: 'currency' };
  }

  if (isStatusField) {
    return { value: trimmedValue, kind: 'status' };
  }

  return { value: trimmedValue, kind: 'text' };
}

async function downloadStyledWorkbook(filename: string, sheetName: string, title: string, rows: Array<Record<string, SpreadsheetCell>>) {
  if (!rows.length) return;
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PlayField';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    properties: { defaultRowHeight: 22 },
    views: [{ state: 'frozen', ySplit: 4 }]
  });

  const headers = Object.keys(rows[0]);
  const headerLabels = headers.map(spreadsheetLabel);
  const exportStamp = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());

  worksheet.mergeCells(1, 1, 1, headers.length);
  worksheet.getCell('A1').value = title;
  worksheet.getCell('A1').font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFF8FAFC' } };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D6051' } };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells(2, 1, 2, headers.length);
  worksheet.getCell('A2').value = `Exportado por PlayField em ${exportStamp}`;
  worksheet.getCell('A2').font = { name: 'Calibri', size: 10, color: { argb: 'FF365346' }, italic: true };
  worksheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5F0' } };
  worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left' };

  worksheet.addRow([]);
  const headerRow = worksheet.addRow(headerLabels);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFF8FAFC' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB6D4CB' } },
      left: { style: 'thin', color: { argb: 'FFB6D4CB' } },
      bottom: { style: 'thin', color: { argb: 'FFB6D4CB' } },
      right: { style: 'thin', color: { argb: 'FFB6D4CB' } }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  rows.forEach((row, rowIndex) => {
    const processedCells = headers.map((header) => spreadsheetCellMeta(header, row[header]));
    const dataRow = worksheet.addRow(processedCells.map((cell) => cell.value));
    dataRow.eachCell((cell, columnIndex) => {
      const header = headers[columnIndex - 1]?.toLowerCase() ?? '';
      const cellMeta = processedCells[columnIndex - 1] ?? { value: '', kind: 'text' as const };
      const isNumeric = cellMeta.kind === 'number' || cellMeta.kind === 'currency';
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE1ECE7' } },
        left: { style: 'thin', color: { argb: 'FFE1ECE7' } },
        bottom: { style: 'thin', color: { argb: 'FFE1ECE7' } },
        right: { style: 'thin', color: { argb: 'FFE1ECE7' } }
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowIndex % 2 === 0 ? 'FFFDFEFD' : 'FFF3F8F5' } };
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F332A' } };
      cell.alignment = { vertical: 'middle', horizontal: isNumeric ? 'center' : 'left' };

      if (cellMeta.kind === 'currency') {
        cell.numFmt = '[$R$-416] #,##0.00';
      }
      if (cellMeta.kind === 'date') {
        cell.numFmt = 'dd/mm/yyyy';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      if (cellMeta.kind === 'month') {
        cell.numFmt = 'mm/yyyy';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      if (cellMeta.kind === 'status' && typeof cellMeta.value === 'string') {
        const statusValue = cellMeta.value.toUpperCase();
        if (statusValue === 'PAID') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9F4E5' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF166534' } };
        } else if (statusValue === 'LATE') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE2E2' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
        } else if (statusValue === 'PENDING') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } };
        } else if (statusValue === 'PARTIAL') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1D4ED8' } };
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
  });

  worksheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: headers.length }
  };

  worksheet.columns = headers.map((header, index) => {
    const normalizedHeader = header.toLowerCase();
    const widest = Math.max(
      headerLabels[index].length,
      ...rows.map((row) => {
        const cellMeta = spreadsheetCellMeta(header, row[header]);
        if (cellMeta.kind === 'date') return 10;
        if (cellMeta.kind === 'month') return 7;
        if (cellMeta.kind === 'currency') return 14;
        return String(spreadsheetCellValue(row[header])).length;
      })
    );
    const isWideText = normalizedHeader.includes('observ') || normalizedHeader.includes('descr');
    return {
      key: header,
      width: Math.min(Math.max(widest + 3, normalizedHeader.includes('atleta') ? 18 : 12), isWideText ? 40 : 24)
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, rows: Array<Record<string, SpreadsheetCell>>) {
  const brandedFilename = filename.replace(/^poka-pratika-/i, 'playfield-');
  const workbookName = brandedFilename.toLowerCase().endsWith('.csv') ? `${brandedFilename.slice(0, -4)}.xlsx` : `${brandedFilename}.xlsx`;
  const baseName = workbookName.replace(/\.xlsx$/i, '');
  const sheetName = baseName
    .replace(/^(?:playfield|poka-pratika)-?/i, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') || 'Relatorio';
  const title = `PlayField • ${sheetName.replace(/([a-z])([A-Z])/g, '$1 $2')}`;
  void downloadStyledWorkbook(workbookName, sheetName, title, rows);
}

function formatMoney(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function matchCountdownLabel(match?: MatchListItem | null, now = Date.now()): string {
  if (!match) return 'Sem agenda';
  const diffSeconds = Math.floor((getMatchStartTime(match) - now) / 1000);
  if (diffSeconds <= 0) return match.status === 'RUNNING' ? 'Em andamento' : '00:00:00';
  const days = Math.floor(diffSeconds / 86400);
  const hours = Math.floor((diffSeconds % 86400) / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;
  return days > 0
    ? `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h`
    : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function compactMatchDateLabel(match: MatchListItem): string {
  const date = matchDateParts(match);
  return `${date.day} ${date.month} • ${date.weekday} ${date.time}`;
}

function matchOutcomeLabel(match: MatchListItem): string {
  if (match.teamAScore === match.teamBScore) return 'Empate confirmado em súmula';
  return `Vitória confirmada de ${match.teamAScore > match.teamBScore ? match.teamAName : match.teamBName}`;
}

function teamBadgeLabel(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '--';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function DashboardIcon({ name }: { name: 'calendar' | 'clock' | 'shield' | 'wallet' | 'field' | 'table' | 'goal' | 'assist' | 'cards' | 'trophy' | 'file' | 'gear' | 'bell' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === 'calendar' && <><rect x="3" y="5" width="18" height="16" rx="3" {...common} /><path d="M16 3v4M8 3v4M3 10h18" {...common} /></>}
      {name === 'clock' && <><circle cx="12" cy="12" r="9" {...common} /><path d="M12 7v5l3 2" {...common} /></>}
      {name === 'shield' && <><path d="M12 3l7 3v5c0 4.4-2.8 8.1-7 10-4.2-1.9-7-5.6-7-10V6l7-3z" {...common} /><path d="M9.5 12.3l1.8 1.8 3.5-4" {...common} /></>}
      {name === 'wallet' && <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a2 2 0 0 1 2 2v1H6.5A2.5 2.5 0 0 0 4 10.5v-3z" {...common} /><path d="M4 10.5A2.5 2.5 0 0 1 6.5 8H21v9a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-6z" {...common} /><circle cx="16.5" cy="13.5" r="1" fill="currentColor" /></>}
      {name === 'field' && <><rect x="3" y="4" width="18" height="16" rx="2" {...common} /><path d="M12 4v16M3 12h18M8 12a4 4 0 0 0 0-8M8 12a4 4 0 0 1 0 8M16 12a4 4 0 0 1 0-8M16 12a4 4 0 0 0 0 8" {...common} /><circle cx="12" cy="12" r="1.5" {...common} /></>}
      {name === 'table' && <><rect x="3" y="5" width="18" height="14" rx="2" {...common} /><path d="M3 10h18M8 5v14M16 5v14" {...common} /></>}
      {name === 'goal' && <><path d="M5 18V7h14v11" {...common} /><path d="M9 18V9M15 18V9M3 18h18" {...common} /></>}
      {name === 'assist' && <><path d="M7 12l3 3 7-7" {...common} /><path d="M5 5h4v4M15 15h4v4" {...common} /></>}
      {name === 'cards' && <><rect x="6" y="4" width="11" height="15" rx="2" {...common} /><path d="M9 8h5M9 12h5M9 16h3" {...common} /><path d="M17 7h1.5A1.5 1.5 0 0 1 20 8.5V17" {...common} /></>}
      {name === 'trophy' && <><path d="M8 4h8v3a4 4 0 0 1-8 0V4z" {...common} /><path d="M9 17h6M10 14h4v3h-4zM6 6H4a2 2 0 0 0 2 4h2M18 6h2a2 2 0 0 1-2 4h-2" {...common} /></>}
      {name === 'file' && <><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" {...common} /><path d="M14 3v5h5" {...common} /></>}
      {name === 'gear' && <><circle cx="12" cy="12" r="3" {...common} /><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2a1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.1a1 1 0 0 0-.6-.9a1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1a1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.1a1 1 0 0 0 .9-.6a1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .5-.9V4a2 2 0 1 1 4 0v.1a1 1 0 0 0 .6.9a1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.5H20a2 2 0 1 1 0 4h-.1a1 1 0 0 0-.9.6z" {...common} /></>}
      {name === 'bell' && <><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" {...common} /><path d="M10 17a2 2 0 0 0 4 0" {...common} /></>}
    </svg>
  );
}

export function App() {
  const passwordPath = window.location.pathname === '/ativar-conta' || window.location.pathname === '/resetar-senha' ? window.location.pathname : '';
  const [auth, setAuth] = useState<AuthPayload | null>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) as AuthPayload : null;
  });
  const api = useMemo(() => new ApiClient(auth?.token ?? null), [auth?.token]);
  const [view, setView] = useState<View>('temporada');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState('');
  const [standings, setStandings] = useState<Standing[]>([]);
  const [rankings, setRankings] = useState<RankingPayload>({ goals: [], assists: [], presence: [], cards: [] });
  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [points, setPoints] = useState<PointSetting[]>([]);
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchDetail | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [operationalDialogOpen, setOperationalDialogOpen] = useState(false);
  const canCoordinate = auth?.user.role === 'ADMIN' || auth?.user.role === 'COORDENADOR';
  const isAdmin = auth?.user.role === 'ADMIN';
  const activeSeason = seasons.find((season) => season.id === activeSeasonId) ?? seasons.find((season) => season.status === 'OPEN') ?? seasons[0];

  async function loadData() {
    if (!auth) return;
    setLoading(true);
    setError('');
    try {
      const [seasonData, userData, pointData, suspensionData] = await Promise.all([
        api.request<Season[]>('/seasons'),
        api.request<User[]>('/users'),
        api.request<PointSetting[]>('/settings/points'),
        api.request<Suspension[]>('/suspensions')
      ]);
      setSeasons(seasonData);
      setUsers(userData);
      setPoints(pointData);
      setSuspensions(suspensionData);
      const selected = activeSeasonId || seasonData.find((season) => season.status === 'OPEN')?.id || seasonData[0]?.id || '';
      setActiveSeasonId(selected);
      if (selected) {
        const [standingData, rankingData, matchData] = await Promise.all([
          api.request<Standing[]>(`/seasons/${selected}/standings`),
          api.request<RankingPayload>(`/seasons/${selected}/rankings`),
          api.request<MatchListItem[]>(`/matches?seasonId=${selected}`)
        ]);
        setStandings(standingData);
        setRankings(rankingData);
        setMatches(matchData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [auth?.token]);

  useEffect(() => {
    if (!auth || !activeSeasonId) return;
    Promise.all([
      api.request<Standing[]>(`/seasons/${activeSeasonId}/standings`),
      api.request<RankingPayload>(`/seasons/${activeSeasonId}/rankings`),
      api.request<MatchListItem[]>(`/matches?seasonId=${activeSeasonId}`)
    ]).then(([standingData, rankingData, matchData]) => {
      setStandings(standingData);
      setRankings(rankingData);
      setMatches(matchData);
    }).catch((err) => setError(err instanceof Error ? err.message : 'Falha ao trocar temporada.'));
  }, [activeSeasonId]);

  useEffect(() => {
    if (!auth || !activeSeasonId) return;
    const timer = window.setInterval(() => {
      api.request<MatchListItem[]>(`/matches?seasonId=${activeSeasonId}`)
        .then(setMatches)
        .catch(() => undefined);
      if (selectedMatch?.id) {
        api.request<MatchDetail>(`/matches/${selectedMatch.id}`)
          .then(setSelectedMatch)
          .catch(() => undefined);
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [api, auth?.token, activeSeasonId, selectedMatch?.id]);

  useEffect(() => {
    if (!accountMenuOpen) return;

    function closeOnOutside(event: PointerEvent) {
      const target = event.target as Element | null;
      if (target?.closest('.account-menu') || target?.closest('.header-menu-trigger')) return;
      setAccountMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountMenuOpen]);

  function saveAuth(payload: AuthPayload) {
    localStorage.setItem(storageKey, JSON.stringify(payload));
    setAuth(payload);
  }

  function updateAuthenticatedUser(user: User) {
    setAuth((current) => {
      if (!current) return current;
      const updated = { ...current, user: { ...current.user, ...user } };
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  }

  if (passwordPath) {
    return <PasswordTokenScreen mode={passwordPath === '/ativar-conta' ? 'activation' : 'reset'} />;
  }

  if (!auth) {
    return <LoginScreen onAuth={saveAuth} />;
  }

  return (
    <main
      className={`shell ${view === "temporada" ? "shell-home" : ""} ${accountMenuOpen ? "menu-open" : ""}`}
    >
      <header className="hero card glass app-header">
        <div className="header-admin-cluster">
          <div className="account-area">
            <button
              type="button"
              className={`header-menu-trigger ${accountMenuOpen ? "is-open" : ""}`}
              onClick={() => setAccountMenuOpen((value) => !value)}
              aria-label="Abrir menu principal"
              title="Abrir menu principal"
            >
              <MdMenu />
            </button>
          </div>
        </div>
        <div className="brand-lockup">
          <span className="brand-symbol">
            <img className="brand-logo" src={logoUrl} alt="Logo PlayField" />
          </span>
          <span className="brand-copy">
            <strong className="brand-name">PlayField</strong>
            <span className="brand-tagline">sports &amp; gaming hub</span>
          </span>
        </div>
      </header>

      {accountMenuOpen && (
        <div className="account-menu-layer">
          <button
            type="button"
            className="account-menu-backdrop"
            aria-label="Fechar menu"
            onClick={() => setAccountMenuOpen(false)}
          />
          <aside
            className="account-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
          >
            <div className="account-menu-top">
              <button
                type="button"
                className="account-menu-close"
                aria-label="Fechar menu"
                onClick={() => setAccountMenuOpen(false)}
              >
                x
              </button>
              <div className="account-menu-profile">
                {auth.user.avatarDataUrl ? (
                  <img src={auth.user.avatarDataUrl} alt="Avatar" />
                ) : (
                  <span>{auth.user.name.slice(0, 1)}</span>
                )}
                <div>
                  <strong>{auth.user.name}</strong>
                  <small>{auth.user.role}</small>
                </div>
              </div>
            </div>
            <nav className="account-menu-actions">
              {canCoordinate && (
                <>
                  <button
                    onClick={() => {
                      setOperationalDialogOpen(true);
                      setAccountMenuOpen(false);
                    }}
                  >
                    Criar jogo
                  </button>
                  <button
                    onClick={() => {
                      setView("temporada");
                      setAccountMenuOpen(false);
                    }}
                  >
                    Temporada
                  </button>
                  <button
                    onClick={() => {
                      setView("partidas");
                      setAccountMenuOpen(false);
                    }}
                  >
                    Partidas
                  </button>
                  <button
                    onClick={() => {
                      setView("estatisticas");
                      setAccountMenuOpen(false);
                    }}
                  >
                    Estatísticas
                  </button>
                  <button
                    onClick={() => {
                      setView("pagamentos");
                      setAccountMenuOpen(false);
                    }}
                  >
                    Mensalidades
                  </button>
                  <button
                    onClick={() => {
                      setView("premios");
                      setAccountMenuOpen(false);
                    }}
                  >
                    Prêmios
                  </button>
                  <button
                    onClick={() => {
                      setView("usuarios");
                      setAccountMenuOpen(false);
                    }}
                  >
                    Usuários
                  </button>
                  <button
                    onClick={() => {
                      setView("admin");
                      setAccountMenuOpen(false);
                    }}
                  >
                    Config.
                  </button>
                  <button
                    onClick={() => {
                      setView("agenda");
                      setAccountMenuOpen(false);
                    }}
                  >
                    Agenda
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setProfileUserId(auth.user.id);
                  setAccountMenuOpen(false);
                }}
              >
                Meu perfil
              </button>
              <button
                className="danger-menu"
                onClick={() => {
                  localStorage.removeItem(storageKey);
                  setAuth(null);
                }}
              >
                Sair
              </button>
            </nav>
          </aside>
        </div>
      )}

      {canCoordinate && (
        <OperationalMatchDialog
          api={api}
          users={users}
          activeSeasonId={activeSeasonId}
          onDone={loadData}
          controlledOpen={operationalDialogOpen}
          onOpenChange={setOperationalDialogOpen}
          hideTrigger
        />
      )}

      {changePasswordOpen && (
        <ChangePasswordDialog
          api={api}
          onClose={() => setChangePasswordOpen(false)}
        />
      )}
      {profileUserId && (
        <div className="modal profile-modal">
          <div className="profile-modal-card athlete-profile-modal-card">
            <div className="card-head athlete-profile-modal-head">
              <h2>Perfil do atleta</h2>
              <button
                type="button"
                className="ghost modal-close-button"
                aria-label="Fechar modal"
                title="Fechar"
                onClick={() => setProfileUserId(null)}
              >
                X
              </button>
            </div>
            <ProfilesPanel
              api={api}
              currentUserId={auth.user.id}
              initialUserId={profileUserId}
              onCurrentUserUpdated={updateAuthenticatedUser}
              onRequestChangePassword={() => {
                setProfileUserId(null);
                setChangePasswordOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <button className="alert" onClick={() => setError("")}>
          {error}
        </button>
      )}
      {loading && (
        <div className="mini-loading">Carregando dados reais da Railway...</div>
      )}
      {!loading && activeSeason && (
        <>
          <GlobalAttendancePrompt
            api={api}
            activeSeason={activeSeason}
            currentUserId={auth.user.id}
            onSaved={loadData}
          />
          <GlobalVotingPrompt
            api={api}
            users={users}
            activeSeason={activeSeason}
            isAdmin={isAdmin}
          />
        </>
      )}
      {view === "temporada" && (
        <div className="home-stack dashboard-main">
          <div className="dashboard-top-grid">
            <DashboardMatchesPanel
              api={api}
              canCoordinate={canCoordinate}
              users={users}
              matches={matches}
              rankings={rankings}
              standings={standings}
              activeSeasonId={activeSeasonId}
              currentUserId={auth.user.id}
              onReload={loadData}
              selectedMatch={selectedMatch}
              setSelectedMatch={setSelectedMatch}
              onOpenProfile={setProfileUserId}
            />
          </div>
          <div className="dashboard-bottom-grid">
            <DashboardStandingsPanel
              standings={standings}
              onOpenProfile={setProfileUserId}
            />
          </div>
        </div>
      )}
      {view === "partidas" && (
        <div className="home-stack standard-page">
          <section className="card compact standard-page-header">
            <div className="card-head">
              <div>
                <h2>Partidas</h2>
                <p className="muted">Histórico de jogos confirmados da temporada.</p>
              </div>
            </div>
          </section>
          <DashboardFinishedMatchesPanel matches={matches} />
        </div>
      )}
      {view === "estatisticas" && (
        <div className="home-stack statistics-page">
          <DashboardStandingsPanel standings={standings} onOpenProfile={setProfileUserId} />
        </div>
      )}
      {view === "agenda" && canCoordinate && (
        <ScheduleManagerPanel
          api={api}
          matches={matches}
          activeSeasonId={activeSeasonId}
          onDone={loadData}
        />
      )}
      {view === "pagamentos" && (
        <PaymentsPanel
          api={api}
          canCoordinate={canCoordinate}
          users={users}
          activeSeasonId={activeSeasonId}
        />
      )}
      {view === "premios" && canCoordinate && (
        <div className="home-stack">
          <AwardSettingsCard api={api} />
        </div>
      )}
      {view === "usuarios" && canCoordinate && (
        <UsersManagementTablePanel
          api={api}
          users={users}
          onReload={loadData}
          isAdmin={isAdmin}
        />
      )}
      {view === "admin" && canCoordinate && (
        <AdminPanel
          api={api}
          users={users}
          seasons={seasons}
          points={points}
          activeSeasonId={activeSeasonId}
          onReload={loadData}
          isAdmin={isAdmin}
        />
      )}
    </main>
  );
}

function PasswordTokenScreen({ mode }: { mode: 'activation' | 'reset' }) {
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token') ?? '', []);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const api = useMemo(() => new ApiClient(null), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!token) {
      setMessage('Link inválido: token não encontrado.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('As senhas precisam ser iguais.');
      return;
    }
    try {
      await api.request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
      setDone(true);
      setMessage(mode === 'activation' ? 'Cadastro ativado. Agora é só entrar com seu e-mail e senha.' : 'Senha alterada. Agora você pode entrar novamente.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível salvar a senha.');
    }
  }

  return <main className="login-wrap"><form className="login-card card" onSubmit={submit}><img className="login-logo" src={logoUrl} alt="Logo PlayField" /><p className="eyebrow">PlayField • acesso seguro</p><h1>{mode === 'activation' ? 'Ativar cadastro' : 'Alterar senha'}</h1><p className="muted">Defina uma senha com pelo menos 8 caracteres. O login será sempre pelo seu e-mail.</p><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nova senha" type="password" autoComplete="new-password" required minLength={8} disabled={done} /><input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirmar senha" type="password" autoComplete="new-password" required minLength={8} disabled={done} /><button className="primary" disabled={done}>{done ? 'Senha salva' : 'Salvar senha'}</button>{message && <p className="muted">{message}</p>}{done && <button type="button" className="ghost" onClick={() => { window.history.replaceState({}, '', '/'); window.location.reload(); }}>Ir para login</button>}</form></main>;
}

function LoginScreen({ onAuth }: { onAuth: (payload: AuthPayload) => void }) {
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const api = useMemo(() => new ApiClient(null), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      if (mode === 'forgot') {
        const response = await api.request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
        setMessage(response.message);
        return;
      }
      const payload = await api.request<AuthPayload>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      onAuth(payload);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível autenticar.');
    }
  }

  function toggleMode() {
    setMode((currentMode) => currentMode === 'forgot' ? 'login' : 'forgot');
    setPassword('');
    setMessage('');
  }

  return (
    <main className="login-wrap">
      <form className="login-card login-card-auth card" onSubmit={submit}>
        <section className="login-brand-panel">
          <img className="login-logo" src={logoUrl} alt="Logo PlayField" />
          <div className="login-brand-copy">
            <p className="eyebrow">Balneário Camboriú / SC</p>
            <strong>O jogo começa antes da bola rolar.</strong>
            <span>Organização, presença e temporada em um só lugar.</span>
          </div>
        </section>

        <section className="login-form-panel">
          <header className="login-heading">
            <span className="login-kicker">Acesso ao clube</span>
            <h1>{mode === 'forgot' ? 'Recuperar senha' : 'Entrar no PlayField'}</h1>
            <p>{mode === 'forgot' ? 'Informe seu e-mail para receber as instruções de recuperação.' : 'Use seu e-mail cadastrado para continuar.'}</p>
          </header>

          <div className="login-fields">
            <label className="login-field">
              <span>E-mail</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" type="email" autoComplete="email" required />
            </label>
            {mode !== 'forgot' && (
              <label className="login-field">
                <span>Senha</span>
                <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" type="password" autoComplete="current-password" required minLength={8} />
              </label>
            )}
          </div>

          <button className="primary login-submit">{mode === 'forgot' ? 'Enviar recuperação' : 'Entrar'}</button>
          {message && <p className="login-message" role="status">{message}</p>}
          <div className="login-actions">
            <button type="button" className="ghost" onClick={toggleMode}>{mode === 'forgot' ? 'Voltar ao login' : 'Esqueci minha senha'}</button>
          </div>
        </section>
      </form>
    </main>
  );
}

function GlobalAttendancePrompt({ api, activeSeason, currentUserId, onSaved }: { api: ApiClient; activeSeason: Season; currentUserId: string; onSaved: () => Promise<void> }) {
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [dismissedMatchId, setDismissedMatchId] = useState('');

  async function loadPrompt() {
    const prompt = await api.request<{ kind: 'ATTENDANCE' | null; match: MatchListItem | null }>(`/matches/confirmation-prompt?seasonId=${activeSeason.id}`);
    if (prompt.kind !== 'ATTENDANCE' || !prompt.match || prompt.match.id === dismissedMatchId) {
      setMatch(null);
      return;
    }
    setMatch(await api.request<MatchDetail>(`/matches/${prompt.match.id}`));
  }

  useEffect(() => {
    void loadPrompt().catch(() => setMatch(null));
    const timer = window.setInterval(() => void loadPrompt().catch(() => undefined), 15000);
    return () => window.clearInterval(timer);
  }, [api, activeSeason.id, dismissedMatchId]);

  if (!match) return null;

  return (
    <div className="modal prompt-modal">
      <section className="match-modal-card confirmation-popup">
        <div className="card-head">
          <div>
            <h2>Confirmação aberta</h2>
            <p className="muted">{match.title} • {matchDateLabel(match)}</p>
          </div>
          <button type="button" className="ghost" onClick={() => setDismissedMatchId(match.id)}>Depois</button>
        </div>
        <AttendancePanel
          api={api}
          match={match}
          currentUserId={currentUserId}
          showRecentCard={false}
          onSaved={async () => {
            setMatch(null);
            await onSaved();
          }}
        />
      </section>
    </div>
  );
}

function GlobalVotingPrompt({ api, users, activeSeason, isAdmin }: { api: ApiClient; users: User[]; activeSeason: Season; isAdmin: boolean }) {
  const [summary, setSummary] = useState<AwardPendingSummary | null>(null);
  const [dismissedSeasonId, setDismissedSeasonId] = useState('');
  const [open, setOpen] = useState(false);

  async function loadPendingVotes() {
    setSummary(await api.request<AwardPendingSummary>(`/awards/pending/${activeSeason.id}`));
  }

  useEffect(() => {
    setOpen(false);
    setDismissedSeasonId('');
    void loadPendingVotes().catch(() => setSummary(null));
  }, [activeSeason.id]);

  const pendingCount = summary?.pending.length ?? 0;
  if (!summary?.votingOpen || pendingCount === 0) return null;

  return <>{dismissedSeasonId !== activeSeason.id && !open && <div className="modal prompt-modal"><section className="card modal-card confirmation-popup voting-popup"><div className="card-head"><div><h2>Votação aberta</h2><p className="muted">{summary.seasonName ?? activeSeason.name} • {pendingCount} pendência(s) para você</p></div><button type="button" className="ghost" onClick={() => setDismissedSeasonId(activeSeason.id)}>Depois</button></div><p className="muted">A temporada foi encerrada e alguns prêmios dependem do seu voto. Tudo acontece aqui em modal, sem sair da página principal.</p><div className="chips">{summary.pending.map((item) => <span className="chip trophy" key={item.code}>{item.label}</span>)}</div><div className="actions"><button type="button" className="primary" onClick={() => setOpen(true)}>Votar agora</button><button type="button" className="ghost" onClick={() => setDismissedSeasonId(activeSeason.id)}>Agora não</button></div></section></div>}{open && <div className="modal profile-modal"><div className="profile-modal-card"><div className="card-head"><div><h2>Votação dos prêmios</h2><p className="muted">Votos individuais, sigilosos e controlados por usuário.</p></div><button type="button" className="ghost modal-close-button" aria-label="Fechar modal" title="Fechar" onClick={() => { setOpen(false); void loadPendingVotes().catch(() => undefined); }}>X</button></div><AwardsPanel api={api} users={users} activeSeason={activeSeason} isAdmin={isAdmin} onVoted={loadPendingVotes} /></div></div>}</>;
}

function ChangePasswordDialog({ api, onClose }: { api: ApiClient; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (newPassword !== confirmPassword) {
      setMessage('A confirmação precisa ser igual à nova senha.');
      return;
    }
    setSaving(true);
    try {
      const response = await api.request<{ message: string }>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
      setMessage(response.message);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível trocar a senha.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="modal"><form className="card modal-card password-card" onSubmit={submit}><div className="card-head"><h2>Trocar senha</h2><button type="button" className="ghost modal-close-button" aria-label="Fechar modal" title="Fechar" onClick={onClose}>X</button></div><p className="muted">Informe sua senha atual e defina uma nova senha com pelo menos 8 caracteres.</p><input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Senha atual" type="password" autoComplete="current-password" required disabled={saving || saved} /><input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Nova senha" type="password" autoComplete="new-password" required minLength={8} disabled={saving || saved} /><input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirmar nova senha" type="password" autoComplete="new-password" required minLength={8} disabled={saving || saved} /><button className="primary" disabled={saving || saved}>{saving ? 'Salvando...' : saved ? 'Senha alterada' : 'Salvar nova senha'}</button>{message && <p className="muted">{message}</p>}</form></div>;
}

function DashboardSeasonPanel({ standings, rankings, matches, onOpenProfile }: { standings: Standing[]; rankings: RankingPayload; matches: MatchListItem[]; onOpenProfile: (userId: string) => void }) {
  const [tab, setTab] = useState<SeasonStatsTab>('GERAL');
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  const finishedMatches = sortMatchesByOperationalRelevance(matches).filter((match) => match.status === 'CONFIRMED').slice(0, 10);
  const leaderCards = [
    standings[0] && { key: 'points', icon: 'trophy' as const, label: 'Líder geral', userId: standings[0].user_id, name: standings[0].name, value: `${standings[0].total_points} pts`, detail: `${standings[0].wins} vitórias • ${standings[0].games_played} jogos` },
    rankings.goals[0] && { key: 'goals', icon: 'goal' as const, label: 'Artilharia', userId: rankings.goals[0].userId, name: rankings.goals[0].name, value: `${rankings.goals[0].goals} gols`, detail: `${rankings.goals[0].netGoals} saldo líquido` },
    rankings.assists[0] && { key: 'assists', icon: 'assist' as const, label: 'Assistências', userId: rankings.assists[0].userId, name: rankings.assists[0].name, value: `${rankings.assists[0].assists} assist.`, detail: `${rankings.assists[0].gamesPlayed} jogos • média ${formatAverage(rankings.assists[0].average)}` },
    rankings.presence[0] && { key: 'presence', icon: 'calendar' as const, label: 'Mais presente', userId: rankings.presence[0].userId, name: rankings.presence[0].name, value: `${rankings.presence[0].total} pres.`, detail: `${formatAverage(rankings.presence[0].percentage)}% de presença` }
  ].filter(Boolean) as Array<{ key: string; icon: 'trophy' | 'goal' | 'assist' | 'calendar'; label: string; userId: string; name: string; value: string; detail: string }>;
  const tabs: Array<{ value: SeasonStatsTab; label: string; icon: 'table' | 'goal' | 'assist' | 'cards' }> = [
    { value: 'GERAL', label: 'Geral', icon: 'table' },
    { value: 'ARTILHARIA', label: 'Artilharia', icon: 'goal' },
    { value: 'ASSISTENCIAS', label: 'Assistências', icon: 'assist' },
    { value: 'CARTOES', label: 'Cartões', icon: 'cards' }
  ];

  const generalRows = standings.map((row) => ({
    key: row.user_id,
    userId: row.user_id,
    position: row.position,
    name: row.name,
    cells: [row.total_points, row.games_played, row.wins, row.draws, row.losses, row.goals, row.assists, row.total_cards, formatPercent(row.games_played ? ((row.wins * 3 + row.draws) / (row.games_played * 3)) * 100 : 0)]
  }));
  const goalRows = rankings.goals.map((row, index) => ({ key: row.userId, userId: row.userId, position: index + 1, name: row.name, cells: [row.goals, row.ownGoals, row.netGoals, row.gamesPlayed, formatAverage(row.average)] }));
  const assistRows = rankings.assists.map((row, index) => ({ key: row.userId, userId: row.userId, position: index + 1, name: row.name, cells: [row.assists, row.gamesPlayed, formatAverage(row.average)] }));
  const cardRows = rankings.cards.map((row, index) => ({ key: row.userId, userId: row.userId, position: index + 1, name: row.name, cells: [row.cardPoints, row.totalCards, row.gamesPlayed, formatAverage(row.average)] }));
  const currentRows = tab === 'GERAL' ? generalRows : tab === 'ARTILHARIA' ? goalRows : tab === 'ASSISTENCIAS' ? assistRows : cardRows;
  const totalPages = Math.max(1, Math.ceil(currentRows.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const pageRows = currentRows.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);
  const headers = tab === 'GERAL' ? ['PTS', 'J', 'V', 'E', 'D', 'G', 'A', 'CAR', 'APR'] : tab === 'ARTILHARIA' ? ['Gols', 'GC', 'Saldo', 'Jogos', 'Média'] : tab === 'ASSISTENCIAS' ? ['Assist.', 'Jogos', 'Média'] : ['Pts', 'Total', 'Jogos', 'Média'];

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function exportCurrentTab() {
    if (tab === 'GERAL') {
      await downloadStyledWorkbook('playfield-classificacao.xlsx', 'Classificacao', 'PlayField • Classificação da temporada', standings.map((row) => ({ posicao: row.position, atleta: row.name, pontos: row.total_points, jogos: row.games_played, vitorias: row.wins, empates: row.draws, derrotas: row.losses, gols: row.goals, assistencias: row.assists, cartoes: row.total_cards })));
      return;
    }
    if (tab === 'ARTILHARIA') {
      await downloadStyledWorkbook('playfield-artilharia.xlsx', 'Artilharia', 'PlayField • Ranking de artilharia', rankings.goals.map((row, index) => ({ posicao: index + 1, atleta: row.name, gols: row.goals, golsContra: row.ownGoals, saldoLiquido: row.netGoals, jogos: row.gamesPlayed, media: formatAverage(row.average) })));
      return;
    }
    if (tab === 'ASSISTENCIAS') {
      await downloadStyledWorkbook('playfield-assistencias.xlsx', 'Assistencias', 'PlayField • Ranking de assistências', rankings.assists.map((row, index) => ({ posicao: index + 1, atleta: row.name, assistencias: row.assists, jogos: row.gamesPlayed, media: formatAverage(row.average) })));
      return;
    }
    await downloadStyledWorkbook('playfield-cartoes.xlsx', 'Cartoes', 'PlayField • Ranking disciplinar', rankings.cards.map((row, index) => ({ posicao: index + 1, atleta: row.name, pontosCartao: row.cardPoints, totalCartoes: row.totalCards, jogos: row.gamesPlayed, media: formatAverage(row.average) })));
  }

  return <section className="card compact standings-card season-dashboard-card"><div className="card-head championship-head"><div><h2>Tabela da temporada & estatísticas</h2><p className="muted">Painel limpo com líderes, histórico recente e navegação por ranking da temporada.</p></div>{currentRows.length > 0 && <button className="ghost" onClick={exportCurrentTab}>Exportar {tab.toLowerCase()}</button>}</div><div className="season-summary-grid">{leaderCards.map((item) => <button className="leader-spotlight as-button" key={item.key} onClick={() => onOpenProfile(item.userId)}><span className="dashboard-icon"><DashboardIcon name={item.icon} /></span><small>{item.label}</small><strong>{item.name}</strong><b>{item.value}</b><em>{item.detail}</em></button>)}</div><section className="finished-strip"><div className="card-head"><div><h3>Jogos finalizados</h3><p className="muted">Últimos confrontos em leitura horizontal rápida.</p></div><span className="status">{finishedMatches.length} jogos</span></div><div className="finished-carousel">{finishedMatches.length === 0 ? <EmptyState title="Sem histórico confirmado" text="Os últimos placares entram aqui assim que as súmulas forem confirmadas." /> : finishedMatches.map((match) => <article className="finished-card" key={match.id}><div className="finished-card-top"><span className="finished-date">{compactMatchDateLabel(match)}</span><span className="finished-badge">MVP indisponível</span></div><strong>{match.title}</strong><div className="finished-score"><span>{match.teamAName}</span><b>{match.teamAScore} x {match.teamBScore}</b><span>{match.teamBName}</span></div><small>{match.teamAScore === match.teamBScore ? 'Empate confirmado' : `Venceu: ${match.teamAScore > match.teamBScore ? match.teamAName : match.teamBName}`}</small></article>)}</div></section><div className="season-table-panel"><div className="season-tabs">{tabs.map((item) => <button key={item.value} type="button" className={tab === item.value ? 'active' : ''} onClick={() => setTab(item.value)}><span className="dashboard-icon small"><DashboardIcon name={item.icon} /></span>{item.label}</button>)}</div>{currentRows.length === 0 ? <EmptyState title="Sem dados para esta aba" text="Confirme jogos e eventos da temporada para preencher este ranking." /> : <div className="championship-wrap season-table-shell"><table className="championship-table season-table"><thead><tr><th>Pos</th><th>Atleta</th>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{pageRows.map((row) => <tr key={row.key}><td className="pos-cell">{row.position}</td><td className="athlete-cell"><button className="name-link strong" onClick={() => onOpenProfile(row.userId)}>{row.name}</button></td>{row.cells.map((cell, index) => <td className={tab === 'GERAL' && index === 0 ? 'points-cell' : ''} key={`${row.key}-${index}`}>{cell}</td>)}</tr>)}</tbody></table></div>}<div className="table-pagination"><button type="button" className="ghost" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}>Anterior</button><span className="status">Página {safePage} de {totalPages}</span><button type="button" className="ghost" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages}>Próxima</button></div></div></section>;
}

function DashboardSeasonOperationsPanel({ api, suspensions, matches, activeSeasonId, canCoordinate }: { api: ApiClient; suspensions: Suspension[]; matches: MatchListItem[]; activeSeasonId: string; canCoordinate: boolean }) {
  const nextScheduledMatch = sortMatchesByOperationalRelevance(matches).find((match) => match.status !== 'CANCELLED' && getMatchStartTime(match) >= Date.now()) ?? null;
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [cashSummary, setCashSummary] = useState<CashSummary | null>(null);
  const financeOpenItems = canCoordinate && paymentSummary ? paymentSummary.pending + paymentSummary.late : null;
  const financeBadge = canCoordinate && paymentSummary ? paymentSummary.late : 0;
  const financeValue = !canCoordinate || !paymentSummary ? 'N/A' : financeOpenItems ? String(financeOpenItems) : 'N/A';
  const financeDetail = !canCoordinate || !paymentSummary ? 'Visível apenas para coordenação' : financeOpenItems ? `${paymentSummary.late} atraso(s) • caixa ${formatMoney(cashSummary?.balanceCents ?? 0)}` : `Caixa ${formatMoney(cashSummary?.balanceCents ?? 0)}`;
  const agendaBadge = nextScheduledMatch ? 1 : 0;
  const agendaValue = nextScheduledMatch ? 'View' : 'Livre';
  const agendaDetail = nextScheduledMatch ? `${compactMatchDateLabel(nextScheduledMatch)} • ${nextScheduledMatch.title}` : 'Sem jogo futuro fora do card principal';

  useEffect(() => {
    if (!canCoordinate) {
      setPaymentSummary(null);
      setCashSummary(null);
      return;
    }
    Promise.all([
      api.request<PaymentSummary>(`/payments/summary${activeSeasonId ? `?seasonId=${activeSeasonId}` : ''}`),
      api.request<CashSummary>('/cash/summary')
    ]).then(([paymentsData, cashData]) => {
      setPaymentSummary(paymentsData);
      setCashSummary(cashData);
    }).catch(() => {
      setPaymentSummary(null);
      setCashSummary(null);
    });
  }, [api, activeSeasonId, canCoordinate]);

  return (
    <section className="card compact operations-panel dashboard-ops-card">
      <div className="card-head">
        <div>
          <h2>Central operacional</h2>
          <p className="muted">Pendências disciplinares e suspensões ativas da temporada.</p>
        </div>
        <span className={`status ${suspensions.length ? 'danger' : 'open'}`}>{suspensions.length} susp.</span>
      </div>
      <div className="ops-widget-grid">
        <article className="ops-highlight danger">
          <div className="ops-highlight-top">
            <span className="ops-highlight-label">
              <span className="dashboard-icon"><DashboardIcon name="shield" /></span>
              <small>Suspenses</small>
            </span>
            <span className="ops-highlight-badge">{suspensions.length}</span>
          </div>
          <strong>{suspensions.length}</strong>
          <em>{suspensions.length ? 'Suspensões ativas exigem baixa imediata.' : 'Sem pendências disciplinares.'}</em>
        </article>
        <article className="ops-highlight gold">
          <div className="ops-highlight-top">
            <span className="ops-highlight-label">
              <span className="dashboard-icon"><DashboardIcon name="wallet" /></span>
              <small>Finance</small>
            </span>
            <span className="ops-highlight-badge warning">{financeBadge}</span>
          </div>
          <strong>{financeValue}</strong>
          <em>{financeDetail}</em>
        </article>
        <article className="ops-highlight success">
          <div className="ops-highlight-top">
            <span className="ops-highlight-label">
              <span className="dashboard-icon"><DashboardIcon name="calendar" /></span>
              <small>Agenda</small>
            </span>
            <span className="ops-highlight-badge warning">{agendaBadge}</span>
          </div>
          <strong>{agendaValue}</strong>
          <em>{agendaDetail}</em>
        </article>
      </div>
    </section>
  );

/*

  return <section className="card compact operations-panel dashboard-ops-card"><div className="card-head"><div><h2>Central operacional</h2><p className="muted">Métricas rápidas de disciplina, financeiro e status da quadra.</p></div><span className={`status ${suspensions.length ? 'danger' : 'open'}`}>{suspensions.length} pend.</span></div><div className="ops-widget-grid"><article className="ops-highlight danger"><span className="dashboard-icon"><DashboardIcon name="shield" /></span><small>Disciplina</small><strong>{suspensions.length}</strong><em>{suspensions.length ? 'Suspensões ativas exigem baixa' : 'Nenhuma suspensão aberta'}</em></article><article className="ops-highlight gold"><span className="dashboard-icon"><DashboardIcon name="wallet" /></span><small>Financeiro</small><strong>{canCoordinate && paymentSummary ? `${paymentSummary.pending + paymentSummary.late}` : 'Restrito'}</strong><em>{canCoordinate && paymentSummary ? `${paymentSummary.late} atraso(s) • caixa ${formatMoney(cashSummary?.balanceCents ?? 0)}` : 'Visível apenas para coordenação'}</em></article><article className="ops-highlight success"><span className="dashboard-icon"><DashboardIcon name="field" /></span><small>Quadra / reserva</small><strong>{nextScheduledMatch ? 'Reservada' : 'Sem agenda'}</strong><em>{nextScheduledMatch ? `${compactMatchDateLabel(nextScheduledMatch)} • ${nextScheduledMatch.title}` : 'Cadastre o próximo jogo para refletir a reserva'}</em></article></div><div className="ops-section dashboard-suspension-section"><div className="card-head"><strong>Suspensões ativas</strong><span className={`status ${suspensions.length ? 'danger' : 'open'}`}>{suspensions.length}</span></div>{suspensions.length === 0 ? <p className="muted">Sem pendências disciplinares no momento.</p> : <div className="suspension-list compact-suspensions">{suspensions.slice(0, 4).map((item) => <article className="suspension-row" key={item.id}><strong>{item.userName}</strong><span>{formatCardReason(item.reason)}</span><small>Origem: {item.triggerMatchTitle}</small>{canCoordinate && <select disabled={!confirmedMatches.length} defaultValue="" onChange={(event) => void serveSuspension(item.id, event.target.value)}><option value="">Cumpriu em...</option>{confirmedMatches.map((match) => <option key={match.id} value={match.id}>{match.title} • {match.matchDate?.slice(0, 10)}</option>)}</select>}</article>)}</div>}</div></section>;
*/
}

function DashboardMatchesPanel({ api, canCoordinate, users, matches, rankings, standings, activeSeasonId, currentUserId, onReload, selectedMatch, setSelectedMatch, onOpenProfile }: { api: ApiClient; canCoordinate: boolean; users: User[]; matches: MatchListItem[]; rankings: RankingPayload; standings: Standing[]; activeSeasonId: string; currentUserId: string; onReload: () => Promise<void>; selectedMatch: MatchDetail | null; setSelectedMatch: (match: MatchDetail | null) => void; onOpenProfile: (userId: string) => void }) {
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [matchMessage, setMatchMessage] = useState('');
  const [selectedSheetMatch, setSelectedSheetMatch] = useState<MatchDetail | null>(null);
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const [dismissedSheetMatchId, setDismissedSheetMatchId] = useState('');
  const sheetPromptCheckRef = useRef('');

  useEffect(() => {
    const timer = window.setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function openMatch(id: string) {
    try {
      setMatchMessage('');
      setSelectedMatch(await api.request<MatchDetail>(`/matches/${id}`));
      setCancelConfirm(false);
    } catch (error) {
      setMatchMessage(error instanceof Error ? error.message : 'Não foi possível abrir a súmula.');
    }
  }

  async function openSheet(id: string) {
    try {
      setMatchMessage('');
      setSelectedSheetMatch(await api.request<MatchDetail>(`/matches/${id}`));
    } catch (error) {
      setMatchMessage(error instanceof Error ? error.message : 'Não foi possível abrir a súmula.');
    }
  }

  useEffect(() => {
    if (!selectedSheetMatch) return;
    if (selectedSheetMatch.status === 'CONFIRMED') return;
    const timer = window.setInterval(() => {
      void api.request<MatchDetail>(`/matches/${selectedSheetMatch.id}`)
        .then(setSelectedSheetMatch)
        .catch(() => undefined);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [api, selectedSheetMatch?.id, selectedSheetMatch?.status]);

  async function openConfirmation(matchId: string) {
    setMatchMessage('Abrindo confirmação para os atletas...');
    await api.request(`/matches/${matchId}/open-confirmation`, { method: 'POST' });
    setMatchMessage('Aberto para Confirmação. Atletas já podem responder pelo card do jogo.');
    await onReload();
  }

  const sortedMatches = sortMatchesByOperationalRelevance(matches);
  const activeUserCount = Math.max(1, users.filter((user) => user.active !== false).length);
  const nextMatch = sortedMatches.filter((match) => match.status !== 'CONFIRMED' && match.status !== 'CANCELLED').find((match) => getMatchStartTime(match) >= countdownNow) ?? sortedMatches.find((match) => match.status !== 'CONFIRMED' && match.status !== 'CANCELLED') ?? null;
  const lastConfirmedMatch = [...matches].filter((match) => match.status === 'CONFIRMED').sort((left, right) => getMatchStartTime(right) - getMatchStartTime(left))[0] ?? null;

  useEffect(() => {
    if (!canCoordinate || !nextMatch || nextMatch.status !== 'DRAFT' || selectedSheetMatch || dismissedSheetMatchId === nextMatch.id) return;
    const sheetOpensAt = getMatchStartTime(nextMatch) - 60 * 60 * 1000;
    if (countdownNow < sheetOpensAt) return;

    const checkKey = `${nextMatch.id}:${Math.floor(countdownNow / 15000)}`;
    if (sheetPromptCheckRef.current === checkKey) return;
    sheetPromptCheckRef.current = checkKey;

    void api.request<MatchDetail>(`/matches/${nextMatch.id}`)
      .then((detail) => {
        const hasTeamA = detail.players.some((player) => player.team === 'A');
        const hasTeamB = detail.players.some((player) => player.team === 'B');
        if (hasTeamA && hasTeamB) setSelectedSheetMatch(detail);
      })
      .catch(() => undefined);
  }, [api, canCoordinate, countdownNow, dismissedSheetMatchId, nextMatch?.id, nextMatch?.status, selectedSheetMatch?.id]);
  const topEfficiency = useMemo(() => [...standings]
    .map((row) => ({
      userId: row.user_id,
      name: row.name,
      efficiency: row.games_played ? ((row.wins * 3 + row.draws) / (row.games_played * 3)) * 100 : 0
    }))
    .sort((left, right) => right.efficiency - left.efficiency || left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' }))[0] ?? null, [standings]);
  const topCards = useMemo(() => [...rankings.cards]
    .sort((left, right) => right.totalCards - left.totalCards || right.cardPoints - left.cardPoints || left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' }))[0] ?? null, [rankings.cards]);
  const leaderBubbles = [
    rankings.goals[0] ? { key: 'goals', label: 'Artilheiro', value: String(rankings.goals[0].goals), accent: 'goal', userId: rankings.goals[0].userId, name: rankings.goals[0].name, detail: 'gols' } : null,
    rankings.assists[0] ? { key: 'assists', label: 'Assistências', value: String(rankings.assists[0].assists), accent: 'assist', userId: rankings.assists[0].userId, name: rankings.assists[0].name, detail: 'assistências' } : null,
    topEfficiency ? { key: 'efficiency', label: 'Aproveitamento', value: formatPercent(topEfficiency.efficiency), accent: 'efficiency', userId: topEfficiency.userId, name: topEfficiency.name, detail: 'melhor índice' } : null,
    topCards ? { key: 'cards', label: 'Mais cartões', value: String(topCards.totalCards), accent: 'cards', userId: topCards.userId, name: topCards.name, detail: 'cartões' } : null
  ].filter(Boolean) as Array<{ key: string; label: string; value: string; accent: string; userId: string; name: string; detail: string }>;

  function renderHeroCard(match: MatchListItem) {
    const date = matchDateParts(match);
    const playing = match.attendancePlaying ?? 0;
    const presentOnly = match.attendancePresentOnly ?? 0;
    const absent = match.attendanceAbsent ?? 0;
    const responses = playing + presentOnly + absent;
    const pending = Math.max((match.invitedCount ?? activeUserCount) - responses, 0);
    const myAttendanceStatus = match.myAttendanceStatus ?? null;
    const confirmationReallyOpen = isConfirmationReallyOpen(match) && match.isInvited !== false;
    const confirmationText = match.confirmationOpen ? 'Aberto para Confirmação' : 'Fechado para Confirmação';
    const confirmationDetail = match.confirmationOpen ? `${attendanceStatusLabel(myAttendanceStatus)}${match.confirmationCloseAt ? ` • fecha ${formatBrasiliaTime(match.confirmationCloseAt)}` : ''}` : confirmationWindowHasEnded(match) ? `Janela encerrada${match.confirmationCloseAt ? ` em ${formatBrasiliaTime(match.confirmationCloseAt)}` : ''}.` : `Janela configurada: ${confirmationWindowScheduleLabel(match)}.`;
    const segments = [
      { label: 'Confirmados', value: playing, className: 'confirmed' },
      { label: 'Presença', value: presentOnly, className: 'present-only' },
      { label: 'Ausentes', value: absent, className: 'absent' },
      { label: 'Não responderam', value: pending, className: 'pending' }
    ];

    return <article className="next-match-hero" key={match.id}><div className="next-match-pitch" aria-hidden="true"><div className="next-match-pitch-field" /></div><div className="next-match-main"><div className="next-match-date-badge"><b>{date.day}</b><div className="next-match-date-stack"><span>{date.month}</span><em>{date.time}</em><small>{date.weekday}</small></div><div className="next-match-title-block"><strong>{match.title}</strong><small>{matchRelativeLabel(match)} • {matchStatusLabel(match.status)}</small></div></div><div className="match-card-metrics next-match-metrics">{segments.map((segment) => <span className={`metric-pill ${segment.className}`} key={segment.label}><b>{segment.value}</b>{segment.label}</span>)}</div><small className="next-match-footnote">{match.isInvited === false ? 'Você não foi convocado para este jogo.' : confirmationDetail}</small></div><div className="next-match-side"><span className={`status ${match.confirmationOpen ? 'open' : 'danger'}`}>{confirmationText}</span><div className="next-match-cta-row"><div className="countdown-panel"><small>Contagem regressiva</small><b>{matchCountdownLabel(match)}</b></div><button type="button" className={`primary attendance-action-button next-match-presence-button ${myAttendanceStatus ? 'confirmed-action' : ''}`} title={match.isInvited === false ? 'Confirmação disponível somente para atletas convocados.' : confirmationReallyOpen ? myAttendanceStatus ? 'Clique para alterar sua confirmação.' : 'Abrir confirmação da rodada.' : match.status === 'DRAFT' ? 'Prazo de confirmação encerrado.' : 'Confirmação encerrada porque o jogo já começou.'} disabled={!confirmationReallyOpen} onClick={() => void openMatch(match.id)}>Confirmar presença</button></div>{canCoordinate && match.status === 'DRAFT' && !match.confirmationOpen && !confirmationWindowHasEnded(match) && <div className="next-match-actions"><button type="button" className="ghost" onClick={() => void openConfirmation(match.id)}>Abrir confirmação</button></div>}</div></article>;
  }

  return (
    <section className="card compact matches-report dashboard-next-match-card">
      {matchMessage && <button className="alert" onClick={() => setMatchMessage('')}>{matchMessage}</button>}
      {leaderBubbles.length > 0 && <div className="next-match-leader-strip">{leaderBubbles.map((item) => <button type="button" className={`next-match-leader-card ${item.accent}`} key={item.key} onClick={() => onOpenProfile(item.userId)} aria-label={`Abrir perfil de ${item.name}`}><div className="next-match-leader-value"><strong>{item.value}</strong><small>{item.detail}</small></div><div className="next-match-leader-copy"><span>{item.label}</span><strong>{item.name}</strong></div></button>)}</div>}
      {nextMatch ? renderHeroCard(nextMatch) : <EmptyState title="Sem próximo jogo operacional" text="Crie ou ajuste a agenda para exibir a próxima rodada aqui." />}
      {canCoordinate && nextMatch?.status === 'DRAFT' && dismissedSheetMatchId === nextMatch.id && countdownNow >= getMatchStartTime(nextMatch) - 60 * 60 * 1000 && (
        <div className="next-match-actions">
          <button type="button" className="ghost" onClick={() => void openSheet(nextMatch.id)}>Reabrir súmula</button>
        </div>
      )}
      {lastConfirmedMatch && <button type="button" className="dashboard-last-match-button" onClick={() => void openSheet(lastConfirmedMatch.id)}><span className="dashboard-last-match-label">Último jogo</span><div className="finished-list-row dashboard-last-match-card"><div className="finished-list-main"><span className="finished-list-date">{compactMatchDateLabel(lastConfirmedMatch)}</span><strong className="finished-list-title">{lastConfirmedMatch.title}</strong><small className="finished-list-outcome">{matchOutcomeLabel(lastConfirmedMatch)}</small></div><div className="finished-list-duel"><div className="finished-list-team"><span className="finished-team-mark">{teamBadgeLabel(lastConfirmedMatch.teamAName)}</span><strong>{lastConfirmedMatch.teamAName}</strong></div><div className="finished-list-score"><b>{lastConfirmedMatch.teamAScore}</b><span>x</span><b>{lastConfirmedMatch.teamBScore}</b></div><div className="finished-list-team is-away"><strong>{lastConfirmedMatch.teamBName}</strong><span className="finished-team-mark">{teamBadgeLabel(lastConfirmedMatch.teamBName)}</span></div></div></div></button>}
      {selectedMatch && (
        <div className="modal match-modal">
          <section className="match-modal-card">
            <div className="card-head">
              <div>
                <h2>{selectedMatch.title}</h2>
                <p className="muted">Confirmação da rodada • {formatDateOnly(selectedMatch.matchDate, 'sem data')} • {matchStatusLabel(selectedMatch.status)}</p>
              </div>
              <button type="button" className="ghost modal-close-button" aria-label="Fechar modal" title="Fechar" onClick={() => { setSelectedMatch(null); setCancelConfirm(false); }}>X</button>
            </div>
            <AttendancePanel
              api={api}
              match={selectedMatch}
              currentUserId={currentUserId}
              showRecentCard={!canCoordinate}
              onSaved={async () => {
                await openMatch(selectedMatch.id);
                await onReload();
              }}
            />
            {canCoordinate && selectedMatch.status === 'DRAFT' && (
              <ExistingLineupEditor
                api={api}
                match={selectedMatch}
                users={users}
                onSaved={async () => {
                  await openMatch(selectedMatch.id);
                  await onReload();
                }}
              />
            )}
          </section>
        </div>
      )}
      {selectedSheetMatch && (
        <div className="modal match-modal">
          <section className="match-modal-card sheet-modal-card">
            <div className="card-head">
              <div>
                <h2>{selectedSheetMatch.title}</h2>
                <p className="muted">{selectedSheetMatch.status === 'CONFIRMED' ? 'Último jogo confirmado' : 'Súmula liberada para escalação'} • {formatDateOnly(selectedSheetMatch.matchDate, 'sem data')} • {matchStatusLabel(selectedSheetMatch.status)}</p>
              </div>
              <button type="button" className="ghost modal-close-button" aria-label="Fechar modal" title="Fechar" onClick={() => { setDismissedSheetMatchId(selectedSheetMatch.id); setSelectedSheetMatch(null); }}>X</button>
            </div>
            <OpenMatchSheetBoard
              api={api}
              match={selectedSheetMatch}
              users={users}
              onSaved={async () => {
                await openSheet(selectedSheetMatch.id);
                await onReload();
              }}
            />
          </section>
        </div>
      )}
    </section>
  );
}

function OpenMatchSheetBoard({ api, match, users, onSaved }: { api: ApiClient; match: MatchDetail; users: User[]; onSaved: () => Promise<void> }) {
  const initialEvents = match.status === 'CONFIRMED' ? match.events : match.draftEvents?.length ? match.draftEvents : match.events;
  function seededPlayers(): MatchDetail['players'] {
    const balanced = buildRegisteredRosterSeed(users, match.attendance, match.players);
    const teamOrders = { A: 0, B: 0 };

    return balanced.map((player, index) => {
      const rotationOrder = player.team === 'A' || player.team === 'B' ? ++teamOrders[player.team] : null;
      return {
        userId: player.userId,
        name: player.name,
        team: player.team,
        roleInMatch: player.roleInMatch,
        drawOrder: Number(player.drawOrder ?? index + 1),
        rotationOrder,
        startsOnBench: player.startsOnBench,
        present: player.present,
        position: player.position,
        isGuest: player.isGuest === true,
        fieldLeft: toOptionalNumber(player.fieldLeft),
        fieldTop: toOptionalNumber(player.fieldTop)
      };
    });
  }

  const [players, setPlayers] = useState(seededPlayers);
  const [teamAScore, setTeamAScore] = useState(match.status === 'CONFIRMED' ? match.teamAScore : match.draftTeamAScore ?? match.teamAScore);
  const [teamBScore, setTeamBScore] = useState(match.status === 'CONFIRMED' ? match.teamBScore : match.draftTeamBScore ?? match.teamBScore);
  const [events, setEvents] = useState<MatchEventDraft[]>(initialEvents.map((event) => ({ id: event.id, userId: event.userId, relatedUserId: event.relatedUserId, eventType: event.eventType as MatchEventDraft['eventType'], minute: event.minute, clockSecond: event.clockSecond, team: event.team, occurredAt: event.occurredAt ?? event.createdAt ?? null, createdAt: event.createdAt ?? null })));
  const [clockSeconds, setClockSeconds] = useState(deriveOperationalClockSeconds(match));
  const [clockRunning, setClockRunning] = useState(deriveOperationalClockRunning(match));
  const [clockFrozen, setClockFrozen] = useState(false);
  const [finalizationRequested, setFinalizationRequested] = useState(false);
  const [gameStarted, setGameStarted] = useState(match.status !== 'DRAFT' || Boolean(match.startedAt));
  const [officialStartedAt, setOfficialStartedAt] = useState<string | null>(match.startedAt ?? null);
  const [sheetMessage, setSheetMessage] = useState(match.draftSavedAt ? `Rascunho salvo em ${formatBrasiliaTime(match.draftSavedAt)}.` : 'Arraste um titular sobre um reserva do mesmo time para fazer a troca automática.');
  const [activityLog, setActivityLog] = useState<SheetActivityLogEntry[]>([]);
  const [draggedPlayerId, setDraggedPlayerId] = useState('');
  const [dropTargetId, setDropTargetId] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [pitchDrag, setPitchDrag] = useState<{ userId: string; team: 'A' | 'B'; pointerId: number } | null>(null);
  const [pitchPreview, setPitchPreview] = useState<Record<string, { left: number; top: number }>>({});
  const usersById = new Map(users.map((item) => [item.id, item]));
  const attendanceStatusByUserId = new Map(match.attendance.map((item) => [item.userId, item.responseStatus]));
  const skipAutosaveRef = useRef(true);
  const appliedAutoSwapMinutesRef = useRef<Record<'A' | 'B', number[]>>({ A: [], B: [] });
  const manualSwapOverrideRef = useRef<Record<'A' | 'B', boolean>>({ A: false, B: false });
  const boardDirtyRef = useRef(false);
  const hydratedMatchIdRef = useRef<string | null>(null);
  const pitchSurfaceRef = useRef<HTMLDivElement | null>(null);
  const eventLogRef = useRef<HTMLDivElement | null>(null);
  const pitchDragRef = useRef<{ userId: string; team: 'A' | 'B'; pointerId: number } | null>(null);
  const pendingPitchMoveRef = useRef<{ dragState: { userId: string; team: 'A' | 'B'; pointerId: number }; clientX: number; clientY: number } | null>(null);
  const pitchDragFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const recoveredEvents = match.status === 'CONFIRMED' ? match.events : match.draftEvents?.length ? match.draftEvents : match.events;
    const sameMatch = hydratedMatchIdRef.current === match.id;
    const preserveLiveBoard = sameMatch && boardDirtyRef.current && match.status !== 'CONFIRMED' && match.status !== 'CANCELLED';
    hydratedMatchIdRef.current = match.id;

    if (preserveLiveBoard) {
      if (match.startedAt && match.startedAt !== officialStartedAt) setOfficialStartedAt(match.startedAt);
      if (!gameStarted && (match.status !== 'DRAFT' || Boolean(match.startedAt))) setGameStarted(true);
      return;
    }

    setPlayers(normalizeOperationalLineup(seededPlayers()));
    setTeamAScore(match.status === 'CONFIRMED' ? match.teamAScore : match.draftTeamAScore ?? match.teamAScore);
    setTeamBScore(match.status === 'CONFIRMED' ? match.teamBScore : match.draftTeamBScore ?? match.teamBScore);
    setEvents(recoveredEvents.map((event) => ({ id: event.id, userId: event.userId, relatedUserId: event.relatedUserId, eventType: event.eventType as MatchEventDraft['eventType'], minute: event.minute, clockSecond: event.clockSecond, team: event.team, occurredAt: event.occurredAt ?? event.createdAt ?? null, createdAt: event.createdAt ?? null })));
    setClockSeconds(deriveOperationalClockSeconds(match));
    setClockRunning(deriveOperationalClockRunning(match));
    setClockFrozen(false);
    setFinalizationRequested(match.status === 'SUBMITTED' || match.status === 'CONFIRMED');
    setGameStarted(match.status !== 'DRAFT' || Boolean(match.startedAt));
    setOfficialStartedAt(match.startedAt ?? null);
    setSheetMessage(match.draftSavedAt ? `Rascunho salvo em ${formatBrasiliaTime(match.draftSavedAt)}.` : 'Arraste um titular sobre um reserva do mesmo time para fazer a troca automática.');
    setActivityLog([]);
    setDraggedPlayerId('');
    setDropTargetId('');
    setSelectedPlayerId('');
    setPitchDrag(null);
    setPitchPreview({});
    skipAutosaveRef.current = true;
    appliedAutoSwapMinutesRef.current = { A: [], B: [] };
    manualSwapOverrideRef.current = { A: false, B: false };
    boardDirtyRef.current = false;
    pitchDragRef.current = null;
    pendingPitchMoveRef.current = null;
    if (pitchDragFrameRef.current != null) {
      window.cancelAnimationFrame(pitchDragFrameRef.current);
      pitchDragFrameRef.current = null;
    }
  }, [match.id, match.status, match.startedAt, match.teamAScore, match.teamBScore, match.draftTeamAScore, match.draftTeamBScore, match.draftClockSeconds, match.draftClockRunning, match.draftSavedAt, match.players, match.draftEvents, match.events, match.attendance, users, gameStarted, officialStartedAt]);

  useEffect(() => () => {
    if (pitchDragFrameRef.current != null) window.cancelAnimationFrame(pitchDragFrameRef.current);
  }, []);

  useEffect(() => {
    function closePlayerMenu(event: globalThis.PointerEvent) {
      if (!(event.target as Element | null)?.closest('.sheet-roster-row')) setSelectedPlayerId('');
    }
    function closePlayerMenuOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedPlayerId('');
    }
    document.addEventListener('pointerdown', closePlayerMenu);
    document.addEventListener('keydown', closePlayerMenuOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closePlayerMenu);
      document.removeEventListener('keydown', closePlayerMenuOnEscape);
    };
  }, []);

  useEffect(() => {
    const limitSeconds = (match.availableMinutes ?? 60) * 60;
    if (clockFrozen || !clockRunning) return;
    const timer = window.setInterval(() => setClockSeconds((value) => Math.min(limitSeconds, value + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [clockFrozen, clockRunning, match.availableMinutes]);

  function addActivityLog(message: string, createdAt = new Date().toISOString()) {
    const id = window.crypto?.randomUUID?.() ?? `${createdAt}-${Math.random().toString(16).slice(2, 10)}`;
    setActivityLog((current) => [...current, { id, message, createdAt }]);
  }

  useEffect(() => {
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }
    if (match.status === 'CONFIRMED') return;
    const timer = window.setTimeout(() => {
      void saveBoard(false).catch((err) => setSheetMessage(err instanceof Error ? err.message : 'Falha ao salvar rascunho da súmula.'));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [players, teamAScore, teamBScore, events, match.status]);

  useEffect(() => {
    if (!pitchDrag) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pitchDrag.pointerId) return;
      queueDraggedPlayerPreview(pitchDrag, event.clientX, event.clientY);
    };

    const finishDrag = (event: PointerEvent) => {
      if (event.pointerId !== pitchDrag.pointerId) return;
      finishPitchDrag(event.pointerId, event.type === 'pointerup', event.clientX, event.clientY);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [pitchDrag]);

  const playablePlayers = players.filter((player) => player.team !== 'PRESENTE_SEM_JOGAR');
  const currentMinute = Math.floor(clockSeconds / 60);
  const matchIsOperationallyRunning = gameStarted && match.status !== 'CONFIRMED' && match.status !== 'CANCELLED';
  const canRegisterEvents = gameStarted && match.status !== 'CONFIRMED' && match.status !== 'CANCELLED';
  const canRepositionPlayers = match.status !== 'CONFIRMED' && match.status !== 'CANCELLED';

  function clearPitchDragFrame() {
    if (pitchDragFrameRef.current != null) {
      window.cancelAnimationFrame(pitchDragFrameRef.current);
      pitchDragFrameRef.current = null;
    }
  }

  function clearPitchPreviewForPlayer(userId: string) {
    setPitchPreview((current) => {
      if (!(userId in current)) return current;
      const next = { ...current };
      delete next[userId];
      return next;
    });
  }

  function resolveDraggedPitchSlot(dragState: { userId: string; team: 'A' | 'B'; pointerId: number }, clientX: number, clientY: number) {
    const surface = pitchSurfaceRef.current;
    if (!surface) return null;
    const bounds = surface.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    const relativeLeft = ((clientX - bounds.left) / bounds.width) * 100;
    const relativeTop = ((clientY - bounds.top) / bounds.height) * 100;
    return clampPitchSlot(dragState.team, relativeLeft, relativeTop);
  }

  function queueDraggedPlayerPreview(dragState: { userId: string; team: 'A' | 'B'; pointerId: number }, clientX: number, clientY: number) {
    pendingPitchMoveRef.current = { dragState, clientX, clientY };
    if (pitchDragFrameRef.current != null) return;

    pitchDragFrameRef.current = window.requestAnimationFrame(() => {
      pitchDragFrameRef.current = null;
      const pendingMove = pendingPitchMoveRef.current;
      if (!pendingMove) return;
      const slot = resolveDraggedPitchSlot(pendingMove.dragState, pendingMove.clientX, pendingMove.clientY);
      if (!slot) return;
      setPitchPreview((current) => {
        const previous = current[pendingMove.dragState.userId];
        if (previous?.left === slot.left && previous?.top === slot.top) return current;
        return { ...current, [pendingMove.dragState.userId]: slot };
      });
    });
  }

  function persistDraggedPlayerPosition(dragState: { userId: string; team: 'A' | 'B'; pointerId: number }, clientX: number, clientY: number) {
    const slot = resolveDraggedPitchSlot(dragState, clientX, clientY) ?? pitchPreview[dragState.userId] ?? null;
    clearPitchPreviewForPlayer(dragState.userId);
    if (!slot) return;
    boardDirtyRef.current = true;
    setPlayers((current) => current.map((player) => player.userId === dragState.userId && (player.fieldLeft !== slot.left || player.fieldTop !== slot.top)
      ? { ...player, fieldLeft: slot.left, fieldTop: slot.top }
      : player));
  }

  function finishPitchDrag(pointerId: number, shouldCommit: boolean, clientX?: number, clientY?: number) {
    const activeDrag = pitchDragRef.current;
    if (!activeDrag || activeDrag.pointerId !== pointerId) return;
    clearPitchDragFrame();
    pendingPitchMoveRef.current = null;
    if (shouldCommit && clientX != null && clientY != null) {
      persistDraggedPlayerPosition(activeDrag, clientX, clientY);
    } else {
      clearPitchPreviewForPlayer(activeDrag.userId);
    }
    pitchDragRef.current = null;
    setPitchDrag(null);
  }

  function normalizePlayersForBoard(list: MatchDetail['players']) {
    const ranked = [...list].sort((left, right) => {
      const teamRank = (team: MatchDetail['players'][number]['team']) => team === 'A' ? 0 : team === 'B' ? 1 : 2;
      const teamDiff = teamRank(left.team) - teamRank(right.team);
      if (teamDiff !== 0) return teamDiff;
      const leftPosition = left.position ?? usersById.get(left.userId)?.position ?? 'MC';
      const rightPosition = right.position ?? usersById.get(right.userId)?.position ?? 'MC';
      const positionDiff = positionSequenceOrder(leftPosition) - positionSequenceOrder(rightPosition);
      if (positionDiff !== 0) return positionDiff;
      const leftOrder = left.rotationOrder ?? left.drawOrder ?? 999;
      const rightOrder = right.rotationOrder ?? right.drawOrder ?? 999;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' });
    });
    const teamOrders = { A: 0, B: 0 };
    return ranked.map((player) => player.team === 'A' || player.team === 'B' ? { ...player, rotationOrder: ++teamOrders[player.team] } : { ...player, rotationOrder: player.rotationOrder ?? null });
  }

  function selectOperationalGoalkeeper(teamPlayers: MatchDetail['players']) {
    const starters = teamPlayers.filter((player) => !player.startsOnBench);
    return starters.find((player) => player.roleInMatch === 'GOLEIRO')
      ?? starters.find((player) => (player.position ?? usersById.get(player.userId)?.position ?? 'MC') === 'GO')
      ?? starters[0]
      ?? teamPlayers.find((player) => player.roleInMatch === 'GOLEIRO')
      ?? teamPlayers.find((player) => (player.position ?? usersById.get(player.userId)?.position ?? 'MC') === 'GO')
      ?? teamPlayers[0]
      ?? null;
  }

  function normalizeOperationalLineup(list: MatchDetail['players']) {
    const normalized = rebalanceNaturalGoalkeepers(list).map((player) => ({ ...player }));

    for (const team of ['A', 'B'] as const) {
      const teamPlayers = normalized.filter((player) => player.team === team).sort((left, right) => {
        const leftPosition = left.position ?? usersById.get(left.userId)?.position ?? 'MC';
        const rightPosition = right.position ?? usersById.get(right.userId)?.position ?? 'MC';
        return positionSequenceOrder(leftPosition) - positionSequenceOrder(rightPosition);
      });
      if (!teamPlayers.length) continue;

      const goalkeeperCandidate = selectOperationalGoalkeeper(teamPlayers);

      for (const player of teamPlayers) {
        if (goalkeeperCandidate && player.userId === goalkeeperCandidate.userId) {
          player.roleInMatch = 'GOLEIRO';
        } else {
          player.roleInMatch = 'LINHA';
        }
      }
    }

    const bounded = normalized.map((player) => {
      if ((player.team !== 'A' && player.team !== 'B') || player.fieldLeft == null || player.fieldTop == null) return player;
      const slot = clampPitchSlot(player.team, player.fieldLeft, player.fieldTop);
      return { ...player, fieldLeft: slot.left, fieldTop: slot.top };
    });

    return normalizePlayersForBoard(bounded);
  }

  function playerBoardNumber(player: MatchDetail['players'][number], fallbackIndex: number) {
    return player.rotationOrder ?? player.drawOrder ?? fallbackIndex + 1;
  }

  function playersForTeam(team: 'A' | 'B') {
    return playablePlayers.filter((player) => player.team === team).sort((left, right) => (left.rotationOrder ?? left.drawOrder ?? 999) - (right.rotationOrder ?? right.drawOrder ?? 999));
  }

  function startersForTeam(team: 'A' | 'B') {
    return playersForTeam(team).filter((player) => !player.startsOnBench);
  }

  function reservesForTeam(team: 'A' | 'B') {
    return playersForTeam(team).filter((player) => player.startsOnBench);
  }

  function fieldPlayers(team: 'A' | 'B') {
    const starters = startersForTeam(team);
    return assignPlayersToTacticalSlots(team, starters).map(({ player, slot }) => {
      const previewSlot = pitchPreview[player.userId] ?? null;
      const manualSlot = player.fieldLeft != null && player.fieldTop != null
        ? clampPitchSlot(team, player.fieldLeft, player.fieldTop)
        : null;
      return { player, slot: previewSlot ?? manualSlot ?? slot };
    });
  }

  const sheetRotationPlans = useMemo(() => ({
    A: buildSheetRotationPlan(playersForTeam('A').filter((player) => player.roleInMatch === 'LINHA' && player.present !== false).map((player) => ({ userId: player.userId, name: player.name, rotationOrder: player.rotationOrder ?? player.drawOrder ?? 999, startsOnBench: player.startsOnBench })), match.availableMinutes ?? 60),
    B: buildSheetRotationPlan(playersForTeam('B').filter((player) => player.roleInMatch === 'LINHA' && player.present !== false).map((player) => ({ userId: player.userId, name: player.name, rotationOrder: player.rotationOrder ?? player.drawOrder ?? 999, startsOnBench: player.startsOnBench })), match.availableMinutes ?? 60)
  }), [players, match.availableMinutes]);

  useEffect(() => {
    if (!matchIsOperationallyRunning) return;
    const dueSteps: Array<{ team: 'A' | 'B'; step: SheetRotationStep }> = [];
    for (const team of ['A', 'B'] as const) {
      if (manualSwapOverrideRef.current[team]) continue;
      for (const step of sheetRotationPlans[team].schedule) {
        if (step.second <= clockSeconds && !appliedAutoSwapMinutesRef.current[team].includes(step.second)) dueSteps.push({ team, step });
      }
    }
    if (!dueSteps.length) return;
    setPlayers((current) => {
      let next = [...current];
      for (const { team, step } of dueSteps) {
        next = next.map((player) => step.enteringIds.includes(player.userId) && player.team === team ? { ...player, startsOnBench: false } : step.leavingIds.includes(player.userId) && player.team === team ? { ...player, startsOnBench: true } : player);
      }
      return normalizePlayersForBoard(next);
    });
    for (const { team, step } of dueSteps) appliedAutoSwapMinutesRef.current[team].push(step.second);
    const labels = dueSteps.map(({ team, step }) => `Time ${team} ${step.label.toLowerCase()}`).join(' • ');
    const autoSwapMessage = `Troca automática aplicada: ${labels}.`;
    setSheetMessage(autoSwapMessage);
    addActivityLog(autoSwapMessage);
  }, [clockSeconds, currentMinute, matchIsOperationallyRunning, sheetRotationPlans]);

  function scoreForPreview(eventType: MatchEventDraft['eventType'], team: 'A' | 'B') {
    if (eventType === 'GOL') {
      if (team === 'A') setTeamAScore((value) => value + 1);
      if (team === 'B') setTeamBScore((value) => value + 1);
    }
    if (eventType === 'GOL_CONTRA') {
      if (team === 'A') setTeamBScore((value) => value + 1);
      if (team === 'B') setTeamAScore((value) => value + 1);
    }
  }

  function addQuickEvent(player: MatchDetail['players'][number], eventType: MatchEventDraft['eventType']) {
    if (!canRegisterEvents) {
      setSheetMessage('Inicie o jogo para lançar gol, assistência e cartões na súmula.');
      return;
    }
    if (player.team === 'PRESENTE_SEM_JOGAR') return;
    const eventMinute = Math.max(0, Math.floor(clockSeconds / 60));
    const eventTeam = player.team === 'A' ? 'A' : 'B';
    const relatedUserId = eventType === 'GOL' ? startersForTeam(eventTeam).find((candidate) => candidate.userId !== player.userId && candidate.roleInMatch !== 'GOLEIRO')?.userId ?? null : null;
    const createdAt = new Date().toISOString();
    const eventId = window.crypto?.randomUUID?.() ?? `${createdAt}-${Math.random().toString(16).slice(2, 10)}`;
    setEvents((list) => [...list, { id: eventId, userId: player.userId, relatedUserId, eventType, minute: eventMinute, clockSecond: clockSeconds, team: eventTeam, occurredAt: createdAt, createdAt }]);
    scoreForPreview(eventType, eventTeam);
    setSelectedPlayerId('');
    setSheetMessage(eventType === 'CARTAO_AZUL' ? `${player.name} recebeu cartão azul e fica 2 minutos fora.` : `${eventLabel(eventType)} lançado para ${player.name}.`);
  }

  function recalculateScoreFromEvents(nextEvents: MatchEventDraft[]) {
    return nextEvents.reduce((scores, item) => {
      if (item.team !== 'A' && item.team !== 'B') return scores;
      if (item.eventType === 'GOL') {
        if (item.team === 'A') scores.teamA += 1;
        if (item.team === 'B') scores.teamB += 1;
      }
      if (item.eventType === 'GOL_CONTRA') {
        if (item.team === 'A') scores.teamB += 1;
        if (item.team === 'B') scores.teamA += 1;
      }
      return scores;
    }, { teamA: 0, teamB: 0 });
  }

  function removeLoggedEvent(eventId: string) {
    const target = events.find((item) => item.id === eventId);
    if (!target) return;
    const nextEvents = events.filter((item) => item.id !== eventId);
    const recalculated = recalculateScoreFromEvents(nextEvents);
    setEvents(nextEvents);
    setTeamAScore(recalculated.teamA);
    setTeamBScore(recalculated.teamB);
    setSheetMessage(`${eventLabel(target.eventType)} removido do log da súmula.`);
    addActivityLog(`Marcação removida: ${eventLabel(target.eventType)} de ${players.find((player) => player.userId === target.userId)?.name ?? 'atleta'}.`);
  }

  function canSwapPlayers(firstPlayer: MatchDetail['players'][number] | undefined, secondPlayer: MatchDetail['players'][number] | undefined) {
    return Boolean(firstPlayer && secondPlayer && firstPlayer.userId !== secondPlayer.userId && firstPlayer.team !== 'PRESENTE_SEM_JOGAR' && secondPlayer.team !== 'PRESENTE_SEM_JOGAR' && ((firstPlayer.team === secondPlayer.team && firstPlayer.startsOnBench !== secondPlayer.startsOnBench) || firstPlayer.team !== secondPlayer.team));
  }

  function removeGuestPlayer(playerId: string) {
    const guest = players.find((player) => player.userId === playerId && player.isGuest);
    if (!guest) return;
    if (events.some((event) => event.userId === playerId || event.relatedUserId === playerId)) {
      setSheetMessage('Não é possível remover convidado que já possui evento lançado na súmula.');
      return;
    }
    boardDirtyRef.current = true;
    setPlayers((current) => normalizeOperationalLineup(current.filter((player) => player.userId !== playerId)));
    if (draggedPlayerId === playerId) setDraggedPlayerId('');
    if (dropTargetId === playerId) setDropTargetId('');
    setSheetMessage(`${guest.name} foi removido da súmula.`);
  }

  async function saveBoard(showFeedback = true, overrides?: { teamAScore?: number; teamBScore?: number; events?: MatchEventDraft[]; clockSeconds?: number; clockRunning?: boolean }) {
    const normalizedPlayers = normalizeOperationalLineup(players);
    const effectiveTeamAScore = overrides?.teamAScore ?? teamAScore;
    const effectiveTeamBScore = overrides?.teamBScore ?? teamBScore;
    const effectiveEvents = overrides?.events ?? events;
    const effectiveClockSeconds = overrides?.clockSeconds ?? clockSeconds;
    const effectiveClockRunning = overrides?.clockRunning ?? clockRunning;
    const lineupAdjusted = normalizedPlayers.some((player, index) => {
      const current = players[index];
      return current && (current.userId !== player.userId || current.team !== player.team || current.roleInMatch !== player.roleInMatch || current.startsOnBench !== player.startsOnBench || current.rotationOrder !== player.rotationOrder || current.present !== player.present || current.fieldLeft !== player.fieldLeft || current.fieldTop !== player.fieldTop);
    });
    if (lineupAdjusted) setPlayers(normalizedPlayers);
    const teamAPlayers = normalizedPlayers.filter((player) => player.team === 'A');
    const teamBPlayers = normalizedPlayers.filter((player) => player.team === 'B');
    await api.request(`/matches/${match.id}/lineup`, {
      method: 'PATCH',
      body: JSON.stringify({
        matchDate: match.matchDate.slice(0, 10),
        title: match.title,
        refereeName: match.refereeName ?? null,
        teamAName: match.teamAName,
        teamBName: match.teamBName,
        players: normalizedPlayers.map((player, index) => ({
          userId: player.userId,
          name: player.name,
          position: player.position ?? 'MC',
          isGuest: player.isGuest === true,
          team: player.team,
          roleInMatch: player.team === 'PRESENTE_SEM_JOGAR' ? 'PRESENTE_SEM_JOGAR' : player.roleInMatch,
          drawOrder: toOptionalNumber(player.drawOrder) ?? index + 1,
          rotationOrder: player.team === 'A' ? teamAPlayers.findIndex((item) => item.userId === player.userId) + 1 : player.team === 'B' ? teamBPlayers.findIndex((item) => item.userId === player.userId) + 1 : null,
          fieldLeft: toOptionalNumber(player.fieldLeft),
          fieldTop: toOptionalNumber(player.fieldTop),
          startsOnBench: player.startsOnBench,
          present: persistedPresenceForTeam(player.team)
        }))
      })
    });
    const saved = await api.request<{ draftSavedAt: string }>(`/matches/${match.id}/draft`, {
      method: 'PATCH',
      body: JSON.stringify({ teamAScore: effectiveTeamAScore, teamBScore: effectiveTeamBScore, events: effectiveEvents, clockSeconds: effectiveClockSeconds, clockRunning: effectiveClockRunning })
    });
    boardDirtyRef.current = false;
    if (showFeedback) setSheetMessage(lineupAdjusted ? `Escalação ajustada e rascunho salvo em ${formatBrasiliaTime(saved.draftSavedAt)}.` : `Rascunho salvo em ${formatBrasiliaTime(saved.draftSavedAt)}.`);
  }

  async function startGame() {
    try {
      if (match.status === 'RUNNING') {
        setGameStarted(true);
        setClockRunning(true);
        setSheetMessage('O jogo já foi iniciado nesta súmula.');
        return;
      }
      if (match.status === 'SUBMITTED' || match.status === 'CONFIRMED') {
        setSheetMessage('Este jogo já está encerrado para edição operacional.');
        return;
      }
      await saveBoard(false);
      const started = await api.request<{ id: string; status: string; startedAt: string }>(`/matches/${match.id}/start`, { method: 'POST' });
      setGameStarted(true);
      setOfficialStartedAt(started.startedAt);
      setClockSeconds(0);
      setClockRunning(true);
      await saveBoard(false, { clockSeconds: 0, clockRunning: true });
      setSheetMessage('Jogo iniciado com cronômetro oficial.');
      await onSaved();
    } catch (error) {
      setSheetMessage(error instanceof Error ? error.message : 'Não foi possível iniciar o jogo.');
    }
  }

  async function toggleGamePause() {
    if (!gameStarted || match.status === 'CONFIRMED' || match.status === 'CANCELLED') return;
    const nextRunning = !clockRunning;
    setClockRunning(nextRunning);
    const pauseMessage = nextRunning ? 'Jogo retomado.' : 'Jogo pausado.';
    setSheetMessage(pauseMessage);
    addActivityLog(pauseMessage);
    try {
      await saveBoard(false, { clockSeconds, clockRunning: nextRunning });
    } catch (error) {
      setClockRunning(!nextRunning);
      setSheetMessage(error instanceof Error ? error.message : 'Não foi possível alterar a pausa do jogo.');
    }
  }

  async function finalizeGame() {
    if (match.status === 'CONFIRMED') {
      setSheetMessage('Esta súmula já foi confirmada.');
      return;
    }
    if (!gameStarted && match.status === 'DRAFT') {
      setSheetMessage('Inicie o jogo antes de finalizar a súmula.');
      return;
    }
    const finalClock = clockSeconds;
    setFinalizationRequested(true);
    setClockFrozen(true);
    setClockRunning(false);
    setSheetMessage('Partida finalizada.');
    addActivityLog('Partida finalizada.');
    try {
      await saveBoard(false, { clockSeconds: finalClock, clockRunning: false });
      if (match.status !== 'SUBMITTED') {
        await api.request(`/matches/${match.id}/submit`, { method: 'POST', body: JSON.stringify({ teamAScore, teamBScore, events }) });
      }
      await api.request(`/matches/${match.id}/confirm`, { method: 'POST' });
      setSheetMessage('Partida finalizada e súmula confirmada.');
      await onSaved();
    } catch (error) {
      setSheetMessage(error instanceof Error ? error.message : 'Não foi possível finalizar o jogo. A partida segue travada para nova tentativa de finalização.');
      return;
    }
  }

  function executeDragSwap(targetPlayerId: string) {
    const draggedPlayer = players.find((player) => player.userId === draggedPlayerId);
    const targetPlayer = players.find((player) => player.userId === targetPlayerId);
    if (!canSwapPlayers(draggedPlayer, targetPlayer)) {
      setDraggedPlayerId('');
      setDropTargetId('');
      setSheetMessage('Arraste um titular sobre um reserva do mesmo time para trocar automaticamente.');
      return;
    }
    const sameTeamSwap = draggedPlayer?.team === targetPlayer?.team;
    const outgoingStarter = sameTeamSwap ? (draggedPlayer?.startsOnBench ? targetPlayer : draggedPlayer) : null;
    const outgoingFieldLeft = outgoingStarter?.fieldLeft ?? null;
    const outgoingFieldTop = outgoingStarter?.fieldTop ?? null;
    boardDirtyRef.current = true;
    setPlayers((list) => {
      const next = list.map((player) => {
        if (player.userId === draggedPlayerId) {
          return sameTeamSwap
            ? {
                ...player,
                startsOnBench: targetPlayer?.startsOnBench ?? player.startsOnBench,
                roleInMatch: targetPlayer?.roleInMatch ?? player.roleInMatch,
                fieldLeft: targetPlayer?.startsOnBench ? null : outgoingFieldLeft,
                fieldTop: targetPlayer?.startsOnBench ? null : outgoingFieldTop
              }
            : { ...player, team: targetPlayer?.team ?? player.team, roleInMatch: targetPlayer?.roleInMatch ?? player.roleInMatch, startsOnBench: targetPlayer?.startsOnBench ?? player.startsOnBench, fieldLeft: null, fieldTop: null };
        }
        if (player.userId === targetPlayerId) {
          return sameTeamSwap
            ? {
                ...player,
                startsOnBench: draggedPlayer?.startsOnBench ?? player.startsOnBench,
                roleInMatch: draggedPlayer?.roleInMatch ?? player.roleInMatch,
                fieldLeft: draggedPlayer?.startsOnBench ? null : outgoingFieldLeft,
                fieldTop: draggedPlayer?.startsOnBench ? null : outgoingFieldTop
              }
            : { ...player, team: draggedPlayer?.team ?? player.team, roleInMatch: draggedPlayer?.roleInMatch ?? player.roleInMatch, startsOnBench: draggedPlayer?.startsOnBench ?? player.startsOnBench, fieldLeft: null, fieldTop: null };
        }
        return player;
      });
      return normalizeOperationalLineup(next);
    });
    if (draggedPlayer?.team === 'A' || draggedPlayer?.team === 'B') manualSwapOverrideRef.current[draggedPlayer.team] = true;
    if (targetPlayer?.team === 'A' || targetPlayer?.team === 'B') manualSwapOverrideRef.current[targetPlayer.team] = true;
    setDraggedPlayerId('');
    setDropTargetId('');
    const substitutionMessage = draggedPlayer?.team === targetPlayer?.team ? `Troca manual aplicada entre #${playerBoardNumber(draggedPlayer!, 0)} e #${playerBoardNumber(targetPlayer!, 0)}. O automático deste time ficou pausado.` : `${draggedPlayer?.name} e ${targetPlayer?.name} trocaram de lado. A rotação automática dos times envolvidos ficou pausada.`;
    setSheetMessage(substitutionMessage);
    addActivityLog(substitutionMessage);
  }

  function playerIsDimmed(player: MatchDetail['players'][number]) {
    if (player.isGuest) return false;
    const status = attendanceStatusByUserId.get(player.userId);
    return player.present === false || !status || status === 'AUSENTE';
  }

  function beginPitchDrag(event: ReactPointerEvent<HTMLDivElement>, player: MatchDetail['players'][number]) {
    if (!canRepositionPlayers || player.team !== 'A' && player.team !== 'B') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const dragState = { userId: player.userId, team: player.team, pointerId: event.pointerId };
    pitchDragRef.current = dragState;
    setPitchDrag(dragState);
    queueDraggedPlayerPreview(dragState, event.clientX, event.clientY);
    setSheetMessage(`Arraste ${player.name} dentro do campo para ajustar a posição, mesmo sem confirmação de presença.`);
  }

  function movePitchDrag(event: ReactPointerEvent<HTMLDivElement>, player: MatchDetail['players'][number]) {
    if (!pitchDrag || pitchDrag.userId !== player.userId || pitchDrag.pointerId !== event.pointerId) return;
    event.preventDefault();
    queueDraggedPlayerPreview(pitchDrag, event.clientX, event.clientY);
  }

  function endPitchDrag(event: ReactPointerEvent<HTMLDivElement>, player: MatchDetail['players'][number]) {
    if (!pitchDrag || pitchDrag.userId !== player.userId || pitchDrag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    finishPitchDrag(event.pointerId, true, event.clientX, event.clientY);
  }

  function summaryTime(item: MatchEventDraft) {
    if (item.occurredAt ?? item.createdAt) return formatBrasiliaClock(item.occurredAt ?? item.createdAt ?? null);
    return `${String(item.minute).padStart(2, '0')}:00`;
  }

  function summaryText(item: MatchEventDraft) {
    const player = players.find((current) => current.userId === item.userId);
    const related = item.relatedUserId ? players.find((current) => current.userId === item.relatedUserId) : null;
    const teamLabel = item.team === 'A' ? match.teamAName : match.teamBName;
    const boardNumber = player ? playerBoardNumber(player, playersForTeam(item.team === 'A' ? 'A' : 'B').findIndex((current) => current.userId === player.userId)) : '?';
    const relatedNumber = related ? playerBoardNumber(related, playersForTeam(item.team === 'A' ? 'A' : 'B').findIndex((current) => current.userId === related.userId)) : null;
    const detail = item.eventType === 'GOL' ? `Gol #${boardNumber}${relatedNumber ? ` (Assist #${relatedNumber})` : ''}` : item.eventType === 'ASSISTENCIA' ? `Assistência #${boardNumber}` : item.eventType === 'CARTAO_AMARELO' ? `Cartão Amarelo #${boardNumber}` : item.eventType === 'CARTAO_VERMELHO' ? `Cartão Vermelho #${boardNumber}` : item.eventType === 'CARTAO_AZUL' ? `Cartão Azul #${boardNumber}` : `Gol contra #${boardNumber}`;
    return `${summaryTime(item)} - ${teamLabel}: ${detail}`;
  }

  function bluePenaltyRemaining(playerId: string) {
    const blueCardSecond = events
      .filter((event) => event.userId === playerId && event.eventType === 'CARTAO_AZUL')
      .reduce((latest, event) => Math.max(latest, event.clockSecond ?? event.minute * 60), -1);
    if (blueCardSecond < 0 || match.status === 'CONFIRMED') return 0;
    return Math.max(0, 120 - (clockSeconds - blueCardSecond));
  }

  function rosterRow(player: MatchDetail['players'][number], index: number, reserve = false) {
    const dragged = draggedPlayerId === player.userId;
    const dropTarget = dropTargetId === player.userId;
    const pending = playerIsDimmed(player);
    const selected = selectedPlayerId === player.userId;
    const penaltyRemaining = bluePenaltyRemaining(player.userId);
    const penaltyLabel = `${String(Math.floor(penaltyRemaining / 60)).padStart(2, '0')}:${String(penaltyRemaining % 60).padStart(2, '0')}`;
    return (
      <div className={`ops-roster-row sheet-roster-row ${reserve ? 'is-reserve' : ''} ${dragged ? 'is-dragging' : ''} ${dropTarget ? 'is-drop-target' : ''} ${pending ? 'is-pending' : ''} ${selected ? 'is-selected' : ''} ${penaltyRemaining > 0 ? 'is-blue-penalty' : ''}`} key={player.userId} role="button" tabIndex={0} aria-expanded={selected} draggable={canRepositionPlayers} onClick={() => setSelectedPlayerId((current) => current === player.userId ? '' : player.userId)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedPlayerId((current) => current === player.userId ? '' : player.userId); } }} onDragStart={() => { setSelectedPlayerId(''); setDraggedPlayerId(player.userId); }} onDragEnd={() => { setDraggedPlayerId(''); setDropTargetId(''); }} onDragOver={(event) => { const sourcePlayer = players.find((current) => current.userId === draggedPlayerId); if (canRepositionPlayers && canSwapPlayers(sourcePlayer, player)) { event.preventDefault(); setDropTargetId(player.userId); } }} onDragLeave={() => { if (dropTargetId === player.userId) setDropTargetId(''); }} onDrop={(event) => { event.preventDefault(); if (canRepositionPlayers) executeDragSwap(player.userId); }}>
        <div className="ops-roster-copy">
          <strong>{player.name}</strong>
        </div>
        {penaltyRemaining > 0 && <span className="sheet-blue-penalty-time">Fora {penaltyLabel}</span>}
        {selected && <div className="sheet-player-event-menu" role="menu" aria-label={`Ações para ${player.name}`}>
          <button type="button" className="sheet-event-command" title="Gol" aria-label="Gol" disabled={!canRegisterEvents} onClick={(event) => { event.stopPropagation(); addQuickEvent(player, 'GOL'); }}><span aria-hidden="true">⚽</span></button>
          <button type="button" className="sheet-event-command is-assist" title="Assistência" aria-label="Assistência" disabled={!canRegisterEvents} onClick={(event) => { event.stopPropagation(); addQuickEvent(player, 'ASSISTENCIA'); }}><span aria-hidden="true">A</span></button>
          <button type="button" className="sheet-event-command is-yellow" title="Cartão amarelo" aria-label="Cartão amarelo" disabled={!canRegisterEvents} onClick={(event) => { event.stopPropagation(); addQuickEvent(player, 'CARTAO_AMARELO'); }}><span className="sheet-card-icon" aria-hidden="true" /></button>
          <button type="button" className="sheet-event-command is-red" title="Cartão vermelho" aria-label="Cartão vermelho" disabled={!canRegisterEvents} onClick={(event) => { event.stopPropagation(); addQuickEvent(player, 'CARTAO_VERMELHO'); }}><span className="sheet-card-icon" aria-hidden="true" /></button>
          <button type="button" className="sheet-event-command is-blue" title="Cartão azul · 2 minutos fora" aria-label="Cartão azul, 2 minutos fora" disabled={!canRegisterEvents} onClick={(event) => { event.stopPropagation(); addQuickEvent(player, 'CARTAO_AZUL'); }}><span className="sheet-card-icon" aria-hidden="true" /><small>2 min</small></button>
          {player.isGuest && match.status === 'DRAFT' && !gameStarted && canRepositionPlayers && <button type="button" className="is-remove" onClick={(event) => { event.stopPropagation(); setSelectedPlayerId(''); removeGuestPlayer(player.userId); }}>Remover</button>}
        </div>}
      </div>
    );
  }

  const clockLabel = `${String(Math.floor(clockSeconds / 60)).padStart(2, '0')}:${String(clockSeconds % 60).padStart(2, '0')}`;
  const summaryLines = [
    ...events.map((item, index) => {
      const timeValue = item.occurredAt ?? item.createdAt ? new Date(item.occurredAt ?? item.createdAt ?? '').getTime() : item.minute * 60000;
      return { id: item.id ?? `event-${item.userId}-${item.eventType}-${index}`, eventId: item.id ?? `event-${item.userId}-${item.eventType}-${index}`, kind: 'event' as const, sortTime: timeValue, timeLabel: summaryTime(item), detail: summaryText(item).split(' - ').slice(1).join(' - ') };
    }),
    ...activityLog.map((item) => ({ id: item.id, kind: 'activity' as const, sortTime: new Date(item.createdAt).getTime(), timeLabel: formatBrasiliaClock(item.createdAt), detail: item.message }))
  ].sort((left, right) => left.sortTime - right.sortTime);

  useEffect(() => {
    const logElement = eventLogRef.current;
    if (!logElement) return;
    logElement.scrollTop = logElement.scrollHeight;
  }, [summaryLines]);

  return (
    <div className="sheet-preview-board">
      <div className="sheet-preview-top">
        <section className="match-time-card sheet-top-clock-card">
          <span>TEMPO DE JOGO</span>
          <strong className="match-time-card-clock">{clockLabel}</strong>
          <div className="match-time-card-score sheet-time-score">
            <div><b>{match.teamAName}</b><small>{teamAScore}</small></div>
            <span>-</span>
            <div><b>{match.teamBName}</b><small>{teamBScore}</small></div>
          </div>
        </section>
      </div>

      <div className="sheet-lineups-grid">
        <section className={`ops-roster-column sheet-roster-panel team-a-roster ${players.some((player) => player.userId === selectedPlayerId && player.team === 'A') ? 'has-open-player-menu' : ''}`}>
          <div className="ops-roster-head team-a-head"><strong>{match.teamAName}</strong></div>
          <span className="sheet-panel-label">Titulares</span>
          <div className="ops-roster-list">{startersForTeam('A').length ? startersForTeam('A').map((player, index) => rosterRow(player, index)) : <small className="muted">Sem titulares definidos.</small>}</div>
          <div className="ops-roster-head reserve-head"><strong>Banco de reservas</strong><span>{reservesForTeam('A').length}</span></div>
          <div className="ops-roster-list reserve-list">{reservesForTeam('A').length ? reservesForTeam('A').map((player, index) => rosterRow(player, index, true)) : <small className="muted">Sem reservas definidos.</small>}</div>
        </section>

        <section className={`ops-roster-column sheet-roster-panel team-b-roster ${players.some((player) => player.userId === selectedPlayerId && player.team === 'B') ? 'has-open-player-menu' : ''}`}>
          <div className="ops-roster-head team-b-head"><strong>{match.teamBName}</strong></div>
          <span className="sheet-panel-label">Titulares</span>
          <div className="ops-roster-list">{startersForTeam('B').length ? startersForTeam('B').map((player, index) => rosterRow(player, index)) : <small className="muted">Sem titulares definidos.</small>}</div>
          <div className="ops-roster-head reserve-head"><strong>Banco de reservas</strong><span>{reservesForTeam('B').length}</span></div>
          <div className="ops-roster-list reserve-list">{reservesForTeam('B').length ? reservesForTeam('B').map((player, index) => rosterRow(player, index, true)) : <small className="muted">Sem reservas definidos.</small>}</div>
        </section>
      </div>

      <div className="sheet-center-column">
        <section className="ops-pitch-card sheet-pitch-panel">
          <div className="ops-pitch-surface sheet-pitch-surface" ref={pitchSurfaceRef}>
            <div className="ops-pitch-center-circle" />
            <div className="ops-pitch-midline" />
            <div className="ops-pitch-box ops-pitch-box-a" />
            <div className="ops-pitch-box ops-pitch-box-b" />
            {fieldPlayers('A').filter(({ player }) => bluePenaltyRemaining(player.userId) === 0).map(({ player, slot }, index) => <div className={`ops-pitch-player team-a-player ${player.roleInMatch === 'GOLEIRO' ? 'is-goalkeeper' : ''} ${pitchDrag?.userId === player.userId ? 'is-dragging' : ''}`} key={`sheet-a-${player.userId}`} style={{ left: `${slot.left}%`, top: `${slot.top}%` }} title="Clique e arraste para reposicionar" onPointerDown={(event) => beginPitchDrag(event, player)} onPointerMove={(event) => movePitchDrag(event, player)} onPointerUp={(event) => endPitchDrag(event, player)} onPointerCancel={(event) => endPitchDrag(event, player)}><span>{player.roleInMatch === 'GOLEIRO' ? `G${playerBoardNumber(player, index)}` : playerBoardNumber(player, index)}</span><small>{player.name.split(' ')[0]}</small></div>)}
            {fieldPlayers('B').filter(({ player }) => bluePenaltyRemaining(player.userId) === 0).map(({ player, slot }, index) => <div className={`ops-pitch-player team-b-player ${player.roleInMatch === 'GOLEIRO' ? 'is-goalkeeper' : ''} ${pitchDrag?.userId === player.userId ? 'is-dragging' : ''}`} key={`sheet-b-${player.userId}`} style={{ left: `${slot.left}%`, top: `${slot.top}%` }} title="Clique e arraste para reposicionar" onPointerDown={(event) => beginPitchDrag(event, player)} onPointerMove={(event) => movePitchDrag(event, player)} onPointerUp={(event) => endPitchDrag(event, player)} onPointerCancel={(event) => endPitchDrag(event, player)}><span>{player.roleInMatch === 'GOLEIRO' ? `G${playerBoardNumber(player, index)}` : playerBoardNumber(player, index)}</span><small>{player.name.split(' ')[0]}</small></div>)}
          </div>
        </section>

        <section className="sheet-log-panel is-sheet-main">
          <div className="match-control-feed-head">
            <div><strong>Log da súmula</strong></div>
            <small>{sheetMessage}</small>
          </div>
          <div className="event-log ops-event-log" ref={eventLogRef}>{summaryLines.length === 0 ? <small className="muted">Sem eventos registrados ainda.</small> : summaryLines.map((item) => <span key={item.id}><b>{item.timeLabel}</b><small>{item.detail}</small>{item.kind === 'event' && match.status !== 'CONFIRMED' && <button type="button" className="ghost small sheet-log-remove-button" onClick={() => removeLoggedEvent(item.eventId)}>Excluir</button>}</span>)}</div>
          <div className="sheet-footer-actions">
            {match.status === 'DRAFT' && !gameStarted && <button type="button" className="primary sheet-green-button" onClick={() => void startGame()}>INICIAR JOGO</button>}
            {match.status !== 'CONFIRMED' && gameStarted && !finalizationRequested && !clockFrozen && <button type="button" className="ghost sheet-guest-trigger-button" onClick={() => void toggleGamePause()}>{clockRunning ? 'PAUSAR JOGO' : 'RETOMAR JOGO'}</button>}
            {match.status !== 'CONFIRMED' && gameStarted && <button type="button" className="primary danger-action sheet-danger-button" onClick={() => void finalizeGame()}>{match.status === 'SUBMITTED' ? 'CONFIRMAR FINALIZAÇÃO' : 'FINALIZAR JOGO'}</button>}
          </div>
        </section>
      </div>
    </div>
  );
}

function DashboardFinishedMatchesPanel({ matches }: { matches: MatchListItem[] }) {
  const finishedMatches = sortMatchesByOperationalRelevance(matches).filter((match) => match.status === 'CONFIRMED').slice(0, 8);

  return (
    <section className="card compact dashboard-finished-card">
      <div className="card-head">
        <div className="finished-panel-head">
          <h2>Jogos finalizados</h2>
          <span className="finished-count-badge">{finishedMatches.length}</span>
        </div>
      </div>
      <div className="finished-vertical-list">{finishedMatches.length === 0 ? <EmptyState title="Sem jogos confirmados" text="Os últimos placares entram aqui quando as súmulas forem fechadas." /> : finishedMatches.map((match) => <article className="finished-list-row" key={match.id}><div className="finished-list-main"><span className="finished-list-date">{compactMatchDateLabel(match)}</span><strong className="finished-list-title">{match.title}</strong><small className="finished-list-outcome">{matchOutcomeLabel(match)}</small></div><div className="finished-list-duel"><div className="finished-list-team"><span className="finished-team-mark">{teamBadgeLabel(match.teamAName)}</span><strong>{match.teamAName}</strong></div><div className="finished-list-score"><b>{match.teamAScore}</b><span>x</span><b>{match.teamBScore}</b></div><div className="finished-list-team is-away"><strong>{match.teamBName}</strong><span className="finished-team-mark">{teamBadgeLabel(match.teamBName)}</span></div></div></article>)}</div>
    </section>
  );
}

function DashboardStandingsPanel({ standings, onOpenProfile }: { standings: Standing[]; onOpenProfile: (userId: string) => void }) {
  const statisticOptions = [
    { value: 'wins', label: 'Vitórias', read: (row: Standing) => row.wins, format: (value: number) => String(value) },
    { value: 'draws', label: 'Empates', read: (row: Standing) => row.draws, format: (value: number) => String(value) },
    { value: 'losses', label: 'Derrotas', read: (row: Standing) => row.losses, format: (value: number) => String(value) },
    { value: 'presences', label: 'Presenças', read: (row: Standing) => row.presences, format: (value: number) => String(value) },
    { value: 'paid_months', label: 'Mensalidades', read: (row: Standing) => row.paid_months, format: (value: number) => String(value) },
    { value: 'goals', label: 'Gols', read: (row: Standing) => row.goals, format: (value: number) => String(value) },
    { value: 'assists', label: 'Assistências', read: (row: Standing) => row.assists, format: (value: number) => String(value) },
    { value: 'total_cards', label: 'Cartões', read: (row: Standing) => row.total_cards, format: (value: number) => String(value) },
    { value: 'own_goals', label: 'Gols contra', read: (row: Standing) => row.own_goals, format: (value: number) => String(value) },
    { value: 'net_goals', label: 'Saldo individual', read: (row: Standing) => row.net_goals, format: (value: number) => String(value) },
    { value: 'team_goals_for', label: 'Gols pró da equipe', read: (row: Standing) => row.team_goals_for, format: (value: number) => String(value) },
    { value: 'team_goals_against', label: 'Gols sofridos da equipe', read: (row: Standing) => row.team_goals_against, format: (value: number) => String(value) },
    { value: 'team_goal_balance', label: 'Saldo da equipe', read: (row: Standing) => row.team_goal_balance, format: (value: number) => String(value) },
    { value: 'efficiency', label: 'Aproveitamento', read: (row: Standing) => row.games_played ? ((row.wins * 3 + row.draws) / (row.games_played * 3)) * 100 : 0, format: (value: number) => formatPercent(value) }
  ] as const;
  const [selectedStatistic, setSelectedStatistic] = useState<(typeof statisticOptions)[number]['value']>('goals');
  const activeStatistic = statisticOptions.find((option) => option.value === selectedStatistic) ?? statisticOptions[0];
  const sortedStandings = useMemo(() => [...standings]
    .sort((left, right) => {
      const valueDiff = activeStatistic.read(right) - activeStatistic.read(left);
      if (valueDiff !== 0) return valueDiff;
      const pointsDiff = right.total_points - left.total_points;
      if (pointsDiff !== 0) return pointsDiff;
      const gamesDiff = right.games_played - left.games_played;
      if (gamesDiff !== 0) return gamesDiff;
      return left.position - right.position;
    })
    .map((row, index) => ({
      ...row,
      dashboardStatisticValue: activeStatistic.read(row),
      dashboardDisplayPosition: index + 1,
      dashboardEfficiency: row.games_played ? ((row.wins * 3 + row.draws) / (row.games_played * 3)) * 100 : 0
    })), [standings, activeStatistic]);

  return (
    <section className="card compact dashboard-standings-card">
      <div className="card-head championship-head">
        <div>
          <h2>Tabela da temporada</h2>
          <p className="muted">Escolha a estatística que quer destacar e a tabela reordena os atletas por esse critério.</p>
        </div>
        {standings.length > 0 && <div className="dashboard-standings-toolbar"><label><span>Estatística</span><select value={selectedStatistic} onChange={(event) => setSelectedStatistic(event.target.value as (typeof statisticOptions)[number]['value'])}>{statisticOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>}
      </div>
      {standings.length === 0 ? <EmptyState title="Sem classificação ainda" text="A tabela será preenchida assim que os jogos forem confirmados." /> : <div className="championship-wrap dashboard-standings-wrap"><table className="championship-table dashboard-standings-table"><thead><tr><th>#</th><th>Atleta</th><th>PTS</th><th>J</th><th>{activeStatistic.label}</th><th>APR</th></tr></thead><tbody>{sortedStandings.map((row) => <tr key={row.user_id}><td className="pos-cell">{row.dashboardDisplayPosition}</td><td className="athlete-cell"><button className="name-link strong" onClick={() => onOpenProfile(row.user_id)}>{row.name}</button></td><td className="points-cell">{row.total_points}</td><td>{row.games_played}</td><td>{activeStatistic.format(row.dashboardStatisticValue)}</td><td>{formatPercent(row.dashboardEfficiency)}</td></tr>)}</tbody></table></div>}
    </section>
  );
}

function SeasonPanel({ standings, rankings, onOpenProfile }: { standings: Standing[]; rankings: RankingPayload; onOpenProfile: (userId: string) => void }) {
  const topScorer = rankings.goals[0];
  const topAssistant = rankings.assists[0];
  const topPresence = rankings.presence[0];
  const topPoints = standings[0];
  const topEfficiency = [...standings].filter((row) => row.games_played > 0).sort((left, right) => ((right.wins * 3 + right.draws) / (right.games_played * 3)) - ((left.wins * 3 + left.draws) / (left.games_played * 3)))[0];
  const topTeamBalance = [...standings].sort((left, right) => right.team_goal_balance - left.team_goal_balance || right.team_goals_for - left.team_goals_for)[0];
  const indicators = [
    topScorer && { icon: '⚽', title: 'Artilheiro', userId: topScorer.userId, name: topScorer.name, value: topScorer.goals, suffix: 'gols', detail: `${topScorer.netGoals} saldo • ${topScorer.ownGoals} contra` },
    topAssistant && { icon: '🅰️', title: 'Garçom', userId: topAssistant.userId, name: topAssistant.name, value: topAssistant.assists, suffix: 'assist.', detail: `${topAssistant.gamesPlayed} jogos • média ${formatAverage(topAssistant.average)}` },
    topPresence && { icon: '📍', title: 'Mais assíduo', userId: topPresence.userId, name: topPresence.name, value: topPresence.total, suffix: 'pres.', detail: `${topPresence.gamesPlayed} jogos • ${formatAverage(topPresence.percentage)}%` },
    topEfficiency && { icon: '📈', title: 'Melhor aproveitamento', userId: topEfficiency.user_id, name: topEfficiency.name, value: Math.round(topEfficiency.games_played ? ((topEfficiency.wins * 3 + topEfficiency.draws) / (topEfficiency.games_played * 3)) * 100 : 0), suffix: '%', detail: `V ${topEfficiency.wins} • E ${topEfficiency.draws} • D ${topEfficiency.losses}` },
    topPoints && { icon: '🏆', title: 'Maior pontuador', userId: topPoints.user_id, name: topPoints.name, value: topPoints.total_points, suffix: 'pts', detail: `1º nos pontos corridos` },
    topTeamBalance && { icon: '🥅', title: 'Melhor saldo equipe', userId: topTeamBalance.user_id, name: topTeamBalance.name, value: topTeamBalance.team_goal_balance, suffix: 'saldo', detail: `${topTeamBalance.team_goals_for} pró • ${topTeamBalance.team_goals_against} contra` }
  ].filter(Boolean) as Array<{ icon: string; title: string; userId: string; name: string; value: number; suffix: string; detail: string }>;

  return <section className="card compact standings-card"><div className="card-head championship-head"><div><h2>Tabela da temporada</h2><p className="muted">Classificação em largura total, estilo campeonato: clique no atleta para abrir o perfil.</p></div>{standings.length > 0 && <button className="ghost" onClick={() => downloadCsv('poka-pratika-classificacao.csv', standings.map((row) => ({ posicao: row.position, atleta: row.name, pontos: row.total_points, jogos: row.games_played, vitorias: row.wins, empates: row.draws, derrotas: row.losses, presencasSemJogar: row.presences, mensalidades: row.paid_months, gols: row.goals, golsContra: row.own_goals, assistencias: row.assists, cartoes: row.total_cards, saldoEquipe: row.team_goal_balance })))}>Exportar Excel</button>}</div>{standings.length === 0 ? <EmptyState title="Temporada pronta para começar" text="Assim que a primeira súmula for confirmada, a tabela ganha vida." /> : <div className="championship-wrap"><table className="championship-table"><thead><tr><th>Pos</th><th>Atleta</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>PSJ</th><th>Mens.</th><th>GP</th><th>GC</th><th>SG</th><th>GF</th><th>GS</th><th>SE</th><th>APR</th><th>G</th><th>A</th><th>CAR</th></tr></thead><tbody>{standings.map((row) => <tr key={row.user_id}><td className="pos-cell">{row.position}</td><td className="athlete-cell"><button className="name-link strong" onClick={() => onOpenProfile(row.user_id)}>{row.name}</button></td><td className="points-cell">{row.total_points}</td><td>{row.games_played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td>{row.presences}</td><td>{row.paid_months}</td><td>{row.goals}</td><td>{row.own_goals}</td><td>{row.net_goals}</td><td>{row.team_goals_for}</td><td>{row.team_goals_against}</td><td>{row.team_goal_balance}</td><td>{formatPercent(row.games_played ? ((row.wins * 3 + row.draws) / (row.games_played * 3)) * 100 : 0)}</td><td>{row.goals}</td><td>{row.assists}</td><td>{row.total_cards}</td></tr>)}</tbody></table></div>}<div className="leader-strip">{indicators.length === 0 ? <EmptyState title="Indicadores aguardando jogos" text="Os líderes individuais aparecem aqui após as primeiras súmulas confirmadas." /> : indicators.map((item) => <article className="leader-card" key={item.title}><span className="leader-icon">{item.icon}</span><div><small>{item.title}</small><button className="name-link" onClick={() => onOpenProfile(item.userId)}>{item.name}</button><b>{item.value} {item.suffix}</b><em>{item.detail}</em></div></article>)}</div></section>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><strong>{title}</strong><span>{text}</span></div>;
}

function SeasonOperationsPanel({ api, suspensions, matches, canCoordinate, onReload }: { api: ApiClient; suspensions: Suspension[]; matches: MatchListItem[]; canCoordinate: boolean; onReload: () => Promise<void> }) {
  const confirmedMatches = matches.filter((match) => match.status === 'CONFIRMED');
  async function serveSuspension(id: string, servedMatchId: string) {
    if (!servedMatchId) return;
    await api.request(`/suspensions/${id}/serve`, { method: 'POST', body: JSON.stringify({ servedMatchId }) });
    await onReload();
  }

  return <section className="card compact operations-panel"><div className="card-head"><div><h2>Central operacional</h2><p className="muted">Pendências disciplinares e suspensões ativas da temporada.</p></div><span className={`status ${suspensions.length ? 'danger' : 'open'}`}>{suspensions.length} susp.</span></div><div className="ops-section"><div className="card-head"><strong>Suspensões</strong><span className={`status ${suspensions.length ? 'danger' : 'open'}`}>{suspensions.length}</span></div>{suspensions.length === 0 ? <p className="muted">Sem pendências disciplinares no momento.</p> : <div className="suspension-list compact-suspensions">{suspensions.map((item) => <article className="suspension-row" key={item.id}><strong>{item.userName}</strong><span>{formatCardReason(item.reason)}</span><small>Origem: {item.triggerMatchTitle}</small>{canCoordinate && <select disabled={!confirmedMatches.length} defaultValue="" onChange={(event) => void serveSuspension(item.id, event.target.value)}><option value="">Cumpriu em...</option>{confirmedMatches.map((match) => <option key={match.id} value={match.id}>{match.title} • {match.matchDate?.slice(0, 10)}</option>)}</select>}</article>)}</div>}</div></section>;
}

function ProfilesPanel({ api, currentUserId, initialUserId, onCurrentUserUpdated, onRequestChangePassword }: { api: ApiClient; currentUserId: string; initialUserId: string; onCurrentUserUpdated: (user: User) => void; onRequestChangePassword: () => void }) {
  const [selectedUserId, setSelectedUserId] = useState(initialUserId);
  const [career, setCareer] = useState<CareerProfile | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => setSelectedUserId(initialUserId), [initialUserId]);

  useEffect(() => {
    setMessage('');
    api.request<CareerProfile>(`/users/${selectedUserId}/career`).then(setCareer).catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao carregar perfil.'));
  }, [selectedUserId]);

  async function saveAvatar(file?: File | null) {
    if (!career || selectedUserId !== currentUserId) return;
    if (!file) {
      const updated = await api.request<User>('/users/me/avatar', { method: 'PATCH', body: JSON.stringify({ avatarDataUrl: null }) });
      onCurrentUserUpdated(updated);
      setCareer({ ...career, profile: { ...career.profile, avatarDataUrl: null } });
      setMessage('Foto removida do perfil.');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setMessage('Use uma imagem PNG, JPG ou WEBP.');
      return;
    }
    if (file.size > 650000) {
      setMessage('A imagem precisa ter até 650 KB para carregar rápido no celular.');
      return;
    }
    const avatarDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      reader.readAsDataURL(file);
    });
    const updated = await api.request<User>('/users/me/avatar', { method: 'PATCH', body: JSON.stringify({ avatarDataUrl }) });
    onCurrentUserUpdated(updated);
    setCareer({ ...career, profile: { ...career.profile, avatarDataUrl: updated.avatarDataUrl } });
    setMessage('Foto atualizada. Agora o craque tem figurinha oficial.');
  }

  const orderedSeasons = career ? [...career.seasons].sort((left, right) => left.year - right.year || left.seasonName.localeCompare(right.seasonName)) : [];
  const lineValues = orderedSeasons.map((season) => season.totalPoints);
  const maxLineValue = Math.max(...lineValues, 1);
  const lineWidth = 188;
  const lineHeight = 110;
  const linePadding = 16;
  const linePath = lineValues.map((value, index) => {
    const x = lineValues.length === 1 ? lineWidth / 2 : linePadding + (index * (lineWidth - linePadding * 2)) / Math.max(1, lineValues.length - 1);
    const y = lineHeight - linePadding - (value / maxLineValue) * (lineHeight - linePadding * 2);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  const radarValues = career ? [career.totals.totalPoints, career.totals.presences, career.totals.goals, career.totals.assists, career.totals.wins] : [0, 0, 0, 0, 0];
  const radarLabels = ['Pontos', 'Presença', 'Gols', 'Assist', 'Vitórias'];
  const maxRadarValue = Math.max(...radarValues, 1);
  const radarCx = 78;
  const radarCy = 78;
  const radarRadius = 54;
  const radarAngles = radarLabels.map((_, index) => (-Math.PI / 2) + (index * Math.PI * 2) / radarLabels.length);
  const radarPolygon = radarValues.map((value, index) => polarChartPoint(radarCx, radarCy, (value / maxRadarValue) * radarRadius, radarAngles[index])).join(' ');
  const suspensionCount = career?.suspensions.length ?? 0;

  return (
    <div className="athlete-profile-sheet">
      {message && <p className="status-line athlete-profile-message">{message}</p>}
      {!career && <p className="muted">Carregando perfil...</p>}
      {career && <>
        <section className="athlete-profile-hero-card">
          <div className="athlete-profile-avatar-shell">
            <div className="athlete-profile-avatar-ring">
              {career.profile.avatarDataUrl ? <img src={career.profile.avatarDataUrl} alt={`Avatar de ${career.profile.name}`} /> : <span>{career.profile.name.slice(0, 1)}</span>}
            </div>
          </div>

          {selectedUserId === currentUserId && <div className="athlete-profile-actions"><button type="button" className="primary small" onClick={onRequestChangePassword}>Trocar senha</button><label className="ghost small"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void saveAvatar(file); }} />Trocar foto</label>{career.profile.avatarDataUrl && <button type="button" className="ghost small athlete-profile-remove-photo" onClick={() => void saveAvatar(null)}>Remover foto</button>}</div>}

          <div className="athlete-profile-identity">
            <h3>{career.profile.name}</h3>
            <p>{career.profile.role} • {positionLabel(career.profile.position)}</p>
            <strong>{career.totals.seasonsPlayed} temporada(s)</strong>
          </div>
        </section>

        <section className="athlete-profile-card athlete-profile-history-card">
          <div className="athlete-profile-card-head">
            <strong>Histórico de temporadas</strong>
            <span>{orderedSeasons.length}</span>
          </div>
          {orderedSeasons.length === 0 ? <p className="muted">Sem temporadas suficientes para montar histórico visual.</p> : <>
            <div className="athlete-profile-season-strip">{orderedSeasons.map((season, index) => <span key={season.seasonId}>Temporada {index + 1}: {season.year}</span>)}</div>
            <div className="athlete-profile-chart-grid">
              <div className="athlete-profile-chart-card athlete-profile-radar-card">
                <svg viewBox="0 0 156 156" aria-hidden="true">
                  {[0.25, 0.5, 0.75, 1].map((step) => <polygon key={step} points={radarAngles.map((angle) => polarChartPoint(radarCx, radarCy, radarRadius * step, angle)).join(' ')} className="athlete-profile-radar-grid" />)}
                  {radarAngles.map((angle, index) => {
                    const [x, y] = polarChartPoint(radarCx, radarCy, radarRadius, angle).split(',').map(Number);
                    return <line key={radarLabels[index]} x1={radarCx} y1={radarCy} x2={x} y2={y} className="athlete-profile-radar-axis" />;
                  })}
                  <polygon points={radarPolygon} className="athlete-profile-radar-shape" />
                  <circle cx={radarCx} cy={radarCy} r="3" className="athlete-profile-radar-center" />
                  {radarLabels.map((label, index) => {
                    const [x, y] = polarChartPoint(radarCx, radarCy, radarRadius + 18, radarAngles[index]).split(',').map(Number);
                    return <text key={label} x={x} y={y} className="athlete-profile-radar-label">{label}</text>;
                  })}
                </svg>
              </div>
              <div className="athlete-profile-chart-card athlete-profile-line-card">
                <svg viewBox={`0 0 ${lineWidth} ${lineHeight}`} aria-hidden="true">
                  {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                    const y = lineHeight - linePadding - step * (lineHeight - linePadding * 2);
                    return <line key={step} x1={linePadding} y1={y} x2={lineWidth - linePadding} y2={y} className="athlete-profile-line-grid" />;
                  })}
                  {linePath && <path d={linePath} className="athlete-profile-line-path" />}
                  {lineValues.map((value, index) => {
                    const x = lineValues.length === 1 ? lineWidth / 2 : linePadding + (index * (lineWidth - linePadding * 2)) / Math.max(1, lineValues.length - 1);
                    const y = lineHeight - linePadding - (value / maxLineValue) * (lineHeight - linePadding * 2);
                    return <g key={`${orderedSeasons[index]?.seasonId ?? index}-dot`}><circle cx={x} cy={y} r="4" className="athlete-profile-line-dot" /><text x={x} y={lineHeight - 4} className="athlete-profile-line-label">{index + 1}</text></g>;
                  })}
                </svg>
              </div>
            </div>
          </>}
        </section>

        <section className="athlete-profile-card athlete-profile-trophies-card">
          <div className="athlete-profile-card-head">
            <strong>Títulos e badges</strong>
            <span>{career.awards.length + career.badges.length}</span>
          </div>
          {career.awards.length === 0 && career.badges.length === 0 ? <p className="muted">Nenhum prêmio registrado ainda.</p> : <>
            <div className="athlete-profile-awards-list">{career.awards.map((award) => <span className="chip trophy" key={award.id}>{award.label} • {award.year}</span>)}</div>
            <div className="athlete-profile-badge-list">{career.badges.length === 0 ? <span className="muted">Sem badges adicionais.</span> : career.badges.map((badge) => <span className="chip" key={badge.id}>{badge.icon ? `${badge.icon} ` : ''}{badge.label}</span>)}</div>
          </>}
        </section>

        <section className="athlete-profile-card athlete-profile-stats-card">
          <div className="athlete-profile-card-head">
            <strong>Resumo da carreira</strong>
            <span>{suspensionCount}</span>
          </div>
          <div className="athlete-profile-stat-grid">
            <span><b>{career.totals.totalPoints}</b><small>Pontos</small></span>
            <span><b>{career.totals.presences}</b><small>Presenças</small></span>
            <span><b>{career.totals.goals}</b><small>Gols</small></span>
            <span><b>{career.totals.assists}</b><small>Assistências</small></span>
            <span><b>{career.totals.wins}</b><small>Vitórias</small></span>
            <span><b>{career.totals.yellowCards + career.totals.redCards + career.totals.blueCards}</b><small>Cartões</small></span>
          </div>
        </section>
      </>}
    </div>
  );
}

function AttendancePanel({ api, match, currentUserId, onSaved, showRecentCard = true }: { api: ApiClient; match: MatchDetail; currentUserId: string; onSaved: () => Promise<void>; showRecentCard?: boolean }) {
  const own = match.attendance.find((item) => item.userId === currentUserId);
  const [responseStatus, setResponseStatus] = useState<AttendanceStatus>(own?.responseStatus ?? 'JOGAR');
  const [dinnerConfirmed, setDinnerConfirmed] = useState(own?.dinnerConfirmed ?? false);
  const [guestCount, setGuestCount] = useState(own?.guestCount ?? 0);
  const [notes, setNotes] = useState(own?.notes ?? '');
  const [message, setMessage] = useState('');
  const openForResponse = isConfirmationReallyOpen(match);

  useEffect(() => {
    setResponseStatus(own?.responseStatus ?? 'JOGAR');
    setDinnerConfirmed(own?.dinnerConfirmed ?? false);
    setGuestCount(own?.guestCount ?? 0);
    setNotes(own?.notes ?? '');
    setMessage('');
  }, [match.id, own?.updatedAt]);

  const playing = match.attendance.filter((item) => item.responseStatus === 'JOGAR');
  const presentOnly = match.attendance.filter((item) => item.responseStatus === 'PRESENTE_SEM_JOGAR');
  const absent = match.attendance.filter((item) => item.responseStatus === 'AUSENTE');
  const dinnerPeople = match.attendance.reduce((total, item) => total + (item.dinnerConfirmed ? 1 : 0) + (item.dinnerConfirmed ? item.guestCount : 0), 0);
  const closedMessage = match.status === 'DRAFT'
    ? confirmationWindowHasEnded(match)
      ? `Confirmação encerrada pela janela configurada${match.confirmationCloseAt ? ` em ${formatBrasiliaTime(match.confirmationCloseAt)}` : ''}.`
      : `Confirmação ainda não aberta. A coordenação pode abrir manualmente ou manter a janela configurada: ${confirmationWindowScheduleLabel(match)}.`
    : 'Confirmação bloqueada porque a súmula já saiu do rascunho.';
  const recentSavedAt = own?.updatedAt ? new Date(own.updatedAt).toLocaleString('pt-BR') : '';

  function RoundIcon({ kind, className }: { kind: 'ball' | 'person' | 'meal' | 'status' | 'play' | 'present' | 'absent' | 'check'; className?: string }) {
    if (kind === 'ball') return <MdSportsSoccer className={className} aria-hidden="true" focusable="false" />;
    if (kind === 'person') return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M5.5 18.5c1.4-3.5 3.6-5.3 6.5-5.3s5.1 1.8 6.5 5.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
    if (kind === 'meal') return <MdOutlineRestaurantMenu className={className} aria-hidden="true" focusable="false" />;
    if (kind === 'status') return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>;
    if (kind === 'play') return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 8 5-8 5V7Z" fill="currentColor" /><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>;
    if (kind === 'present') return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M7 19h10M9.2 15.5h5.6M8.2 18c.4-2.2 1.8-3.8 3.8-3.8s3.4 1.6 3.8 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
    if (kind === 'absent') return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m8.5 8.5 7 7m0-7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5 9.5 16 18.5 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }

  async function saveAttendance() {
    setMessage('Salvando confirmação...');
    const normalizedDinnerConfirmed = responseStatus !== 'AUSENTE' && dinnerConfirmed;
    await api.request(`/matches/${match.id}/attendance/me`, { method: 'PUT', body: JSON.stringify({ responseStatus, dinnerConfirmed: normalizedDinnerConfirmed, guestCount: normalizedDinnerConfirmed ? guestCount : 0, notes: notes || null }) });
    setMessage(responseStatus === 'JOGAR' ? 'Confirmação salva: você ficou disponível para o jogo e para a escalação.' : responseStatus === 'PRESENTE_SEM_JOGAR' ? 'Confirmação salva: você ficou apenas presente, fora do jogo e da escalação.' : 'Confirmação salva: ausência registrada para esta rodada.');
    await onSaved();
  }

  return (
    <section className="score-editor attendance-panel attendance-dashboard-panel">
      <div className="attendance-header-row">
        <div className="attendance-header-copy">
          <h2>Confirmação da rodada</h2>
          <p className="muted">Atletas escolhem uma única situação na rodada e, se forem ao evento, informam jantar/churrasco.</p>

          <div className="attendance-global-strip">
            <span className="attendance-global-chip attendance-global-chip-label"><RoundIcon kind="status" className="attendance-inline-icon" /> Status Global:</span>
            <span className={`attendance-global-chip ${match.confirmationOpen ? 'is-open' : 'is-neutral'}`}>{match.confirmationOpen ? 'Aberto para Confirmação' : 'Fechado para Confirmação'}</span>
            <span className="attendance-global-chip is-neutral">{match.status === 'DRAFT' ? 'Aguardando Início Oficial' : matchStatusLabel(match.status)}</span>
          </div>
        </div>

        <div className="attendance-hero-statuses">
          <div className={`attendance-hero-status ${responseStatus === 'JOGAR' ? 'is-on' : ''}`}>
            <span className="attendance-hero-ring"><RoundIcon kind="ball" className="attendance-ring-icon" /></span>
            <small>Jogo Confirmado</small>
          </div>
          <div className={`attendance-hero-status ${responseStatus === 'PRESENTE_SEM_JOGAR' ? 'is-on' : ''}`}>
            <span className="attendance-hero-ring"><RoundIcon kind="person" className="attendance-ring-icon" /></span>
            <small>Presente</small>
          </div>
          <div className={`attendance-hero-status ${dinnerConfirmed && responseStatus !== 'AUSENTE' ? 'is-dinner' : ''}`}>
            <span className="attendance-hero-ring"><RoundIcon kind="meal" className="attendance-ring-icon" /></span>
            <small>Janta Confirmado</small>
          </div>
        </div>
      </div>

      <div className="attendance-dashboard-shell">
        <div className="attendance-dashboard-head">
          <div>
            <strong>Confirmation Dashboard</strong>
            <p className="muted">Escolha única: qual sua situação?</p>
          </div>
          <span className="attendance-club-name">Club no: PlayField</span>
        </div>

        {openForResponse ? (
          <>
            <div className="attendance-dashboard-grid">
              <div className="attendance-dashboard-main">
                <div className="attendance-choice-group" role="radiogroup" aria-label="Escolha única de presença na rodada">
                  <button type="button" role="radio" aria-checked={responseStatus === 'JOGAR'} className={`attendance-choice-button ${responseStatus === 'JOGAR' ? 'is-active is-game' : ''}`} onClick={() => setResponseStatus('JOGAR')}>
                    <RoundIcon kind="ball" className="attendance-choice-icon" />
                    <span>Jogo</span>
                  </button>
                  <button type="button" role="radio" aria-checked={responseStatus === 'PRESENTE_SEM_JOGAR'} className={`attendance-choice-button ${responseStatus === 'PRESENTE_SEM_JOGAR' ? 'is-active is-present' : ''}`} onClick={() => setResponseStatus('PRESENTE_SEM_JOGAR')}>
                    <RoundIcon kind="person" className="attendance-choice-icon" />
                    <span>Apenas Presença</span>
                  </button>
                  <button type="button" role="radio" aria-checked={responseStatus === 'AUSENTE'} className={`attendance-choice-button ${responseStatus === 'AUSENTE' ? 'is-active is-absent' : ''}`} onClick={() => { setResponseStatus('AUSENTE'); setDinnerConfirmed(false); setGuestCount(0); }}>
                    <RoundIcon kind="absent" className="attendance-choice-icon" />
                    <span>Ausência</span>
                  </button>
                </div>

                <small className="attendance-dashboard-note">Escalação salva no banco.</small>

                <div className="attendance-summary-grid">
                  <article className="attendance-summary-card is-game">
                    <RoundIcon kind="play" className="attendance-summary-icon" />
                    <div><strong>{playing.length}</strong><span>Disponíveis para Jogo</span></div>
                  </article>
                  <article className="attendance-summary-card is-present">
                    <RoundIcon kind="present" className="attendance-summary-icon" />
                    <div><strong>{presentOnly.length}</strong><span>Só Presentes</span></div>
                  </article>
                  <article className="attendance-summary-card is-absent">
                    <RoundIcon kind="absent" className="attendance-summary-icon" />
                    <div><strong>{absent.length}</strong><span>Ausentes</span></div>
                  </article>
                  <article className="attendance-summary-card is-dinner">
                    <RoundIcon kind="meal" className="attendance-summary-icon" />
                    <div><strong>{dinnerPeople}</strong><span>Pessoas na Janta</span></div>
                  </article>
                </div>
              </div>

              <div className="attendance-dashboard-side">
                <label className="attendance-field">
                  <span>Número de pessoas para Janta/Churrasco:</span>
                  <input type="number" min="0" max="20" value={guestCount} onChange={(event) => setGuestCount(Number(event.target.value))} disabled={responseStatus === 'AUSENTE' || !dinnerConfirmed} placeholder="0" />
                </label>

                <label className={`attendance-dinner-toggle ${dinnerConfirmed && responseStatus !== 'AUSENTE' ? 'is-active' : ''} ${responseStatus === 'AUSENTE' ? 'is-disabled' : ''}`}>
                  <input type="checkbox" checked={dinnerConfirmed} disabled={responseStatus === 'AUSENTE'} onChange={(event) => { setDinnerConfirmed(event.target.checked); if (!event.target.checked) setGuestCount(0); }} />
                  <span className="attendance-dinner-toggle-box"><RoundIcon kind="check" className="attendance-dinner-check" /></span>
                  <span>Fico para Janta?</span>
                </label>

                <label className="attendance-field attendance-field-notes">
                  <span>Observação Rápida:</span>
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex: Chego atrasado, tenho que sair cedo..." maxLength={300} rows={2} />
                  <small>Observação rápida para a comissão.</small>
                </label>
              </div>
            </div>

            <button type="button" className="primary attendance-save-button" onClick={() => void saveAttendance()}>Salvar minha confirmação</button>
            
          </>
        ) : (
          <p className="muted attendance-closed-note">{closedMessage}</p>
        )}

        {message && <p className="attendance-feedback">{message}</p>}
      </div>

      {showRecentCard && <div className="attendance-recent-card">
        <div className="attendance-recent-head">
          <strong>Sua Resposta Recente</strong>
          {recentSavedAt && <span>Salvo no {recentSavedAt}</span>}
        </div>

        <div className="attendance-recent-stats">
          <span><RoundIcon kind="ball" className="attendance-inline-icon" /><b>{playing.length}</b> Disponíveis para Jogo</span>
          <span><RoundIcon kind="person" className="attendance-inline-icon" /><b>{presentOnly.length}</b> Só Presentes</span>
          <span><RoundIcon kind="absent" className="attendance-inline-icon" /><b>{absent.length}</b> Ausentes</span>
          <span><RoundIcon kind="meal" className="attendance-inline-icon" /><b>{dinnerPeople}</b> Pessoas na Janta</span>
        </div>
      </div>}
    </section>
  );
}

function MatchDayChecklist({ match }: { match: MatchDetail }) {
  const teamA = match.players.filter((player) => player.team === 'A');
  const teamB = match.players.filter((player) => player.team === 'B');
  const teamAGoalkeepers = teamA.filter((player) => player.roleInMatch === 'GOLEIRO').length;
  const teamBGoalkeepers = teamB.filter((player) => player.roleInMatch === 'GOLEIRO').length;
  const teamALine = teamA.filter((player) => player.roleInMatch !== 'GOLEIRO').length;
  const teamBLine = teamB.filter((player) => player.roleInMatch !== 'GOLEIRO').length;
  const checks = [
    { label: match.confirmationOpen ? 'Aberto para Confirmação' : 'Fechado para Confirmação', ok: Boolean(match.confirmationOpen) },
    { label: `${match.attendance.filter((item) => item.responseStatus === 'JOGAR').length} confirmado(s) para jogar`, ok: match.attendance.some((item) => item.responseStatus === 'JOGAR') },
    { label: `${teamA.length} x ${teamB.length} atletas escalados`, ok: teamA.length > 0 && teamB.length > 0 },
    { label: `Goleiros ${teamAGoalkeepers}/${teamBGoalkeepers}`, ok: teamAGoalkeepers === 1 && teamBGoalkeepers === 1 },
    { label: `Linha ${teamALine}/${teamBLine}`, ok: teamALine >= 6 && teamBLine >= 6 },
    { label: match.startedAt ? `Iniciado ${formatBrasiliaClock(match.startedAt)}` : 'Aguardando início oficial', ok: Boolean(match.startedAt) }
  ];

  return <section className="match-day-checklist">{checks.map((check) => <span className={`status ${check.ok ? 'open' : 'danger'}`} key={check.label}>{check.ok ? '✓' : '•'} {check.label}</span>)}</section>;
}

function MatchesPanel({ api, canCoordinate, users, matches, activeSeasonId, currentUserId, onReload, selectedMatch, setSelectedMatch }: { api: ApiClient; canCoordinate: boolean; users: User[]; matches: MatchListItem[]; activeSeasonId: string; currentUserId: string; onReload: () => Promise<void>; selectedMatch: MatchDetail | null; setSelectedMatch: (match: MatchDetail | null) => void }) {
  const [clockRunning, setClockRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [matchMessage, setMatchMessage] = useState('');

  useEffect(() => {
    if (!clockRunning || selectedMatch?.status === 'RUNNING') return;
    const limitSeconds = (selectedMatch?.availableMinutes ?? 60) * 60;
    const timer = window.setInterval(() => setSeconds((value) => Math.min(value + 1, limitSeconds)), 1000);
    return () => window.clearInterval(timer);
  }, [clockRunning, selectedMatch?.status, selectedMatch?.availableMinutes]);

  useEffect(() => {
    if (!selectedMatch) return;
    if (selectedMatch.status === 'RUNNING' && selectedMatch.startedAt) {
      const startedAt = new Date(selectedMatch.startedAt).getTime();
      const limitSeconds = (selectedMatch.availableMinutes ?? 60) * 60;
      const syncOfficialClock = () => setSeconds(Math.min(limitSeconds, Math.max(0, Math.floor((Date.now() - startedAt) / 1000))));
      syncOfficialClock();
      setClockRunning(true);
      const timer = window.setInterval(syncOfficialClock, 1000);
      return () => window.clearInterval(timer);
    }
    setClockRunning(selectedMatch.draftClockRunning ?? false);
    setSeconds(selectedMatch.draftClockSeconds ?? 0);
  }, [selectedMatch?.id, selectedMatch?.status, selectedMatch?.startedAt, selectedMatch?.availableMinutes, selectedMatch?.draftClockSeconds, selectedMatch?.draftClockRunning]);

  async function openMatch(id: string) {
    try {
      setMatchMessage('');
      setSelectedMatch(await api.request<MatchDetail>(`/matches/${id}`));
      setSeconds(0);
      setClockRunning(false);
      setCancelConfirm(false);
    } catch (error) {
      setMatchMessage(error instanceof Error ? error.message : 'Não foi possível abrir a súmula.');
    }
  }

  async function startSelectedMatch() {
    if (!selectedMatch) return;
    await api.request(`/matches/${selectedMatch.id}/start`, { method: 'POST' });
    await openMatch(selectedMatch.id);
    setClockRunning(true);
    await onReload();
  }

  async function cancelSelectedMatch() {
    if (!selectedMatch) return;
    await api.request(`/matches/${selectedMatch.id}/cancel`, { method: 'POST' });
    await openMatch(selectedMatch.id);
    await onReload();
  }

  async function openConfirmation(matchId: string) {
    setMatchMessage('Abrindo confirmação para os atletas...');
    await api.request(`/matches/${matchId}/open-confirmation`, { method: 'POST' });
    setMatchMessage('Aberto para Confirmação. Atletas já podem responder pelo card do jogo.');
    await onReload();
  }

  const sortedMatches = sortMatchesByOperationalRelevance(matches);

  const now = Date.now();
  const activeUserCount = Math.max(1, users.filter((user) => user.active !== false).length);
  const operationalMatches = sortedMatches.filter((match) => match.status !== 'CONFIRMED' && match.status !== 'CANCELLED');
  const nextMatch = operationalMatches.find((match) => getMatchStartTime(match) >= now) ?? operationalMatches[0];
  const finishedMatches = sortedMatches.filter((match) => match.id !== nextMatch?.id && match.status === 'CONFIRMED').sort((left, right) => getMatchStartTime(right) - getMatchStartTime(left)).slice(0, 8);

  function renderMatchCard(match: MatchListItem, variant: 'hero' | 'compact' = 'compact') {
    const date = matchDateParts(match);
    const playing = match.attendancePlaying ?? 0;
    const presentOnly = match.attendancePresentOnly ?? 0;
    const absent = match.attendanceAbsent ?? 0;
    const dinnerPeople = match.attendanceDinnerPeople ?? 0;
    const responses = playing + presentOnly + absent;
    const invitedCount = Math.max(1, match.invitedCount ?? activeUserCount);
    const pending = Math.max(invitedCount - responses, 0);
    const responsePercent = Math.min(100, Math.round((responses / invitedCount) * 100));
    const confirmationText = match.confirmationOpen ? 'Aberto para Confirmação' : 'Fechado para Confirmação';
    const confirmationReallyOpen = isConfirmationReallyOpen(match) && match.isInvited !== false;
    const myAttendanceStatus = match.myAttendanceStatus ?? null;
    const confirmationDetail = match.confirmationOpen
      ? `${attendanceStatusLabel(myAttendanceStatus)}${match.confirmationCloseAt ? ` • fecha ${formatBrasiliaTime(match.confirmationCloseAt)}` : ''}`
      : confirmationWindowHasEnded(match)
        ? `Janela encerrada${match.confirmationCloseAt ? ` em ${formatBrasiliaTime(match.confirmationCloseAt)}` : ''}.`
        : `Janela configurada: ${confirmationWindowScheduleLabel(match)}.`;

    return <article className={`match-card ${variant}`} key={match.id}><div className="match-date-badge"><b>{date.day}</b><span>{date.month}</span><em>{date.weekday} • {date.time}</em></div><div className="match-card-body"><div className="match-card-headline"><div><strong>{match.title}</strong><small>{matchRelativeLabel(match)} • {matchStatusLabel(match.status)}</small></div><div className="match-card-tags"><span className={`status ${match.confirmationOpen ? 'open' : 'danger'}`}>{confirmationText}</span><span className="status">{responsePercent}% respostas</span></div></div><div className="match-card-score"><span>{match.teamAName}</span><b>{match.teamAScore} x {match.teamBScore}</b><span>{match.teamBName}</span></div><div className="match-card-metrics"><span><b>{playing}</b> Confirmados</span><span><b>{presentOnly}</b> Só presença</span><span><b>{absent}</b> Ausentes</span><span><b>{pending}</b> Não responderam</span><span><b>{dinnerPeople}</b> Para o jantar</span></div><div className="match-card-progress"><i style={{ width: `${responsePercent}%` }} /></div><div className="match-card-footer"><small>{confirmationDetail}</small><div className="match-card-actions">{canCoordinate && match.status === 'DRAFT' && !match.confirmationOpen && !confirmationWindowHasEnded(match) && <button type="button" className="primary small" onClick={() => void openConfirmation(match.id)}>Abrir confirmação</button>}<button type="button" className={`primary small attendance-action-button ${myAttendanceStatus ? 'confirmed-action' : ''}`} title={confirmationReallyOpen ? myAttendanceStatus ? 'Clique para alterar sua confirmação.' : 'Abrir confirmação da rodada.' : match.status === 'DRAFT' ? 'Prazo de confirmação encerrado.' : 'Confirmação encerrada porque o jogo já começou.'} disabled={!confirmationReallyOpen} onClick={() => void openMatch(match.id)}>{attendanceActionLabel(myAttendanceStatus)}</button><button type="button" className="ghost" onClick={() => void openMatch(match.id)}>{canCoordinate ? 'Abrir súmula' : 'Ver jogo'}</button></div></div></div></article>;
  }

  return (
    <section className="card compact matches-report">
      <div className="card-head">
        <div>
          <h2>Central dos jogos</h2>
          <p className="muted">Home focada no que importa agora: próximo jogo e partidas já finalizadas. Agenda anual fica no menu Agenda.</p>
        </div>
        {canCoordinate && <OperationalMatchDialog api={api} users={users} activeSeasonId={activeSeasonId} onDone={onReload} />}
      </div>
      {matchMessage && <button className="alert" onClick={() => setMatchMessage('')}>{matchMessage}</button>}
      <div className="matches-dashboard">
        {nextMatch ? renderMatchCard(nextMatch, 'hero') : <EmptyState title="Sem próximo jogo operacional" text="Crie ou ajuste a agenda para exibir a próxima rodada aqui. Jogos finalizados continuam abaixo." />}
        <div className="match-section-grid">
          <section className="match-mini-section">
            <div className="card-head"><strong>Jogos finalizados</strong><span className="status">{finishedMatches.length}</span></div>
            <div className="match-mini-list">{finishedMatches.length ? finishedMatches.map((match) => renderMatchCard(match)) : <p className="muted">Quando uma súmula for confirmada, o jogo entra aqui como histórico útil. Jogos futuros além do próximo ficam somente na Agenda.</p>}</div>
          </section>
        </div>
      </div>
      {selectedMatch && (
        <div className="modal match-modal">
          <section className="match-modal-card">
            <div className="card-head">
              <div>
                <h2>{selectedMatch.title}</h2>
                <p className="muted">Súmula operacional • {formatDateOnly(selectedMatch.matchDate, 'sem data')} • {matchStatusLabel(selectedMatch.status)}</p>
              </div>
              <button type="button" className="ghost modal-close-button" aria-label="Fechar modal" title="Fechar" onClick={() => { setSelectedMatch(null); setCancelConfirm(false); }}>X</button>
            </div>

            <AttendancePanel
              api={api}
              match={selectedMatch}
              currentUserId={currentUserId}
              showRecentCard={!canCoordinate}
              onSaved={async () => {
                await openMatch(selectedMatch.id);
                await onReload();
              }}
            />
            {canCoordinate && selectedMatch.status === 'DRAFT' && (
              <ExistingLineupEditor
                api={api}
                match={selectedMatch}
                users={users}
                onSaved={async () => {
                  await openMatch(selectedMatch.id);
                  await onReload();
                }}
              />
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function ExistingLineupEditor({ api, match, users, onSaved }: { api: ApiClient; match: MatchDetail; users: User[]; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(match.status === 'DRAFT' && match.players.length === 0);
  const [title, setTitle] = useState(match.title);
  const [date, setDate] = useState(match.matchDate.slice(0, 10));
  const [refereeName, setRefereeName] = useState(match.refereeName ?? '');
  const [teamAName, setTeamAName] = useState(match.teamAName);
  const [teamBName, setTeamBName] = useState(match.teamBName);
  const [players, setPlayers] = useState<MatchDraftPlayer[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setTitle(match.title);
    setDate(match.matchDate.slice(0, 10));
    setRefereeName(match.refereeName ?? '');
    setTeamAName(match.teamAName);
    setTeamBName(match.teamBName);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const attendanceById = new Map(match.attendance.map((item) => [item.userId, item.responseStatus]));
    const seededPlayers = match.players.map((player, index) => {
      const user = usersById.get(player.userId);
      const confirmedToPlay = player.isGuest === true || attendanceById.get(player.userId) === 'JOGAR';
      const keepDrawnTeam = confirmedToPlay && (player.team === 'A' || player.team === 'B');
      const position = player.position ?? user?.position ?? 'MC';
      return {
        userId: player.userId,
        name: player.name,
        email: user?.email ?? '',
        position,
        team: keepDrawnTeam ? player.team as 'A' | 'B' : 'PRESENTE_SEM_JOGAR' as const,
        roleInMatch: keepDrawnTeam ? player.roleInMatch === 'GOLEIRO' ? 'GOLEIRO' as const : 'LINHA' as const : 'PRESENTE_SEM_JOGAR' as const,
        drawOrder: String(player.drawOrder ?? index + 1),
        startsOnBench: keepDrawnTeam && player.startsOnBench,
        present: confirmedToPlay,
        isGuest: player.isGuest === true,
        fieldLeft: player.fieldLeft ?? null,
        fieldTop: player.fieldTop ?? null
      };
    });
    setPlayers(seededPlayers);
    setMessage(`${seededPlayers.filter((player) => player.present).length} convocado(s) liberado(s) para o sorteio após confirmação.`);
  }, [match.id, match.title, match.matchDate, match.refereeName, match.teamAName, match.teamBName, match.players, match.attendance, users]);

  const teamA = players.filter((player) => player.team === 'A');
  const teamB = players.filter((player) => player.team === 'B');
  const presentOnly = players.filter((player) => player.team === 'PRESENTE_SEM_JOGAR');
  const confirmedForDraw = players.filter((player) => player.present);

  function payload() {
    const normalizedPlayers = normalizeDraftPlayersForLineup(players);
    const currentTeamA = normalizedPlayers.filter((player) => player.team === 'A');
    const currentTeamB = normalizedPlayers.filter((player) => player.team === 'B');
    return normalizedPlayers.map((player) => ({
      userId: player.userId,
      team: player.team,
      roleInMatch: player.team === 'PRESENTE_SEM_JOGAR' ? 'PRESENTE_SEM_JOGAR' : player.roleInMatch,
      drawOrder: player.drawOrder ? Number(player.drawOrder) : null,
      rotationOrder: player.team === 'A' ? currentTeamA.findIndex((item) => item.userId === player.userId) + 1 : player.team === 'B' ? currentTeamB.findIndex((item) => item.userId === player.userId) + 1 : null,
      startsOnBench: player.startsOnBench,
      present: player.team === 'A' || player.team === 'B'
    }));
  }

  function addPlayer(user: User, team: MatchDraftPlayer['team']) {
    const position = user.position ?? 'MC';
    setPlayers((list) => normalizeDraftPlayersForLineup([...list, { userId: user.id, name: user.name, email: user.email, position, team, roleInMatch: team === 'PRESENTE_SEM_JOGAR' ? 'PRESENTE_SEM_JOGAR' : position === 'GO' ? 'GOLEIRO' : 'LINHA', drawOrder: String(list.length + 1), startsOnBench: false, present: team !== 'PRESENTE_SEM_JOGAR' }]));
    setQuery('');
  }

  function updatePlayer(userId: string, patch: Partial<MatchDraftPlayer>) {
    setPlayers((list) => normalizeDraftPlayersForLineup(list.map((player) => player.userId === userId ? { ...player, ...patch } : player)));
  }

  function balanceTeamsByPosition() {
    setPlayers((list) => {
      const confirmed = list.filter((player) => player.present).map((player) => ({ ...player, team: 'A' as const, roleInMatch: player.position === 'GO' ? 'GOLEIRO' as const : 'LINHA' as const }));
      const waiting = list.filter((player) => !player.present).map((player) => ({ ...player, team: 'PRESENTE_SEM_JOGAR' as const, roleInMatch: 'PRESENTE_SEM_JOGAR' as const }));
      return [...drawBalancedTeams(confirmed), ...waiting];
    });
    setMessage('Sorteio concluído apenas com os atletas que confirmaram presença para jogar.');
  }

  function removePlayer(userId: string) {
    setPlayers((list) => list.filter((player) => player.userId !== userId));
  }

  function applyAttendanceLineup() {
    const attendanceById = new Map(match.attendance.map((item) => [item.userId, item.responseStatus]));
    setPlayers((list) => list.map((player) => ({
      ...player,
      team: 'PRESENTE_SEM_JOGAR',
      roleInMatch: 'PRESENTE_SEM_JOGAR',
      startsOnBench: false,
      present: player.isGuest === true || attendanceById.get(player.userId) === 'JOGAR'
    })));
    setMessage('Confirmações atualizadas. Faça o sorteio para formar os times.');
  }

  async function save() {
    await api.request(`/matches/${match.id}/lineup`, {
      method: 'PATCH',
      body: JSON.stringify({
        matchDate: date,
        title,
        refereeName: refereeName || null,
        teamAName,
        teamBName,
        players: payload()
      })
    });
    setMessage('Escalação salva com sucesso.');
    await onSaved();
  }

  function TeamRows({ team, rows }: { team: 'A' | 'B'; rows: MatchDraftPlayer[] }) {
    return (
      <div className={`team-list drawn-team team-${team.toLowerCase()}`}>
        <div className="team-title">
          <strong>{team === 'A' ? teamAName : teamBName}</strong>
          <span>{rows.length} atleta{rows.length === 1 ? '' : 's'}</span>
        </div>
        {rows.length === 0 ? (
          <small className="muted">Nenhum atleta neste time.</small>
        ) : rows.map((player, index) => (
          <div className="team-player draw-row" key={player.userId}>
            <span className="drag-handle">#{index + 1}</span>
            <div className="player-meta">
              <b>{player.name}</b>
              <small>{positionLabel(player.position)}{player.present ? '' : ' • não confirmado'}</small>
            </div>
            <select value={player.roleInMatch} onChange={(event) => updatePlayer(player.userId, { roleInMatch: event.target.value as MatchDraftPlayer['roleInMatch'] })}>
              <option value="LINHA">Linha</option>
              <option value="GOLEIRO">Goleiro</option>
            </select>
            <span className="chip">{player.startsOnBench ? 'Banco auto' : 'Titular auto'}</span>
            <button type="button" className="ghost small" onClick={() => removePlayer(player.userId)}>X</button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {!open && <button className="ghost small" onClick={() => setOpen(true)}>Editar escalação</button>}
      {open && (
        <section className="card team-builder">
          <div className="card-head">
            <div>
              <h2>Editar escalação</h2>
              <p className="muted">Revise atletas confirmados, rebalanceie os times e ajuste banco/goleiro antes de iniciar.</p>
            </div>
            <div className="actions">
              <button type="button" className="ghost" onClick={() => setOpen(false)}>Fechar</button>
            </div>
          </div>
          {message && <p className="status-line">{message}</p>}
          <div className="match-meta">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" />
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            <input value={refereeName} onChange={(event) => setRefereeName(event.target.value)} placeholder="Árbitro" />
            <input value={teamAName} onChange={(event) => setTeamAName(event.target.value)} />
            <input value={teamBName} onChange={(event) => setTeamBName(event.target.value)} />
          </div>
          <div className="draw-action">
            <div>
              <strong>Confirmações e escalação</strong>
              <small>{confirmedForDraw.length} confirmado(s) para jogar e {presentOnly.filter((player) => !player.present).length} pendente(s), ausente(s) ou apenas presente(s).</small>
            </div>
            <div className="actions">
              <button type="button" className="ghost" onClick={applyAttendanceLineup}>Atualizar confirmações</button>
              <button type="button" className="primary" onClick={balanceTeamsByPosition} disabled={confirmedForDraw.length < 2}>Sortear confirmados</button>
              <button type="button" className="primary" onClick={() => void save()} disabled={teamA.length === 0 || teamB.length === 0}>Salvar times</button>
            </div>
          </div>
          <div className="team-builder">
            <section>
              <div className="team-list roster-list">
                <div className="team-title">
                  <strong>Aguardando ou fora do jogo</strong>
                  <span>{presentOnly.length}</span>
                </div>
                {presentOnly.length === 0 ? <small className="muted">Todos os confirmados já foram sorteados.</small> : presentOnly.map((player) => (
                  <div className="team-player roster-row pending" key={player.userId}>
                    <div className="player-meta">
                      <b>{player.name}</b>
                      <small>{positionLabel(player.position)}</small>
                    </div>
                    <span className="chip">{player.present ? 'Confirmado, aguardando sorteio' : 'Sem confirmação para jogar'}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="team-board">
              <TeamRows team="A" rows={teamA} />
              <TeamRows team="B" rows={teamB} />
            </section>
          </div>
        </section>
      )}
    </>
  );
}

function MatchScoreEditor({ api, match, users, clockSeconds, clockRunning, onSaved }: { api: ApiClient; match: MatchDetail; users: User[]; clockSeconds: number; clockRunning: boolean; onSaved: () => Promise<void> }) {
  const initialEvents = match.status === 'CONFIRMED' ? match.events : match.draftEvents?.length ? match.draftEvents : match.events;
  const [teamAScore, setTeamAScore] = useState(match.status === 'CONFIRMED' ? match.teamAScore : match.draftTeamAScore ?? match.teamAScore);
  const [teamBScore, setTeamBScore] = useState(match.status === 'CONFIRMED' ? match.teamBScore : match.draftTeamBScore ?? match.teamBScore);
  const [events, setEvents] = useState<MatchEventDraft[]>(initialEvents.map((event) => ({ userId: event.userId, relatedUserId: event.relatedUserId, eventType: event.eventType as MatchEventDraft['eventType'], minute: event.minute, team: event.team, occurredAt: event.occurredAt ?? event.createdAt ?? null, createdAt: event.createdAt ?? null })));
  const [userId, setUserId] = useState(match.players[0]?.userId ?? users[0]?.id ?? '');
  const [relatedUserId, setRelatedUserId] = useState('');
  const [eventType, setEventType] = useState<MatchEventDraft['eventType']>('GOL');
  const [minute, setMinute] = useState(0);
  const [correctionReason, setCorrectionReason] = useState('');
  const [pendingQuickEvent, setPendingQuickEvent] = useState<{ userId: string; eventType: MatchEventDraft['eventType'] } | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState(match.draftSavedAt ? `Rascunho recuperado de ${formatBrasiliaTime(match.draftSavedAt)}.` : 'Rascunho pronto para autosave.');
  const clockRef = useRef({ clockSeconds, clockRunning });

  useEffect(() => {
    const recoveredEvents = match.status === 'CONFIRMED' ? match.events : match.draftEvents?.length ? match.draftEvents : match.events;
    setTeamAScore(match.status === 'CONFIRMED' ? match.teamAScore : match.draftTeamAScore ?? match.teamAScore);
    setTeamBScore(match.status === 'CONFIRMED' ? match.teamBScore : match.draftTeamBScore ?? match.teamBScore);
    setEvents(recoveredEvents.map((event) => ({ userId: event.userId, relatedUserId: event.relatedUserId, eventType: event.eventType as MatchEventDraft['eventType'], minute: event.minute, team: event.team, occurredAt: event.occurredAt ?? event.createdAt ?? null, createdAt: event.createdAt ?? null })));
    setUserId(match.players[0]?.userId ?? users[0]?.id ?? '');
    setCorrectionReason('');
    setPendingQuickEvent(null);
    setAutosaveStatus(match.draftSavedAt ? `Rascunho recuperado de ${formatBrasiliaTime(match.draftSavedAt)}.` : 'Rascunho pronto para autosave.');
  }, [match.id]);

  useEffect(() => {
    clockRef.current = { clockSeconds, clockRunning };
  }, [clockSeconds, clockRunning]);

  useEffect(() => {
    if (match.status === 'CONFIRMED' || match.status === 'CANCELLED') return;
    setAutosaveStatus('Salvando rascunho no banco...');
    const timer = window.setTimeout(() => {
      void api.request<{ draftSavedAt: string }>(`/matches/${match.id}/draft`, { method: 'PATCH', body: JSON.stringify({ teamAScore, teamBScore, events, clockSeconds: clockRef.current.clockSeconds, clockRunning: clockRef.current.clockRunning }) })
        .then((saved) => setAutosaveStatus(`Rascunho salvo em ${formatBrasiliaTime(saved.draftSavedAt)}.`))
        .catch((err) => setAutosaveStatus(err instanceof Error ? err.message : 'Falha ao salvar rascunho.'));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [api, match.id, match.status, teamAScore, teamBScore, events]);

  function addEvent() {
    if (!userId) return;
    const selectedPlayer = match.players.find((player) => player.userId === userId);
    if (!selectedPlayer || selectedPlayer.team === 'PRESENTE_SEM_JOGAR') return;
    const eventTeam = selectedPlayer.team === 'A' ? 'A' : 'B';
    setEvents((list) => [...list, { userId, relatedUserId: relatedUserId || null, eventType, minute, team: eventTeam, occurredAt: new Date().toISOString() }]);
  }
  function addQuickEvent(player: MatchDetail['players'][number], quickEventType: MatchEventDraft['eventType']) {
    if (player.team === 'PRESENTE_SEM_JOGAR') return;
    const eventTeam = player.team === 'A' ? 'A' : 'B';
    const eventMinute = match.status === 'CONFIRMED' ? minute : Math.max(0, Math.floor(clockRef.current.clockSeconds / 60));
    setEvents((list) => [...list, { userId: player.userId, relatedUserId: null, eventType: quickEventType, minute: eventMinute, team: eventTeam, occurredAt: new Date().toISOString() }]);
    if (quickEventType === 'GOL') {
      if (eventTeam === 'A') setTeamAScore((value) => value + 1);
      if (eventTeam === 'B') setTeamBScore((value) => value + 1);
    }
    if (quickEventType === 'GOL_CONTRA') {
      if (eventTeam === 'A') setTeamBScore((value) => value + 1);
      if (eventTeam === 'B') setTeamAScore((value) => value + 1);
    }
  }

  function confirmQuickEvent() {
    if (!pendingQuickEvent) return;
    const player = playablePlayers.find((item) => item.userId === pendingQuickEvent.userId);
    if (!player) return;
    addQuickEvent(player, pendingQuickEvent.eventType);
    setPendingQuickEvent(null);
  }

  async function submit() {
    const path = match.status === 'CONFIRMED' ? `/matches/${match.id}/correct` : `/matches/${match.id}/submit`;
    await api.request(path, { method: 'POST', body: JSON.stringify(match.status === 'CONFIRMED' ? { teamAScore, teamBScore, events, reason: correctionReason } : { teamAScore, teamBScore, events }) });
    await onSaved();
  }

  async function confirm() {
    await api.request(`/matches/${match.id}/confirm`, { method: 'POST' });
    await onSaved();
  }

  const selectedEventPlayer = match.players.find((player) => player.userId === userId);
  const playablePlayers = match.players.filter((player) => player.team !== 'PRESENTE_SEM_JOGAR');
  const relatedPlayers = playablePlayers.filter((player) => player.userId !== userId && player.team === selectedEventPlayer?.team);
  const eventLog = [
    ...(match.startedAt ? [{ key: 'start', at: match.startedAt, label: 'Início do jogo', detail: 'Cronômetro oficial iniciado' }] : []),
    ...events.map((item, index) => {
      const player = match.players.find((current) => current.userId === item.userId);
      return { key: `${item.userId}-${item.eventType}-${index}`, at: item.occurredAt ?? item.createdAt ?? null, label: eventLabel(item.eventType), detail: `${player?.name ?? 'Atleta'} • ${item.minute}' • Time ${item.team ?? '—'}` };
    }),
    ...((match.endedAt || match.status === 'SUBMITTED' || match.status === 'CONFIRMED') ? [{ key: 'end', at: match.endedAt ?? null, label: 'Final do jogo', detail: match.endedAt ? 'Súmula encerrada' : 'Será registrado ao submeter' }] : [])
  ].sort((left, right) => {
    const leftTime = left.at ? new Date(left.at).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.at ? new Date(right.at).getTime() : Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  });

  const usersById = new Map(users.map((item) => [item.id, item]));
  const boardScoreA = match.status === 'CONFIRMED' ? match.teamAScore : teamAScore;
  const boardScoreB = match.status === 'CONFIRMED' ? match.teamBScore : teamBScore;
  const clockLabel = `${String(Math.floor(clockSeconds / 60)).padStart(2, '0')}:${String(clockSeconds % 60).padStart(2, '0')}`;
  const pendingQuickPlayer = pendingQuickEvent ? playablePlayers.find((item) => item.userId === pendingQuickEvent.userId) ?? null : null;

  function playerBoardNumber(player: MatchDetail['players'][number], fallbackIndex: number) {
    return player.rotationOrder ?? player.drawOrder ?? fallbackIndex + 1;
  }

  function playersForTeam(team: 'A' | 'B') {
    return playablePlayers.filter((player) => player.team === team).sort((left, right) => (left.rotationOrder ?? left.drawOrder ?? 999) - (right.rotationOrder ?? right.drawOrder ?? 999));
  }

  function startersForTeam(team: 'A' | 'B') {
    return playersForTeam(team).filter((player) => !player.startsOnBench);
  }

  function reservesForTeam(team: 'A' | 'B') {
    return playersForTeam(team).filter((player) => player.startsOnBench);
  }

  function fieldPlayers(team: 'A' | 'B') {
    return assignPlayersToTacticalSlots(team, startersForTeam(team));
  }

  function rosterRow(player: MatchDetail['players'][number], team: 'A' | 'B', index: number, reserve = false) {
    const user = usersById.get(player.userId);
    const label = user?.position ? positionLabel(user.position) : player.roleInMatch === 'GOLEIRO' ? 'GO • Goleiro' : 'MC • Meio campo';
    return (
      <div className={`ops-roster-row ${reserve ? 'is-reserve' : ''} ${pendingQuickEvent?.userId === player.userId ? 'is-armed' : ''}`} key={`${team}-${player.userId}`}>
        <div className="ops-roster-avatar">{user?.avatarDataUrl ? <img src={user.avatarDataUrl} alt={player.name} /> : <span>{player.name.slice(0, 1)}</span>}</div>
        <div className="ops-roster-copy">
          <strong>#{playerBoardNumber(player, index)} {player.name}</strong>
          <small>{label}{player.roleInMatch === 'GOLEIRO' ? ' • Goleiro' : ''}</small>
        </div>
        <div className="ops-roster-actions">
          <button type="button" className="ops-icon-card is-yellow" title="Cartão amarelo" onClick={() => setPendingQuickEvent({ userId: player.userId, eventType: 'CARTAO_AMARELO' })}>🟨</button>
          <button type="button" className="ops-icon-card is-red" title="Cartão vermelho" onClick={() => setPendingQuickEvent({ userId: player.userId, eventType: 'CARTAO_VERMELHO' })}>🟥</button>
          <button type="button" className="ops-icon-card is-goal" title="Gol" onClick={() => setPendingQuickEvent({ userId: player.userId, eventType: 'GOL' })}>⚽</button>
          <button type="button" className="ops-icon-card is-more" title="Assistência" onClick={() => setPendingQuickEvent({ userId: player.userId, eventType: 'ASSISTENCIA' })}>A</button>
        </div>
      </div>
    );
  }

  return (
    <div className="score-editor match-control-board">
      <div className="match-control-top">
        <div className="match-time-card">
          <span>TEMPO DE JOGO</span>
          <strong className="match-time-card-clock">{clockLabel}</strong>
          <div className="match-time-card-score">
            <div><b>{match.teamAName}</b><small>{boardScoreA}</small></div>
            <span>-</span>
            <div><b>{match.teamBName}</b><small>{boardScoreB}</small></div>
          </div>
        </div>
        <div className="match-time-sidecard">
          <strong>{match.status === 'CONFIRMED' ? 'Correção auditada da súmula' : 'Fechamento da súmula'}</strong>
          {match.status !== 'CONFIRMED' && <small className="muted">{autosaveStatus}</small>}
          <small className="muted">Clique nos cartões dos atletas para armar um evento rápido. A confirmação final entra no log da súmula.</small>
        </div>
      </div>

      {pendingQuickEvent && pendingQuickPlayer && <div className="match-command-banner"><strong>{eventLabel(pendingQuickEvent.eventType)}</strong><span>{pendingQuickPlayer.name} • Time {pendingQuickPlayer.team}</span><div className="actions"><button type="button" className="primary small" onClick={confirmQuickEvent}>Confirmar</button><button type="button" className="ghost small" onClick={() => setPendingQuickEvent(null)}>Cancelar</button></div></div>}

      <div className="match-ops-arena">
        <section className="ops-roster-column">
          <div className="ops-roster-head team-a-head"><strong>{match.teamAName}</strong><span>Titulares</span></div>
          <div className="ops-roster-list">
            {startersForTeam('A').length ? startersForTeam('A').map((player, index) => rosterRow(player, 'A', index)) : <small className="muted">Sem titulares definidos.</small>}
          </div>
          <div className="ops-roster-head reserve-head"><strong>Banco de reservas</strong><span>{reservesForTeam('A').length}</span></div>
          <div className="ops-roster-list reserve-list">
            {reservesForTeam('A').length ? reservesForTeam('A').map((player, index) => rosterRow(player, 'A', index, true)) : <small className="muted">Sem reservas neste time.</small>}
          </div>
        </section>

        <section className="ops-pitch-card">
          <div className="ops-pitch-surface">
            <div className="ops-pitch-center-circle" />
            <div className="ops-pitch-midline" />
            <div className="ops-pitch-box ops-pitch-box-a" />
            <div className="ops-pitch-box ops-pitch-box-b" />
            {fieldPlayers('A').map(({ player, slot }, index) => <div className="ops-pitch-player team-a-player" key={`pitch-a-${player.userId}`} style={{ left: `${slot.left}%`, top: `${slot.top}%` }}><span>{playerBoardNumber(player, index)}</span><small>{player.name.split(' ')[0]}</small></div>)}
            {fieldPlayers('B').map(({ player, slot }, index) => <div className="ops-pitch-player team-b-player" key={`pitch-b-${player.userId}`} style={{ left: `${slot.left}%`, top: `${slot.top}%` }}><span>{playerBoardNumber(player, index)}</span><small>{player.name.split(' ')[0]}</small></div>)}
          </div>
        </section>

        <section className="ops-roster-column">
          <div className="ops-roster-head team-b-head"><strong>{match.teamBName}</strong><span>Titulares</span></div>
          <div className="ops-roster-list">
            {startersForTeam('B').length ? startersForTeam('B').map((player, index) => rosterRow(player, 'B', index)) : <small className="muted">Sem titulares definidos.</small>}
          </div>
          <div className="ops-roster-head reserve-head"><strong>Banco de reservas</strong><span>{reservesForTeam('B').length}</span></div>
          <div className="ops-roster-list reserve-list">
            {reservesForTeam('B').length ? reservesForTeam('B').map((player, index) => rosterRow(player, 'B', index, true)) : <small className="muted">Sem reservas neste time.</small>}
          </div>
        </section>
      </div>

      <div className="match-control-bottom">
        <section className="match-control-feed">
          <div className="match-control-feed-head">
            <strong>Fechamento da súmula</strong>
            <small>{match.status === 'CONFIRMED' ? 'Modo auditoria' : autosaveStatus}</small>
          </div>
          <div className="event-log ops-event-log">{eventLog.length === 0 ? <small className="muted">Sem eventos registrados ainda.</small> : eventLog.map((item) => <span key={item.key}><b>{formatBrasiliaClock(item.at)}</b><small>{item.label} • {item.detail}</small></span>)}</div>
          <div className="chips">{events.map((item, index) => <button className="chip" key={`${item.userId}-${item.eventType}-${index}`} onClick={() => setEvents((list) => list.filter((_, itemIndex) => itemIndex !== index))}>{item.minute}' {eventLabel(item.eventType)}</button>)}</div>
        </section>

        <section className="match-control-actions">
          <div className="score-inputs"><input type="number" min="0" value={teamAScore} onChange={(event) => setTeamAScore(Number(event.target.value))} /><span>x</span><input type="number" min="0" value={teamBScore} onChange={(event) => setTeamBScore(Number(event.target.value))} /></div>
          {match.status === 'CONFIRMED' && <input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Motivo da correção: gol/assistência/cartão lançado errado" required minLength={5} />}
          <div className="actions match-submit-actions"><button className="primary" onClick={submit} disabled={match.status === 'CONFIRMED' && correctionReason.trim().length < 5}>{match.status === 'CONFIRMED' ? 'Salvar correção' : 'Salvar súmula'}</button>{match.status === 'SUBMITTED' && <button className="ghost" onClick={confirm}>Confirmar e pontuar</button>}</div>
          <details className="advanced-score"><summary>Lançamento manual avançado</summary><div className="event-form"><select value={eventType} onChange={(event) => setEventType(event.target.value as MatchEventDraft['eventType'])}><option value="GOL">Gol</option><option value="GOL_CONTRA">Gol contra</option><option value="ASSISTENCIA">Assistência</option><option value="CARTAO_AMARELO">Cartão amarelo</option><option value="CARTAO_VERMELHO">Cartão vermelho</option><option value="CARTAO_AZUL">Cartão azul</option></select><select value={userId} onChange={(event) => { setUserId(event.target.value); setRelatedUserId(''); }}>{playablePlayers.map((player) => <option key={player.userId} value={player.userId}>{player.name} • Time {player.team}</option>)}</select><select value={relatedUserId} onChange={(event) => setRelatedUserId(event.target.value)}><option value="">Sem relacionado</option>{relatedPlayers.map((player) => <option key={player.userId} value={player.userId}>{player.name}</option>)}</select><input type="number" min="0" max="180" value={minute} onChange={(event) => setMinute(Number(event.target.value))} /><span className="status open">Time {selectedEventPlayer?.team ?? '—'}</span><button type="button" className="ghost" onClick={addEvent}>Adicionar</button></div></details>
        </section>
      </div>
    </div>
  );
}

function CorrectionHistory({ corrections }: { corrections: MatchCorrection[] }) {
  if (!corrections.length) return <div className="empty-state"><strong>Sem correções auditadas</strong><span>Depois de confirmada, qualquer ajuste de placar/eventos aparece aqui com motivo, responsável e data.</span></div>;
  return <div className="audit-box"><strong>Histórico de correções</strong>{corrections.map((item) => <article className="row-card" key={item.id}><strong>{item.previousTeamAScore} x {item.previousTeamBScore} → {item.newTeamAScore} x {item.newTeamBScore}</strong><span>{item.correctedByName}</span><small>{new Date(item.createdAt).toLocaleString('pt-BR')} • {item.reason}</small><small>Eventos: {item.previousEvents.length} → {item.newEvents.length}</small></article>)}</div>;
}

function ScheduleManagerPanel({ api, matches, activeSeasonId, onDone }: { api: ApiClient; matches: MatchListItem[]; activeSeasonId: string; onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<ScheduleMode>('recurring');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('Futebol de quarta');
  const [manualDate, setManualDate] = useState(todayInputValue());
  const [rangeStart, setRangeStart] = useState(todayInputValue());
  const [rangeEnd, setRangeEnd] = useState(addDaysInput(90));
  const [weekday, setWeekday] = useState(3);
  const [scheduledStart, setScheduledStart] = useState('20:00');
  const [scheduledEnd, setScheduledEnd] = useState('21:00');
  const [confirmationHours, setConfirmationHours] = useState(48);
  const [confirmationCloseHours, setConfirmationCloseHours] = useState(2);
  const [teamAName, setTeamAName] = useState('Time A');
  const [teamBName, setTeamBName] = useState('Time B');
  const [tableFilters, setTableFilters] = useState({ date: '', title: '', time: '', status: '', window: '', attendance: '' });
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const scheduledMatches = [...matches].filter((match) => match.status === 'DRAFT').sort((left, right) => `${left.matchDate}${left.scheduledStart ?? ''}`.localeCompare(`${right.matchDate}${right.scheduledStart ?? ''}`));

  useEffect(() => {
    setFilterSearch('');
  }, [activeFilterMenu]);

  function loadForEdit(match: MatchListItem) {
    setEditingId(match.id);
    setMode('manual');
    setEditorOpen(true);
    setTitle(match.title);
    setManualDate(match.matchDate.slice(0, 10));
    setScheduledStart(match.scheduledStart?.slice(0, 5) ?? '20:00');
    setScheduledEnd(match.scheduledEnd?.slice(0, 5) ?? '21:00');
    setTeamAName(match.teamAName);
    setTeamBName(match.teamBName);
    setConfirmationHours(match.confirmationOpensHoursBefore ?? 48);
    setConfirmationCloseHours(match.confirmationClosesHoursBefore ?? 2);
    setMessage(`Editando ${match.title}. Ajuste abertura e fechamento conforme a regra do grupo e salve para recalcular a janela de confirmação.`);
  }

  function updateConfirmationHours(value: number) {
    const nextOpen = Math.max(1, Math.min(336, value));
    setConfirmationHours(nextOpen);
    setConfirmationCloseHours((current) => Math.min(current, nextOpen - 1));
  }

  function updateConfirmationCloseHours(value: number) {
    setConfirmationCloseHours(Math.max(0, Math.min(value, confirmationHours - 1)));
  }

  function toggleFilterMenu(key: string) {
    setActiveFilterMenu((current) => current === key ? null : key);
  }

  function confirmationStatus(match: MatchListItem) {
    if (match.confirmationOpen) return 'Aberto para confirmação';
    if (confirmationWindowHasEnded(match)) return 'Janela encerrada';
    return 'Fechado para confirmação';
  }

  function filterValue(match: MatchListItem, key: keyof typeof tableFilters) {
    if (key === 'date') return matchDateLabel(match);
    if (key === 'title') return `${match.title} • ${match.teamAName} x ${match.teamBName}`;
    if (key === 'time') return `${match.scheduledStart?.slice(0, 5) ?? '20:00'} -> ${match.scheduledEnd?.slice(0, 5) ?? '21:00'}`;
    if (key === 'status') return confirmationStatus(match);
    if (key === 'window') return `${confirmationWindowScheduleLabel(match)} • ${match.confirmationOpensHoursBefore ?? 48}h -> ${match.confirmationClosesHoursBefore ?? 2}h antes`;
    return `${match.attendancePlaying ?? 0} jogar • ${match.attendancePresentOnly ?? 0} só presença • ${match.attendanceAbsent ?? 0} ausente(s)`;
  }

  function filterOptions(key: keyof typeof tableFilters) {
    return buildTableFilterOptions(scheduledMatches.map((match) => filterValue(match, key)));
  }

  const filteredScheduledMatches = useMemo(() => scheduledMatches.filter((match) => Object.entries(tableFilters).every(([key, value]) => !value || normalizeTableFilterValue(filterValue(match, key as keyof typeof tableFilters)).includes(normalizeTableFilterValue(value)))), [scheduledMatches, tableFilters]);

  async function saveSchedule(event: FormEvent) {
    event.preventDefault();
    setMessage('Salvando agenda...');
    if (editingId) {
      await api.request(`/matches/${editingId}/schedule`, { method: 'PATCH', body: JSON.stringify({ matchDate: manualDate, title, scheduledStart, scheduledEnd, confirmationOpensHoursBefore: confirmationHours, confirmationClosesHoursBefore: confirmationCloseHours, teamAName, teamBName }) });
      setMessage('Jogo pré-definido atualizado.');
      setEditingId('');
    } else if (mode === 'manual') {
      await api.request('/matches/schedule/manual', { method: 'POST', body: JSON.stringify({ seasonId: activeSeasonId || null, matchDate: manualDate, title, scheduledStart, scheduledEnd, confirmationOpensHoursBefore: confirmationHours, confirmationClosesHoursBefore: confirmationCloseHours, teamAName, teamBName }) });
      setMessage('Jogo avulso criado e disponível na lista.');
    } else {
      const result = await api.request<{ generated: number; skipped: number }>('/matches/schedule/recurring', { method: 'POST', body: JSON.stringify({ seasonId: activeSeasonId || null, weekday, startDate: rangeStart, endDate: rangeEnd, title, scheduledStart, scheduledEnd, confirmationOpensHoursBefore: confirmationHours, confirmationClosesHoursBefore: confirmationCloseHours, teamAName, teamBName }) });
      setMessage(`${result.generated} jogo(s) gerado(s). ${result.skipped} data(s) já existiam e foram preservadas.`);
    }
    await onDone();
    setEditorOpen(false);
  }

  async function removeScheduledMatch(matchId: string) {
    setMessage('Removendo jogo pré-definido...');
    await api.request(`/matches/${matchId}/schedule`, { method: 'DELETE' });
    setMessage('Jogo removido da agenda.');
    await onDone();
  }

  async function openConfirmation(matchId: string) {
    setMessage('Abrindo confirmação para os atletas...');
    await api.request(`/matches/${matchId}/open-confirmation`, { method: 'POST' });
    setMessage('Aberto para Confirmação. Atletas verão o aviso de fácil acesso ao entrar.');
    await onDone();
  }

  return (
    <>
      <div className="home-stack standard-page schedule-page">
        <section className="card compact standard-page-header">
          <div className="card-head">
            <div>
              <h2>Agenda</h2>
              <p className="muted">Agendamentos e janelas de confirmação dos jogos.</p>
            </div>
          </div>
          {message && <p className="status-line">{message}</p>}
          <div className="schedule-create-actions">
            <button type="button" className="primary" onClick={() => { setMode('recurring'); setEditingId(''); setEditorOpen(true); }}>Recorrente</button>
            <button type="button" className="ghost" onClick={() => { setMode('manual'); setEditingId(''); setEditorOpen(true); }}>Data específica</button>
          </div>
        </section>
        <section className="card compact schedule-page-content">
          <div className="championship-wrap management-table-wrap schedule-table-wrap">
            <table className="championship-table management-table schedule-table">
              <thead>
                <tr>
                  <th><TableFilterHeader label="Data" menuKey="schedule-date" currentValue={tableFilters.date} options={filterOptions('date')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar data" onToggle={toggleFilterMenu} onSearchChange={setFilterSearch} onSelect={(value) => { setTableFilters((current) => ({ ...current, date: value })); setActiveFilterMenu(null); }} onClear={() => { setTableFilters((current) => ({ ...current, date: '' })); setActiveFilterMenu(null); }} /></th>
                  <th><TableFilterHeader label="Jogo" menuKey="schedule-title" currentValue={tableFilters.title} options={filterOptions('title')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar jogo" onToggle={toggleFilterMenu} onSearchChange={setFilterSearch} onSelect={(value) => { setTableFilters((current) => ({ ...current, title: value })); setActiveFilterMenu(null); }} onClear={() => { setTableFilters((current) => ({ ...current, title: '' })); setActiveFilterMenu(null); }} /></th>
                  <th><TableFilterHeader label="Horário" menuKey="schedule-time" currentValue={tableFilters.time} options={filterOptions('time')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar horário" onToggle={toggleFilterMenu} onSearchChange={setFilterSearch} onSelect={(value) => { setTableFilters((current) => ({ ...current, time: value })); setActiveFilterMenu(null); }} onClear={() => { setTableFilters((current) => ({ ...current, time: '' })); setActiveFilterMenu(null); }} /></th>
                  <th><TableFilterHeader label="Confirmação" menuKey="schedule-status" currentValue={tableFilters.status} options={filterOptions('status')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar status" onToggle={toggleFilterMenu} onSearchChange={setFilterSearch} onSelect={(value) => { setTableFilters((current) => ({ ...current, status: value })); setActiveFilterMenu(null); }} onClear={() => { setTableFilters((current) => ({ ...current, status: '' })); setActiveFilterMenu(null); }} /></th>
                  <th><TableFilterHeader label="Janela" menuKey="schedule-window" currentValue={tableFilters.window} options={filterOptions('window')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar janela" onToggle={toggleFilterMenu} onSearchChange={setFilterSearch} onSelect={(value) => { setTableFilters((current) => ({ ...current, window: value })); setActiveFilterMenu(null); }} onClear={() => { setTableFilters((current) => ({ ...current, window: '' })); setActiveFilterMenu(null); }} /></th>
                  <th><TableFilterHeader label="Presenças" menuKey="schedule-attendance" currentValue={tableFilters.attendance} options={filterOptions('attendance')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar presença" onToggle={toggleFilterMenu} onSearchChange={setFilterSearch} onSelect={(value) => { setTableFilters((current) => ({ ...current, attendance: value })); setActiveFilterMenu(null); }} onClear={() => { setTableFilters((current) => ({ ...current, attendance: '' })); setActiveFilterMenu(null); }} /></th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredScheduledMatches.length === 0 ? <tr><td colSpan={7} className="table-empty-cell">Nenhum jogo pré-definido encontrado com os filtros atuais.</td></tr> : filteredScheduledMatches.map((match) => <tr key={match.id}>
                  <td>{matchDateLabel(match)}</td>
                  <td className="management-main-cell schedule-title-cell"><strong>{match.title}</strong><small>{match.teamAName} x {match.teamBName}</small></td>
                  <td>{match.scheduledStart?.slice(0, 5) ?? '20:00'} {'->'} {match.scheduledEnd?.slice(0, 5) ?? '21:00'}</td>
                  <td><span className={`status ${match.confirmationOpen ? 'open' : confirmationWindowHasEnded(match) ? 'danger' : 'draft'}`}>{confirmationStatus(match)}</span></td>
                  <td className="schedule-detail-cell"><strong>{confirmationWindowScheduleLabel(match)}</strong><small>Janela {match.confirmationOpensHoursBefore ?? 48}h {'->'} {match.confirmationClosesHoursBefore ?? 2}h antes</small></td>
                  <td>{match.attendancePlaying ?? 0} jogar<br />{match.attendancePresentOnly ?? 0} só presença<br />{match.attendanceAbsent ?? 0} ausente(s)</td>
                  <td><div className="actions compact-actions"><button type="button" className="ghost" onClick={() => loadForEdit(match)}>Editar</button>{!match.confirmationOpen && !confirmationWindowHasEnded(match) && <button type="button" className="primary small" onClick={() => void openConfirmation(match.id)}>Abrir confirmação</button>}<button type="button" className="ghost" onClick={() => void removeScheduledMatch(match.id)}>Remover</button></div></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </div>
        {editorOpen && <div className="modal schedule-editor-layer">
          <form className="card modal-card wide schedule-form schedule-editor-card" onSubmit={saveSchedule}>
            <div className="card-head">
              <div><h2>{editingId ? 'Editar agendamento' : mode === 'recurring' ? 'Agendamento recorrente' : 'Agendamento em data específica'}</h2></div>
              <button type="button" className="ghost modal-close-button" aria-label="Fechar formulário" title="Fechar" onClick={() => setEditorOpen(false)}>X</button>
            </div>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título do jogo" required />
            {mode === 'recurring' && !editingId ? <div className="match-meta">
              <select value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>{weekdayOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
              <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
            </div> : <input type="date" value={manualDate} onChange={(event) => setManualDate(event.target.value)} />}
            <div className="match-meta">
              <input type="time" value={scheduledStart} onChange={(event) => setScheduledStart(event.target.value)} />
              <input type="time" value={scheduledEnd} onChange={(event) => setScheduledEnd(event.target.value)} />
              <label className="field-row"><span>Abre antes (h)</span><input type="number" min="1" max="336" value={confirmationHours} onChange={(event) => updateConfirmationHours(Number(event.target.value))} aria-label="Horas antes do jogo para abrir confirmação" /></label>
              <label className="field-row"><span>Fecha antes (h)</span><input type="number" min="0" max={Math.max(0, confirmationHours - 1)} value={confirmationCloseHours} onChange={(event) => updateConfirmationCloseHours(Number(event.target.value))} aria-label="Horas antes do jogo para fechar confirmação" /></label>
              <input value={teamAName} onChange={(event) => setTeamAName(event.target.value)} placeholder="Time A" />
              <input value={teamBName} onChange={(event) => setTeamBName(event.target.value)} placeholder="Time B" />
            </div>
            <button className="primary">{editingId ? 'Salvar edição' : mode === 'recurring' ? 'Gerar jogos recorrentes' : 'Criar jogo avulso'}</button>
          </form>
        </div>}
    </>
  );
}

function OperationalMatchDialog({ api, users, activeSeasonId, onDone, controlledOpen, onOpenChange, hideTrigger = false }: { api: ApiClient; users: User[]; activeSeasonId: string; onDone: () => Promise<void>; controlledOpen?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [creationStep, setCreationStep] = useState<'details' | 'players'>('details');
  const [draftMatchId, setDraftMatchId] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [title, setTitle] = useState('Futebol de quarta');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'WEEKLY'>('WEEKLY');
  const [recurringWeekday, setRecurringWeekday] = useState(weekdayFromInputDate(todayInputValue()));
  const [recurringEndDate, setRecurringEndDate] = useState(addDaysInput(90));
  const [refereeName, setRefereeName] = useState('');
  const [teamAName, setTeamAName] = useState('Time A');
  const [teamBName, setTeamBName] = useState('Time B');
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState<MatchDraftPlayer[]>([]);
  const [draggedUserId, setDraggedUserId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPosition, setGuestPosition] = useState<AthletePosition>('MC');

  const assignedIds = new Set(players.map((player) => player.userId));
  const search = query.trim().toLowerCase();
  const searchResults = search.length < 3 ? [] : users.filter((user) => user.active !== false && user.role === 'ATLETA' && !assignedIds.has(user.id) && `${user.name} ${user.email}`.toLowerCase().includes(search)).slice(0, 8);
  const recurringWeekdayLabel = weekdayOptions.find((item) => item.value === recurringWeekday)?.label ?? 'Quarta-feira';

  useEffect(() => {
    if (isRecurring && recurringEndDate < date) setRecurringEndDate(date);
  }, [date, isRecurring, recurringEndDate]);

  function selectedPlayersPayload(list = players) {
    return list.map((player) => ({
      userId: player.userId,
      name: player.name,
      position: player.position,
      isGuest: player.isGuest === true,
      team: 'PRESENTE_SEM_JOGAR' as const,
      roleInMatch: 'PRESENTE_SEM_JOGAR' as const,
      drawOrder: player.drawOrder ? Number(player.drawOrder) : null,
      rotationOrder: null,
      startsOnBench: false,
      present: false
    }));
  }

  async function saveLineup() {
    if (!draftMatchId) return;
    await api.request(`/matches/${draftMatchId}/lineup`, { method: 'PATCH', body: JSON.stringify({ matchDate: date, title, refereeName: refereeName || null, teamAName, teamBName, players: selectedPlayersPayload() }) });
  }

  function openCreation() {
    setCreationStep('details');
    setDraftMatchId('');
    setPlayers([]);
    setSaveStatus('');
    setOpen(true);
  }

  async function cancelCreation() {
    const abandonedDraftId = draftMatchId;
    setOpen(false);
    setCreationStep('details');
    setDraftMatchId('');
    setPlayers([]);
    setSaveStatus('');
    if (!abandonedDraftId) return;
    try {
      await api.request(`/matches/${abandonedDraftId}`, { method: 'DELETE' });
      await onDone();
    } catch {
      await onDone();
    }
  }

  async function advanceToPlayers() {
    if (title.trim().length < 2 || !date) {
      setSaveStatus('Informe o tipo e a data do jogo antes de avançar.');
      return;
    }
    if (isRecurring && weekdayFromInputDate(date) !== recurringWeekday) {
      setSaveStatus('A data base precisa cair no mesmo dia escolhido para a recorrência.');
      return;
    }
    try {
      setSaveStatus('Salvando detalhes do jogo...');
      if (draftMatchId) {
        await saveLineup();
      } else {
        const created = await api.request<{ id: string }>('/matches', { method: 'POST', body: JSON.stringify({ seasonId: activeSeasonId || null, matchDate: date, title, refereeName: refereeName || null, teamAName, teamBName, players: [] }) });
        setDraftMatchId(created.id);
      }
      setCreationStep('players');
      setSaveStatus('Detalhes salvos. Selecione os atletas que deverão confirmar presença.');
      await onDone();
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : 'Não foi possível salvar os detalhes do jogo.');
    }
  }

  function addParticipant(user: User) {
    const position = user.position ?? 'MC';
    setPlayers((list) => [...list, { userId: user.id, name: user.name, email: user.email, position, team: 'PRESENTE_SEM_JOGAR', roleInMatch: 'PRESENTE_SEM_JOGAR', drawOrder: String(list.length + 1), startsOnBench: false, present: true }]);
    setQuery('');
  }

  function addGuestParticipant() {
    const normalizedName = guestName.trim().replace(/\s+/g, ' ');
    if (normalizedName.length < 2) {
      setSaveStatus('Informe o nome do suplente convidado antes de incluir no sorteio.');
      return;
    }
    const guestId = `guest:${window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`}`;
    setPlayers((list) => [...list, {
      userId: guestId,
      name: normalizedName,
      email: '',
      position: guestPosition,
      team: 'PRESENTE_SEM_JOGAR',
      roleInMatch: 'PRESENTE_SEM_JOGAR',
      drawOrder: String(list.length + 1),
      startsOnBench: false,
      present: true,
      isGuest: true
    }]);
    setGuestName('');
    setGuestPosition('MC');
    setSaveStatus(`${normalizedName} foi incluído na convocação.`);
  }

  function removePlayer(userId: string) {
    setPlayers((list) => list.filter((player) => player.userId !== userId));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (creationStep === 'details') {
      await advanceToPlayers();
      return;
    }
    if (!players.length) {
      setSaveStatus('Selecione pelo menos um atleta para abrir a confirmação.');
      return;
    }
    if (isRecurring && weekdayFromInputDate(date) !== recurringWeekday) {
      setSaveStatus('Para jogo recorrente, a data base precisa cair no mesmo dia escolhido na recorrência. Ex.: quarta-feira com repetição às quartas.');
      return;
    }
    if (isRecurring && recurringEndDate < date) {
      setSaveStatus('A data final da recorrência precisa ser igual ou posterior à data do jogo base.');
      return;
    }
    try {
      setSaveStatus(isRecurring ? 'Salvando convocação e gerando recorrência...' : 'Salvando convocação...');
      await saveLineup();
      if (isRecurring) {
        const result = await api.request<{ generated: number; skipped: number }>('/matches/schedule/recurring', {
          method: 'POST',
          body: JSON.stringify({
            seasonId: activeSeasonId || null,
            weekday: recurringWeekday,
            startDate: date,
            endDate: recurringEndDate,
            title,
            refereeName: refereeName || null,
            scheduledStart: '20:00',
            scheduledEnd: '21:00',
            confirmationOpensHoursBefore: 48,
            confirmationClosesHoursBefore: 2,
            teamAName,
            teamBName,
            players: selectedPlayersPayload()
          })
        });
        const extraDuplicates = Math.max(0, result.skipped - 1);
        setSaveStatus(`Convocação salva. Recorrência semanal configurada: ${result.generated} jogo(s) futuro(s) criado(s)${extraDuplicates ? ` e ${extraDuplicates} data(s) já existiam.` : '.'}`);
      }
      await api.request(`/matches/${draftMatchId}/open-confirmation`, { method: 'POST' });
      setOpen(false);
      setDraftMatchId('');
      setPlayers([]);
      setCreationStep('details');
      await onDone();
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : 'Falha ao salvar a convocação.');
    }
  }

  function DrawIcon({ kind, className, tone = 'neutral' }: { kind: 'pitch' | 'playerPlus' | 'roster' | 'goalkeeper' | 'defense' | 'midfield' | 'attack' | 'results' | 'dice' | 'shirt'; className?: string; tone?: 'neutral' | 'a' | 'b' }) {
    const stroke = tone === 'a' ? '#2e8b57' : tone === 'b' ? '#c7921f' : 'currentColor';
    const fill = tone === 'a' ? '#daf3e5' : tone === 'b' ? '#f9ebbf' : 'none';

    if (kind === 'pitch') {
      return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 5v14M3 12h18M8.5 12a3.5 3.5 0 1 0 0-.01Zm7 0a3.5 3.5 0 1 0 0-.01Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    }
    if (kind === 'playerPlus') {
      return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M3.5 18.2c1.2-3 3.1-4.6 5.5-4.6s4.3 1.6 5.5 4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M17.5 7v6M14.5 10h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
    }
    if (kind === 'roster') {
      return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7.2A2.8 2.8 0 1 0 8 7Zm8 0A2.8 2.8 0 1 0 16 7Zm-8.7 10c.5-2 1.9-3.3 3.7-3.3s3.2 1.3 3.7 3.3M13.7 17.2c.5-1.6 1.8-2.7 3.4-2.7 1.5 0 2.7 1 3.3 2.7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
    }
    if (kind === 'goalkeeper') {
      return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 6.5 6v4.7c0 4.2 2.2 7.2 5.5 9 3.3-1.8 5.5-4.8 5.5-9V6L12 3.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M9.5 11.5 11 13l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    }
    if (kind === 'defense') {
      return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17 9 7l3 5 3-5 5 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M6.5 17h11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
    }
    if (kind === 'midfield') {
      return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>;
    }
    if (kind === 'attack') {
      return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="m13 7 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    }
    if (kind === 'results') {
      return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M6 20h12M8 17V9M12 17V5M16 17v-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    }
    if (kind === 'dice') {
      return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="8" width="8" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" transform="rotate(-12 7.5 12)" /><rect x="12.5" y="8" width="8" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" transform="rotate(12 16.5 12)" /><circle cx="7.5" cy="12" r="1" fill="currentColor" /><circle cx="16" cy="10" r="1" fill="currentColor" /><circle cx="18" cy="14" r="1" fill="currentColor" /></svg>;
    }
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5 12 3l5 2.5 1 7.5-6 7-6-7 1-7.5Z" fill={fill} stroke={stroke} strokeWidth="1.7" strokeLinejoin="round" /><path d="M9 7.5h6M9.5 10.5h5M10 13.5h4" fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" /></svg>;
  }

  const rosterRows = [...players].sort((left, right) => Number(left.drawOrder || 0) - Number(right.drawOrder || 0) || left.name.localeCompare(right.name, 'pt-BR'));
  const selectedLabel = rosterRows.length === 0 ? 'Vazios (0)' : `${rosterRows.length} atleta${rosterRows.length === 1 ? '' : 's'}`;

  return (
    <>
      {!hideTrigger && <button className="primary small" onClick={openCreation}>Criar jogo</button>}
      {open && (
        <div className="modal">
          <form className="card modal-card wide draw-modal draw-modal-sheet" onSubmit={submit}>
            <div className="draw-sheet-head">
              <div className="draw-sheet-copy">
                <span className="eyebrow">Súmula Inteligente</span>
              
              </div>
              <button type="button" className="ghost modal-close-button" aria-label="Fechar modal" title="Fechar" onClick={() => void cancelCreation()} />
            </div>

            {saveStatus && <p className="status-line draw-status-line">{saveStatus}</p>}

            <div className="draw-sheet-grid is-single-step">
              {creationStep === 'details' && (
              <section className="draw-sheet-card draw-details-card">
                <div className="draw-card-head">
                  <div className="draw-title-row">
                    <DrawIcon kind="pitch" className="draw-icon" />
                    <h3>Detalhes do Jogo</h3>
                  </div>
                </div>

                <div className="draw-date-row">
                  <label className="field-shell">
                    <span>Data</span>
                    <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                  </label>
                  <label className="field-shell">
                    <span>Horário</span>
                    <input value="20:00" readOnly />
                  </label>
                </div>

                <label className="field-shell">
                  <span>Tipo</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>

                <label className="field-shell field-shell-textarea">
                  <span>Arbitragem (Opcional)</span>
                  <textarea value={refereeName} onChange={(event) => setRefereeName(event.target.value)} placeholder="Árbitro" rows={3} />
                </label>

                <label className="draw-recurring-toggle">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setIsRecurring(checked);
                      if (checked) {
                        setRecurringWeekday(weekdayFromInputDate(date));
                        if (recurringEndDate < date) setRecurringEndDate(date);
                      }
                    }}
                  />
                  <div className="draw-recurring-copy">
                    <strong>Jogo recorrente</strong>
                  </div>
                </label>

                {isRecurring && (
                  <div className="draw-recurring-panel">
                    <label className="field-shell">
                      <span>Frequência</span>
                      <select value={recurrenceFrequency} onChange={(event) => setRecurrenceFrequency(event.target.value as 'WEEKLY')}>
                        <option value="WEEKLY">Toda semana</option>
                      </select>
                    </label>
                    <div className="draw-recurring-grid">
                      <label className="field-shell">
                        <span>Repetir toda</span>
                        <select value={recurringWeekday} onChange={(event) => setRecurringWeekday(Number(event.target.value))}>
                          {weekdayOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </label>
                      <label className="field-shell">
                        <span>Até</span>
                        <input type="date" value={recurringEndDate} min={date} onChange={(event) => setRecurringEndDate(event.target.value)} />
                      </label>
                    </div>
                    <p className="draw-card-note">O jogo atual vira a data base e o sistema agenda automaticamente os próximos {recurringWeekdayLabel.toLowerCase()} até {new Date(`${recurringEndDate}T12:00:00-03:00`).toLocaleDateString('pt-BR')}.</p>
                  </div>
                )}

                <p className="draw-card-note">Na próxima etapa você selecionará os atletas convocados.</p>
              </section>
              )}

              {creationStep === 'players' && (
              <section className="draw-sheet-side">
                <div className="draw-sheet-card draw-search-card">
                  <div className="draw-card-head">
                    <div className="draw-title-row">
                      <DrawIcon kind="playerPlus" className="draw-icon" />
                      <h3>Adicionar Jogadores</h3>
                    </div>
                  </div>

                  <div className="draw-search-input">
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar atleta por nome ou e-mail" />
                  </div>

                  {query.trim().length > 0 && query.trim().length < 3 && <p className="muted draw-inline-hint">Digite pelo menos 3 caracteres.</p>}

                  {query.trim().length >= 3 && (
                    <div className="draw-search-results">
                      {searchResults.length === 0 ? (
                        <p className="muted draw-inline-hint">Nenhum atleta encontrado para essa busca.</p>
                      ) : searchResults.map((user) => (
                        <article key={user.id}>
                          <div>
                            <strong>{user.name}</strong>
                            <small>{user.email} • {positionLabel(user.position)}</small>
                          </div>
                          <button type="button" className="primary small" onClick={() => addParticipant(user)}>Adicionar</button>
                        </article>
                      ))}
                    </div>
                  )}

                  <div className="draw-guest-builder">
                    <div className="draw-guest-head">
                      <strong>Suplente convidado</strong>
                    </div>
                    <div className="draw-guest-grid">
                      <label className="field-shell">
                        <span>Nome</span>
                        <input value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Nome do convidado" maxLength={120} />
                      </label>
                      <label className="field-shell">
                        <span>Posição obrigatória</span>
                        <select value={guestPosition} onChange={(event) => setGuestPosition(event.target.value as AthletePosition)}>
                          {athletePositionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      <button type="button" className="ghost draw-guest-add-button" onClick={addGuestParticipant} disabled={guestName.trim().length < 2}>Adicionar convidado</button>
                    </div>
                  </div>

                  <div className="draw-selected-head">
                    <strong><DrawIcon kind="roster" className="draw-icon draw-icon-inline" /> Convocados: {selectedLabel}</strong>
                  </div>

                  {rosterRows.length > 0 && (
                    <div className={`draw-selected-list ${rosterRows.length > 6 ? 'is-split' : ''}`}>
                      {(rosterRows.length > 6
                        ? [rosterRows.slice(0, Math.ceil(rosterRows.length / 2)), rosterRows.slice(Math.ceil(rosterRows.length / 2))]
                        : [rosterRows]
                      ).map((column, columnIndex) => (
                        <div className="draw-selected-column" key={`convocados-coluna-${columnIndex + 1}`}>
                          {column.map((player) => (
                            <div className={`draw-selected-player draw-selected-line ${player.team === 'PRESENTE_SEM_JOGAR' ? 'is-pending' : ''}`} key={player.userId}>
                              <div className="draw-selected-meta">
                                <span className="draw-selected-name">{player.name.trim().split(/\s+/)[0] ?? player.name}</span>
                                <span className="draw-selected-position">{positionLabel(player.position)}</span>
                              </div>
                              <span className={`draw-selected-badge ${player.isGuest ? 'is-guest' : ''}`}>{player.isGuest ? 'Convidado' : 'Atleta'}</span>
                              <button type="button" className="ghost draw-inline-remove" aria-label={`Remover ${player.name}`} title="Remover" onClick={() => removePlayer(player.userId)}>X</button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
              )}
            </div>

            <div className="draw-sheet-footer">
              <button type="button" className="ghost" onClick={() => creationStep === 'players' ? setCreationStep('details') : void cancelCreation()}>{creationStep === 'players' ? 'Voltar' : 'Cancelar'}</button>
              <div className="draw-footer-save">
                <button className="primary" disabled={creationStep === 'players' && players.length === 0}>{creationStep === 'details' ? 'PRÓXIMO' : isRecurring ? 'SALVAR CONVOCAÇÃO + RECORRÊNCIA' : 'SALVAR CONVOCAÇÃO'}</button>
                <small>{creationStep === 'details' ? 'Avance para selecionar os jogadores.' : 'Os convocados confirmarão presença antes do sorteio.'}</small>
              </div>
            </div>
          </form>

        </div>
      )}
    </>
  );

  /*
  return <><button className="primary small" onClick={() => void openPersistentDraft()}>Criar jogo</button>{open && <div className="modal"><form className="card modal-card wide draw-modal" onSubmit={submit}><div className="draw-hero"><div><span className="eyebrow">Súmula inteligente</span><h2>Montar jogo por presença e sorteio</h2><p className="muted">Inclua somente quem vai participar do jogo. A divisão em {teamAName} e {teamBName} é automática, aleatória e balanceada pelas posições oficiais.</p></div><button type="button" className="ghost" onClick={() => setOpen(false)}>Fechar</button></div><div className="sheet-steps"><span className="step-chip done">1. Dados</span><span className={`step-chip ${players.length ? 'done' : 'active'}`}>2. Participantes</span><span className={`step-chip ${teamsDrawn ? 'done' : players.length >= 2 ? 'active' : ''}`}>3. Sorteio</span></div>{saveStatus && <p className="status-line">{saveStatus}</p>}<div className="match-meta draw-meta"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /><input value={refereeName} onChange={(event) => setRefereeName(event.target.value)} placeholder="Árbitro" /><input value={teamAName} onChange={(event) => setTeamAName(event.target.value)} /><input value={teamBName} onChange={(event) => setTeamBName(event.target.value)} /></div><div className="draw-dashboard"><article><span>Elenco</span><strong>{players.length}</strong><small>atletas no jogo</small></article>{positionOverview.map((item) => <article key={item.group}><span>{item.label}</span><strong>{item.count}</strong><small>posição base</small></article>)}</div><div className="draw-action"><div><strong>{teamsDrawn ? 'Sorteio concluído' : 'Divisão automática obrigatória'}</strong><small>{drawStatus}</small></div><button type="button" className="primary draw-button" onClick={balanceTeamsByPosition} disabled={players.length < 2}>{teamsDrawn ? 'Sortear novamente' : 'Sortear times'}</button></div><div className="team-builder draw-builder"><section className="draw-pool"><h2>Participantes do jogo</h2><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar atleta por nome ou e-mail" />{query.trim().length > 0 && query.trim().length < 3 && <p className="muted">Digite pelo menos 3 caracteres.</p>}<div className="search-results draw-search">{searchResults.map((user) => <article key={user.id}><strong>{user.name}</strong><small>{user.email} • {positionLabel(user.position)}</small><div className="actions"><button type="button" className="primary small" onClick={() => addParticipant(user)}>Adicionar ao jogo</button></div></article>)}</div><div className="team-list roster-list"><div className="team-title"><strong>Elenco selecionado</strong><span>{pendingPlayers.length ? `${pendingPlayers.length} aguardando` : teamsDrawn ? 'sorteado' : 'vazio'}</span></div>{rosterRows.length === 0 ? <small className="muted">Busque e adicione todos os atletas que jogarão. Quem estiver presente e não jogar será incluído depois, na súmula aberta do jogo.</small> : rosterRows.map((player) => <div className={`team-player roster-row ${player.team === 'PRESENTE_SEM_JOGAR' ? 'pending' : ''}`} key={player.userId}><div className="player-meta"><b>{player.name}</b><small>{positionLabel(player.position)}</small></div><span className="team-badge">{player.team === 'PRESENTE_SEM_JOGAR' ? 'Aguardando' : player.team === 'A' ? teamAName : teamBName}</span><button type="button" className="ghost" onClick={() => removePlayer(player.userId)}>Remover</button></div>)}</div></section><section className="team-board draw-teams"><TeamList team="A" rows={teamA} /><TeamList team="B" rows={teamB} /></section></div><div className="draw-footer"><small>{teamsDrawn ? 'Pronto para salvar: a súmula será criada com times e roteiro de troca já calculados.' : 'O salvamento final só libera após o sorteio para impedir escalação manual incorreta.'}</small><button className="primary" disabled={!teamsDrawn}>Salvar súmula</button></div></form></div>}</>;
  */
}

function PaymentsPanel({ api, canCoordinate, users, activeSeasonId }: { api: ApiClient; canCoordinate: boolean; users: User[]; activeSeasonId: string }) {
  const activeAthletes = useMemo(() => {
    const seenEmails = new Set<string>();
    return users.filter((user) => user.active !== false && user.role === 'ATLETA').filter((user) => {
      const emailKey = user.email.trim().toLowerCase();
      if (!emailKey) return true;
      if (seenEmails.has(emailKey)) return false;
      seenEmails.add(emailKey);
      return true;
    });
  }, [users]);
  const [userId, setUserId] = useState(users[0]?.id ?? '');
  const [amount, setAmount] = useState('0');
  const [bulkAmount, setBulkAmount] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');
  const [currentPaidCents, setCurrentPaidCents] = useState(0);
  const [fullPayment, setFullPayment] = useState(true);
  const [monthCount, setMonthCount] = useState(1);
  const [generateForAll, setGenerateForAll] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7) + '-01');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<PaymentRecord['status']>('PAID');
  const [notes, setNotes] = useState('');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [cashSummary, setCashSummary] = useState<CashSummary | null>(null);
  const [cashEntryType, setCashEntryType] = useState<CashEntryType>('EXPENSE');
  const [cashDate, setCashDate] = useState(new Date().toISOString().slice(0, 10));
  const [cashDescription, setCashDescription] = useState('');
  const [cashAmount, setCashAmount] = useState('0');
  const [message, setMessage] = useState('');
  const [paymentModal, setPaymentModal] = useState<'generate' | 'register' | 'cash' | null>(null);
  const [paymentFilters, setPaymentFilters] = useState({ name: '', month: '', dueDate: '', amount: '', paid: '', balance: '', status: '', paidAt: '', point: '', notes: '' });
  const [cashFilters, setCashFilters] = useState({ date: '', type: '', description: '', origin: '', recordedBy: '', amount: '' });
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [expandedPaymentGroupKey, setExpandedPaymentGroupKey] = useState<string | null>(null);

  useEffect(() => {
    if (!userId && activeAthletes[0]?.id) setUserId(activeAthletes[0].id);
    if (!selectedUserIds.length && activeAthletes[0]?.id) setSelectedUserIds([activeAthletes[0].id]);
  }, [activeAthletes, selectedUserIds.length, userId]);

  useEffect(() => {
    setFilterSearch('');
  }, [activeFilterMenu]);

  async function loadPayments() {
    const path = canCoordinate ? `/payments${activeSeasonId ? `?seasonId=${activeSeasonId}` : ''}` : '/payments/me';
    if (canCoordinate) {
      const [filteredRows, historyRows] = await Promise.all([
        api.request<PaymentRecord[]>(path),
        activeSeasonId ? api.request<PaymentRecord[]>('/payments') : api.request<PaymentRecord[]>(path)
      ]);
      setPayments(filteredRows);
      setPaymentHistory(historyRows);
    } else {
      const ownPayments = await api.request<PaymentRecord[]>(path);
      setPayments(ownPayments);
      setPaymentHistory(ownPayments);
    }
    if (canCoordinate) {
      const [paymentSummary, cashRows, cashTotals] = await Promise.all([
        api.request<PaymentSummary>(`/payments/summary${activeSeasonId ? `?seasonId=${activeSeasonId}` : ''}`),
        api.request<CashEntry[]>('/cash'),
        api.request<CashSummary>('/cash/summary')
      ]);
      setSummary(paymentSummary);
      setCashEntries(cashRows);
      setCashSummary(cashTotals);
    }
  }

  useEffect(() => {
    void loadPayments().catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao carregar mensalidades.'));
  }, [activeSeasonId, canCoordinate]);

  async function save() {
    const amountCents = centsFromInput(amount);
    const paidAmountCents = status === 'PAID' ? amountCents : status === 'PARTIAL' ? Math.min(amountCents, centsFromInput(paidAmount)) : 0;
    const resolvedStatus: PaymentStatus = status === 'WAIVED' ? 'WAIVED' : paidAmountCents >= amountCents && amountCents > 0 ? 'PAID' : paidAmountCents > 0 ? 'PARTIAL' : status === 'LATE' ? 'LATE' : 'PENDING';
    const saved = await api.request<PaymentRecord>('/payments', { method: 'PUT', body: JSON.stringify({ userId, seasonId: activeSeasonId || null, referenceMonth: month, dueDate, amountCents, paidAmountCents, status: resolvedStatus, paidAt: paidAmountCents > 0 ? new Date(`${paidAt}T12:00:00`).toISOString() : null, notes: notes || null }) });
    setMessage(saved.earnsPoint ? 'Pagamento total antecipado registrado: +1 ponto na temporada.' : saved.status === 'PARTIAL' ? `Pagamento parcial registrado. Saldo: R$ ${((saved.balanceCents ?? 0) / 100).toFixed(2)}.` : 'Mensalidade registrada sem ponto antecipado.');
    await loadPayments();
  }

  async function generateMonth() {
    const result = await api.request<{ generated: number }>('/payments/generate-month', { method: 'POST', body: JSON.stringify({ seasonId: activeSeasonId || null, startMonth: month, months: monthCount, userIds: generateForAll ? undefined : selectedUserIds, dueDate, amountCents: centsFromInput(bulkAmount || amount), notes: notes || null }) });
    setMessage(`${result.generated} cobrança(s) criada(s)/atualizada(s) em ${monthCount} mês(es). Pagamentos quitados/isentos foram preservados.`);
    await loadPayments();
  }

  async function saveCashEntry() {
    await api.request<CashEntry>('/cash', { method: 'POST', body: JSON.stringify({ entryType: cashEntryType, entryDate: cashDate, description: cashDescription, amountCents: centsFromInput(cashAmount) }) });
    setMessage('Lançamento de caixa registrado para prestação de contas.');
    setCashDescription('');
    setCashAmount('0');
    await loadPayments();
  }

  function money(cents = 0) {
    return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function paymentMonthLabel(referenceMonth: string) {
    const [yearValue, monthValue] = referenceMonth.slice(0, 7).split('-');
    const monthIndex = Number(monthValue) - 1;
    const monthName = paymentMonthNames[monthIndex] ?? referenceMonth.slice(5, 7);
    return `${monthName} ${yearValue}`;
  }

  function shiftReferenceMonth(referenceMonth: string, offset: number) {
    const [yearValue, monthValue] = referenceMonth.slice(0, 7).split('-');
    const baseDate = new Date(Date.UTC(Number(yearValue), Number(monthValue) - 1, 1));
    baseDate.setUTCMonth(baseDate.getUTCMonth() + offset);
    const shiftedYear = baseDate.getUTCFullYear();
    const shiftedMonth = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
    return `${shiftedYear}-${shiftedMonth}-01`;
  }

  function paymentTimelineKey(payment: PaymentRecord) {
    return payment.dueDate?.slice(0, 10) || `${payment.referenceMonth.slice(0, 7)}-01`;
  }

  function paymentStatusTone(paymentStatus: PaymentStatus) {
    return paymentStatus === 'PAID' || paymentStatus === 'WAIVED' ? 'open' : paymentStatus === 'LATE' ? 'danger' : '';
  }

  function centsFromInput(value: string) {
    const normalized = value.replace(/\./g, '').replace(',', '.').trim();
    const parsed = Number(normalized || 0);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }

  function statusLabel(paymentStatus: PaymentStatus) {
    if (paymentStatus === 'PAID') return 'Pago';
    if (paymentStatus === 'PARTIAL') return 'Parcial';
    if (paymentStatus === 'LATE') return 'Atrasado';
    if (paymentStatus === 'WAIVED') return 'Isento';
    return 'Pendente';
  }

  function paymentHasOpenBalance(payment: PaymentRecord) {
    return (payment.balanceCents ?? Math.max(payment.amountCents - (payment.paidAmountCents ?? 0), 0)) > 0 && payment.status !== 'WAIVED';
  }

  function paymentIsLateRecord(payment: PaymentRecord, todayKey: string) {
    const dueKey = payment.dueDate?.slice(0, 10) ?? `${payment.referenceMonth.slice(0, 7)}-01`;
    return paymentHasOpenBalance(payment) && dueKey < todayKey;
  }

  function toggleSelectedUser(id: string) {
    setSelectedUserIds((list) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  function toggleFilterMenu(key: string) {
    setActiveFilterMenu((current) => current === key ? null : key);
  }

  function paymentMatchesFilters(payment: PaymentRecord) {
    const name = normalizeTableFilterValue(payment.userName ?? 'Minha mensalidade');
    const monthValue = normalizeTableFilterValue(`${paymentMonthLabel(payment.referenceMonth)} ${payment.referenceMonth.slice(0, 7)}`);
    const dueDateValue = normalizeTableFilterValue(`${formatDateOnly(payment.dueDate, '')} ${payment.dueDate?.slice(0, 10) ?? ''}`);
    const amountValue = normalizeTableFilterValue(money(payment.amountCents));
    const paidValue = normalizeTableFilterValue(money(payment.paidAmountCents ?? 0));
    const balanceValue = normalizeTableFilterValue(money(payment.balanceCents ?? 0));
    const statusValue = normalizeTableFilterValue(statusLabel(payment.status));
    const paidAtValue = normalizeTableFilterValue(`${formatDateOnly(payment.paidAt, 'Nao informado')} ${payment.paidAt?.slice(0, 10) ?? ''}`);
    const pointValue = normalizeTableFilterValue(payment.earnsPoint ? 'Com ponto' : 'Sem ponto');
    const notesValue = normalizeTableFilterValue(payment.notes ?? '');
    return name.includes(normalizeTableFilterValue(paymentFilters.name))
      && monthValue.includes(normalizeTableFilterValue(paymentFilters.month))
      && dueDateValue.includes(normalizeTableFilterValue(paymentFilters.dueDate))
      && amountValue.includes(normalizeTableFilterValue(paymentFilters.amount))
      && paidValue.includes(normalizeTableFilterValue(paymentFilters.paid))
      && balanceValue.includes(normalizeTableFilterValue(paymentFilters.balance))
      && statusValue.includes(normalizeTableFilterValue(paymentFilters.status))
      && paidAtValue.includes(normalizeTableFilterValue(paymentFilters.paidAt))
      && pointValue.includes(normalizeTableFilterValue(paymentFilters.point))
      && notesValue.includes(normalizeTableFilterValue(paymentFilters.notes));
  }

  function paymentFilterOptions(key: keyof typeof paymentFilters) {
    const values = organizedPayments.map((payment) => {
      if (key === 'name') return payment.userName ?? 'Minha mensalidade';
      if (key === 'month') return paymentMonthLabel(payment.referenceMonth);
      if (key === 'dueDate') return formatDateOnly(payment.dueDate, '-');
      if (key === 'amount') return money(payment.amountCents);
      if (key === 'paid') return money(payment.paidAmountCents ?? 0);
      if (key === 'balance') return money(payment.balanceCents ?? 0);
      if (key === 'status') return statusLabel(payment.status);
      if (key === 'paidAt') return formatDateOnly(payment.paidAt, 'Nao informado');
      if (key === 'point') return payment.earnsPoint ? 'Com ponto' : 'Sem ponto';
      return payment.notes?.trim() ? payment.notes : '-';
    });
    return [...new Set(values)].filter(Boolean).sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }));
  }

  function cashFilterOptions(key: keyof typeof cashFilters) {
    const values = organizedCashEntries.map((entry) => {
      if (key === 'date') return formatDateOnly(entry.entryDate, '-');
      if (key === 'type') return entry.entryType === 'REVENUE' ? 'Receita' : 'Despesa';
      if (key === 'description') return entry.description;
      if (key === 'origin') return entry.paymentId ? 'Mensalidade' : 'Manual';
      if (key === 'recordedBy') return entry.recordedByName?.trim() ? entry.recordedByName : '-';
      return `${entry.entryType === 'REVENUE' ? '+' : '-'} ${money(entry.amountCents)}`;
    });
    return [...new Set(values)].filter(Boolean).sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }));
  }

  function renderFilterHeader(label: string, menuKey: string, currentValue: string, options: string[], onSelect: (value: string) => void, onClear: () => void, placeholder: string) {
    const isOpen = activeFilterMenu === menuKey;
    const inputValue = currentValue || filterSearch;
    return <div className="table-filter-anchor"><button type="button" className={`table-filter-button ${currentValue ? 'is-active' : ''}`} onClick={() => toggleFilterMenu(menuKey)} aria-label={`Filtrar ${label.toLowerCase()}`}><MdFilterList /></button><span>{label}</span>{isOpen && <div className="table-filter-popover"><div className="table-filter-popover-head"><strong>{label}</strong><button type="button" className="ghost small" onClick={() => { onClear(); setActiveFilterMenu(null); }}>Limpar</button></div><input value={inputValue} onChange={(event) => { setFilterSearch(event.target.value); onSelect(event.target.value); }} placeholder={placeholder} /></div>}</div>;
  }

  function openRegister(payment?: PaymentRecord) {
    if (payment) {
      setUserId(payment.userId ?? activeAthletes[0]?.id ?? '');
      setMonth(payment.referenceMonth);
      setDueDate(payment.dueDate?.slice(0, 10) ?? dueDate);
      setAmount(String((payment.amountCents / 100).toFixed(2)));
      setPaidAmount('0.00');
      setCurrentPaidCents(payment.paidAmountCents ?? 0);
      setStatus((payment.balanceCents ?? 0) > 0 ? 'PARTIAL' : 'PAID');
      setFullPayment((payment.balanceCents ?? 0) <= 0);
      setNotes(payment.notes ?? '');
    } else {
      setCurrentPaidCents(0);
    }
    setPaymentModal('register');
  }

  const registerAmountCents = centsFromInput(amount || '0');
  const registerPaidCents = status === 'PAID' ? registerAmountCents : status === 'PARTIAL' ? Math.min(registerAmountCents, currentPaidCents + centsFromInput(paidAmount || '0')) : 0;
  const registerBalanceCents = Math.max(registerAmountCents - registerPaidCents, 0);
  const organizedPayments = useMemo(() => [...payments].sort((left, right) => {
    const nameCompare = (left.userName ?? 'Minha mensalidade').localeCompare(right.userName ?? 'Minha mensalidade', 'pt-BR', { sensitivity: 'base' });
    if (nameCompare !== 0) return nameCompare;
    const monthCompare = left.referenceMonth.localeCompare(right.referenceMonth);
    if (monthCompare !== 0) return monthCompare;
    return (left.dueDate ?? '').localeCompare(right.dueDate ?? '');
  }), [payments]);
  const organizedPaymentHistory = useMemo(() => [...paymentHistory].sort((left, right) => {
    const nameCompare = (left.userName ?? 'Minha mensalidade').localeCompare(right.userName ?? 'Minha mensalidade', 'pt-BR', { sensitivity: 'base' });
    if (nameCompare !== 0) return nameCompare;
    const monthCompare = left.referenceMonth.localeCompare(right.referenceMonth);
    if (monthCompare !== 0) return monthCompare;
    return (left.dueDate ?? '').localeCompare(right.dueDate ?? '');
  }), [paymentHistory]);
  const filteredPayments = useMemo(() => organizedPayments.filter(paymentMatchesFilters), [organizedPayments, paymentFilters]);
  const paymentGroups = useMemo(() => {
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const groupsMap = new Map<string, { key: string; userId?: string; userName: string; payments: PaymentRecord[] }>();
    const historyGroupsMap = new Map<string, PaymentRecord[]>();
    organizedPaymentHistory.forEach((payment) => {
      const key = payment.userId ?? payment.userName ?? 'me';
      const current = historyGroupsMap.get(key);
      if (current) {
        current.push(payment);
        return;
      }
      historyGroupsMap.set(key, [payment]);
    });
    organizedPayments.forEach((payment) => {
      const key = payment.userId ?? payment.userName ?? 'me';
      const current = groupsMap.get(key);
      if (current) {
        current.payments.push(payment);
        return;
      }
      groupsMap.set(key, { key, userId: payment.userId, userName: payment.userName ?? 'Minha mensalidade', payments: [payment] });
    });
    return [...groupsMap.values()].map((group): PaymentAthleteGroup | null => {
      const historySource = historyGroupsMap.get(group.key) ?? group.payments;
      const paymentsByMonth = new Map<string, PaymentRecord>();
      [...historySource]
        .sort((left, right) => left.referenceMonth.localeCompare(right.referenceMonth) || (left.dueDate ?? '').localeCompare(right.dueDate ?? ''))
        .forEach((payment) => {
          const referenceMonthKey = payment.referenceMonth.slice(0, 7);
          if (!paymentsByMonth.has(referenceMonthKey)) paymentsByMonth.set(referenceMonthKey, payment);
        });
      const historyPayments = [...paymentsByMonth.values()].sort((left, right) => paymentTimelineKey(left).localeCompare(paymentTimelineKey(right)));
      const openPayments = historyPayments.filter((payment) => paymentHasOpenBalance(payment)).sort((left, right) => paymentTimelineKey(left).localeCompare(paymentTimelineKey(right)));
      const paidPayments = historyPayments.filter((payment) => (payment.paidAmountCents ?? 0) > 0).sort((left, right) => {
        const leftKey = `${left.paidAt ?? left.referenceMonth}-${left.referenceMonth}`;
        const rightKey = `${right.paidAt ?? right.referenceMonth}-${right.referenceMonth}`;
        return rightKey.localeCompare(leftKey);
      });
      const nameFilter = normalizeTableFilterValue(paymentFilters.name);
      if (nameFilter && !normalizeTableFilterValue(group.userName).includes(nameFilter)) return null;
      return {
        key: group.key,
        userId: group.userId,
        userName: group.userName,
        payments: historyPayments,
        openPayments,
        totalOpenCents: openPayments.reduce((sum, payment) => sum + (payment.balanceCents ?? 0), 0),
        totalPaidCents: historyPayments.reduce((sum, payment) => sum + (payment.paidAmountCents ?? 0), 0),
        lastPaidPayment: paidPayments[0] ?? null,
        nextOpenPayment: openPayments[0] ?? null,
        latePaymentsCount: openPayments.filter((payment) => paymentIsLateRecord(payment, todayKey)).length
      };
    }).filter((group): group is PaymentAthleteGroup => group !== null).sort((left, right) => left.userName.localeCompare(right.userName, 'pt-BR', { sensitivity: 'base' }));
  }, [organizedPayments, organizedPaymentHistory, paymentFilters.name]);

  useEffect(() => {
    if (expandedPaymentGroupKey && !paymentGroups.some((group) => group.key === expandedPaymentGroupKey)) setExpandedPaymentGroupKey(null);
  }, [expandedPaymentGroupKey, paymentGroups]);
  const organizedCashEntries = useMemo(() => [...cashEntries].sort((left, right) => {
    const dateCompare = (right.entryDate ?? '').localeCompare(left.entryDate ?? '');
    if (dateCompare !== 0) return dateCompare;
    return (right.createdAt ?? '').localeCompare(left.createdAt ?? '');
  }), [cashEntries]);
  const filteredCashEntries = useMemo(() => organizedCashEntries.filter((entry) => {
    const dateValue = `${formatDateOnly(entry.entryDate, '').toLowerCase()} ${(entry.entryDate?.slice(0, 10) ?? '').toLowerCase()}`;
    const typeValue = (entry.entryType === 'REVENUE' ? 'receita' : 'despesa').toLowerCase();
    const descriptionValue = entry.description.toLowerCase();
    const originValue = (entry.paymentId ? 'mensalidade' : 'manual').toLowerCase();
    const recordedByValue = (entry.recordedByName ?? '').toLowerCase();
    const amountValue = `${entry.entryType === 'REVENUE' ? '+' : '-'} ${money(entry.amountCents)}`.toLowerCase();
    return dateValue.includes(cashFilters.date.trim().toLowerCase())
      && typeValue.includes(cashFilters.type.trim().toLowerCase())
      && descriptionValue.includes(cashFilters.description.trim().toLowerCase())
      && originValue.includes(cashFilters.origin.trim().toLowerCase())
      && recordedByValue.includes(cashFilters.recordedBy.trim().toLowerCase())
      && amountValue.includes(cashFilters.amount.trim().toLowerCase());
  }), [cashFilters, organizedCashEntries]);

  return (
    <section className="card compact payments-panel">
      <div className="card-head">
        <div>
          <h2>Mensalidades</h2>
          <p className="muted">Acompanhamento financeiro da temporada com ações operacionais em modal.</p>
        </div>
        {canCoordinate && <div className="actions panel-actions"><button className="primary small" onClick={() => setPaymentModal('generate')}>Gerar mensalidades</button><button className="ghost" onClick={() => setPaymentModal('cash')}>Lançar caixa</button>{filteredPayments.length > 0 && <button className="ghost" onClick={() => downloadCsv('poka-pratika-mensalidades.csv', filteredPayments.map((payment) => ({ atleta: payment.userName ?? 'Minha mensalidade', mes: paymentMonthLabel(payment.referenceMonth), vencimento: formatDateOnly(payment.dueDate, ''), pagoEm: formatDateOnly(payment.paidAt, ''), valor: (payment.amountCents / 100).toFixed(2), pago: ((payment.paidAmountCents ?? 0) / 100).toFixed(2), saldo: ((payment.balanceCents ?? 0) / 100).toFixed(2), status: payment.status, pontoAntecipado: payment.earnsPoint, observacao: payment.notes ?? '' })))}>Exportar mensalidades</button>}{filteredCashEntries.length > 0 && <button className="ghost" onClick={() => downloadCsv('poka-pratika-caixa.csv', filteredCashEntries.map((entry) => ({ data: formatDateOnly(entry.entryDate, ''), tipo: entry.entryType === 'REVENUE' ? 'Receita' : 'Despesa', descricao: entry.description, valor: (entry.amountCents / 100).toFixed(2), origem: entry.paymentId ? 'Mensalidade' : 'Manual', responsavel: entry.recordedByName ?? '' })))}>Exportar caixa</button>}</div>}
      </div>
      {canCoordinate && (summary || cashSummary) && <div className="stat-grid payments-overview-strip">{summary && <><span><b>R$ {(summary.paidCents / 100).toFixed(2)}</b> recebido</span><span><b>R$ {(summary.openCents / 100).toFixed(2)}</b> aberto</span><span><b>{summary.pending}</b> pendente(s)</span><span><b>{summary.late}</b> atraso(s)</span><span><b>{summary.earlyPoints}</b> ponto(s) antecipados</span></>}{cashSummary && <><span><b>{money(cashSummary.revenueCents)}</b> receitas</span><span><b>{money(cashSummary.expenseCents)}</b> despesas</span><span><b>{money(cashSummary.balanceCents)}</b> saldo caixa</span></>}</div>}
      {!canCoordinate && <p className="muted">Você visualiza apenas sua mensalidade e se ela gerou ponto por pagamento antecipado.</p>}
      {message && <p className="muted">{message}</p>}
      {organizedPayments.length === 0 ? <EmptyState title="Sem mensalidades lançadas" text="Gere o mês ou registre uma cobrança individual para começar a acompanhar a tabela financeira." /> : <div className="championship-wrap payments-table-wrap"><table className="championship-table payments-table payments-group-table payments-summary-table"><thead><tr><th>{renderFilterHeader('Atleta', 'payments-name', paymentFilters.name, paymentFilterOptions('name'), (value) => setPaymentFilters((current) => ({ ...current, name: value })), () => setPaymentFilters((current) => ({ ...current, name: '' })), 'Pesquisar atleta')}</th><th>Inadimplência total</th><th>Total pago</th><th>Último mês pago</th><th>Próximo mês em aberto</th><th>Meses em atraso</th></tr></thead><tbody>{paymentGroups.length === 0 ? <tr><td colSpan={6} className="table-empty-cell">Nenhum atleta encontrado com os filtros atuais.</td></tr> : paymentGroups.map((group) => <Fragment key={group.key}><tr className={expandedPaymentGroupKey === group.key ? 'payments-group-row is-open' : 'payments-group-row'} onClick={() => setExpandedPaymentGroupKey((current) => current === group.key ? null : group.key)}><td className="athlete-cell payments-name-cell payments-athlete-cell"><strong>{group.userName}</strong></td><td className="payments-summary-cell payments-balance-cell">{money(group.totalOpenCents)}</td><td className="payments-summary-cell">{money(group.totalPaidCents)}</td><td className="payments-summary-cell">{group.lastPaidPayment ? paymentMonthLabel(group.lastPaidPayment.referenceMonth) : <span className="payments-muted">Sem pagamento</span>}</td><td className="payments-summary-cell">{group.nextOpenPayment ? paymentMonthLabel(group.nextOpenPayment.referenceMonth) : <span className="payments-muted">Sem aberto</span>}</td><td className="payments-summary-cell">{group.latePaymentsCount > 0 ? <span className="status danger">{group.latePaymentsCount} atraso(s)</span> : <span className="status open">Em dia</span>}</td></tr>{expandedPaymentGroupKey === group.key && <tr className="payments-group-detail-row"><td colSpan={6}><div className="payments-subtable-wrap"><div className="payments-subtable-head"><strong>Mensalidades abertas do atleta</strong><span>{group.openPayments.length} registro(s) com saldo pendente</span></div>{group.openPayments.length === 0 ? <p className="payments-muted">Este atleta não possui mensalidades abertas ou atrasadas no momento.</p> : <table className="championship-table payments-table payments-subtable"><thead><tr><th>Mês</th><th>Vencimento</th><th>Valor</th><th>Pago</th><th>Pendente</th><th>Status</th><th>Observação</th>{canCoordinate && <th>Ação</th>}</tr></thead><tbody>{group.openPayments.map((payment) => <tr key={`${group.key}-${payment.id ?? payment.referenceMonth}-${payment.dueDate ?? 'sem-vencimento'}`}><td>{paymentMonthLabel(payment.referenceMonth)}</td><td>{formatDateOnly(payment.dueDate, '-')}</td><td>{money(payment.amountCents)}</td><td>{money(payment.paidAmountCents ?? 0)}</td><td className="payments-balance-cell">{money(payment.balanceCents ?? 0)}</td><td><span className={`status ${paymentStatusTone(payment.status)}`}>{statusLabel(payment.status)}</span></td><td className="payments-notes-cell">{payment.notes?.trim() ? payment.notes : <span className="payments-muted">-</span>}</td>{canCoordinate && <td className="payments-action-cell"><button type="button" className="ghost small" onClick={() => openRegister(payment)}>{(payment.balanceCents ?? 0) > 0 ? 'Baixar saldo' : 'Editar'}</button></td>}</tr>)}</tbody></table>}</div></td></tr>}</Fragment>)}</tbody></table></div>}
      {canCoordinate && <section className="cash-ledger"><div className="card-head"><div><h2>Caixa do grupo</h2><p className="muted">Prestação de contas simples: receitas e despesas com data, descrição e valor.</p></div><span className="status open">{filteredCashEntries.length} de {organizedCashEntries.length} lançamento(s)</span></div>{organizedCashEntries.length === 0 ? <EmptyState title="Caixa sem lançamentos" text="Pagamentos de mensalidade entram automaticamente como receita. Despesas podem ser lançadas manualmente." /> : <div className="championship-wrap cash-table-wrap"><table className="championship-table cash-table"><thead><tr><th>{renderFilterHeader('Data', 'cash-date', cashFilters.date, cashFilterOptions('date'), (value) => setCashFilters((current) => ({ ...current, date: value })), () => setCashFilters((current) => ({ ...current, date: '' })), 'Pesquisar data')}</th><th>{renderFilterHeader('Tipo', 'cash-type', cashFilters.type, cashFilterOptions('type'), (value) => setCashFilters((current) => ({ ...current, type: value })), () => setCashFilters((current) => ({ ...current, type: '' })), 'Pesquisar tipo')}</th><th>{renderFilterHeader('Descrição', 'cash-description', cashFilters.description, cashFilterOptions('description'), (value) => setCashFilters((current) => ({ ...current, description: value })), () => setCashFilters((current) => ({ ...current, description: '' })), 'Pesquisar descrição')}</th><th>{renderFilterHeader('Origem', 'cash-origin', cashFilters.origin, cashFilterOptions('origin'), (value) => setCashFilters((current) => ({ ...current, origin: value })), () => setCashFilters((current) => ({ ...current, origin: '' })), 'Pesquisar origem')}</th><th>{renderFilterHeader('Responsável', 'cash-recordedBy', cashFilters.recordedBy, cashFilterOptions('recordedBy'), (value) => setCashFilters((current) => ({ ...current, recordedBy: value })), () => setCashFilters((current) => ({ ...current, recordedBy: '' })), 'Pesquisar responsável')}</th><th>{renderFilterHeader('Valor', 'cash-amount', cashFilters.amount, cashFilterOptions('amount'), (value) => setCashFilters((current) => ({ ...current, amount: value })), () => setCashFilters((current) => ({ ...current, amount: '' })), 'Pesquisar valor')}</th></tr></thead><tbody>{filteredCashEntries.length === 0 ? <tr><td colSpan={6} className="table-empty-cell">Nenhum lançamento encontrado com os filtros atuais.</td></tr> : filteredCashEntries.map((entry) => <tr key={entry.id}><td>{formatDateOnly(entry.entryDate, '-')}</td><td><span className={`status ${entry.entryType === 'REVENUE' ? 'open' : 'danger'}`}>{entry.entryType === 'REVENUE' ? 'Receita' : 'Despesa'}</span></td><td className="cash-description-cell"><strong>{entry.description}</strong></td><td>{entry.paymentId ? 'Mensalidade' : 'Manual'}</td><td>{entry.recordedByName?.trim() ? entry.recordedByName : <span className="payments-muted">-</span>}</td><td className={`cash-amount-cell ${entry.entryType === 'REVENUE' ? 'is-revenue' : 'is-expense'}`}>{entry.entryType === 'REVENUE' ? '+' : '-'} {money(entry.amountCents)}</td></tr>)}</tbody></table></div>}</section>}
      {paymentModal === 'generate' && <div className="modal"><form className="card modal-card payment-card wide-payment" onSubmit={(event) => { event.preventDefault(); void generateMonth().then(() => setPaymentModal(null)).catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao gerar mensalidades.')); }}><div className="card-head"><div><h2>Gerar mensalidades em lote</h2><p className="muted">Crie vários meses para todos os atletas ou para uma seleção específica.</p></div><button type="button" className="ghost" onClick={() => setPaymentModal(null)}>Fechar</button></div><div className="payment-form-grid"><label><span>Mês inicial</span><input type="month" value={month.slice(0, 7)} onChange={(event) => setMonth(`${event.target.value}-01`)} /></label><label><span>Quantidade de meses</span><input type="number" min="1" max="24" value={monthCount} onChange={(event) => setMonthCount(Number(event.target.value))} /></label><label><span>Vencimento inicial</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label><span>Valor mensal</span><input value={bulkAmount} onChange={(event) => setBulkAmount(event.target.value)} placeholder="Ex. 120,00" /></label></div><div className="segmented"><button type="button" className={generateForAll ? 'primary small' : 'ghost'} onClick={() => setGenerateForAll(true)}>Todos os atletas</button><button type="button" className={!generateForAll ? 'primary small' : 'ghost'} onClick={() => setGenerateForAll(false)}>Selecionar atletas</button></div>{!generateForAll && <div className="user-select-grid">{activeAthletes.map((user) => <label className="payment-user-option" key={user.id}><input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => toggleSelectedUser(user.id)} /> <span>{user.name}</span></label>)}</div>}<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observação opcional" /><div className="payment-preview"><span><b>{generateForAll ? activeAthletes.length : selectedUserIds.length}</b><small>atleta(s)</small></span><span><b>{monthCount}</b><small>mês(es)</small></span><span><b>{money(centsFromInput(bulkAmount || amount || '0') * monthCount * (generateForAll ? activeAthletes.length : selectedUserIds.length))}</b><small>volume gerado</small></span></div><button className="primary" disabled={!generateForAll && selectedUserIds.length === 0}>Gerar cobranças reais</button></form></div>}
      {paymentModal === 'register' && <div className="modal"><form className="card modal-card payment-card wide-payment" onSubmit={(event) => { event.preventDefault(); void save().then(() => setPaymentModal(null)).catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao registrar pagamento.')); }}><div className="card-head"><div><h2>Registrar pagamento</h2><p className="muted">Baixa total ou parcial. Só pagamento total antecipado gera ponto.</p></div><button type="button" className="ghost" onClick={() => setPaymentModal(null)}>Fechar</button></div><div className="payment-form-grid"><label><span>Atleta</span><select value={userId} onChange={(event) => setUserId(event.target.value)}>{activeAthletes.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label><span>Mês</span><input type="month" value={month.slice(0, 7)} onChange={(event) => setMonth(`${event.target.value}-01`)} /></label><label><span>Vencimento</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label><span>Data da baixa</span><input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></label><label><span>Valor da mensalidade</span><input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Valor individual" /></label>{status === 'PARTIAL' && <label><span>Valor recebido agora</span><input value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} placeholder="Valor parcial" /></label>}</div><div className="segmented payment-mode"><button type="button" className={status === 'PAID' ? 'primary small' : 'ghost'} onClick={() => { setStatus('PAID'); setFullPayment(true); }}>Pagamento total</button><button type="button" className={status === 'PARTIAL' ? 'primary small' : 'ghost'} onClick={() => { setStatus('PARTIAL'); setFullPayment(false); }}>Pagamento parcial</button><button type="button" className={status === 'PENDING' ? 'primary small' : 'ghost'} onClick={() => { setStatus('PENDING'); setFullPayment(false); }}>Pendente</button><button type="button" className={status === 'LATE' ? 'primary small' : 'ghost'} onClick={() => { setStatus('LATE'); setFullPayment(false); }}>Atrasado</button><button type="button" className={status === 'WAIVED' ? 'primary small' : 'ghost'} onClick={() => { setStatus('WAIVED'); setFullPayment(false); }}>Isento</button></div><div className="payment-preview"><span><b>{money(registerAmountCents)}</b><small>valor</small></span><span><b>{money(registerPaidCents)}</b><small>pago após baixa</small></span><span><b>{money(registerBalanceCents)}</b><small>saldo restante</small></span></div>{fullPayment && status === 'PAID' && <p className="muted">Se a data da baixa for antes do vencimento, o atleta recebe +1 ponto automaticamente.</p>}<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observação" /><button className="primary">Salvar baixa</button></form></div>}
      {paymentModal === 'cash' && <div className="modal"><form className="card modal-card payment-card wide-payment" onSubmit={(event) => { event.preventDefault(); void saveCashEntry().then(() => setPaymentModal(null)).catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao lançar caixa.')); }}><div className="card-head"><div><h2>Lançamento de caixa</h2><p className="muted">Use para despesas e receitas avulsas. Mensalidades pagas entram automaticamente.</p></div><button type="button" className="ghost" onClick={() => setPaymentModal(null)}>Fechar</button></div><div className="segmented payment-mode"><button type="button" className={cashEntryType === 'REVENUE' ? 'primary small' : 'ghost'} onClick={() => setCashEntryType('REVENUE')}>Receita</button><button type="button" className={cashEntryType === 'EXPENSE' ? 'primary small' : 'ghost'} onClick={() => setCashEntryType('EXPENSE')}>Despesa</button></div><div className="payment-form-grid"><label><span>Data</span><input type="date" value={cashDate} onChange={(event) => setCashDate(event.target.value)} /></label><label><span>Valor</span><input value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} placeholder="Ex. 85,00" /></label></div><input value={cashDescription} onChange={(event) => setCashDescription(event.target.value)} placeholder="Descrição: aluguel da quadra, bola nova, patrocínio, etc." required minLength={3} maxLength={240} /><div className="payment-preview"><span><b>{cashEntryType === 'REVENUE' ? 'Receita' : 'Despesa'}</b><small>tipo</small></span><span><b>{money(centsFromInput(cashAmount))}</b><small>valor</small></span><span><b>{formatDateOnly(cashDate, '--/--/----')}</b><small>data</small></span></div><button className="primary" disabled={centsFromInput(cashAmount) <= 0 || cashDescription.trim().length < 3}>Salvar lançamento</button></form></div>}
    </section>
  );
}

function AwardSettingsCard({ api }: { api: ApiClient }) {
  const [categories, setCategories] = useState<AwardSetting[]>([]);
  const [message, setMessage] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newMetric, setNewMetric] = useState<MetricCode>('TOTAL_POINTS');
  const [newType, setNewType] = useState<AwardType>('RANKING');
  const [newIcon, setNewIcon] = useState('🏅');
  const [tableFilters, setTableFilters] = useState({ label: '', type: '', metric: '', sortDirection: '', winners: '', minGames: '', voteSlots: '', allowSelfVote: '', badgeIcon: '', badgeColor: '', active: '', hint: '' });
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  useEffect(() => {
    setFilterSearch('');
  }, [activeFilterMenu]);

  async function loadSettings() {
    setCategories(await api.request<AwardSetting[]>('/settings/awards'));
  }

  useEffect(() => {
    void loadSettings().catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao carregar configuração de prêmios.'));
  }, []);

  async function save() {
    const updated = await api.request<AwardSetting[]>('/settings/awards', { method: 'PUT', body: JSON.stringify({ categories }) });
    setCategories(updated);
    setMessage('Central de regras salva. Rankings, votação e badges passam a usar esta configuração.');
  }

  function patchCategory(code: string, patch: Partial<AwardSetting>) {
    setCategories((list) => list.map((item) => item.code === code ? { ...item, ...patch, votingEnabled: patch.awardType === 'VOTACAO' ? true : patch.awardType ? false : item.votingEnabled } : item));
  }

  function addCategory() {
    const label = newLabel.trim();
    if (!label) {
      setMessage('Informe o nome da regra/premiação antes de adicionar.');
      return;
    }
    const code = awardCodeFromLabel(label);
    if (categories.some((item) => item.code === code)) {
      setMessage('Já existe uma regra com este nome/código. Ajuste o nome para diferenciar.');
      return;
    }
    setCategories((list) => [{
      code,
      label,
      votingEnabled: newType === 'VOTACAO',
      adminOnly: false,
      active: true,
      awardType: newType,
      metricCode: newType === 'RANKING' ? newMetric : null,
      sortDirection: 'DESC',
      winnersCount: 1,
      minGames: 0,
      voteSlots: 1,
      allowSelfVote: false,
      badgeIcon: newIcon,
      badgeColor: '#3b82f6'
    }, ...list]);
    setNewLabel('');
    setNewIcon('🏅');
    setMessage('Regra adicionada na tela. Clique em salvar para gravar no banco.');
  }

  function toggleFilterMenu(key: string) {
    setActiveFilterMenu((current) => current === key ? null : key);
  }

  function filterValue(item: AwardSetting, key: keyof typeof tableFilters) {
    if (key === 'label') return item.label;
    if (key === 'type') return item.awardType === 'RANKING' ? 'Ranking automático' : item.awardType === 'VOTACAO' ? 'Votação' : item.awardType === 'SORTEIO' ? 'Sorteio/manual' : 'Premiação manual';
    if (key === 'metric') return item.awardType === 'RANKING' ? metricLabel(item.metricCode) : item.votingEnabled ? 'Entra na votação' : 'Sem votação';
    if (key === 'sortDirection') return item.sortDirection === 'DESC' ? 'Maior vence' : 'Menor vence';
    if (key === 'winners') return String(item.winnersCount);
    if (key === 'minGames') return String(item.minGames);
    if (key === 'voteSlots') return String(item.voteSlots);
    if (key === 'allowSelfVote') return item.allowSelfVote ? 'Permitido' : 'Bloqueado';
    if (key === 'badgeIcon') return item.badgeIcon;
    if (key === 'badgeColor') return item.badgeColor;
    if (key === 'active') return item.active ? 'Ativa' : 'Inativa';
    return metricOptions.find((metric) => metric.value === item.metricCode)?.hint ?? 'Configure como votação, sorteio ou premiação manual quando não depender de cálculo automático.';
  }

  function filterOptions(key: keyof typeof tableFilters) {
    return buildTableFilterOptions(categories.map((item) => filterValue(item, key)));
  }

  const filteredCategories = useMemo(() => categories.filter((item) => Object.entries(tableFilters).every(([key, value]) => !value || normalizeTableFilterValue(filterValue(item, key as keyof typeof tableFilters)).includes(normalizeTableFilterValue(value)))), [categories, tableFilters]);

  return (
    <section className="card compact rules-center">
      <div className="card-head">
        <div>
          <h2>Central de regras, rankings e premiações</h2>
          <p className="muted">Configure pontuação, acompanhamentos individuais, votação e badges sem alterar código.</p>
        </div>
        <button className="primary small" onClick={save}>Salvar central</button>
      </div>

      {message && <p className="status-line">{message}</p>}

      <div className="rule-create">
        <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Nova regra: Ex. Rei dos cartões" />
        <select value={newType} onChange={(event) => setNewType(event.target.value as AwardType)}>
          <option value="RANKING">Ranking automático</option>
          <option value="VOTACAO">Votação</option>
          <option value="SORTEIO">Sorteio/manual</option>
          <option value="MANUAL">Premiação manual</option>
        </select>
        {newType === 'RANKING' && (
          <select value={newMetric} onChange={(event) => setNewMetric(event.target.value as MetricCode)}>
            {metricOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        )}
        <input value={newIcon} onChange={(event) => setNewIcon(event.target.value)} maxLength={4} placeholder="🏅" />
        <button className="ghost" onClick={addCategory}>Adicionar regra</button>
      </div>

      <div className="championship-wrap management-table-wrap">
        <table className="championship-table management-table rules-table">
          <thead>
          </thead>
          <tbody>
            <tr><th>{TableFilterHeader({ label: 'Regra', menuKey: 'award-label', currentValue: tableFilters.label, options: filterOptions('label'), activeMenu: activeFilterMenu, searchValue: filterSearch, placeholder: 'Pesquisar regra', onToggle: toggleFilterMenu, onSearchChange: setFilterSearch, onSelect: (value) => { setTableFilters((current) => ({ ...current, label: value })); setActiveFilterMenu(null); }, onClear: () => { setTableFilters((current) => ({ ...current, label: '' })); setActiveFilterMenu(null); } })}</th><th>{TableFilterHeader({ label: 'Tipo', menuKey: 'award-type', currentValue: tableFilters.type, options: filterOptions('type'), activeMenu: activeFilterMenu, searchValue: filterSearch, placeholder: 'Pesquisar tipo', onToggle: toggleFilterMenu, onSearchChange: setFilterSearch, onSelect: (value) => { setTableFilters((current) => ({ ...current, type: value })); setActiveFilterMenu(null); }, onClear: () => { setTableFilters((current) => ({ ...current, type: '' })); setActiveFilterMenu(null); } })}</th><th>{TableFilterHeader({ label: 'Métrica / Votação', menuKey: 'award-metric', currentValue: tableFilters.metric, options: filterOptions('metric'), activeMenu: activeFilterMenu, searchValue: filterSearch, placeholder: 'Pesquisar métrica', onToggle: toggleFilterMenu, onSearchChange: setFilterSearch, onSelect: (value) => { setTableFilters((current) => ({ ...current, metric: value })); setActiveFilterMenu(null); }, onClear: () => { setTableFilters((current) => ({ ...current, metric: '' })); setActiveFilterMenu(null); } })}</th><th>{TableFilterHeader({ label: 'Ordenação', menuKey: 'award-sort', currentValue: tableFilters.sortDirection, options: filterOptions('sortDirection'), activeMenu: activeFilterMenu, searchValue: filterSearch, placeholder: 'Pesquisar ordenação', onToggle: toggleFilterMenu, onSearchChange: setFilterSearch, onSelect: (value) => { setTableFilters((current) => ({ ...current, sortDirection: value })); setActiveFilterMenu(null); }, onClear: () => { setTableFilters((current) => ({ ...current, sortDirection: '' })); setActiveFilterMenu(null); } })}</th><th>{TableFilterHeader({ label: 'Vencedores', menuKey: 'award-winners', currentValue: tableFilters.winners, options: filterOptions('winners'), activeMenu: activeFilterMenu, searchValue: filterSearch, placeholder: 'Pesquisar quantidade', onToggle: toggleFilterMenu, onSearchChange: setFilterSearch, onSelect: (value) => { setTableFilters((current) => ({ ...current, winners: value })); setActiveFilterMenu(null); }, onClear: () => { setTableFilters((current) => ({ ...current, winners: '' })); setActiveFilterMenu(null); } })}</th><th>{TableFilterHeader({ label: 'Mín. jogos', menuKey: 'award-minGames', currentValue: tableFilters.minGames, options: filterOptions('minGames'), activeMenu: activeFilterMenu, searchValue: filterSearch, placeholder: 'Pesquisar mínimo', onToggle: toggleFilterMenu, onSearchChange: setFilterSearch, onSelect: (value) => { setTableFilters((current) => ({ ...current, minGames: value })); setActiveFilterMenu(null); }, onClear: () => { setTableFilters((current) => ({ ...current, minGames: '' })); setActiveFilterMenu(null); } })}</th><th>{TableFilterHeader({ label: 'Votos', menuKey: 'award-voteSlots', currentValue: tableFilters.voteSlots, options: filterOptions('voteSlots'), activeMenu: activeFilterMenu, searchValue: filterSearch, placeholder: 'Pesquisar votos', onToggle: toggleFilterMenu, onSearchChange: setFilterSearch, onSelect: (value) => { setTableFilters((current) => ({ ...current, voteSlots: value })); setActiveFilterMenu(null); }, onClear: () => { setTableFilters((current) => ({ ...current, voteSlots: '' })); setActiveFilterMenu(null); } })}</th><th>{TableFilterHeader({ label: 'Auto-voto', menuKey: 'award-selfVote', currentValue: tableFilters.allowSelfVote, options: filterOptions('allowSelfVote'), activeMenu: activeFilterMenu, searchValue: filterSearch, placeholder: 'Pesquisar auto-voto', onToggle: toggleFilterMenu, onSearchChange: setFilterSearch, onSelect: (value) => { setTableFilters((current) => ({ ...current, allowSelfVote: value })); setActiveFilterMenu(null); }, onClear: () => { setTableFilters((current) => ({ ...current, allowSelfVote: '' })); setActiveFilterMenu(null); } })}</th><th>{TableFilterHeader({ label: 'Ícone', menuKey: 'award-icon', currentValue: tableFilters.badgeIcon, options: filterOptions('badgeIcon'), activeMenu: activeFilterMenu, searchValue: filterSearch, placeholder: 'Pesquisar ícone', onToggle: toggleFilterMenu, onSearchChange: setFilterSearch, onSelect: (value) => { setTableFilters((current) => ({ ...current, badgeIcon: value })); setActiveFilterMenu(null); }, onClear: () => { setTableFilters((current) => ({ ...current, badgeIcon: '' })); setActiveFilterMenu(null); } })}</th><th>{TableFilterHeader({ label: 'Cor', menuKey: 'award-color', currentValue: tableFilters.badgeColor, options: filterOptions('badgeColor'), activeMenu: activeFilterMenu, searchValue: filterSearch, placeholder: 'Pesquisar cor', onToggle: toggleFilterMenu, onSearchChange: setFilterSearch, onSelect: (value) => { setTableFilters((current) => ({ ...current, badgeColor: value })); setActiveFilterMenu(null); }, onClear: () => { setTableFilters((current) => ({ ...current, badgeColor: '' })); setActiveFilterMenu(null); } })}</th><th>{TableFilterHeader({ label: 'Status', menuKey: 'award-active', currentValue: tableFilters.active, options: filterOptions('active'), activeMenu: activeFilterMenu, searchValue: filterSearch, placeholder: 'Pesquisar status', onToggle: toggleFilterMenu, onSearchChange: setFilterSearch, onSelect: (value) => { setTableFilters((current) => ({ ...current, active: value })); setActiveFilterMenu(null); }, onClear: () => { setTableFilters((current) => ({ ...current, active: '' })); setActiveFilterMenu(null); } })}</th><th>{TableFilterHeader({ label: 'Dica', menuKey: 'award-hint', currentValue: tableFilters.hint, options: filterOptions('hint'), activeMenu: activeFilterMenu, searchValue: filterSearch, placeholder: 'Pesquisar dica', onToggle: toggleFilterMenu, onSearchChange: setFilterSearch, onSelect: (value) => { setTableFilters((current) => ({ ...current, hint: value })); setActiveFilterMenu(null); }, onClear: () => { setTableFilters((current) => ({ ...current, hint: '' })); setActiveFilterMenu(null); } })}</th></tr>
            {filteredCategories.length === 0 ? <tr><td colSpan={12} className="table-empty-cell">Nenhuma regra encontrada com os filtros atuais.</td></tr> : filteredCategories.map((item) => <tr key={item.code}><td className="management-main-cell"><div className="rule-title"><span className="rule-icon" style={{ background: `${item.badgeColor}33`, color: item.badgeColor }}>{item.badgeIcon}</span><div><input value={item.label} onChange={(event) => patchCategory(item.code, { label: event.target.value })} /><small>{item.code}</small></div></div></td><td><select value={item.awardType} onChange={(event) => patchCategory(item.code, { awardType: event.target.value as AwardType })}><option value="RANKING">Ranking automático</option><option value="VOTACAO">Votação</option><option value="SORTEIO">Sorteio/manual</option><option value="MANUAL">Premiação manual</option></select></td><td>{item.awardType === 'RANKING' ? <select value={item.metricCode ?? 'TOTAL_POINTS'} onChange={(event) => patchCategory(item.code, { metricCode: event.target.value as MetricCode })}>{metricOptions.map((metric) => <option key={metric.value} value={metric.value}>{metric.label}</option>)}</select> : <label className="bench compact-bench"><input type="checkbox" checked={item.votingEnabled} onChange={(event) => patchCategory(item.code, { votingEnabled: event.target.checked, awardType: 'VOTACAO' })} />Entra na votação</label>}</td><td><select value={item.sortDirection} onChange={(event) => patchCategory(item.code, { sortDirection: event.target.value as 'ASC' | 'DESC' })}><option value="DESC">Maior vence</option><option value="ASC">Menor vence</option></select></td><td><input type="number" min="1" max="20" value={item.winnersCount} onChange={(event) => patchCategory(item.code, { winnersCount: Number(event.target.value) })} /></td><td><input type="number" min="0" max="500" value={item.minGames} onChange={(event) => patchCategory(item.code, { minGames: Number(event.target.value) })} /></td><td><input type="number" min="1" max="7" value={item.voteSlots} onChange={(event) => patchCategory(item.code, { voteSlots: Number(event.target.value) })} /></td><td><label className="bench compact-bench"><input type="checkbox" checked={item.allowSelfVote} onChange={(event) => patchCategory(item.code, { allowSelfVote: event.target.checked })} />Permitido</label></td><td><input value={item.badgeIcon} onChange={(event) => patchCategory(item.code, { badgeIcon: event.target.value })} maxLength={4} /></td><td><input value={item.badgeColor} onChange={(event) => patchCategory(item.code, { badgeColor: event.target.value })} /></td><td><label className="bench compact-bench"><input type="checkbox" checked={item.active} onChange={(event) => patchCategory(item.code, { active: event.target.checked })} />{item.active ? 'Ativa' : 'Inativa'}</label></td><td className="management-hint-cell">{metricOptions.find((metric) => metric.value === item.metricCode)?.hint ?? 'Configure como votação, sorteio ou premiação manual quando não depender de cálculo automático.'}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AwardsPanel({ api, users, activeSeason, isAdmin, onVoted }: { api: ApiClient; users: User[]; activeSeason?: Season; isAdmin: boolean; onVoted?: () => Promise<void> | void }) {
  const [category, setCategory] = useState('CRAQUE_GALERA');
  const [votedUserId, setVotedUserId] = useState(users[0]?.id ?? '');
  const [voteUserIds, setVoteUserIds] = useState<string[]>([users[0]?.id ?? '']);
  const goalkeepers = users.filter((user) => user.position === 'GO');
  const linePlayers = users.filter((user) => user.position !== 'GO');
  const [selectionGoalkeeperId, setSelectionGoalkeeperId] = useState(goalkeepers[0]?.id ?? '');
  const [selectionLineUserIds, setSelectionLineUserIds] = useState<string[]>(Array(6).fill(''));
  const [categories, setCategories] = useState<AwardCategory[]>([]);
  const [myVotes, setMyVotes] = useState<MyVote[]>([]);
  const [results, setResults] = useState<AwardResult[]>([]);
  const [message, setMessage] = useState('');

  async function loadCategories() {
    const data = await api.request<AwardCategory[]>('/awards/categories');
    setCategories(data);
    if (!data.some((item) => item.code === category) && data[0]) setCategory(data[0].code);
  }

  async function loadMyVotes() {
    if (!activeSeason) return;
    setMyVotes(await api.request<MyVote[]>(`/awards/my-votes/${activeSeason.id}`));
  }

  async function loadResults() {
    if (!activeSeason || !isAdmin) return;
    setResults(await api.request<AwardResult[]>(`/awards/results/${activeSeason.id}`));
  }

  useEffect(() => {
    void loadCategories().catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao carregar categorias.'));
  }, []);

  useEffect(() => {
    if (!votedUserId && users[0]?.id) setVotedUserId(users[0].id);
    setVoteUserIds((current) => current.length ? current.map((id, index) => id || users[index]?.id || users[0]?.id || '') : [users[0]?.id ?? '']);
    if (!selectionGoalkeeperId && goalkeepers[0]?.id) setSelectionGoalkeeperId(goalkeepers[0].id);
    setSelectionLineUserIds((current) => current.map((id, index) => id || linePlayers[index]?.id || ''));
  }, [users, votedUserId]);

  useEffect(() => {
    void loadMyVotes().catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao carregar seus votos.'));
    void loadResults().catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao carregar resultados.'));
  }, [activeSeason?.id, isAdmin]);

  useEffect(() => {
    const selectionVotes = myVotes.filter((voteItem) => voteItem.categoryCode === 'SELECAO_ANO');
    const goalkeeperVote = selectionVotes.find((voteItem) => voteItem.voteSlot === 1);
    const lineVotes = selectionVotes.filter((voteItem) => voteItem.voteSlot > 1).sort((left, right) => left.voteSlot - right.voteSlot);
    if (goalkeeperVote) setSelectionGoalkeeperId(goalkeeperVote.votedUserId);
    if (lineVotes.length) setSelectionLineUserIds(Array.from({ length: 6 }, (_, index) => lineVotes[index]?.votedUserId ?? linePlayers[index]?.id ?? ''));
  }, [myVotes]);

  async function vote() {
    if (!activeSeason) return;
    if (category === 'SELECAO_ANO') {
      const selectedIds = [selectionGoalkeeperId, ...selectionLineUserIds].filter(Boolean);
      if (selectedIds.length !== 7 || new Set(selectedIds).size !== 7) {
        setMessage('Seleção do ano precisa ter 1 goleiro e 6 jogadores de linha diferentes.');
        return;
      }
      await api.request('/awards/selection-year', { method: 'POST', body: JSON.stringify({ seasonId: activeSeason.id, goalkeeperUserId: selectionGoalkeeperId, lineUserIds: selectionLineUserIds }) });
    } else {
      const slots = categories.find((item) => item.code === category)?.voteSlots ?? 1;
      const votes = Array.from({ length: slots }, (_item, index) => voteUserIds[index] || votedUserId || users[index]?.id || users[0]?.id || '').filter(Boolean);
      if (votes.length !== slots || new Set(votes).size !== votes.length) {
        setMessage('Revise os votos: a categoria exige atletas preenchidos e sem repetição.');
        return;
      }
      await api.request('/awards/vote', { method: 'POST', body: JSON.stringify({ seasonId: activeSeason.id, categoryCode: category, votes }) });
    }
    setMessage('Voto registrado com sigilo. Resultado visível apenas ao ADMIN.');
    await loadMyVotes();
    await loadResults();
    await onVoted?.();
  }

  async function consolidate() {
    if (!activeSeason) return;
    await api.request(`/awards/consolidate/${activeSeason.id}`, { method: 'POST' });
    setMessage('Vencedores consolidados: prêmios gravados no histórico e badges dos atletas.');
    await loadResults();
    await onVoted?.();
  }

  const groupedResults = results.reduce<Record<string, AwardResult[]>>((acc, item) => {
    acc[item.label] = [...(acc[item.label] ?? []), item];
    return acc;
  }, {});
  const voteMap = new Map(myVotes.filter((item) => item.categoryCode !== 'SELECAO_ANO').map((item) => [item.categoryCode, users.find((user) => user.id === item.votedUserId)?.name ?? 'Atleta removido']));
  const selectionVoteNames = myVotes.filter((item) => item.categoryCode === 'SELECAO_ANO').sort((left, right) => left.voteSlot - right.voteSlot).map((item) => users.find((user) => user.id === item.votedUserId)?.name ?? 'Atleta removido');
  const selectionDuplicate = new Set([selectionGoalkeeperId, ...selectionLineUserIds].filter(Boolean)).size !== [selectionGoalkeeperId, ...selectionLineUserIds].filter(Boolean).length;
  const selectedCategory = categories.find((item) => item.code === category);
  const selectedVoteSlots = category === 'SELECAO_ANO' ? 1 : selectedCategory?.voteSlots ?? 1;
  const genericVotes = Array.from({ length: selectedVoteSlots }, (_item, index) => voteUserIds[index] || votedUserId || users[index]?.id || users[0]?.id || '');
  const genericVoteDuplicate = category !== 'SELECAO_ANO' && new Set(genericVotes.filter(Boolean)).size !== genericVotes.filter(Boolean).length;

  return <div className="grid two"><section className="card compact"><h2>Votação dos prêmios</h2><p className="muted">Escolha com carinho. O voto é sigiloso; a resenha fica para depois.</p><div className="inline-form"><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select>{category !== 'SELECAO_ANO' && <select value={votedUserId} onChange={(event) => setVotedUserId(event.target.value)}>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>}<button className="primary" onClick={vote} disabled={!activeSeason || activeSeason.status !== 'CLOSED' || !categories.length || (category === 'SELECAO_ANO' && selectionDuplicate)}>Votar</button></div>{category === 'SELECAO_ANO' && <div className="selection-grid"><label><span>Goleiro da seleção</span><select value={selectionGoalkeeperId} onChange={(event) => setSelectionGoalkeeperId(event.target.value)}>{goalkeepers.map((user) => <option key={user.id} value={user.id}>{user.name} • {positionLabel(user.position)}</option>)}</select></label>{selectionLineUserIds.map((lineUserId, index) => <label key={`linha-${index}`}><span>Linha {index + 1}</span><select value={lineUserId} onChange={(event) => setSelectionLineUserIds((list) => list.map((current, currentIndex) => currentIndex === index ? event.target.value : current))}>{linePlayers.map((user) => <option key={user.id} value={user.id}>{user.name} • {positionLabel(user.position)}</option>)}</select></label>)}<small className="muted">Seleção do ano: 1 goleiro + 6 jogadores de linha diferentes.</small>{selectionDuplicate && <small className="muted">A seleção não pode repetir atleta.</small>}</div>}{activeSeason?.status !== 'CLOSED' && <p className="muted">A votação abre quando a temporada for encerrada.</p>}{message && <p className="muted">{message}</p>}<div className="chips">{categories.map((item) => <span className="chip" key={item.code}>{item.label}: {item.code === 'SELECAO_ANO' ? selectionVoteNames.length === 7 ? selectionVoteNames.join(', ') : 'sem voto' : voteMap.get(item.code) ?? 'sem voto'}</span>)}</div><div className="award-cards"><article><strong>🏆 Ranking automático</strong><span>Campeão, vice, terceiro, artilheiro, garçom e assiduidade geram prêmios e badges no fechamento.</span></article><article><strong>🗳️ Voto dos atletas</strong><span>Seleção do ano recebe 7 votos: 1 GO e 6 linhas. Demais categorias recebem voto único.</span></article></div></section><section className="card compact"><div className="card-head"><h2>Apuração ADMIN</h2>{isAdmin && activeSeason && <button className="primary small" onClick={consolidate}>Consolidar</button>}</div>{!isAdmin ? <EmptyState title="Resultado sigiloso" text="A apuração fica protegida e só aparece para ADMIN." /> : Object.keys(groupedResults).length === 0 ? <EmptyState title="Sem votos ainda" text="Quando os atletas votarem, a liderança de cada categoria aparece aqui." /> : <div className="table-cards">{Object.entries(groupedResults).map(([label, rows]) => <article className="row-card" key={label}><strong>{label}</strong><span>{rows[0]?.name}</span><small>{rows.slice(0, label === 'Seleção do ano' ? 8 : 3).map((row) => `${label === 'Seleção do ano' ? row.voteSlot === 1 ? 'GO ' : 'LINHA ' : ''}${row.name}: ${row.votes}`).join(' • ')}</small></article>)}</div>}</section></div>;
}

function AwardLeaderboardsPanel({ api, activeSeason }: { api: ApiClient; activeSeason?: Season }) {
  const [boards, setBoards] = useState<AwardLeaderboard[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!activeSeason) return;
    api.request<AwardLeaderboard[]>(`/awards/leaderboards/${activeSeason.id}`)
      .then(setBoards)
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao carregar acompanhamentos configurados.'));
  }, [api, activeSeason?.id]);

  return <section className="card compact span"><div className="card-head"><div><h2>Acompanhamentos configurados</h2><p className="muted">Rankings automáticos definidos na Central de Regras, usando dados reais das súmulas.</p></div><span className="status open">{boards.length} regra(s)</span></div>{message && <p className="muted">{message}</p>}<div className="award-board-grid">{boards.length === 0 ? <EmptyState title="Sem acompanhamentos ativos" text="Crie regras de ranking automático na configuração de prêmios para acompanhar métricas individuais." /> : boards.map((board) => <article className="award-board" key={board.code}><div className="rule-title"><span className="rule-icon" style={{ background: `${board.badgeColor}33`, color: board.badgeColor }}>{board.badgeIcon}</span><div><strong>{board.label}</strong><small>{metricLabel(board.metricCode)} • {board.sortDirection === 'DESC' ? 'maior vence' : 'menor vence'} • mínimo {board.minGames} jogo(s)</small></div></div>{board.rows.length === 0 ? <small className="muted">Sem dados suficientes nesta temporada.</small> : board.rows.map((row) => <span className="board-row" key={`${board.code}-${row.userId}`}><b>{row.position}º {row.name}</b><em>{Number(row.value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</em></span>)}</article>)}</div></section>;
}

function normalizeHeader(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function readNumber(value: string | undefined): number {
  const normalized = (value ?? '0').replace(/\./g, '').replace(',', '.').trim();
  const parsed = Number(normalized || 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function parseStandingClipboard(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map(normalizeHeader);
  const pick = (cells: string[], aliases: string[]) => {
    const index = headers.findIndex((header) => aliases.includes(header));
    return index >= 0 ? cells[index]?.trim() : undefined;
  };
  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter);
    return {
      name: pick(cells, ['nome', 'atleta', 'jogador']),
      email: pick(cells, ['email', 'e-mail']),
      totalPoints: readNumber(pick(cells, ['pontos', 'pts', 'total', 'totalpontos'])),
      gamesPlayed: readNumber(pick(cells, ['jogos', 'jogo', 'j'])),
      presences: readNumber(pick(cells, ['presencas', 'presenca', 'pres'])),
      wins: readNumber(pick(cells, ['v', 'vit', 'vitorias'])),
      draws: readNumber(pick(cells, ['e', 'empates'])),
      losses: readNumber(pick(cells, ['d', 'derrotas'])),
      paidMonths: readNumber(pick(cells, ['mensalidades', 'mesespagos', 'pagas', 'pagamentos'])),
      goals: readNumber(pick(cells, ['gols', 'gol', 'g'])),
      ownGoals: readNumber(pick(cells, ['golscontra', 'golcontra', 'contra', 'gc'])),
      assists: readNumber(pick(cells, ['assistencias', 'assistencia', 'assist', 'a'])),
      yellowCards: readNumber(pick(cells, ['amarelos', 'amarelo', 'ca'])),
      redCards: readNumber(pick(cells, ['vermelhos', 'vermelho', 'cv'])),
      blueCards: readNumber(pick(cells, ['azuis', 'azul'])),
      teamGoalsFor: readNumber(pick(cells, ['marcados', 'golsdaequipe', 'golspro', 'pro'])),
      teamGoalsAgainst: readNumber(pick(cells, ['sofridos', 'golssofridos', 'contraequipe']))
    };
  }).filter((row) => row.email || row.name);
}

function UsersAdminTable({ api, users, onReload, isAdmin, emptyText }: { api: ApiClient; users: User[]; onReload: () => Promise<void>; isAdmin: boolean; emptyText: string }) {
  const [filters, setFilters] = useState({ name: '', email: '', role: '', position: '', status: '' });
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  useEffect(() => {
    setFilterSearch('');
  }, [activeFilterMenu]);

  function filterValue(user: User, key: keyof typeof filters) {
    if (key === 'name') return user.name;
    if (key === 'email') return user.email;
    if (key === 'role') return user.role;
    if (key === 'position') return positionLabel(user.position);
    return user.active !== false ? 'Ativo' : 'Inativo';
  }

  function filterOptions(key: keyof typeof filters) {
    return buildTableFilterOptions(users.map((user) => filterValue(user, key)));
  }

  const filteredUsers = useMemo(() => users.filter((user) => Object.entries(filters).every(([key, value]) => !value || normalizeTableFilterValue(filterValue(user, key as keyof typeof filters)).includes(normalizeTableFilterValue(value)))), [users, filters]);

  return (
    <div className="championship-wrap management-table-wrap">
      <table className="championship-table management-table users-management-table">
        <thead>
          <tr>
            <th><TableFilterHeader label="Nome" menuKey="users-name" currentValue={filters.name} options={filterOptions('name')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar nome" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, name: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, name: '' })); setActiveFilterMenu(null); }} /></th>
            <th><TableFilterHeader label="E-mail" menuKey="users-email" currentValue={filters.email} options={filterOptions('email')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar e-mail" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, email: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, email: '' })); setActiveFilterMenu(null); }} /></th>
            <th className="users-role-col"><TableFilterHeader label="Perfil" menuKey="users-role" currentValue={filters.role} options={filterOptions('role')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar perfil" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, role: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, role: '' })); setActiveFilterMenu(null); }} /></th>
            <th className="users-position-col"><TableFilterHeader label="Posição" menuKey="users-position" currentValue={filters.position} options={filterOptions('position')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar posição" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, position: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, position: '' })); setActiveFilterMenu(null); }} /></th>
            <th className="users-status-col"><TableFilterHeader label="Status" menuKey="users-status" currentValue={filters.status} options={filterOptions('status')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar status" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, status: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, status: '' })); setActiveFilterMenu(null); }} /></th>
            <th className="users-actions-col">Ações</th>
            <th>Retorno</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length === 0 ? <tr><td colSpan={7} className="table-empty-cell">{emptyText}</td></tr> : filteredUsers.map((user) => <UserAdminTableRow key={user.id} api={api} user={user} isAdmin={isAdmin} onReload={onReload} />)}
        </tbody>
      </table>
    </div>
  );
}

function SeasonsAdminTable({ seasons, onStartSeason, onCloseSeason }: { seasons: Season[]; onStartSeason: (id: string) => Promise<void>; onCloseSeason: (id: string) => Promise<void> }) {
  const [filters, setFilters] = useState({ name: '', year: '', status: '', startsOn: '', endsOn: '' });
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  useEffect(() => {
    setFilterSearch('');
  }, [activeFilterMenu]);

  function statusLabel(status: Season['status']) {
    return status === 'OPEN' ? 'Aberta' : status === 'CLOSED' ? 'Encerrada' : 'Rascunho';
  }

  function filterValue(season: Season, key: keyof typeof filters) {
    if (key === 'name') return season.name;
    if (key === 'year') return String(season.year);
    if (key === 'status') return statusLabel(season.status);
    if (key === 'startsOn') return formatDateOnly(season.startsOn, 'Sem início');
    return formatDateOnly(season.endsOn, 'Sem fim');
  }

  function filterOptions(key: keyof typeof filters) {
    return buildTableFilterOptions(seasons.map((season) => filterValue(season, key)));
  }

  const filteredSeasons = useMemo(() => seasons.filter((season) => Object.entries(filters).every(([key, value]) => !value || normalizeTableFilterValue(filterValue(season, key as keyof typeof filters)).includes(normalizeTableFilterValue(value)))), [seasons, filters]);

  return (
    <div className="championship-wrap management-table-wrap">
      <table className="championship-table management-table seasons-management-table">
        <thead>
          <tr>
            <th className="seasons-name-col"><TableFilterHeader label="Temporada" menuKey="seasons-name" currentValue={filters.name} options={filterOptions('name')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar temporada" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, name: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, name: '' })); setActiveFilterMenu(null); }} /></th>
            <th className="seasons-year-col"><TableFilterHeader label="Ano" menuKey="seasons-year" currentValue={filters.year} options={filterOptions('year')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar ano" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, year: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, year: '' })); setActiveFilterMenu(null); }} /></th>
            <th className="seasons-status-col"><TableFilterHeader label="Status" menuKey="seasons-status" currentValue={filters.status} options={filterOptions('status')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar status" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, status: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, status: '' })); setActiveFilterMenu(null); }} /></th>
            <th className="seasons-start-col"><TableFilterHeader label="Início" menuKey="seasons-start" currentValue={filters.startsOn} options={filterOptions('startsOn')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar início" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, startsOn: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, startsOn: '' })); setActiveFilterMenu(null); }} /></th>
            <th className="seasons-end-col"><TableFilterHeader label="Fim" menuKey="seasons-end" currentValue={filters.endsOn} options={filterOptions('endsOn')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar fim" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, endsOn: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, endsOn: '' })); setActiveFilterMenu(null); }} /></th>
            <th className="seasons-actions-col">Ações</th>
          </tr>
        </thead>
        <tbody>
          {filteredSeasons.length === 0 ? <tr><td colSpan={6} className="table-empty-cell">Nenhuma temporada encontrada com os filtros atuais.</td></tr> : filteredSeasons.map((season) => <tr key={season.id}><td className="management-main-cell seasons-name-cell"><strong>{season.name}</strong></td><td className="seasons-year-cell">{season.year}</td><td className="seasons-status-cell"><span className={`status ${season.status.toLowerCase()}`}>{statusLabel(season.status)}</span></td><td className="seasons-start-cell">{formatDateOnly(season.startsOn, 'Sem início')}</td><td className="seasons-end-cell">{formatDateOnly(season.endsOn, 'Sem fim')}</td><td className="seasons-actions-cell"><div className="actions compact-actions seasons-row-actions">{season.status !== 'OPEN' && season.status !== 'CLOSED' && <button className="primary small" onClick={() => void onStartSeason(season.id)}>Iniciar</button>}{season.status === 'OPEN' && <button className="ghost" onClick={() => void onCloseSeason(season.id)}>Encerrar e liberar votação</button>}{season.status === 'CLOSED' && <span className="payments-muted">Encerrada</span>}</div></td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function PointsSettingsTable({ points, onPointChange }: { points: PointSetting[]; onPointChange: (code: string, points: number) => void }) {
  const [filters, setFilters] = useState({ label: '', code: '', points: '' });
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  useEffect(() => {
    setFilterSearch('');
  }, [activeFilterMenu]);

  function filterValue(item: PointSetting, key: keyof typeof filters) {
    if (key === 'label') return item.label;
    if (key === 'code') return item.code;
    return String(item.points);
  }

  function filterOptions(key: keyof typeof filters) {
    return buildTableFilterOptions(points.map((item) => filterValue(item, key)));
  }

  const filteredPoints = useMemo(() => points.filter((item) => Object.entries(filters).every(([key, value]) => !value || normalizeTableFilterValue(filterValue(item, key as keyof typeof filters)).includes(normalizeTableFilterValue(value)))), [points, filters]);

  return (
    <div className="championship-wrap management-table-wrap">
      <table className="championship-table management-table">
        <thead>
          <tr>
            <th><TableFilterHeader label="Regra" menuKey="points-label" currentValue={filters.label} options={filterOptions('label')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar regra" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, label: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, label: '' })); setActiveFilterMenu(null); }} /></th>
            <th><TableFilterHeader label="Código" menuKey="points-code" currentValue={filters.code} options={filterOptions('code')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar código" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, code: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, code: '' })); setActiveFilterMenu(null); }} /></th>
            <th><TableFilterHeader label="Pontos" menuKey="points-value" currentValue={filters.points} options={filterOptions('points')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar pontos" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, points: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, points: '' })); setActiveFilterMenu(null); }} /></th>
          </tr>
        </thead>
        <tbody>
          {filteredPoints.length === 0 ? <tr><td colSpan={3} className="table-empty-cell">Nenhuma regra de pontuação encontrada com os filtros atuais.</td></tr> : filteredPoints.map((item) => <tr key={item.code}><td className="management-main-cell"><strong>{item.label}</strong></td><td>{item.code}</td><td><input type="number" value={item.points} onChange={(event) => onPointChange(item.code, Number(event.target.value))} /></td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function UsersManagementPanel({ api, users, onReload, isAdmin }: { api: ApiClient; users: User[]; onReload: () => Promise<void>; isAdmin: boolean }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'COORDENADOR' | 'ATLETA'>('ATLETA');
  const [position, setPosition] = useState<AthletePosition>('MC');
  const [message, setMessage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const activeUsers = users.filter((user) => user.active !== false).length;
  const admins = users.filter((user) => user.role === 'ADMIN').length;
  const coordinators = users.filter((user) => user.role === 'COORDENADOR').length;
  const athletes = users.filter((user) => user.role === 'ATLETA').length;

  async function createUser(event: FormEvent) {
    event.preventDefault();
    const result = await api.request<{ activationEmailSent?: boolean }>('/users', { method: 'POST', body: JSON.stringify({ name, email, password: password || undefined, role: isAdmin ? role : 'ATLETA', position }) });
    setMessage(password ? 'Usuário criado com senha inicial definida.' : result.activationEmailSent ? 'Usuário criado e convite de ativação enviado por e-mail.' : 'Usuário criado. Se o e-mail não chegar, use recuperação de senha.');
    setName('');
    setEmail('');
    setPassword('');
    setRole('ATLETA');
    setPosition('MC');
    setModalOpen(false);
    await onReload();
  }

  return <div className="home-stack users-home"><section className="card compact"><div className="card-head"><div><h2>Gestão de usuários</h2><p className="muted">Cadastro, convite, permissões, posição oficial e bloqueio de acesso dos atletas.</p></div><button className="primary small" onClick={() => setModalOpen(true)}>Novo usuário</button></div>{message && <p className="status-line">{message}</p>}<div className="stat-grid users-summary"><span><b>{users.length}</b> cadastrados</span><span><b>{activeUsers}</b> ativos</span><span><b>{athletes}</b> atletas</span><span><b>{coordinators}</b> coord.</span><span><b>{admins}</b> admins</span></div></section><section className="card compact users-card"><div className="card-head"><h2>Usuários do grupo</h2><span className="status open">{users.length} pessoa(s)</span></div><div className="table-cards admin-users">{users.map((user) => <UserAdminRow key={user.id} api={api} user={user} isAdmin={isAdmin} onReload={onReload} />)}</div></section>{modalOpen && <div className="modal"><form className="card modal-card admin-modal-card" onSubmit={(event) => { void createUser(event).catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao criar usuário.')); }}><div className="card-head"><h2>Novo usuário</h2><button type="button" className="ghost" onClick={() => setModalOpen(false)}>Fechar</button></div><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" required /><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail" type="email" required /><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha inicial opcional" type="password" minLength={8} />{isAdmin ? <select value={role} onChange={(event) => setRole(event.target.value as 'ADMIN' | 'COORDENADOR' | 'ATLETA')}><option>ATLETA</option><option>COORDENADOR</option><option>ADMIN</option></select> : <span className="status">Novo usuário será ATLETA</span>}<select value={position} onChange={(event) => setPosition(event.target.value as AthletePosition)}>{athletePositionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button className="primary">Criar/enviar convite</button></form></div>}</div>;
}

function UsersManagementTablePanel({ api, users, onReload, isAdmin }: { api: ApiClient; users: User[]; onReload: () => Promise<void>; isAdmin: boolean }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'COORDENADOR' | 'ATLETA'>('ATLETA');
  const [position, setPosition] = useState<AthletePosition>('MC');
  const [message, setMessage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const activeUsers = users.filter((user) => user.active !== false).length;
  const admins = users.filter((user) => user.role === 'ADMIN').length;
  const coordinators = users.filter((user) => user.role === 'COORDENADOR').length;
  const athletes = users.filter((user) => user.role === 'ATLETA').length;

  async function createUser(event: FormEvent) {
    event.preventDefault();
    const result = await api.request<{ activationEmailSent?: boolean }>('/users', { method: 'POST', body: JSON.stringify({ name, email, password: password || undefined, role: isAdmin ? role : 'ATLETA', position }) });
    setMessage(password ? 'Usuário criado com senha inicial definida.' : result.activationEmailSent ? 'Usuário criado e convite de ativação enviado por e-mail.' : 'Usuário criado. Se o e-mail não chegar, use recuperação de senha.');
    setName('');
    setEmail('');
    setPassword('');
    setRole('ATLETA');
    setPosition('MC');
    setModalOpen(false);
    await onReload();
  }

  return (
    <div className="home-stack users-home">
      <section className="card compact">
        <div className="card-head">
          <div>
            <h2>Gestão de usuários</h2>
            <p className="muted">Cadastro, convite, permissões, posição oficial e bloqueio de acesso dos atletas.</p>
          </div>
          <button className="primary small" onClick={() => setModalOpen(true)}>Novo usuário</button>
        </div>
        {message && <p className="status-line">{message}</p>}
        <div className="stat-grid users-summary"><span><b>{users.length}</b> cadastrados</span><span><b>{activeUsers}</b> ativos</span><span><b>{athletes}</b> atletas</span><span><b>{coordinators}</b> coord.</span><span><b>{admins}</b> admins</span></div>
      </section>

      <section className="card compact users-card">
        <div className="card-head"><h2>Usuários do grupo</h2><span className="status open">{users.length} pessoa(s)</span></div>
        <UsersAdminTable api={api} users={users} onReload={onReload} isAdmin={isAdmin} emptyText="Nenhum usuário encontrado com os filtros atuais." />
      </section>

      {modalOpen && <div className="modal"><form className="card modal-card admin-modal-card" onSubmit={(event) => { void createUser(event).catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao criar usuário.')); }}><div className="card-head"><h2>Novo usuário</h2><button type="button" className="ghost" onClick={() => setModalOpen(false)}>Fechar</button></div><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" required /><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail" type="email" required /><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha inicial opcional" type="password" minLength={8} />{isAdmin ? <select value={role} onChange={(event) => setRole(event.target.value as 'ADMIN' | 'COORDENADOR' | 'ATLETA')}><option>ATLETA</option><option>COORDENADOR</option><option>ADMIN</option></select> : <span className="status">Novo usuário será ATLETA</span>}<select value={position} onChange={(event) => setPosition(event.target.value as AthletePosition)}>{athletePositionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button className="primary">Criar/enviar convite</button></form></div>}
    </div>
  );
}

function UserAdminTableRow({ api, user, isAdmin, onReload }: { api: ApiClient; user: User; isAdmin: boolean; onReload: () => Promise<void> }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<User['role']>(user.role);
  const [position, setPosition] = useState<AthletePosition>(user.position ?? 'MC');
  const [active, setActive] = useState(user.active !== false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setPosition(user.position ?? 'MC');
    setActive(user.active !== false);
    setPassword('');
  }, [user.id, user.name, user.email, user.role, user.position, user.active]);

  async function save() {
    await api.request(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ name, email, role, position, active }) });
    setMessage('Usuário atualizado.');
    await onReload();
  }

  async function sendActivation() {
    const result = await api.request<{ activationEmailSent: boolean }>(`/users/${user.id}/send-activation`, { method: 'POST' });
    setMessage(result.activationEmailSent ? 'Convite enviado por e-mail.' : 'Convite gerado; Graph não confirmou envio. Use recuperação de senha se necessário.');
  }

  async function changePassword() {
    if (password.length < 8) {
      setMessage('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    await api.request(`/users/${user.id}/password`, { method: 'POST', body: JSON.stringify({ password }) });
    setPassword('');
    setMessage('Senha redefinida pelo ADMIN.');
  }

  return (
    <>
      <tr>
        <td className="management-main-cell"><strong>{user.name}</strong></td>
        <td className="user-email-cell">{user.email}</td>
        <td className="users-role-cell">{user.role}</td>
        <td className="users-position-cell">{positionLabel(user.position)}</td>
        <td className="users-status-cell"><span className={`status ${active ? 'open' : 'danger'}`}>{active ? 'ativo' : 'inativo'}</span></td>
        <td className="users-actions-cell">{isAdmin ? <div className="actions compact-actions users-row-actions"><button className="ghost" onClick={() => setOpen(true)}>Editar</button><button className="ghost" onClick={() => void sendActivation()}>Reenviar convite</button></div> : <span className="payments-muted">Sem ações</span>}</td>
        <td className="management-feedback-cell">{message || '-'}</td>
      </tr>
      {open && <div className="modal"><form className="card modal-card admin-modal-card" onSubmit={(event) => { event.preventDefault(); void save().then(() => setOpen(false)).catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao salvar usuário.')); }}><div className="card-head"><h2>Editar usuário</h2><button type="button" className="ghost" onClick={() => setOpen(false)}>Fechar</button></div><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" /><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail" type="email" /><select value={role} onChange={(event) => setRole(event.target.value as User['role'])}><option>ATLETA</option><option>COORDENADOR</option><option>ADMIN</option></select><select value={position} onChange={(event) => setPosition(event.target.value as AthletePosition)}>{athletePositionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select value={active ? 'true' : 'false'} onChange={(event) => setActive(event.target.value === 'true')}><option value="true">Ativo</option><option value="false">Inativo</option></select><button className="primary">Salvar cadastro</button><div className="inline-form"><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nova senha" type="password" minLength={8} /><button type="button" className="ghost" onClick={() => void changePassword().catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao redefinir senha.'))}>Redefinir senha</button></div></form></div>}
    </>
  );
}

function AdminPanel({ api, users, seasons, points, activeSeasonId, onReload, isAdmin }: { api: ApiClient; users: User[]; seasons: Season[]; points: PointSetting[]; activeSeasonId: string; onReload: () => Promise<void>; isAdmin: boolean }) {
  const [draftPoints, setDraftPoints] = useState(points);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'COORDENADOR' | 'ATLETA'>('ATLETA');
  const [userPosition, setUserPosition] = useState<AthletePosition>('MC');
  const [message, setMessage] = useState('');
  const [standingPaste, setStandingPaste] = useState('');
  const [importResult, setImportResult] = useState<StandingImportResult | null>(null);
  const [seasonName, setSeasonName] = useState('Temporada 2026');
  const [seasonYear, setSeasonYear] = useState(2026);
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [adminModal, setAdminModal] = useState<'season' | 'points' | 'user' | 'import' | null>(null);
  const parsedStandingRows = useMemo(() => parseStandingClipboard(standingPaste), [standingPaste]);
  const previewStandingRows = parsedStandingRows.slice(0, 6);

  useEffect(() => setDraftPoints(points), [points]);

  function updateDraftPoint(code: string, nextPoints: number) {
    setDraftPoints((list) => list.map((item) => item.code === code ? { ...item, points: nextPoints } : item));
  }

  async function savePoints() {
    await api.request('/settings/points', { method: 'PUT', body: JSON.stringify({ settings: draftPoints.map(({ code, points }) => ({ code, points })) }) });
    await onReload();
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    const payload = await api.request<{ activationEmailSent?: boolean }>('/users', { method: 'POST', body: JSON.stringify({ name, email, password: password || undefined, role: isAdmin ? role : 'ATLETA', position: userPosition }) });
    setMessage(password ? 'Usuário criado com senha inicial definida.' : payload.activationEmailSent ? 'Usuário criado e convite de ativação enviado por e-mail.' : 'Usuário criado. O Graph não confirmou envio; use recuperação de senha se necessário.');
    setName(''); setEmail(''); setPassword(''); setUserPosition('MC');
    await onReload();
  }

  async function createSeason(event: FormEvent) {
    event.preventDefault();
    await api.request('/seasons', { method: 'POST', body: JSON.stringify({ name: seasonName, year: seasonYear, startsOn: startsOn || null, endsOn: endsOn || null }) });
    setMessage('Temporada criada. Inicie quando estiver pronto para receber súmulas oficiais.');
    await onReload();
  }

  async function startSeason(id: string) {
    await api.request(`/seasons/${id}/start`, { method: 'POST' });
    setMessage('Temporada iniciada. Ela agora aceita súmulas oficiais.');
    await onReload();
  }

  async function closeSeason(id: string) {
    await api.request(`/seasons/${id}/close`, { method: 'POST' });
    setMessage('Temporada encerrada. Rankings automáticos foram consolidados e votação liberada.');
    await onReload();
  }

  async function importStandings() {
    if (!parsedStandingRows.length) {
      setMessage('Cole a tabela do Excel com cabeçalho antes de importar.');
      return;
    }
    const result = await api.request<StandingImportResult>(`/seasons/${activeSeasonId}/standing-adjustments/import`, { method: 'POST', body: JSON.stringify({ replace: true, rows: parsedStandingRows }) });
    setImportResult(result);
    setMessage(`${result.imported.length} atleta(s) importado(s). ${result.skipped.length} linha(s) exigem revisão.`);
    await onReload();
  }

  return (
    <div className="home-stack admin-home">
      <section className="card compact">
        <div className="card-head">
          <div><h2>Configuração operacional</h2><p className="muted">Ações críticas ficam em modais para manter a tela principal limpa e auditável.</p></div>
          {message && <span className="status open">{message}</span>}
        </div>
        <div className="admin-action-grid">
          <button className="row-card as-button" onClick={() => setAdminModal('season')}><strong>Criar temporada</strong><span>{seasons.length}</span><small>Abra novas temporadas, depois inicie ou encerre pela lista abaixo.</small></button>
          <button className="row-card as-button" onClick={() => setAdminModal('points')}><strong>Pontuação</strong><span>{draftPoints.length}</span><small>Ajuste regras dinâmicas sem alterar código.</small></button>
          <button className="row-card as-button" onClick={() => setAdminModal('user')}><strong>Novo usuário</strong><span>{users.length}</span><small>Crie atletas e convites de ativação reais por e-mail.</small></button>
          {isAdmin && <button className="row-card as-button" onClick={() => setAdminModal('import')} disabled={!activeSeasonId}><strong>Importar Excel</strong><span>{importResult?.imported.length ?? 0}</span><small>Atualize saldo inicial da temporada ativa via colagem do Excel.</small></button>}
        </div>
      </section>
      <section className="card compact"><div className="card-head"><h2>Temporadas</h2><span className="status open">{seasons.length} registro(s)</span></div><SeasonsAdminTable seasons={seasons} onStartSeason={startSeason} onCloseSeason={closeSeason} /></section>
      <section className="card compact"><div className="card-head"><h2>Usuários</h2><span className="status open">{users.length} pessoa(s)</span></div><UsersAdminTable api={api} users={users} onReload={onReload} isAdmin={isAdmin} emptyText="Nenhum usuário encontrado com os filtros atuais." /></section>
      {adminModal === 'season' && <div className="modal"><form className="card modal-card admin-modal-card" onSubmit={(event) => { void createSeason(event).then(() => setAdminModal(null)).catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao criar temporada.')); }}><div className="card-head"><h2>Criar temporada</h2><button type="button" className="ghost" onClick={() => setAdminModal(null)}>Fechar</button></div><input value={seasonName} onChange={(event) => setSeasonName(event.target.value)} placeholder="Nome da temporada" required /><input type="number" value={seasonYear} onChange={(event) => setSeasonYear(Number(event.target.value))} min="2000" max="2100" /><input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /><input type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /><button className="primary">Criar temporada</button></form></div>}
      {adminModal === 'points' && <div className="modal"><section className="card modal-card wide"><div className="card-head"><h2>Pontuação configurável</h2><button type="button" className="ghost" onClick={() => setAdminModal(null)}>Fechar</button></div><PointsSettingsTable points={draftPoints} onPointChange={updateDraftPoint} /><button className="primary" onClick={() => void savePoints().then(() => setAdminModal(null)).catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao salvar pontuação.'))}>Salvar pontuação</button></section></div>}
      {adminModal === 'user' && <div className="modal"><form className="card modal-card admin-modal-card" onSubmit={(event) => { void createUser(event).then(() => setAdminModal(null)).catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao criar usuário.')); }}><div className="card-head"><h2>Novo usuário</h2><button type="button" className="ghost" onClick={() => setAdminModal(null)}>Fechar</button></div><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" required /><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail" type="email" required /><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha inicial opcional" type="password" minLength={8} />{isAdmin ? <select value={role} onChange={(event) => setRole(event.target.value as 'ADMIN' | 'COORDENADOR' | 'ATLETA')}><option>ATLETA</option><option>COORDENADOR</option><option>ADMIN</option></select> : <span className="status">Novo usuário será ATLETA</span>}<select value={userPosition} onChange={(event) => setUserPosition(event.target.value as AthletePosition)}>{athletePositionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button className="primary">Criar/enviar convite</button></form></div>}
      {isAdmin && adminModal === 'import' && <div className="modal"><section className="card modal-card wide import-excel-modal"><div className="card-head"><div><h2>Importar tabela atual do Excel</h2><p className="muted">Cole a tabela com cabeçalho. A interface agora pré-valida as linhas antes do envio e separa claramente o que entrou do que precisa revisão.</p></div><button type="button" className="ghost" onClick={() => setAdminModal(null)}>Fechar</button></div><div className="import-excel-layout"><section className="import-excel-panel import-excel-paste"><div className="import-excel-panel-head"><strong>1. Colagem da planilha</strong><span>{parsedStandingRows.length} linha(s) detectada(s)</span></div><p className="muted">Use o e-mail como chave principal. Se houver divergência, a revisão aparece logo ao lado.</p><textarea className="paste-box import-paste-box" value={standingPaste} onChange={(event) => setStandingPaste(event.target.value)} placeholder="nome\temail\tpontos\tjogos\tpresenças\tv\te\td\tgols\tgols contra\tassistências\tmarcados\tsofridos" /><div className="import-excel-stats"><article><span>Linhas lidas</span><strong>{parsedStandingRows.length}</strong><small>Total reconhecido no bloco colado.</small></article><article><span>Preview</span><strong>{previewStandingRows.length}</strong><small>Primeiras linhas exibidas abaixo.</small></article><article><span>Temporada alvo</span><strong>{activeSeasonId ? 'Ativa' : 'Sem seleção'}</strong><small>{activeSeasonId ? 'Importação pronta para envio.' : 'Selecione uma temporada antes de importar.'}</small></article></div><div className="draw-footer import-excel-footer"><small>Ao importar, o saldo inicial atual da temporada ativa será substituído pelo conteúdo colado.</small><button className="primary" onClick={() => void importStandings().catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao importar Excel.'))} disabled={!activeSeasonId}>Importar saldo</button></div></section><section className="import-excel-panel import-excel-preview"><div className="import-excel-panel-head"><strong>2. Preview estruturado</strong><span>{parsedStandingRows.length ? 'Pronto para revisão' : 'Aguardando colagem'}</span></div>{previewStandingRows.length ? <div className="import-table-shell"><table className="import-table"><thead><tr><th>Atleta</th><th>E-mail</th><th>Pontos</th><th>Jogos</th><th>Presenças</th><th>Gols</th><th>Assist.</th></tr></thead><tbody>{previewStandingRows.map((row, index) => <tr key={`${row.email ?? row.name ?? 'row'}-${index}`}><td className="import-main-cell"><strong>{row.name || 'Sem nome'}</strong></td><td>{row.email || 'Sem e-mail'}</td><td>{row.totalPoints}</td><td>{row.gamesPlayed}</td><td>{row.presences}</td><td>{row.goals}</td><td>{row.assists}</td></tr>)}</tbody></table></div> : <div className="import-empty-state"><strong>Nenhuma linha reconhecida ainda.</strong><small>Cole a planilha do Excel para visualizar uma prévia organizada antes do envio.</small></div>}{parsedStandingRows.length > previewStandingRows.length && <small className="muted">Mostrando {previewStandingRows.length} de {parsedStandingRows.length} linhas reconhecidas.</small>}</section></div>{importResult && <section className="import-result-board"><div className="import-result-summary"><article className="is-imported"><span>Importados</span><strong>{importResult.imported.length}</strong><small>Atletas consolidados no saldo inicial da temporada.</small></article><article className="is-review"><span>Revisão necessária</span><strong>{importResult.skipped.length}</strong><small>Linhas ignoradas ou que exigem correção antes de nova tentativa.</small></article></div><div className="import-result-grid"><section className="import-excel-panel"><div className="import-excel-panel-head"><strong>Entradas importadas</strong><span>{importResult.imported.length} registro(s)</span></div>{importResult.imported.length ? <div className="import-table-shell"><table className="import-table import-table-success"><thead><tr><th>Atleta</th><th>E-mail</th><th>Pontos</th></tr></thead><tbody>{importResult.imported.map((item) => <tr key={`${item.email}-${item.name}`}><td className="import-main-cell"><strong>{item.name}</strong></td><td>{item.email}</td><td className="import-points-cell">{item.totalPoints}</td></tr>)}</tbody></table></div> : <div className="import-empty-state"><strong>Nenhum atleta importado.</strong><small>Quando a importação concluir, os registros aceitos aparecem aqui.</small></div>}</section><section className="import-excel-panel"><div className="import-excel-panel-head"><strong>Linhas para revisar</strong><span>{importResult.skipped.length} ocorrência(s)</span></div>{importResult.skipped.length ? <div className="import-table-shell"><table className="import-table import-table-warning"><thead><tr><th>Identificador</th><th>Motivo</th></tr></thead><tbody>{importResult.skipped.map((item, index) => <tr key={`${item.identifier}-${item.reason}-${index}`}><td className="import-main-cell"><strong>{item.identifier || 'Linha sem identificador'}</strong></td><td>{item.reason}</td></tr>)}</tbody></table></div> : <div className="import-empty-state is-success"><strong>Sem pendências.</strong><small>Todas as linhas reconhecidas foram consolidadas com sucesso.</small></div>}</section></div></section>}</section></div>}
    </div>
  );
}

function UserAdminRow({ api, user, isAdmin, onReload }: { api: ApiClient; user: User; isAdmin: boolean; onReload: () => Promise<void> }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<User['role']>(user.role);
  const [position, setPosition] = useState<AthletePosition>(user.position ?? 'MC');
  const [active, setActive] = useState(user.active !== false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setPosition(user.position ?? 'MC');
    setActive(user.active !== false);
    setPassword('');
  }, [user.id, user.name, user.email, user.role, user.position, user.active]);

  async function save() {
    await api.request(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ name, email, role, position, active }) });
    setMessage('Usuário atualizado.');
    await onReload();
  }

  async function sendActivation() {
    const result = await api.request<{ activationEmailSent: boolean }>(`/users/${user.id}/send-activation`, { method: 'POST' });
    setMessage(result.activationEmailSent ? 'Convite enviado por e-mail.' : 'Convite gerado; Graph não confirmou envio. Use recuperação de senha se necessário.');
  }

  async function changePassword() {
    if (password.length < 8) {
      setMessage('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    await api.request(`/users/${user.id}/password`, { method: 'POST', body: JSON.stringify({ password }) });
    setPassword('');
    setMessage('Senha redefinida pelo ADMIN.');
  }

  return <article className="row-card"><strong>{user.name}</strong><span className={`status ${active ? 'open' : 'danger'}`}>{active ? 'ativo' : 'inativo'}</span><small>{user.email} • {user.role} • {positionLabel(user.position)}</small>{isAdmin ? <div className="actions"><button className="ghost" onClick={() => setOpen(true)}>Editar</button><button className="ghost" onClick={() => void sendActivation()}>Reenviar convite</button></div> : <small>{user.role} • {positionLabel(user.position)}</small>}{message && <small className="muted">{message}</small>}{open && <div className="modal"><form className="card modal-card admin-modal-card" onSubmit={(event) => { event.preventDefault(); void save().then(() => setOpen(false)).catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao salvar usuário.')); }}><div className="card-head"><h2>Editar usuário</h2><button type="button" className="ghost" onClick={() => setOpen(false)}>Fechar</button></div><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" /><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail" type="email" /><select value={role} onChange={(event) => setRole(event.target.value as User['role'])}><option>ATLETA</option><option>COORDENADOR</option><option>ADMIN</option></select><select value={position} onChange={(event) => setPosition(event.target.value as AthletePosition)}>{athletePositionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select value={active ? 'true' : 'false'} onChange={(event) => setActive(event.target.value === 'true')}><option value="true">Ativo</option><option value="false">Inativo</option></select><button className="primary">Salvar cadastro</button><div className="inline-form"><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nova senha" type="password" minLength={8} /><button type="button" className="ghost" onClick={() => void changePassword()}>Redefinir senha</button><button type="button" className="ghost" onClick={() => void sendActivation()}>Reenviar convite</button></div>{message && <p className="muted">{message}</p>}</form></div>}</article>;
}
