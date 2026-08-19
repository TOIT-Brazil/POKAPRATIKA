import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { MdFilterList, MdOutlineRestaurantMenu, MdSportsSoccer } from 'react-icons/md';
import SoccerLineUp from 'react-soccer-lineup';
import { ApiClient } from './api';
import { AthletePosition, MatchListItem, PointSetting, Season, Standing, User } from './types';

const logoUrl = '/logo_pokapratika.png';

type View = 'temporada' | 'pagamentos' | 'premios' | 'usuarios' | 'admin';
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
type MatchEventDraft = { userId: string; relatedUserId?: string | null; eventType: 'GOL' | 'GOL_CONTRA' | 'ASSISTENCIA' | 'CARTAO_AMARELO' | 'CARTAO_VERMELHO' | 'CARTAO_AZUL'; minute: number; team?: 'A' | 'B' | null; occurredAt?: string | null; createdAt?: string | null };
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
type MatchDraftPlayer = { userId: string; name: string; email: string; position: AthletePosition; team: 'A' | 'B' | 'PRESENTE_SEM_JOGAR'; roleInMatch: 'GOLEIRO' | 'LINHA' | 'PRESENTE_SEM_JOGAR'; drawOrder: string; startsOnBench: boolean };
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
  players: Array<{ userId: string; name: string; team: 'A' | 'B' | 'PRESENTE_SEM_JOGAR'; roleInMatch: string; drawOrder?: number | null; rotationOrder?: number | null; startsOnBench: boolean }>;
  events: Array<{ userId: string; relatedUserId?: string | null; eventType: string; minute: number; team?: 'A' | 'B' | null; occurredAt?: string | null; createdAt?: string | null }>;
  corrections: MatchCorrection[];
  attendance: MatchAttendanceResponse[];
  rotation: Record<'A' | 'B', { reserves: number; firstCycleMinutes: number; secondCycleMinutes: number; schedule: Array<{ minute: number; label: string; entering: string[]; leaving: string[] }> }>;
};

type SheetRotationStep = { minute: number; label: string; enteringIds: string[]; leavingIds: string[]; entering: string[]; leaving: string[] };
type SheetRotationPlan = { reserves: number; firstCycleMinutes: number; secondCycleMinutes: number; exchangeSize: number; schedule: SheetRotationStep[] };

const storageKey = 'pokapratika.auth';

const sheetLegacySchedules: Record<number, number[]> = {
  1: [8, 16, 24, 32, 40, 48, 56],
  2: [9, 18, 27, 36, 41, 46, 51, 56],
  3: [10, 20, 30, 39, 48, 57]
};

const sheetLegacyCycleMinutes: Record<number, { first: number; second: number }> = {
  1: { first: 8, second: 0 },
  2: { first: 9, second: 5 },
  3: { first: 10, second: 9 }
};

function chunkRotationItems<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function buildSheetRotationPlan(players: Array<{ userId: string; name: string; rotationOrder: number; startsOnBench: boolean }>, availableMinutes: number): SheetRotationPlan {
  const ordered = [...players].sort((left, right) => left.rotationOrder - right.rotationOrder);
  const bench = ordered.filter((player) => player.startsOnBench);
  const reserves = Math.max(0, ordered.length - 6);
  const exchangeSize = Math.max(1, bench.length);

  if (reserves === 0 || bench.length === 0) {
    return { reserves, firstCycleMinutes: 0, secondCycleMinutes: 0, exchangeSize: 0, schedule: [] };
  }

  const groups = chunkRotationItems(ordered, exchangeSize);
  const scheduleMinutes = sheetLegacySchedules[reserves] ?? Array.from({ length: Math.max(1, Math.floor(availableMinutes / 8)) }, (_, index) => Math.min(availableMinutes - 1, (index + 1) * 8));
  const cycle = sheetLegacyCycleMinutes[reserves] ?? { first: Math.min(10, Math.max(6, Math.floor(availableMinutes / Math.max(4, groups.length * 2)))), second: 5 };

  const schedule = scheduleMinutes
    .filter((minute) => minute < availableMinutes)
    .map((minute, index) => {
      const enteringGroup = groups[index % groups.length];
      const leavingGroup = groups[(index + 1) % groups.length];
      return {
        minute,
        label: `${index + 1}ª troca`,
        enteringIds: enteringGroup.map((player) => player.userId),
        leavingIds: leavingGroup.map((player) => player.userId),
        entering: enteringGroup.map((player) => player.name),
        leaving: leavingGroup.map((player) => player.name)
      };
    });

  return { reserves, firstCycleMinutes: cycle.first, secondCycleMinutes: cycle.second, exchangeSize, schedule };
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

  return <div className="table-filter-anchor"><span>{label}</span><button type="button" className={`table-filter-button ${currentValue ? 'is-active' : ''}`} onClick={() => onToggle(menuKey)} aria-label={`Filtrar ${label.toLowerCase()}`}><MdFilterList /></button>{isOpen && <div className="table-filter-popover"><div className="table-filter-popover-head"><strong>{label}</strong><button type="button" className="ghost small" onClick={onClear}>Limpar</button></div><input value={inputValue} onChange={(event) => { onSearchChange(event.target.value); onSelect(event.target.value); }} placeholder={placeholder} /></div>}</div>;
}

function positionBalanceGroup(position: AthletePosition): PositionBalanceGroup {
  if (position === 'GO') return 'GO';
  if (position === 'ZG' || position === 'LD' || position === 'LE') return 'DEFESA';
  if (position === 'MD' || position === 'MC' || position === 'MA') return 'MEIO';
  return 'ATAQUE';
}

function shuffleRows<T>(rows: T[]): T[] {
  return rows.map((row) => ({ row, sort: Math.random() })).sort((left, right) => left.sort - right.sort).map((item) => item.row);
}

function drawBalancedTeams(players: MatchDraftPlayer[]): MatchDraftPlayer[] {
  const playable = players.filter((player) => player.team !== 'PRESENTE_SEM_JOGAR');
  const presentOnly = players.filter((player) => player.team === 'PRESENTE_SEM_JOGAR');
  const teams: Record<'A' | 'B', MatchDraftPlayer[]> = { A: [], B: [] };
  const counts: Record<'A' | 'B', Record<PositionBalanceGroup, number>> = { A: { GO: 0, DEFESA: 0, MEIO: 0, ATAQUE: 0 }, B: { GO: 0, DEFESA: 0, MEIO: 0, ATAQUE: 0 } };

  for (const group of ['GO', 'DEFESA', 'MEIO', 'ATAQUE'] as PositionBalanceGroup[]) {
    for (const player of shuffleRows(playable.filter((item) => positionBalanceGroup(item.position) === group))) {
      const target = counts.A[group] < counts.B[group] ? 'A' : counts.B[group] < counts.A[group] ? 'B' : teams.A.length < teams.B.length ? 'A' : teams.B.length < teams.A.length ? 'B' : Math.random() < 0.5 ? 'A' : 'B';
      teams[target].push({ ...player, team: target });
      counts[target][group] += 1;
    }
  }

  let drawOrder = 1;
  const decorateTeam = (team: 'A' | 'B') => {
    let goalkeepers = 0;
    let linePlayers = 0;
    return teams[team].map((player) => {
      const goalkeeper = player.position === 'GO' && goalkeepers === 0;
      const roleInMatch: MatchDraftPlayer['roleInMatch'] = goalkeeper ? 'GOLEIRO' : 'LINHA';
      if (goalkeeper) goalkeepers += 1;
      const startsOnBench = roleInMatch === 'LINHA' && linePlayers >= 6;
      if (roleInMatch === 'LINHA') linePlayers += 1;
      return { ...player, roleInMatch, startsOnBench, drawOrder: String(drawOrder++) };
    });
  };

  return [
    ...decorateTeam('A'),
    ...decorateTeam('B'),
    ...presentOnly.map((player) => ({ ...player, roleInMatch: 'PRESENTE_SEM_JOGAR' as const, startsOnBench: false, drawOrder: String(drawOrder++) }))
  ];
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

function addDaysInput(days: number): string {
  const date = new Date(`${todayInputValue()}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function matchDateLabel(match: MatchListItem): string {
  const date = match.matchDate?.slice(0, 10) ?? 'sem data';
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
  return match.status === 'DRAFT' && match.confirmationOpen === true;
}

function confirmationWindowHasEnded(match: MatchListItem): boolean {
  return Boolean(match.confirmationCloseAt && Date.now() >= new Date(match.confirmationCloseAt).getTime());
}

function confirmationWindowScheduleLabel(match: MatchListItem): string {
  const opens = match.confirmationOpenAt ? formatBrasiliaTime(match.confirmationOpenAt) : 'abertura não definida';
  const closes = match.confirmationCloseAt ? formatBrasiliaTime(match.confirmationCloseAt) : 'fechamento não definido';
  return `abre ${opens} • fecha ${closes}`;
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number | boolean | null | undefined>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number | boolean | null | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(';'), ...rows.map((row) => headers.map((header) => escape(row[header])).join(';'))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatMoney(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function matchCountdownLabel(match?: MatchListItem | null): string {
  if (!match) return 'Sem agenda';
  const diffSeconds = Math.floor((getMatchStartTime(match) - Date.now()) / 1000);
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
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
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
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
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
    <main className="shell">
      <header className="hero card glass app-header">
        <div className="brand-lockup">
          <img className="brand-logo" src={logoUrl} alt="Escudo POKA PRÁTIKA" />
          <div className="brand-copy">
            <p className="eyebrow">Balneário Camboriú • Quarta 20h</p>
            <h1>POKA PRÁTIKA</h1>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="header-icon-button" aria-label="Arquivo do clube"><DashboardIcon name="file" /></button>
          <button type="button" className="header-icon-button" aria-label="Configurações"><DashboardIcon name="gear" /></button>
          <button type="button" className="header-icon-button" aria-label="Notificações"><DashboardIcon name="bell" /></button>
        </div>
        <div className="profile-pill account-area" ref={accountMenuRef}>
          <button className="profile-trigger" onClick={() => setAccountMenuOpen((value) => !value)} title="Abrir menu do perfil">
            {auth.user.avatarDataUrl ? <img src={auth.user.avatarDataUrl} alt="Avatar" /> : <span>{auth.user.name.slice(0, 1)}</span>}
            <div>
              <strong>{auth.user.name}</strong>
              <small>{auth.user.role} • menu</small>
            </div>
          </button>
          {accountMenuOpen && <div className="account-menu">{canCoordinate && <><button onClick={() => { setView('temporada'); setAccountMenuOpen(false); }}>Temporada</button><button onClick={() => { setView('pagamentos'); setAccountMenuOpen(false); }}>Mensalidades</button><button onClick={() => { setView('premios'); setAccountMenuOpen(false); }}>Prêmios</button><button onClick={() => { setView('usuarios'); setAccountMenuOpen(false); }}>Usuários</button><button onClick={() => { setView('admin'); setAccountMenuOpen(false); }}>Config.</button><button onClick={() => { setScheduleDialogOpen(true); setAccountMenuOpen(false); }}>Agenda</button></>}<button onClick={() => { setProfileUserId(auth.user.id); setAccountMenuOpen(false); }}>Meu perfil</button><button className="danger-menu" onClick={() => { localStorage.removeItem(storageKey); setAuth(null); }}>Sair</button></div>}
        </div>
      </header>

      {canCoordinate && <ScheduleManagerDialog api={api} matches={matches} activeSeasonId={activeSeasonId} onDone={loadData} controlledOpen={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen} hideTrigger />}

      {changePasswordOpen && <ChangePasswordDialog api={api} onClose={() => setChangePasswordOpen(false)} />}
      {profileUserId && <div className="modal profile-modal"><div className="profile-modal-card athlete-profile-modal-card"><div className="card-head athlete-profile-modal-head"><h2>Perfil do atleta</h2><button type="button" className="ghost modal-close-button" aria-label="Fechar modal" title="Fechar" onClick={() => setProfileUserId(null)}>X</button></div><ProfilesPanel api={api} currentUserId={auth.user.id} initialUserId={profileUserId} onCurrentUserUpdated={updateAuthenticatedUser} onRequestChangePassword={() => { setProfileUserId(null); setChangePasswordOpen(true); }} /></div></div>}

      {error && <button className="alert" onClick={() => setError('')}>{error}</button>}
      {loading && <div className="mini-loading">Carregando dados reais da Railway...</div>}
      {!loading && activeSeason && <GlobalVotingPrompt api={api} users={users} activeSeason={activeSeason} isAdmin={isAdmin} />}
      <section className="context-row dashboard-season-row">
        <select value={activeSeasonId} onChange={(event) => setActiveSeasonId(event.target.value)}>
          {seasons.map((season) => <option key={season.id} value={season.id}>{season.name} • {season.status}</option>)}
        </select>
        <span className={`status ${activeSeason?.status?.toLowerCase()}`}>{activeSeason?.status ?? 'sem temporada'}</span>
      </section>

      {view === 'temporada' && <div className="home-stack dashboard-main"><div className="dashboard-top-grid"><DashboardMatchesPanel api={api} canCoordinate={canCoordinate} users={users} matches={matches} activeSeasonId={activeSeasonId} currentUserId={auth.user.id} onReload={loadData} selectedMatch={selectedMatch} setSelectedMatch={setSelectedMatch} /><DashboardSeasonOperationsPanel api={api} suspensions={suspensions} matches={matches} activeSeasonId={activeSeasonId} canCoordinate={canCoordinate} onReload={loadData} /></div><div className="dashboard-bottom-grid"><DashboardFinishedMatchesPanel matches={matches} /><DashboardStandingsPanel standings={standings} onOpenProfile={setProfileUserId} /></div></div>}
      {view === 'pagamentos' && <PaymentsPanel api={api} canCoordinate={canCoordinate} users={users} activeSeasonId={activeSeasonId} />}
      {view === 'premios' && canCoordinate && <div className="home-stack"><AwardSettingsCard api={api} /></div>}
      {view === 'usuarios' && canCoordinate && <UsersManagementTablePanel api={api} users={users} onReload={loadData} isAdmin={isAdmin} />}
      {view === 'admin' && canCoordinate && <AdminPanel api={api} users={users} seasons={seasons} points={points} activeSeasonId={activeSeasonId} onReload={loadData} isAdmin={isAdmin} />}
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

  return <main className="login-wrap"><form className="login-card card" onSubmit={submit}><img className="login-logo" src={logoUrl} alt="Escudo POKA PRÁTIKA" /><p className="eyebrow">POKA PRÁTIKA • acesso seguro</p><h1>{mode === 'activation' ? 'Ativar cadastro' : 'Alterar senha'}</h1><p className="muted">Defina uma senha com pelo menos 8 caracteres. O login será sempre pelo seu e-mail.</p><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nova senha" type="password" autoComplete="new-password" required minLength={8} disabled={done} /><input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirmar senha" type="password" autoComplete="new-password" required minLength={8} disabled={done} /><button className="primary" disabled={done}>{done ? 'Senha salva' : 'Salvar senha'}</button>{message && <p className="muted">{message}</p>}{done && <button type="button" className="ghost" onClick={() => { window.history.replaceState({}, '', '/'); window.location.reload(); }}>Ir para login</button>}</form></main>;
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

  return (
    <main className="login-wrap">
      <form className="login-card card" onSubmit={submit}>
        <img className="login-logo" src={logoUrl} alt="Escudo POKA PRÁTIKA" />
        <p className="eyebrow">POKA PRÁTIKA • Balneário Camboriú / SC</p>
        <h1>{mode === 'forgot' ? 'Recuperar senha' : 'Entrar no ferino'}</h1>
        <p className="muted">O sistema oficial de quem talvez erre o domínio, mas nunca falta na quarta.</p>
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail" type="email" required />
        {mode !== 'forgot' && <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha" type="password" autoComplete="current-password" required minLength={8} />}
        <button className="primary">{mode === 'forgot' ? 'Enviar recuperação' : 'Acessar'}</button>
        {message && <p className="muted">{message}</p>}
        <div className="login-actions">
          <button type="button" className="ghost" onClick={() => setMode(mode === 'forgot' ? 'login' : 'forgot')}>{mode === 'forgot' ? 'Voltar ao login' : 'Esqueci minha senha'}</button>
        </div>
      </form>
    </main>
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

  function exportCurrentTab() {
    if (tab === 'GERAL') {
      downloadCsv('poka-pratika-classificacao.csv', standings.map((row) => ({ posicao: row.position, atleta: row.name, pontos: row.total_points, jogos: row.games_played, vitorias: row.wins, empates: row.draws, derrotas: row.losses, gols: row.goals, assistencias: row.assists, cartoes: row.total_cards })));
      return;
    }
    if (tab === 'ARTILHARIA') {
      downloadCsv('poka-pratika-artilharia.csv', rankings.goals.map((row, index) => ({ posicao: index + 1, atleta: row.name, gols: row.goals, golsContra: row.ownGoals, saldoLiquido: row.netGoals, jogos: row.gamesPlayed, media: formatAverage(row.average) })));
      return;
    }
    if (tab === 'ASSISTENCIAS') {
      downloadCsv('poka-pratika-assistencias.csv', rankings.assists.map((row, index) => ({ posicao: index + 1, atleta: row.name, assistencias: row.assists, jogos: row.gamesPlayed, media: formatAverage(row.average) })));
      return;
    }
    downloadCsv('poka-pratika-cartoes.csv', rankings.cards.map((row, index) => ({ posicao: index + 1, atleta: row.name, pontosCartao: row.cardPoints, totalCartoes: row.totalCards, jogos: row.gamesPlayed, media: formatAverage(row.average) })));
  }

  return <section className="card compact standings-card season-dashboard-card"><div className="card-head championship-head"><div><h2>Tabela da temporada & estatísticas</h2><p className="muted">Painel limpo com líderes, histórico recente e navegação por ranking da temporada.</p></div>{currentRows.length > 0 && <button className="ghost" onClick={exportCurrentTab}>Exportar {tab.toLowerCase()}</button>}</div><div className="season-summary-grid">{leaderCards.map((item) => <button className="leader-spotlight as-button" key={item.key} onClick={() => onOpenProfile(item.userId)}><span className="dashboard-icon"><DashboardIcon name={item.icon} /></span><small>{item.label}</small><strong>{item.name}</strong><b>{item.value}</b><em>{item.detail}</em></button>)}</div><section className="finished-strip"><div className="card-head"><div><h3>Jogos finalizados</h3><p className="muted">Últimos confrontos em leitura horizontal rápida.</p></div><span className="status">{finishedMatches.length} jogos</span></div><div className="finished-carousel">{finishedMatches.length === 0 ? <EmptyState title="Sem histórico confirmado" text="Os últimos placares entram aqui assim que as súmulas forem confirmadas." /> : finishedMatches.map((match) => <article className="finished-card" key={match.id}><div className="finished-card-top"><span className="finished-date">{compactMatchDateLabel(match)}</span><span className="finished-badge">MVP indisponível</span></div><strong>{match.title}</strong><div className="finished-score"><span>{match.teamAName}</span><b>{match.teamAScore} x {match.teamBScore}</b><span>{match.teamBName}</span></div><small>{match.teamAScore === match.teamBScore ? 'Empate confirmado' : `Venceu: ${match.teamAScore > match.teamBScore ? match.teamAName : match.teamBName}`}</small></article>)}</div></section><div className="season-table-panel"><div className="season-tabs">{tabs.map((item) => <button key={item.value} type="button" className={tab === item.value ? 'active' : ''} onClick={() => setTab(item.value)}><span className="dashboard-icon small"><DashboardIcon name={item.icon} /></span>{item.label}</button>)}</div>{currentRows.length === 0 ? <EmptyState title="Sem dados para esta aba" text="Confirme jogos e eventos da temporada para preencher este ranking." /> : <div className="championship-wrap season-table-shell"><table className="championship-table season-table"><thead><tr><th>Pos</th><th>Atleta</th>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{pageRows.map((row) => <tr key={row.key}><td className="pos-cell">{row.position}</td><td className="athlete-cell"><button className="name-link strong" onClick={() => onOpenProfile(row.userId)}>{row.name}</button></td>{row.cells.map((cell, index) => <td className={tab === 'GERAL' && index === 0 ? 'points-cell' : ''} key={`${row.key}-${index}`}>{cell}</td>)}</tr>)}</tbody></table></div>}<div className="table-pagination"><button type="button" className="ghost" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}>Anterior</button><span className="status">Página {safePage} de {totalPages}</span><button type="button" className="ghost" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages}>Próxima</button></div></div></section>;
}

function DashboardSeasonOperationsPanel({ api, suspensions, matches, activeSeasonId, canCoordinate, onReload }: { api: ApiClient; suspensions: Suspension[]; matches: MatchListItem[]; activeSeasonId: string; canCoordinate: boolean; onReload: () => Promise<void> }) {
  const confirmedMatches = matches.filter((match) => match.status === 'CONFIRMED');
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

  async function serveSuspension(id: string, servedMatchId: string) {
    if (!servedMatchId) return;
    await api.request(`/suspensions/${id}/serve`, { method: 'POST', body: JSON.stringify({ servedMatchId }) });
    await onReload();
  }

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
      <div className="ops-section dashboard-suspension-section">
        <div className="card-head">
          <strong>Suspensões ativas</strong>
          <span className={`status ${suspensions.length ? 'danger' : 'open'}`}>{suspensions.length}</span>
        </div>
        {suspensions.length === 0 ? <p className="muted">Sem pendências disciplinares no momento.</p> : <div className="suspension-list compact-suspensions">{suspensions.slice(0, 4).map((item) => <article className="suspension-row" key={item.id}><strong>{item.userName}</strong><span>{formatCardReason(item.reason)}</span><small>{item.triggerMatchTitle}</small>{canCoordinate && <select disabled={!confirmedMatches.length} defaultValue="" onChange={(event) => void serveSuspension(item.id, event.target.value)}><option value="">Baixar em...</option>{confirmedMatches.map((match) => <option key={match.id} value={match.id}>{match.title} • {match.matchDate?.slice(0, 10)}</option>)}</select>}</article>)}</div>}
      </div>
    </section>
  );

/*

  return <section className="card compact operations-panel dashboard-ops-card"><div className="card-head"><div><h2>Central operacional</h2><p className="muted">Métricas rápidas de disciplina, financeiro e status da quadra.</p></div><span className={`status ${suspensions.length ? 'danger' : 'open'}`}>{suspensions.length} pend.</span></div><div className="ops-widget-grid"><article className="ops-highlight danger"><span className="dashboard-icon"><DashboardIcon name="shield" /></span><small>Disciplina</small><strong>{suspensions.length}</strong><em>{suspensions.length ? 'Suspensões ativas exigem baixa' : 'Nenhuma suspensão aberta'}</em></article><article className="ops-highlight gold"><span className="dashboard-icon"><DashboardIcon name="wallet" /></span><small>Financeiro</small><strong>{canCoordinate && paymentSummary ? `${paymentSummary.pending + paymentSummary.late}` : 'Restrito'}</strong><em>{canCoordinate && paymentSummary ? `${paymentSummary.late} atraso(s) • caixa ${formatMoney(cashSummary?.balanceCents ?? 0)}` : 'Visível apenas para coordenação'}</em></article><article className="ops-highlight success"><span className="dashboard-icon"><DashboardIcon name="field" /></span><small>Quadra / reserva</small><strong>{nextScheduledMatch ? 'Reservada' : 'Sem agenda'}</strong><em>{nextScheduledMatch ? `${compactMatchDateLabel(nextScheduledMatch)} • ${nextScheduledMatch.title}` : 'Cadastre o próximo jogo para refletir a reserva'}</em></article></div><div className="ops-section dashboard-suspension-section"><div className="card-head"><strong>Suspensões ativas</strong><span className={`status ${suspensions.length ? 'danger' : 'open'}`}>{suspensions.length}</span></div>{suspensions.length === 0 ? <p className="muted">Sem pendências disciplinares no momento.</p> : <div className="suspension-list compact-suspensions">{suspensions.slice(0, 4).map((item) => <article className="suspension-row" key={item.id}><strong>{item.userName}</strong><span>{formatCardReason(item.reason)}</span><small>Origem: {item.triggerMatchTitle}</small>{canCoordinate && <select disabled={!confirmedMatches.length} defaultValue="" onChange={(event) => void serveSuspension(item.id, event.target.value)}><option value="">Cumpriu em...</option>{confirmedMatches.map((match) => <option key={match.id} value={match.id}>{match.title} • {match.matchDate?.slice(0, 10)}</option>)}</select>}</article>)}</div>}</div></section>;
*/
}

function DashboardMatchesPanel({ api, canCoordinate, users, matches, activeSeasonId, currentUserId, onReload, selectedMatch, setSelectedMatch }: { api: ApiClient; canCoordinate: boolean; users: User[]; matches: MatchListItem[]; activeSeasonId: string; currentUserId: string; onReload: () => Promise<void>; selectedMatch: MatchDetail | null; setSelectedMatch: (match: MatchDetail | null) => void }) {
  const [clockRunning, setClockRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [matchMessage, setMatchMessage] = useState('');
  const [selectedSheetMatch, setSelectedSheetMatch] = useState<MatchDetail | null>(null);

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
  const activeUserCount = Math.max(1, users.filter((user) => user.active !== false).length);
  const nextMatch = sortedMatches.filter((match) => match.status !== 'CONFIRMED' && match.status !== 'CANCELLED').find((match) => getMatchStartTime(match) >= Date.now()) ?? sortedMatches.find((match) => match.status !== 'CONFIRMED' && match.status !== 'CANCELLED') ?? null;

  function renderHeroCard(match: MatchListItem) {
    const date = matchDateParts(match);
    const playing = match.attendancePlaying ?? 0;
    const presentOnly = match.attendancePresentOnly ?? 0;
    const absent = match.attendanceAbsent ?? 0;
    const dinnerPeople = match.attendanceDinnerPeople ?? 0;
    const responses = playing + presentOnly + absent;
    const pending = Math.max(activeUserCount - responses, 0);
    const responsePercent = Math.min(100, Math.round((responses / activeUserCount) * 100));
    const myAttendanceStatus = match.myAttendanceStatus ?? null;
    const confirmationText = match.confirmationOpen ? 'Aberto para Confirmação' : 'Fechado para Confirmação';
    const confirmationDetail = match.confirmationOpen ? `${attendanceStatusLabel(myAttendanceStatus)}${match.confirmationCloseAt ? ` • fecha ${formatBrasiliaTime(match.confirmationCloseAt)}` : ''}` : confirmationWindowHasEnded(match) ? `Janela encerrada${match.confirmationCloseAt ? ` em ${formatBrasiliaTime(match.confirmationCloseAt)}` : ''}.` : `Janela configurada: ${confirmationWindowScheduleLabel(match)}.`;
    const segments = [
      { label: 'Confirmados', value: playing, className: 'confirmed' },
      { label: 'Só presença', value: presentOnly, className: 'present-only' },
      { label: 'Ausentes', value: absent, className: 'absent' },
      { label: 'Não responderam', value: pending, className: 'pending' },
      { label: dinnerPeople > 0 ? 'Jantar' : 'Para ajustar', value: dinnerPeople, className: 'dinner' }
    ];

    return <article className="next-match-hero" key={match.id}><div className="next-match-pitch" aria-hidden="true"><SoccerLineUp size="fill" color="#0b4c3d" orientation="horizontal" /></div><div className="next-match-date-badge"><b>{date.day}</b><span>{date.month}</span><small>{date.weekday}</small><em>{date.time}</em></div><div className="next-match-center"><div className="match-card-headline"><div><strong>{match.title}</strong><small>{matchRelativeLabel(match)} • {matchStatusLabel(match.status)}</small></div><small className="lineup-status">Sua resposta: {myAttendanceStatus ? attendanceActionLabel(myAttendanceStatus) : 'pendente'}</small></div><div className="match-card-score next-scoreboard"><span className="team-name team-name-home">{match.teamAName}</span><b className="score-pill">{match.teamAScore} x {match.teamBScore}</b><span className="team-name team-name-away">{match.teamBName}</span></div><div className="match-card-metrics next-match-metrics">{segments.map((segment) => <span className={`metric-pill ${segment.className}`} key={segment.label}><b>{segment.value}</b>{segment.label}</span>)}</div><div className="confirmation-progress-track">{segments.map((segment) => <i key={segment.label} className={segment.className} style={{ width: `${Math.max(segment.value, responses ? (segment.value / Math.max(responses, 1)) * 100 : 0)}%` }} />)}</div><small className="next-match-footnote">{confirmationDetail}</small></div><div className="next-match-side"><span className={`status ${match.confirmationOpen ? 'open' : 'danger'}`}>{confirmationText}</span><span className="status">{responsePercent}% respostas</span><div className="countdown-panel"><small>Contagem regressiva</small><b>{matchCountdownLabel(match)}</b></div><div className="next-match-actions">{canCoordinate && match.status === 'DRAFT' && !match.confirmationOpen && !confirmationWindowHasEnded(match) && <button type="button" className="ghost" onClick={() => void openConfirmation(match.id)}>Abrir confirmação</button>}<button type="button" className={`primary ${myAttendanceStatus ? 'confirmed-action' : ''}`} title={myAttendanceStatus ? 'Clique para alterar sua confirmação.' : 'Abrir confirmação da rodada.'} onClick={() => void openMatch(match.id)}>{myAttendanceStatus ? 'Confirmações' : 'Confirmar presença'}</button><button type="button" className="ghost" onClick={() => canCoordinate ? void openSheet(match.id) : void openMatch(match.id)}>{canCoordinate ? 'Abrir súmula' : 'Ver jogo'}</button></div></div></article>;
  }

  return (
    <section className="card compact matches-report dashboard-next-match-card">
      <div className="card-head">
        <div>
          <h2>Central dos jogos</h2>
          <p className="muted">Próximo jogo e partidas já finalizadas. Agenda anual fica no menu Agenda.</p>
        </div>
        {canCoordinate && <OperationalMatchDialog api={api} users={users} activeSeasonId={activeSeasonId} onDone={onReload} />}
      </div>
      {matchMessage && <button className="alert" onClick={() => setMatchMessage('')}>{matchMessage}</button>}
      {nextMatch ? renderHeroCard(nextMatch) : <EmptyState title="Sem próximo jogo operacional" text="Crie ou ajuste a agenda para exibir a próxima rodada aqui." />}
      {selectedMatch && (
        <div className="modal match-modal">
          <section className="match-modal-card">
            <div className="card-head">
              <div>
                <h2>{selectedMatch.title}</h2>
                <p className="muted">Confirmação da rodada • {selectedMatch.matchDate?.slice(0, 10)} • {matchStatusLabel(selectedMatch.status)}</p>
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
          </section>
        </div>
      )}
      {selectedSheetMatch && (
        <div className="modal match-modal">
          <section className="match-modal-card sheet-modal-card">
            <div className="card-head">
              <div>
                <h2>{selectedSheetMatch.title}</h2>
                <p className="muted">Abrir súmula • {selectedSheetMatch.matchDate?.slice(0, 10)} • {matchStatusLabel(selectedSheetMatch.status)}</p>
              </div>
              <button type="button" className="ghost modal-close-button" aria-label="Fechar modal" title="Fechar" onClick={() => setSelectedSheetMatch(null)}>X</button>
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
    const attendancePlayers: MatchDraftPlayer[] = match.attendance
      .filter((item) => item.responseStatus !== 'AUSENTE')
      .map((item, index) => {
        const user = users.find((current) => current.id === item.userId);
        const position = user?.position ?? item.position ?? 'MC';
        const presentOnly = item.responseStatus === 'PRESENTE_SEM_JOGAR';
        return {
          userId: item.userId,
          name: item.name,
          email: user?.email ?? '',
          position,
          team: presentOnly ? 'PRESENTE_SEM_JOGAR' as const : 'A' as const,
          roleInMatch: presentOnly ? 'PRESENTE_SEM_JOGAR' as const : position === 'GO' ? 'GOLEIRO' as const : 'LINHA' as const,
          drawOrder: String(index + 1),
          startsOnBench: false
        };
      });

    if (match.players.length) {
      const mergedPlayers = match.players.map((player) => ({ ...player }));
      const existingIds = new Set(mergedPlayers.map((player) => player.userId));
      let nextDrawOrder = mergedPlayers.reduce((highest, player) => Math.max(highest, player.drawOrder ?? 0), 0) + 1;

      for (const attendancePlayer of attendancePlayers) {
        if (existingIds.has(attendancePlayer.userId)) continue;
        if (attendancePlayer.team === 'PRESENTE_SEM_JOGAR') {
          mergedPlayers.push({
            userId: attendancePlayer.userId,
            name: attendancePlayer.name,
            team: 'PRESENTE_SEM_JOGAR',
            roleInMatch: 'PRESENTE_SEM_JOGAR',
            drawOrder: nextDrawOrder++,
            rotationOrder: null,
            startsOnBench: false
          });
          existingIds.add(attendancePlayer.userId);
          continue;
        }

        const teamAPlayers = mergedPlayers.filter((player) => player.team === 'A');
        const teamBPlayers = mergedPlayers.filter((player) => player.team === 'B');
        const targetTeam: 'A' | 'B' = teamAPlayers.length <= teamBPlayers.length ? 'A' : 'B';
        const targetTeamStarters = mergedPlayers.filter((player) => player.team === targetTeam && !player.startsOnBench);
        const missingGoalkeeper = attendancePlayer.position === 'GO' && !targetTeamStarters.some((player) => player.roleInMatch === 'GOLEIRO');
        mergedPlayers.push({
          userId: attendancePlayer.userId,
          name: attendancePlayer.name,
          team: targetTeam,
          roleInMatch: missingGoalkeeper ? 'GOLEIRO' : 'LINHA',
          drawOrder: nextDrawOrder++,
          rotationOrder: null,
          startsOnBench: targetTeamStarters.length >= 7 && !missingGoalkeeper
        });
        existingIds.add(attendancePlayer.userId);
      }

      return normalizePlayersForBoard(mergedPlayers);
    }

    if (!attendancePlayers.length) return [];

    const balanced = drawBalancedTeams(attendancePlayers);
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
        startsOnBench: player.startsOnBench
      };
    });
  }

  const [players, setPlayers] = useState(seededPlayers);
  const [teamAScore, setTeamAScore] = useState(match.status === 'CONFIRMED' ? match.teamAScore : match.draftTeamAScore ?? match.teamAScore);
  const [teamBScore, setTeamBScore] = useState(match.status === 'CONFIRMED' ? match.teamBScore : match.draftTeamBScore ?? match.teamBScore);
  const [events, setEvents] = useState<MatchEventDraft[]>(initialEvents.map((event) => ({ userId: event.userId, relatedUserId: event.relatedUserId, eventType: event.eventType as MatchEventDraft['eventType'], minute: event.minute, team: event.team, occurredAt: event.occurredAt ?? event.createdAt ?? null, createdAt: event.createdAt ?? null })));
  const [clockSeconds, setClockSeconds] = useState(match.status === 'RUNNING' && match.startedAt ? Math.max(0, Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000)) : match.draftClockSeconds ?? 0);
  const [clockRunning, setClockRunning] = useState(match.status === 'RUNNING' || Boolean(match.draftClockRunning));
  const [gameStarted, setGameStarted] = useState(match.status !== 'DRAFT' || Boolean(match.startedAt));
  const [officialStartedAt, setOfficialStartedAt] = useState<string | null>(match.startedAt ?? null);
  const [sheetMessage, setSheetMessage] = useState(match.draftSavedAt ? `Rascunho salvo em ${formatBrasiliaTime(match.draftSavedAt)}.` : 'Arraste um titular sobre um reserva do mesmo time para fazer a troca automática.');
  const [draggedPlayerId, setDraggedPlayerId] = useState('');
  const [dropTargetId, setDropTargetId] = useState('');
  const usersById = new Map(users.map((item) => [item.id, item]));
  const attendanceStatusByUserId = new Map(match.attendance.map((item) => [item.userId, item.responseStatus]));
  const skipAutosaveRef = useRef(true);
  const appliedAutoSwapMinutesRef = useRef<Record<'A' | 'B', number[]>>({ A: [], B: [] });

  useEffect(() => {
    const recoveredEvents = match.status === 'CONFIRMED' ? match.events : match.draftEvents?.length ? match.draftEvents : match.events;
    setPlayers(seededPlayers());
    setTeamAScore(match.status === 'CONFIRMED' ? match.teamAScore : match.draftTeamAScore ?? match.teamAScore);
    setTeamBScore(match.status === 'CONFIRMED' ? match.teamBScore : match.draftTeamBScore ?? match.teamBScore);
    setEvents(recoveredEvents.map((event) => ({ userId: event.userId, relatedUserId: event.relatedUserId, eventType: event.eventType as MatchEventDraft['eventType'], minute: event.minute, team: event.team, occurredAt: event.occurredAt ?? event.createdAt ?? null, createdAt: event.createdAt ?? null })));
    setClockSeconds(match.status === 'RUNNING' && match.startedAt ? Math.max(0, Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000)) : match.draftClockSeconds ?? 0);
    setClockRunning(match.status === 'RUNNING' || Boolean(match.draftClockRunning));
    setGameStarted(match.status !== 'DRAFT' || Boolean(match.startedAt));
    setOfficialStartedAt(match.startedAt ?? null);
    setSheetMessage(match.draftSavedAt ? `Rascunho salvo em ${formatBrasiliaTime(match.draftSavedAt)}.` : 'Arraste um titular sobre um reserva do mesmo time para fazer a troca automática.');
    setDraggedPlayerId('');
    setDropTargetId('');
    skipAutosaveRef.current = true;
    appliedAutoSwapMinutesRef.current = { A: [], B: [] };
  }, [match.id, match.status, match.startedAt, match.teamAScore, match.teamBScore, match.draftTeamAScore, match.draftTeamBScore, match.draftClockSeconds, match.draftClockRunning, match.draftSavedAt, match.players, match.draftEvents, match.events, match.attendance, users]);

  useEffect(() => {
    const limitSeconds = (match.availableMinutes ?? 60) * 60;
    if ((match.status === 'RUNNING' || (match.status === 'DRAFT' && gameStarted)) && officialStartedAt) {
      const syncOfficialClock = () => setClockSeconds(Math.min(limitSeconds, Math.max(0, Math.floor((Date.now() - new Date(officialStartedAt).getTime()) / 1000))));
      syncOfficialClock();
      const timer = window.setInterval(syncOfficialClock, 1000);
      return () => window.clearInterval(timer);
    }
    if (!clockRunning) return;
    const timer = window.setInterval(() => setClockSeconds((value) => Math.min(limitSeconds, value + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [clockRunning, gameStarted, match.availableMinutes, match.status, officialStartedAt]);

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

  const playablePlayers = players.filter((player) => player.team !== 'PRESENTE_SEM_JOGAR');
  const currentMinute = Math.floor(clockSeconds / 60);
  const canRegisterEvents = gameStarted && match.status !== 'CONFIRMED' && match.status !== 'CANCELLED';
  const canRepositionPlayers = match.status !== 'CONFIRMED' && match.status !== 'CANCELLED';

  function normalizePlayersForBoard(list: MatchDetail['players']) {
    const ranked = [...list].sort((left, right) => {
      const leftOrder = left.rotationOrder ?? left.drawOrder ?? 999;
      const rightOrder = right.rotationOrder ?? right.drawOrder ?? 999;
      if (left.team !== right.team) return left.team.localeCompare(right.team);
      return leftOrder - rightOrder;
    });
    const teamOrders = { A: 0, B: 0 };
    return ranked.map((player) => player.team === 'A' || player.team === 'B' ? { ...player, rotationOrder: ++teamOrders[player.team] } : { ...player, rotationOrder: player.rotationOrder ?? null });
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

  function pitchSlots(team: 'A' | 'B', count: number) {
    const baseSlots = team === 'A'
      ? [
          { left: 11, top: 50 },
          { left: 24, top: 18 },
          { left: 24, top: 34 },
          { left: 24, top: 50 },
          { left: 24, top: 66 },
          { left: 24, top: 82 },
          { left: 40, top: 26 },
          { left: 40, top: 42 },
          { left: 40, top: 58 },
          { left: 40, top: 74 },
          { left: 56, top: 38 },
          { left: 56, top: 62 }
        ]
      : [
          { left: 89, top: 50 },
          { left: 76, top: 18 },
          { left: 76, top: 34 },
          { left: 76, top: 50 },
          { left: 76, top: 66 },
          { left: 76, top: 82 },
          { left: 60, top: 26 },
          { left: 60, top: 42 },
          { left: 60, top: 58 },
          { left: 60, top: 74 },
          { left: 44, top: 38 },
          { left: 44, top: 62 }
        ];
    return baseSlots.slice(0, Math.max(count, 0));
  }

  function fieldPlayers(team: 'A' | 'B') {
    const starters = startersForTeam(team);
    const goalkeeper = starters.find((player) => player.roleInMatch === 'GOLEIRO');
    const outfield = starters.filter((player) => player.userId !== goalkeeper?.userId);
    const ordered = goalkeeper ? [goalkeeper, ...outfield] : outfield;
    const slots = pitchSlots(team, ordered.length);
    return ordered.map((player, index) => ({ player, slot: slots[index] }));
  }

  const sheetRotationPlans = useMemo(() => ({
    A: buildSheetRotationPlan(playersForTeam('A').filter((player) => player.roleInMatch === 'LINHA').map((player) => ({ userId: player.userId, name: player.name, rotationOrder: player.rotationOrder ?? player.drawOrder ?? 999, startsOnBench: player.startsOnBench })), match.availableMinutes ?? 60),
    B: buildSheetRotationPlan(playersForTeam('B').filter((player) => player.roleInMatch === 'LINHA').map((player) => ({ userId: player.userId, name: player.name, rotationOrder: player.rotationOrder ?? player.drawOrder ?? 999, startsOnBench: player.startsOnBench })), match.availableMinutes ?? 60)
  }), [players, match.availableMinutes]);

  useEffect(() => {
    if (match.status !== 'RUNNING') return;
    const dueSteps: Array<{ team: 'A' | 'B'; step: SheetRotationStep }> = [];
    for (const team of ['A', 'B'] as const) {
      for (const step of sheetRotationPlans[team].schedule) {
        if (step.minute <= currentMinute && !appliedAutoSwapMinutesRef.current[team].includes(step.minute)) dueSteps.push({ team, step });
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
    for (const { team, step } of dueSteps) appliedAutoSwapMinutesRef.current[team].push(step.minute);
    const labels = dueSteps.map(({ team, step }) => `Time ${team} ${step.label.toLowerCase()}`).join(' • ');
    setSheetMessage(`Troca automática aplicada: ${labels}.`);
  }, [currentMinute, match.status, sheetRotationPlans]);

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
    setEvents((list) => [...list, { userId: player.userId, relatedUserId, eventType, minute: eventMinute, team: eventTeam, occurredAt: new Date().toISOString() }]);
    scoreForPreview(eventType, eventTeam);
    setSheetMessage(`${eventLabel(eventType)} lançado para ${player.name}.`);
  }

  function canSwapPlayers(firstPlayer: MatchDetail['players'][number] | undefined, secondPlayer: MatchDetail['players'][number] | undefined) {
    return Boolean(firstPlayer && secondPlayer && firstPlayer.userId !== secondPlayer.userId && firstPlayer.team !== 'PRESENTE_SEM_JOGAR' && secondPlayer.team !== 'PRESENTE_SEM_JOGAR' && ((firstPlayer.team === secondPlayer.team && firstPlayer.startsOnBench !== secondPlayer.startsOnBench) || firstPlayer.team !== secondPlayer.team));
  }

  async function saveBoard(showFeedback = true) {
    const teamAPlayers = players.filter((player) => player.team === 'A');
    const teamBPlayers = players.filter((player) => player.team === 'B');
    await api.request(`/matches/${match.id}/lineup`, {
      method: 'PATCH',
      body: JSON.stringify({
        matchDate: match.matchDate.slice(0, 10),
        title: match.title,
        refereeName: match.refereeName ?? null,
        teamAName: match.teamAName,
        teamBName: match.teamBName,
        players: players.map((player, index) => ({
          userId: player.userId,
          team: player.team,
          roleInMatch: player.team === 'PRESENTE_SEM_JOGAR' ? 'PRESENTE_SEM_JOGAR' : player.roleInMatch,
          drawOrder: player.drawOrder ?? index + 1,
          rotationOrder: player.team === 'A' ? teamAPlayers.findIndex((item) => item.userId === player.userId) + 1 : player.team === 'B' ? teamBPlayers.findIndex((item) => item.userId === player.userId) + 1 : null,
          startsOnBench: player.startsOnBench,
          present: true
        }))
      })
    });
    const saved = await api.request<{ draftSavedAt: string }>(`/matches/${match.id}/draft`, {
      method: 'PATCH',
      body: JSON.stringify({ teamAScore, teamBScore, events, clockSeconds, clockRunning })
    });
    if (showFeedback) setSheetMessage(`Rascunho salvo em ${formatBrasiliaTime(saved.draftSavedAt)}.`);
  }

  async function startGame() {
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
    setClockSeconds(Math.max(0, Math.floor((Date.now() - new Date(started.startedAt).getTime()) / 1000)));
    setClockRunning(true);
    setSheetMessage('Jogo iniciado com cronômetro oficial.');
    await onSaved();
  }

  async function finalizeGame() {
    if (match.status === 'CONFIRMED') {
      setSheetMessage('Esta súmula já foi confirmada.');
      return;
    }
    if (match.status === 'DRAFT') {
      setSheetMessage('Inicie o jogo antes de finalizar a súmula.');
      return;
    }
    await saveBoard(false);
    if (match.status !== 'SUBMITTED') {
      await api.request(`/matches/${match.id}/submit`, { method: 'POST', body: JSON.stringify({ teamAScore, teamBScore, events }) });
    }
    await api.request(`/matches/${match.id}/confirm`, { method: 'POST' });
    setClockRunning(false);
    setSheetMessage('Jogo finalizado e súmula confirmada.');
    await onSaved();
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
    setPlayers((list) => {
      const next = list.map((player) => {
        if (player.userId === draggedPlayerId) {
          return draggedPlayer?.team === targetPlayer?.team
            ? { ...player, startsOnBench: targetPlayer?.startsOnBench ?? player.startsOnBench }
            : { ...player, team: targetPlayer?.team ?? player.team, roleInMatch: targetPlayer?.roleInMatch ?? player.roleInMatch, startsOnBench: targetPlayer?.startsOnBench ?? player.startsOnBench };
        }
        if (player.userId === targetPlayerId) {
          return draggedPlayer?.team === targetPlayer?.team
            ? { ...player, startsOnBench: draggedPlayer?.startsOnBench ?? player.startsOnBench }
            : { ...player, team: draggedPlayer?.team ?? player.team, roleInMatch: draggedPlayer?.roleInMatch ?? player.roleInMatch, startsOnBench: draggedPlayer?.startsOnBench ?? player.startsOnBench };
        }
        return player;
      });
      return normalizePlayersForBoard(next);
    });
    setDraggedPlayerId('');
    setDropTargetId('');
    setSheetMessage(draggedPlayer?.team === targetPlayer?.team ? `Troca feita entre #${playerBoardNumber(draggedPlayer!, 0)} e #${playerBoardNumber(targetPlayer!, 0)}.` : `${draggedPlayer?.name} e ${targetPlayer?.name} trocaram de lado.`);
  }

  function playerIsDimmed(player: MatchDetail['players'][number]) {
    const status = attendanceStatusByUserId.get(player.userId);
    return !status || status === 'AUSENTE';
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

  function rosterSubtitle(player: MatchDetail['players'][number]) {
    const user = usersById.get(player.userId);
    if (player.roleInMatch === 'GOLEIRO') return '# • Goleiro';
    return user?.position ?? 'MC';
  }

  function rosterRow(player: MatchDetail['players'][number], index: number, reserve = false) {
    const user = usersById.get(player.userId);
    const dragged = draggedPlayerId === player.userId;
    const dropTarget = dropTargetId === player.userId;
    const pending = playerIsDimmed(player);
    return (
      <div className={`ops-roster-row sheet-roster-row ${reserve ? 'is-reserve' : ''} ${dragged ? 'is-dragging' : ''} ${dropTarget ? 'is-drop-target' : ''} ${pending ? 'is-pending' : ''}`} key={player.userId} role="group" draggable={canRepositionPlayers} onDragStart={() => setDraggedPlayerId(player.userId)} onDragEnd={() => { setDraggedPlayerId(''); setDropTargetId(''); }} onDragOver={(event) => { const sourcePlayer = players.find((current) => current.userId === draggedPlayerId); if (canRepositionPlayers && canSwapPlayers(sourcePlayer, player)) { event.preventDefault(); setDropTargetId(player.userId); } }} onDragLeave={() => { if (dropTargetId === player.userId) setDropTargetId(''); }} onDrop={(event) => { event.preventDefault(); if (canRepositionPlayers) executeDragSwap(player.userId); }}>
        <div className="ops-roster-avatar">{user?.avatarDataUrl ? <img src={user.avatarDataUrl} alt={player.name} /> : <span>{player.name.slice(0, 1)}</span>}</div>
        <div className="ops-roster-copy">
          <strong>#{playerBoardNumber(player, index)} {player.name}</strong>
          <small>{rosterSubtitle(player)}{pending ? ' • não confirmado' : ''}{canRepositionPlayers ? ' • arraste para trocar' : ''}</small>
        </div>
        <div className="ops-roster-actions">
          <button type="button" className="ops-icon-card is-yellow" title={canRegisterEvents ? 'Cartão amarelo' : 'Inicie o jogo para lançar eventos'} disabled={!canRegisterEvents} onClick={(event) => { event.stopPropagation(); addQuickEvent(player, 'CARTAO_AMARELO'); }}>🟨</button>
          <button type="button" className="ops-icon-card is-red" title={canRegisterEvents ? 'Cartão vermelho' : 'Inicie o jogo para lançar eventos'} disabled={!canRegisterEvents} onClick={(event) => { event.stopPropagation(); addQuickEvent(player, 'CARTAO_VERMELHO'); }}>🟥</button>
          <button type="button" className="ops-icon-card is-goal" title={canRegisterEvents ? 'Gol' : 'Inicie o jogo para lançar eventos'} disabled={!canRegisterEvents} onClick={(event) => { event.stopPropagation(); addQuickEvent(player, 'GOL'); }}>⚽</button>
          <button type="button" className="ops-icon-card is-more" title={canRegisterEvents ? 'Assistência' : 'Inicie o jogo para lançar eventos'} disabled={!canRegisterEvents} onClick={(event) => { event.stopPropagation(); addQuickEvent(player, 'ASSISTENCIA'); }}>A</button>
        </div>
      </div>
    );
  }

  const clockLabel = `${String(Math.floor(clockSeconds / 60)).padStart(2, '0')}:${String(clockSeconds % 60).padStart(2, '0')}`;
  const summaryLines = events.slice().sort((left, right) => {
    const leftTime = left.occurredAt ?? left.createdAt ? new Date(left.occurredAt ?? left.createdAt ?? '').getTime() : left.minute * 60000;
    const rightTime = right.occurredAt ?? right.createdAt ? new Date(right.occurredAt ?? right.createdAt ?? '').getTime() : right.minute * 60000;
    return leftTime - rightTime;
  });
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

      <div className="sheet-preview-arena">
        <section className="ops-roster-column sheet-roster-panel">
          <div className="ops-roster-head team-a-head"><strong>{match.teamAName}</strong><div className="sheet-crest-pair small"><span className="sheet-crest is-solid" /><span className="sheet-crest is-outline" /></div></div>
          <span className="sheet-panel-label">Titulares</span>
          <div className="ops-roster-list">{startersForTeam('A').length ? startersForTeam('A').map((player, index) => rosterRow(player, index)) : <small className="muted">Sem titulares definidos.</small>}</div>
          <div className="ops-roster-head reserve-head"><strong>Banco de reservas</strong><span>{reservesForTeam('A').length}</span></div>
          <div className="ops-roster-list reserve-list">{reservesForTeam('A').length ? reservesForTeam('A').map((player, index) => rosterRow(player, index, true)) : <small className="muted">Sem reservas definidos.</small>}</div>
        </section>

        <section className="ops-pitch-card sheet-pitch-panel">
          <div className="ops-pitch-surface sheet-pitch-surface">
            <div className="ops-pitch-center-circle" />
            <div className="ops-pitch-midline" />
            <div className="ops-pitch-box ops-pitch-box-a" />
            <div className="ops-pitch-box ops-pitch-box-b" />
            {fieldPlayers('A').map(({ player, slot }, index) => <div className={`ops-pitch-player team-a-player ${player.roleInMatch === 'GOLEIRO' ? 'is-goalkeeper' : ''} ${playerIsDimmed(player) ? 'is-pending' : ''}`} key={`sheet-a-${player.userId}`} style={{ left: `${slot.left}%`, top: `${slot.top}%` }}><span>{player.roleInMatch === 'GOLEIRO' ? `G${playerBoardNumber(player, index)}` : playerBoardNumber(player, index)}</span><small>{player.name.split(' ')[0]}</small></div>)}
            {fieldPlayers('B').map(({ player, slot }, index) => <div className={`ops-pitch-player team-b-player ${player.roleInMatch === 'GOLEIRO' ? 'is-goalkeeper' : ''} ${playerIsDimmed(player) ? 'is-pending' : ''}`} key={`sheet-b-${player.userId}`} style={{ left: `${slot.left}%`, top: `${slot.top}%` }}><span>{player.roleInMatch === 'GOLEIRO' ? `G${playerBoardNumber(player, index)}` : playerBoardNumber(player, index)}</span><small>{player.name.split(' ')[0]}</small></div>)}
          </div>
        </section>

        <section className="ops-roster-column sheet-roster-panel">
          <div className="ops-roster-head team-b-head"><div className="sheet-crest-pair small"><span className="sheet-crest is-solid" /><span className="sheet-crest is-outline" /></div><strong>{match.teamBName}</strong></div>
          <span className="sheet-panel-label">Titulares</span>
          <div className="ops-roster-list">{startersForTeam('B').length ? startersForTeam('B').map((player, index) => rosterRow(player, index)) : <small className="muted">Sem titulares definidos.</small>}</div>
          <div className="ops-roster-head reserve-head"><strong>Banco de reservas</strong><span>{reservesForTeam('B').length}</span></div>
          <div className="ops-roster-list reserve-list">{reservesForTeam('B').length ? reservesForTeam('B').map((player, index) => rosterRow(player, index, true)) : <small className="muted">Sem reservas definidos.</small>}</div>
        </section>
      </div>

      <div className="sheet-preview-bottom">
        <section className="sheet-log-panel is-sheet-main">
          <div className="match-control-feed-head">
            <div>
              <strong>Log da súmula</strong>
              <small>{match.matchDate ? new Date(match.matchDate).toLocaleDateString('pt-BR') : 'Sem data'}</small>
            </div>
            <small>{sheetMessage}</small>
          </div>
          <div className="event-log ops-event-log">{summaryLines.length === 0 ? <small className="muted">Sem eventos registrados ainda.</small> : summaryLines.map((item, index) => <span key={`log-${item.userId}-${item.eventType}-${index}`}><b>{summaryTime(item)}</b><small>{summaryText(item).split(' - ').slice(1).join(' - ')}</small></span>)}</div>
          <div className="sheet-footer-actions">{match.status === 'DRAFT' && <button type="button" className="primary sheet-green-button" onClick={() => void startGame()}>INICIAR JOGO</button>}{match.status !== 'CONFIRMED' && <button type="button" className="primary danger-action sheet-danger-button" onClick={() => void finalizeGame()}>{match.status === 'SUBMITTED' ? 'CONFIRMAR FINALIZAÇÃO' : 'FINALIZAR JOGO'}</button>}</div>
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
        <div>
          <h2>Jogos finalizados</h2>
          <p className="muted">Quando uma súmula for confirmada, o jogo entra aqui como histórico útil. Jogos futuros além do próximo ficam somente na Agenda.</p>
        </div>
        <span className="status">{finishedMatches.length}</span>
      </div>
      <div className="finished-vertical-list">{finishedMatches.length === 0 ? <EmptyState title="Sem jogos confirmados" text="Os últimos placares entram aqui quando as súmulas forem fechadas." /> : finishedMatches.map((match) => <article className="finished-list-row" key={match.id}><div className="finished-list-main"><strong>{match.matchDate?.slice(5, 10)} • {match.teamAName}</strong><small>{match.title}</small></div><div className="finished-list-score"><b>{match.teamAScore}</b><span>x</span><b>{match.teamBScore}</b></div><div className="finished-list-side"><strong>{match.teamBName}</strong><span className="finished-badge">MVP</span></div></article>)}</div>
    </section>
  );

  return <section className="card compact dashboard-finished-card"><div className="card-head"><div><h2>Jogos finalizados</h2><p className="muted">Confrontos recentes em lista compacta.</p></div><span className="status">{finishedMatches.length}</span></div><div className="finished-vertical-list">{finishedMatches.length === 0 ? <EmptyState title="Sem jogos confirmados" text="Os últimos placares entram aqui quando as súmulas forem fechadas." /> : finishedMatches.map((match) => <article className="finished-list-row" key={match.id}><div className="finished-list-main"><strong>{match.matchDate?.slice(5, 10)} • {match.teamAName}</strong><small>{match.title}</small></div><div className="finished-list-score"><b>{match.teamAScore}</b><span>x</span><b>{match.teamBScore}</b></div><div className="finished-list-side"><strong>{match.teamBName}</strong><span className="finished-badge">MVP</span></div></article>)}</div></section>;
}

function DashboardStandingsPanel({ standings, onOpenProfile }: { standings: Standing[]; onOpenProfile: (userId: string) => void }) {
  return (
    <section className="card compact dashboard-standings-card">
      <div className="card-head championship-head">
        <div>
          <h2>Tabela da temporada</h2>
          <p className="muted">Classificação em largura total, estilo campeonato: clique no atleta para abrir o perfil.</p>
        </div>
      </div>
      {standings.length === 0 ? <EmptyState title="Sem classificação ainda" text="A tabela será preenchida assim que os jogos forem confirmados." /> : <div className="championship-wrap dashboard-standings-wrap"><table className="championship-table dashboard-standings-table"><thead><tr><th>#</th><th>Jogar name</th><th>Goals</th><th>Assists</th><th>% G/A Ratio</th><th>App</th></tr></thead><tbody>{standings.map((row) => <tr key={row.user_id}><td className="pos-cell">{row.position}</td><td className="athlete-cell"><button className="name-link strong" onClick={() => onOpenProfile(row.user_id)}>{row.name}</button></td><td>{row.goals}</td><td>{row.assists}</td><td>{row.assists > 0 ? (row.goals / row.assists).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : row.goals.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>{row.games_played + row.presences}</td></tr>)}</tbody></table></div>}
    </section>
  );

  return <section className="card compact dashboard-standings-card"><div className="card-head championship-head"><div><h2>Tabela da temporada</h2><p className="muted">Classificação e destaque ofensivo dos jogadores.</p></div></div>{standings.length === 0 ? <EmptyState title="Sem classificação ainda" text="A tabela será preenchida assim que os jogos forem confirmados." /> : <div className="championship-wrap dashboard-standings-wrap"><table className="championship-table dashboard-standings-table"><thead><tr><th>#</th><th>Jogar name</th><th>Goals</th><th>Assists</th><th>% G/A Ratio</th><th>App</th></tr></thead><tbody>{standings.map((row) => <tr key={row.user_id}><td className="pos-cell">{row.position}</td><td className="athlete-cell"><button className="name-link strong" onClick={() => onOpenProfile(row.user_id)}>{row.name}</button></td><td>{row.goals}</td><td>{row.assists}</td><td>{row.assists > 0 ? (row.goals / row.assists).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : row.goals.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>{row.games_played + row.presences}</td></tr>)}</tbody></table></div>}</section>;
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

  return <section className="card compact standings-card"><div className="card-head championship-head"><div><h2>Tabela da temporada</h2><p className="muted">Classificação em largura total, estilo campeonato: clique no atleta para abrir o perfil.</p></div>{standings.length > 0 && <button className="ghost" onClick={() => downloadCsv('poka-pratika-classificacao.csv', standings.map((row) => ({ posicao: row.position, atleta: row.name, pontos: row.total_points, jogos: row.games_played, vitorias: row.wins, empates: row.draws, derrotas: row.losses, presencasSemJogar: row.presences, mensalidades: row.paid_months, gols: row.goals, golsContra: row.own_goals, assistencias: row.assists, cartoes: row.total_cards, saldoEquipe: row.team_goal_balance })))}>Exportar CSV</button>}</div>{standings.length === 0 ? <EmptyState title="Temporada pronta para começar" text="Assim que a primeira súmula for confirmada, a tabela ganha vida." /> : <div className="championship-wrap"><table className="championship-table"><thead><tr><th>Pos</th><th>Atleta</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>PSJ</th><th>Mens.</th><th>GP</th><th>GC</th><th>SG</th><th>GF</th><th>GS</th><th>SE</th><th>APR</th><th>G</th><th>A</th><th>CAR</th></tr></thead><tbody>{standings.map((row) => <tr key={row.user_id}><td className="pos-cell">{row.position}</td><td className="athlete-cell"><button className="name-link strong" onClick={() => onOpenProfile(row.user_id)}>{row.name}</button></td><td className="points-cell">{row.total_points}</td><td>{row.games_played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td>{row.presences}</td><td>{row.paid_months}</td><td>{row.goals}</td><td>{row.own_goals}</td><td>{row.net_goals}</td><td>{row.team_goals_for}</td><td>{row.team_goals_against}</td><td>{row.team_goal_balance}</td><td>{formatPercent(row.games_played ? ((row.wins * 3 + row.draws) / (row.games_played * 3)) * 100 : 0)}</td><td>{row.goals}</td><td>{row.assists}</td><td>{row.total_cards}</td></tr>)}</tbody></table></div>}<div className="leader-strip">{indicators.length === 0 ? <EmptyState title="Indicadores aguardando jogos" text="Os líderes individuais aparecem aqui após as primeiras súmulas confirmadas." /> : indicators.map((item) => <article className="leader-card" key={item.title}><span className="leader-icon">{item.icon}</span><div><small>{item.title}</small><button className="name-link" onClick={() => onOpenProfile(item.userId)}>{item.name}</button><b>{item.value} {item.suffix}</b><em>{item.detail}</em></div></article>)}</div></section>;
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
          <span className="attendance-club-name">Club no: POKA PRÁTIKA</span>
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
    const pending = Math.max(activeUserCount - responses, 0);
    const responsePercent = Math.min(100, Math.round((responses / activeUserCount) * 100));
    const confirmationText = match.confirmationOpen ? 'Aberto para Confirmação' : 'Fechado para Confirmação';
    const confirmationReallyOpen = isConfirmationReallyOpen(match);
    const myAttendanceStatus = match.myAttendanceStatus ?? null;
    const confirmationDetail = match.confirmationOpen
      ? `${attendanceStatusLabel(myAttendanceStatus)}${match.confirmationCloseAt ? ` • fecha ${formatBrasiliaTime(match.confirmationCloseAt)}` : ''}`
      : confirmationWindowHasEnded(match)
        ? `Janela encerrada${match.confirmationCloseAt ? ` em ${formatBrasiliaTime(match.confirmationCloseAt)}` : ''}.`
        : `Janela configurada: ${confirmationWindowScheduleLabel(match)}.`;

    return <article className={`match-card ${variant}`} key={match.id}><div className="match-date-badge"><b>{date.day}</b><span>{date.month}</span><em>{date.weekday} • {date.time}</em></div><div className="match-card-body"><div className="match-card-headline"><div><strong>{match.title}</strong><small>{matchRelativeLabel(match)} • {matchStatusLabel(match.status)}</small></div><div className="match-card-tags"><span className={`status ${match.confirmationOpen ? 'open' : 'danger'}`}>{confirmationText}</span><span className="status">{responsePercent}% respostas</span></div></div><div className="match-card-score"><span>{match.teamAName}</span><b>{match.teamAScore} x {match.teamBScore}</b><span>{match.teamBName}</span></div><div className="match-card-metrics"><span><b>{playing}</b> Confirmados</span><span><b>{presentOnly}</b> Só presença</span><span><b>{absent}</b> Ausentes</span><span><b>{pending}</b> Não responderam</span><span><b>{dinnerPeople}</b> Para o jantar</span></div><div className="match-card-progress"><i style={{ width: `${responsePercent}%` }} /></div><div className="match-card-footer"><small>{confirmationDetail}</small><div className="match-card-actions">{canCoordinate && match.status === 'DRAFT' && !match.confirmationOpen && !confirmationWindowHasEnded(match) && <button type="button" className="primary small" onClick={() => void openConfirmation(match.id)}>Abrir confirmação</button>}{confirmationReallyOpen && <button type="button" className={`primary small ${myAttendanceStatus ? 'confirmed-action' : ''}`} title={myAttendanceStatus ? 'Clique para alterar sua confirmação.' : 'Abrir confirmação da rodada.'} onClick={() => void openMatch(match.id)}>{attendanceActionLabel(myAttendanceStatus)}</button>}<button type="button" className="ghost" onClick={() => void openMatch(match.id)}>{canCoordinate ? 'Abrir súmula' : 'Ver jogo'}</button></div></div></div></article>;
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
                <p className="muted">Súmula operacional • {selectedMatch.matchDate?.slice(0, 10)} • {matchStatusLabel(selectedMatch.status)}</p>
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

  function playersFromAttendance(): MatchDraftPlayer[] {
    const attendancePlayers = match.attendance.filter((item) => item.responseStatus !== 'AUSENTE').map((item, index) => {
      const user = users.find((current) => current.id === item.userId);
      const position = user?.position ?? item.position ?? 'MC';
      const presentOnly = item.responseStatus === 'PRESENTE_SEM_JOGAR';
      return {
        userId: item.userId,
        name: item.name,
        email: user?.email ?? '',
        position,
        team: presentOnly ? 'PRESENTE_SEM_JOGAR' as const : 'A' as const,
        roleInMatch: presentOnly ? 'PRESENTE_SEM_JOGAR' as const : position === 'GO' ? 'GOLEIRO' as const : 'LINHA' as const,
        drawOrder: String(index + 1),
        startsOnBench: false
      };
    });
    return drawBalancedTeams(attendancePlayers);
  }

  useEffect(() => {
    setTitle(match.title);
    setDate(match.matchDate.slice(0, 10));
    setRefereeName(match.refereeName ?? '');
    setTeamAName(match.teamAName);
    setTeamBName(match.teamBName);
    const savedPlayers: MatchDraftPlayer[] = match.players.map((player, index) => {
      const user = users.find((item) => item.id === player.userId);
      const team = player.team as MatchDraftPlayer['team'];
      return {
        userId: player.userId,
        name: player.name,
        email: user?.email ?? '',
        position: user?.position ?? 'MC',
        team,
        roleInMatch: team === 'PRESENTE_SEM_JOGAR' ? 'PRESENTE_SEM_JOGAR' : player.roleInMatch === 'GOLEIRO' ? 'GOLEIRO' : 'LINHA',
        drawOrder: String(player.drawOrder ?? index + 1),
        startsOnBench: player.startsOnBench
      };
    });
    const attendancePlayers = playersFromAttendance();
    setPlayers(savedPlayers.length ? savedPlayers : attendancePlayers);
    setMessage(savedPlayers.length || !attendancePlayers.length ? '' : `${attendancePlayers.filter((player) => player.team !== 'PRESENTE_SEM_JOGAR').length} atleta(s) para jogo e ${attendancePlayers.filter((player) => player.team === 'PRESENTE_SEM_JOGAR').length} apenas presente(s) carregados das confirmações. Revise e salve a escalação antes de iniciar.`);
  }, [match.id, match.title, match.matchDate, match.refereeName, match.teamAName, match.teamBName, match.players, match.attendance, users]);

  const assignedIds = new Set(players.map((player) => player.userId));
  const search = query.trim().toLowerCase();
  const searchResults = search.length < 3 ? [] : users.filter((user) => user.active !== false && !assignedIds.has(user.id) && `${user.name} ${user.email}`.toLowerCase().includes(search)).slice(0, 8);
  const teamA = players.filter((player) => player.team === 'A');
  const teamB = players.filter((player) => player.team === 'B');
  const presentOnly = players.filter((player) => player.team === 'PRESENTE_SEM_JOGAR');

  function payload() {
    const currentTeamA = players.filter((player) => player.team === 'A');
    const currentTeamB = players.filter((player) => player.team === 'B');
    return players.map((player) => ({
      userId: player.userId,
      team: player.team,
      roleInMatch: player.team === 'PRESENTE_SEM_JOGAR' ? 'PRESENTE_SEM_JOGAR' : player.roleInMatch,
      drawOrder: player.drawOrder ? Number(player.drawOrder) : null,
      rotationOrder: player.team === 'A' ? currentTeamA.findIndex((item) => item.userId === player.userId) + 1 : player.team === 'B' ? currentTeamB.findIndex((item) => item.userId === player.userId) + 1 : null,
      startsOnBench: player.startsOnBench,
      present: true
    }));
  }

  function addPlayer(user: User, team: MatchDraftPlayer['team']) {
    const position = user.position ?? 'MC';
    setPlayers((list) => [...list, { userId: user.id, name: user.name, email: user.email, position, team, roleInMatch: team === 'PRESENTE_SEM_JOGAR' ? 'PRESENTE_SEM_JOGAR' : position === 'GO' ? 'GOLEIRO' : 'LINHA', drawOrder: String(list.length + 1), startsOnBench: false }]);
    setQuery('');
  }

  function updatePlayer(userId: string, patch: Partial<MatchDraftPlayer>) {
    setPlayers((list) => list.map((player) => player.userId === userId ? { ...player, ...patch } : player));
  }

  function movePlayer(userId: string, direction: -1 | 1) {
    setPlayers((list) => {
      const player = list.find((item) => item.userId === userId);
      if (!player || player.team === 'PRESENTE_SEM_JOGAR') return list;
      const teamRows = list.filter((item) => item.team === player.team);
      const index = teamRows.findIndex((item) => item.userId === userId);
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= teamRows.length) return list;
      const reordered = [...teamRows];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      return list.filter((item) => item.team !== player.team).concat(reordered);
    });
  }

  function balanceTeamsByPosition() {
    setPlayers((list) => drawBalancedTeams(list.map((player) => ({
      ...player,
      team: player.team === 'PRESENTE_SEM_JOGAR' ? 'A' : player.team,
      roleInMatch: player.team === 'PRESENTE_SEM_JOGAR' ? 'LINHA' : player.roleInMatch
    }))));
    setMessage('Times reequilibrados pelas posições oficiais. Revise banco e goleiros antes de salvar.');
  }

  function removePlayer(userId: string) {
    setPlayers((list) => list.filter((player) => player.userId !== userId));
  }

  function applyAttendanceLineup() {
    const next = playersFromAttendance();
    setPlayers(next);
    setMessage(`${next.filter((player) => player.team !== 'PRESENTE_SEM_JOGAR').length} atleta(s) para jogo e ${next.filter((player) => player.team === 'PRESENTE_SEM_JOGAR').length} apenas presente(s) reaplicados das confirmações.`);
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
              <small>{positionLabel(player.position)}</small>
            </div>
            <select value={player.roleInMatch} onChange={(event) => updatePlayer(player.userId, { roleInMatch: event.target.value as MatchDraftPlayer['roleInMatch'] })}>
              <option value="LINHA">Linha</option>
              <option value="GOLEIRO">Goleiro</option>
            </select>
            <label className="bench">
              <input type="checkbox" checked={player.startsOnBench} onChange={(event) => updatePlayer(player.userId, { startsOnBench: event.target.checked })} />
              Banco
            </label>
            <div className="actions compact-actions">
              <button type="button" className="ghost small" onClick={() => movePlayer(player.userId, -1)}>↑</button>
              <button type="button" className="ghost small" onClick={() => movePlayer(player.userId, 1)}>↓</button>
              <button type="button" className="ghost small" onClick={() => removePlayer(player.userId)}>X</button>
            </div>
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
              <small>{presentOnly.length} apenas presente(s) e {teamA.length + teamB.length} atleta(s) em jogo.</small>
            </div>
            <div className="actions">
              {match.attendance.some((item) => item.responseStatus !== 'AUSENTE') && <button className="ghost" onClick={applyAttendanceLineup}>Usar confirmações</button>}
              <button className="primary" onClick={balanceTeamsByPosition}>Rebalancear</button>
              <button className="primary" onClick={() => void save()}>Salvar escalação</button>
            </div>
          </div>
          <div className="team-builder">
            <section>
              <strong>Adicionar atleta</strong>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar atleta por nome ou e-mail" />
              {query.trim().length > 0 && query.trim().length < 3 && <small className="muted">Digite pelo menos 3 caracteres.</small>}
              <div className="search-results">
                {searchResults.map((user) => (
                  <article key={user.id}>
                    <strong>{user.name}</strong>
                    <small>{user.email} • {positionLabel(user.position)}</small>
                    <div className="actions">
                      <button type="button" className="primary small" onClick={() => addPlayer(user, 'A')}>Time A</button>
                      <button type="button" className="ghost small" onClick={() => addPlayer(user, 'B')}>Time B</button>
                      <button type="button" className="ghost small" onClick={() => addPlayer(user, 'PRESENTE_SEM_JOGAR')}>Só presença</button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="team-list roster-list">
                <div className="team-title">
                  <strong>Presentes sem jogar</strong>
                  <span>{presentOnly.length}</span>
                </div>
                {presentOnly.length === 0 ? <small className="muted">Sem atletas apenas presentes.</small> : presentOnly.map((player) => (
                  <div className="team-player roster-row pending" key={player.userId}>
                    <div className="player-meta">
                      <b>{player.name}</b>
                      <small>{positionLabel(player.position)}</small>
                    </div>
                    <button type="button" className="ghost small" onClick={() => updatePlayer(player.userId, { team: 'A', roleInMatch: player.position === 'GO' ? 'GOLEIRO' : 'LINHA' })}>Vai pro jogo</button>
                    <button type="button" className="ghost small" onClick={() => removePlayer(player.userId)}>Remover</button>
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

  function pitchSlots(team: 'A' | 'B') {
    return team === 'A'
      ? [
          { left: 11, top: 50 },
          { left: 26, top: 22 },
          { left: 26, top: 50 },
          { left: 26, top: 78 },
          { left: 44, top: 35 },
          { left: 44, top: 65 },
          { left: 63, top: 50 },
          { left: 56, top: 18 },
          { left: 56, top: 82 }
        ]
      : [
          { left: 89, top: 50 },
          { left: 74, top: 22 },
          { left: 74, top: 50 },
          { left: 74, top: 78 },
          { left: 56, top: 35 },
          { left: 56, top: 65 },
          { left: 37, top: 50 },
          { left: 44, top: 18 },
          { left: 44, top: 82 }
        ];
  }

  function fieldPlayers(team: 'A' | 'B') {
    const starters = startersForTeam(team);
    const goalkeeper = starters.find((player) => player.roleInMatch === 'GOLEIRO');
    const outfield = starters.filter((player) => player.userId !== goalkeeper?.userId);
    const ordered = goalkeeper ? [goalkeeper, ...outfield] : outfield;
    return ordered.slice(0, pitchSlots(team).length).map((player, index) => ({ player, slot: pitchSlots(team)[index] }));
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

function ScheduleManagerDialog({ api, matches, activeSeasonId, onDone, controlledOpen, onOpenChange, hideTrigger = false }: { api: ApiClient; matches: MatchListItem[]; activeSeasonId: string; onDone: () => Promise<void>; controlledOpen?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [mode, setMode] = useState<ScheduleMode>('recurring');
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
      {!hideTrigger && <button className="ghost small" onClick={() => setOpen(true)}>Agenda</button>}
      {open && <div className="modal">
        <section className="card modal-card wide schedule-modal">
          <div className="card-head">
            <div>
              <h2>Agenda e confirmação dos jogos</h2>
              <p className="muted">Pré-defina recorrência, datas avulsas e a janela de confirmação: quando abre e quando fecha antes do jogo.</p>
            </div>
            <button type="button" className="ghost modal-close-button" aria-label="Fechar modal" title="Fechar" onClick={() => setOpen(false)}>X</button>
          </div>
          {message && <p className="status-line">{message}</p>}
          <form className="schedule-form" onSubmit={saveSchedule}>
            <div className="segmented">
              <button type="button" className={mode === 'recurring' && !editingId ? 'primary small' : 'ghost'} onClick={() => { setMode('recurring'); setEditingId(''); }}>Recorrente</button>
              <button type="button" className={mode === 'manual' || editingId ? 'primary small' : 'ghost'} onClick={() => { setMode('manual'); setEditingId(''); }}>Data específica</button>
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
              <input value={teamAName} onChange={(event) => setTeamAName(event.target.value)} />
              <input value={teamBName} onChange={(event) => setTeamBName(event.target.value)} />
            </div>
            <button className="primary">{editingId ? 'Salvar edição' : mode === 'recurring' ? 'Gerar jogos recorrentes' : 'Criar jogo avulso'}</button>
          </form>
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
      </div>}
    </>
  );
}

function OperationalMatchDialog({ api, users, activeSeasonId, onDone }: { api: ApiClient; users: User[]; activeSeasonId: string; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [confirmDrawOpen, setConfirmDrawOpen] = useState(false);
  const [draftMatchId, setDraftMatchId] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [title, setTitle] = useState('Futebol de quarta');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [refereeName, setRefereeName] = useState('');
  const [teamAName, setTeamAName] = useState('Time A');
  const [teamBName, setTeamBName] = useState('Time B');
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState<MatchDraftPlayer[]>([]);
  const [draggedUserId, setDraggedUserId] = useState('');

  const assignedIds = new Set(players.map((player) => player.userId));
  const search = query.trim().toLowerCase();
  const searchResults = search.length < 3 ? [] : users.filter((user) => !assignedIds.has(user.id) && `${user.name} ${user.email}`.toLowerCase().includes(search)).slice(0, 8);
  const pendingPlayers = players.filter((player) => player.team === 'PRESENTE_SEM_JOGAR');
  const teamA = players.filter((player) => player.team === 'A');
  const teamB = players.filter((player) => player.team === 'B');
  const teamsDrawn = teamA.length > 0 && teamB.length > 0 && pendingPlayers.length === 0;

  function selectedPlayersPayload(list = players) {
    const currentTeamA = list.filter((player) => player.team === 'A');
    const currentTeamB = list.filter((player) => player.team === 'B');
    return list.map((player) => ({
      userId: player.userId,
      team: player.team,
      roleInMatch: player.team === 'PRESENTE_SEM_JOGAR' ? 'PRESENTE_SEM_JOGAR' : player.roleInMatch,
      drawOrder: player.drawOrder ? Number(player.drawOrder) : null,
      rotationOrder: player.team === 'A' ? currentTeamA.findIndex((item) => item.userId === player.userId) + 1 : player.team === 'B' ? currentTeamB.findIndex((item) => item.userId === player.userId) + 1 : null,
      startsOnBench: player.startsOnBench,
      present: true
    }));
  }

  async function saveLineup() {
    if (!draftMatchId) return;
    await api.request(`/matches/${draftMatchId}/lineup`, { method: 'PATCH', body: JSON.stringify({ matchDate: date, title, refereeName: refereeName || null, teamAName, teamBName, players: selectedPlayersPayload() }) });
  }

  async function openPersistentDraft() {
    const created = await api.request<{ id: string }>('/matches', { method: 'POST', body: JSON.stringify({ seasonId: activeSeasonId || null, matchDate: date, title, refereeName: refereeName || null, teamAName, teamBName, players: [] }) });
    setDraftMatchId(created.id);
    setConfirmDrawOpen(false);
    setSaveStatus('Rascunho da súmula criado e salvo no banco.');
    setOpen(true);
    await onDone();
  }

  useEffect(() => {
    if (!open || !draftMatchId) return;
    if (players.length > 0 && !teamsDrawn) {
      setSaveStatus('Participantes selecionados. Faça o sorteio automático para gravar a escalação no banco.');
      return;
    }
    setSaveStatus('Salvando escalação...');
    const timer = window.setTimeout(() => {
      void saveLineup()
        .then(() => setSaveStatus('Escalação salva no banco.'))
        .catch((err) => setSaveStatus(err instanceof Error ? err.message : 'Falha ao salvar escalação.'));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [open, draftMatchId, title, date, refereeName, teamAName, teamBName, players, teamsDrawn]);

  function addParticipant(user: User) {
    const position = user.position ?? 'MC';
    setPlayers((list) => [...list, { userId: user.id, name: user.name, email: user.email, position, team: 'PRESENTE_SEM_JOGAR', roleInMatch: 'PRESENTE_SEM_JOGAR', drawOrder: String(list.length + 1), startsOnBench: false }]);
    setQuery('');
  }

  function balanceTeamsByPosition() {
    setPlayers((list) => drawBalancedTeams(list.map((player) => ({ ...player, team: player.team === 'PRESENTE_SEM_JOGAR' ? 'A' : player.team, roleInMatch: player.roleInMatch === 'PRESENTE_SEM_JOGAR' ? 'LINHA' : player.roleInMatch }))));
    setConfirmDrawOpen(true);
  }

  function updatePlayer(userId: string, patch: Partial<MatchDraftPlayer>) {
    setPlayers((list) => list.map((player) => player.userId === userId ? { ...player, ...patch } : player));
  }

  function removePlayer(userId: string) {
    setPlayers((list) => list.filter((player) => player.userId !== userId));
  }

  function movePlayer(userId: string, targetUserId: string, team: 'A' | 'B') {
    if (!userId || userId === targetUserId) return;
    setPlayers((list) => {
      const moving = list.find((player) => player.userId === userId);
      if (!moving) return list;
      const withoutMoving = list.filter((player) => player.userId !== userId);
      const sameTeam = withoutMoving.filter((player) => player.team === team);
      const targetIndex = sameTeam.findIndex((player) => player.userId === targetUserId);
      const orderedTeam = [...sameTeam.slice(0, targetIndex), { ...moving, team }, ...sameTeam.slice(targetIndex)];
      return withoutMoving.filter((player) => player.team !== team).concat(orderedTeam);
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!teamsDrawn) {
      setSaveStatus('Faça o sorteio/divisão automática das equipes antes de salvar a súmula.');
      return;
    }
    await saveLineup();
    setOpen(false);
    setConfirmDrawOpen(false);
    setDraftMatchId('');
    setPlayers([]);
    await onDone();
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

  function TeamList({ team, rows }: { team: 'A' | 'B'; rows: MatchDraftPlayer[] }) {
    return (
      <div className={`draw-result-card team-${team.toLowerCase()}`}>
        <div className="draw-result-head">
          <div className="draw-team-heading">
            <DrawIcon kind="shirt" tone={team === 'A' ? 'a' : 'b'} className="draw-icon draw-icon-shirt" />
            <strong>{team === 'A' ? teamAName.toUpperCase() : teamBName.toUpperCase()}</strong>
          </div>
          <span>({rows.length} atleta{rows.length === 1 ? '' : 's'})</span>
        </div>
        {rows.length === 0 ? (
          <p className="muted draw-empty-team">O time aparecerá aqui depois do sorteio automático.</p>
        ) : (
          <div className="draw-result-list">
            {rows.map((player, index) => (
              <div
                className={`draw-result-player draw-result-line ${player.startsOnBench ? 'is-bench' : ''}`}
                key={player.userId}
                draggable
                onDragStart={() => setDraggedUserId(player.userId)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => movePlayer(draggedUserId, player.userId, team)}
                onClick={() => updatePlayer(player.userId, { startsOnBench: !player.startsOnBench })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    updatePlayer(player.userId, { startsOnBench: !player.startsOnBench });
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={player.startsOnBench}
                title={player.startsOnBench ? 'Clique para tirar do banco' : 'Clique para marcar como banco'}
              >
                <span className="draw-result-order">{index + 1}</span>
                <div className="draw-result-meta">
                  <b>{player.name.trim().split(/\s+/)[0] ?? player.name}</b>
                  <small>{positionLabel(player.position)}</small>
                </div>
                <span className={`draw-bench-chip ${player.startsOnBench ? 'is-visible' : ''}`}>{player.startsOnBench ? 'Banco' : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const rosterRows = [...players].sort((left, right) => Number(left.drawOrder || 0) - Number(right.drawOrder || 0) || left.name.localeCompare(right.name, 'pt-BR'));
  const positionOverview = ([['GO', 'Goleiros', 'goalkeeper'], ['DEFESA', 'Defesa', 'defense'], ['MEIO', 'Meio', 'midfield'], ['ATAQUE', 'Ataque', 'attack']] as const).map(([group, label, icon]) => ({ group, label, icon, count: players.filter((player) => positionBalanceGroup(player.position) === group).length }));
  const drawStatus = players.length < 2 ? 'Adicione pelo menos 2 atletas para liberar o sorteio.' : teamsDrawn ? 'Equipes sorteadas. Você ainda pode sortear novamente ou ajustar sequência/banco.' : 'Elenco pronto para sorteio aleatório por posições.';
  const drawTitle = teamsDrawn ? 'Sorteio concluído.' : 'Divisão automática obrigatória.';
  const drawButtonLabel = teamsDrawn ? 'SORTEAR TIMES NOVAMENTE' : 'SORTEAR TIMES AUTOMATICAMENTE';
  const selectedLabel = rosterRows.length === 0 ? 'Vazios (0)' : `${rosterRows.length} atleta${rosterRows.length === 1 ? '' : 's'}`;

  return (
    <>
      <button className="primary small" onClick={() => void openPersistentDraft()}>Criar jogo</button>
      {open && (
        <div className="modal">
          <form className="card modal-card wide draw-modal draw-modal-sheet" onSubmit={submit}>
            <div className="draw-sheet-head">
              <div className="draw-sheet-copy">
                <span className="eyebrow">Súmula Inteligente</span>
                <h2>Montar Jogo (Presença & Sorteio)</h2>
                <p className="muted">Inclua somente quem vai participar do jogo. A divisão em {teamAName} e {teamBName} é automática, aleatória e balanceada pelas posições oficiais.</p>
              </div>
              <button type="button" className="ghost modal-close-button" aria-label="Fechar modal" title="Fechar" onClick={() => { setConfirmDrawOpen(false); setOpen(false); }}>X</button>
            </div>

            <div className="draw-stepper">
              <div className="draw-step is-done">
                <span className="draw-step-pill">
                  <span className="draw-step-number">1</span>
                  <span className="draw-step-label">Dados</span>
                </span>
              </div>
              <div className={`draw-step ${teamsDrawn ? 'is-done' : 'is-active'}`}>
                <span className="draw-step-pill">
                  <span className="draw-step-number">2</span>
                  <span className="draw-step-label">Participantes</span>
                </span>
              </div>
              <div className={`draw-step ${teamsDrawn ? 'is-active' : ''}`}>
                <span className="draw-step-pill">
                  <span className="draw-step-number">3</span>
                  <span className="draw-step-label">Sorteio</span>
                </span>
              </div>
            </div>

            {saveStatus && <p className="status-line draw-status-line">{saveStatus}</p>}

            <div className="draw-sheet-grid">
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

                <div className="draw-position-list">
                  <div className="draw-position-row draw-position-total">
                    <span className="draw-position-label"><DrawIcon kind="roster" className="draw-icon draw-icon-inline" /> Elenco</span>
                    <strong>{players.length}</strong>
                  </div>
                  {positionOverview.map((item) => (
                    <div className="draw-position-row" key={item.group}>
                      <span className="draw-position-label"><DrawIcon kind={item.icon} className="draw-icon draw-icon-inline" /> {item.label}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>

                <p className="draw-card-note">Escalação salva no banco.</p>
              </section>

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

                  <div className="draw-action-callout">
                    <strong>{drawTitle}</strong>
                    <small>{drawStatus}</small>
                  </div>

                  <div className="draw-selected-head">
                    <strong><DrawIcon kind="roster" className="draw-icon draw-icon-inline" /> Elenco Selecionado: {selectedLabel}</strong>
                  </div>

                  {rosterRows.length > 0 && (
                    <div className="draw-selected-list">
                      {rosterRows.map((player) => (
                        <div className={`draw-selected-player draw-selected-line ${player.team === 'PRESENTE_SEM_JOGAR' ? 'is-pending' : ''}`} key={player.userId}>
                          <span className="draw-selected-name">{player.name.trim().split(/\s+/)[0] ?? player.name}</span>
                          <span className="draw-selected-position">{positionLabel(player.position)}</span>
                          <button type="button" className="ghost draw-inline-remove" aria-label={`Remover ${player.name}`} title="Remover" onClick={() => removePlayer(player.userId)}>X</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="button" className="primary draw-button draw-button-full" onClick={balanceTeamsByPosition} disabled={players.length < 2}><DrawIcon kind="dice" className="draw-icon draw-button-icon" /> {drawButtonLabel}</button>
                  <small className="draw-action-note">Depois do sorteio abre uma confirmação rápida para revisar Time A e Time B antes do salvamento final.</small>
                  {teamsDrawn && <button type="button" className="ghost draw-review-button" onClick={() => setConfirmDrawOpen(true)}><DrawIcon kind="results" className="draw-icon draw-icon-inline" /> Revisar times sorteados</button>}
                </div>
              </section>
            </div>

            <div className="draw-sheet-footer">
              <button type="button" className="ghost" onClick={() => { setConfirmDrawOpen(false); setOpen(false); }}>Cancelar</button>
              <div className="draw-footer-save">
                <button className="primary" disabled={!teamsDrawn}>SALVAR SÚMULA FINAL</button>
                <small>O salvamento final só libera após o sorteio.</small>
              </div>
            </div>
          </form>

          {confirmDrawOpen && (
            <div className="modal prompt-modal draw-confirm-modal">
              <div className="card modal-card confirmation-popup draw-confirm-card">
                <div className="draw-confirm-head">
                  <div>
                    <span className="eyebrow">Confirmação rápida</span>
                    <h3>Revise Time A e Time B</h3>
                    <p className="muted">Clique em um atleta para marcar ou tirar do banco. A definição de posição detalhada fica para a próxima etapa.</p>
                  </div>
                  <button type="button" className="ghost modal-close-button" aria-label="Fechar confirmação" title="Fechar" onClick={() => setConfirmDrawOpen(false)}>X</button>
                </div>

                <div className="draw-results-grid draw-results-grid-confirm">
                  <TeamList team="A" rows={teamA} />
                  <TeamList team="B" rows={teamB} />
                </div>

                <div className="draw-confirm-footer">
                  <small>Quando terminar a revisão, feche esta confirmação e use SALVAR SÚMULA FINAL no modal principal.</small>
                  <button type="button" className="primary" onClick={() => setConfirmDrawOpen(false)}>Confirmar Times</button>
                </div>
              </div>
            </div>
          )}
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

  useEffect(() => {
    if (!userId && activeAthletes[0]?.id) setUserId(activeAthletes[0].id);
    if (!selectedUserIds.length && activeAthletes[0]?.id) setSelectedUserIds([activeAthletes[0].id]);
  }, [activeAthletes, selectedUserIds.length, userId]);

  useEffect(() => {
    setFilterSearch('');
  }, [activeFilterMenu]);

  async function loadPayments() {
    const path = canCoordinate ? `/payments${activeSeasonId ? `?seasonId=${activeSeasonId}` : ''}` : '/payments/me';
    setPayments(await api.request<PaymentRecord[]>(path));
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

  function toggleSelectedUser(id: string) {
    setSelectedUserIds((list) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  function toggleFilterMenu(key: string) {
    setActiveFilterMenu((current) => current === key ? null : key);
  }

  function paymentFilterOptions(key: keyof typeof paymentFilters) {
    const values = organizedPayments.map((payment) => {
      if (key === 'name') return payment.userName ?? 'Minha mensalidade';
      if (key === 'month') return payment.referenceMonth.slice(0, 7);
      if (key === 'dueDate') return payment.dueDate?.slice(0, 10) ?? '-';
      if (key === 'amount') return money(payment.amountCents);
      if (key === 'paid') return money(payment.paidAmountCents ?? 0);
      if (key === 'balance') return money(payment.balanceCents ?? 0);
      if (key === 'status') return statusLabel(payment.status);
      if (key === 'paidAt') return payment.paidAt ? payment.paidAt.slice(0, 10) : 'Nao informado';
      if (key === 'point') return payment.earnsPoint ? 'Com ponto' : 'Sem ponto';
      return payment.notes?.trim() ? payment.notes : '-';
    });
    return [...new Set(values)].filter(Boolean).sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }));
  }

  function cashFilterOptions(key: keyof typeof cashFilters) {
    const values = organizedCashEntries.map((entry) => {
      if (key === 'date') return entry.entryDate?.slice(0, 10) ?? '-';
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
    return <div className="table-filter-anchor"><span>{label}</span><button type="button" className={`table-filter-button ${currentValue ? 'is-active' : ''}`} onClick={() => toggleFilterMenu(menuKey)} aria-label={`Filtrar ${label.toLowerCase()}`}><MdFilterList /></button>{isOpen && <div className="table-filter-popover"><div className="table-filter-popover-head"><strong>{label}</strong><button type="button" className="ghost small" onClick={() => { onClear(); setActiveFilterMenu(null); }}>Limpar</button></div><input value={inputValue} onChange={(event) => { setFilterSearch(event.target.value); onSelect(event.target.value); }} placeholder={placeholder} /></div>}</div>;
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
  const filteredPayments = useMemo(() => organizedPayments.filter((payment) => {
    const name = (payment.userName ?? 'Minha mensalidade').toLowerCase();
    const monthValue = payment.referenceMonth.slice(0, 7).toLowerCase();
    const dueDateValue = (payment.dueDate?.slice(0, 10) ?? '').toLowerCase();
    const amountValue = money(payment.amountCents).toLowerCase();
    const paidValue = money(payment.paidAmountCents ?? 0).toLowerCase();
    const balanceValue = money(payment.balanceCents ?? 0).toLowerCase();
    const statusValue = statusLabel(payment.status).toLowerCase();
    const paidAtValue = payment.paidAt ? payment.paidAt.slice(0, 10).toLowerCase() : 'nao informado';
    const pointValue = payment.earnsPoint ? 'com ponto' : 'sem ponto';
    const notesValue = (payment.notes ?? '').toLowerCase();
    return name.includes(paymentFilters.name.trim().toLowerCase())
      && monthValue.includes(paymentFilters.month.trim().toLowerCase())
      && dueDateValue.includes(paymentFilters.dueDate.trim().toLowerCase())
      && amountValue.includes(paymentFilters.amount.trim().toLowerCase())
      && paidValue.includes(paymentFilters.paid.trim().toLowerCase())
      && balanceValue.includes(paymentFilters.balance.trim().toLowerCase())
      && statusValue.includes(paymentFilters.status.trim().toLowerCase())
      && paidAtValue.includes(paymentFilters.paidAt.trim().toLowerCase())
      && pointValue.includes(paymentFilters.point.trim().toLowerCase())
      && notesValue.includes(paymentFilters.notes.trim().toLowerCase());
  }), [organizedPayments, paymentFilters]);
  const organizedCashEntries = useMemo(() => [...cashEntries].sort((left, right) => {
    const dateCompare = (right.entryDate ?? '').localeCompare(left.entryDate ?? '');
    if (dateCompare !== 0) return dateCompare;
    return (right.createdAt ?? '').localeCompare(left.createdAt ?? '');
  }), [cashEntries]);
  const filteredCashEntries = useMemo(() => organizedCashEntries.filter((entry) => {
    const dateValue = (entry.entryDate?.slice(0, 10) ?? '').toLowerCase();
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
        {canCoordinate && <div className="actions panel-actions"><button className="primary small" onClick={() => setPaymentModal('generate')}>Gerar mensalidades</button><button className="ghost" onClick={() => openRegister()}>Registrar pagamento</button><button className="ghost" onClick={() => setPaymentModal('cash')}>Lançar caixa</button>{filteredPayments.length > 0 && <button className="ghost" onClick={() => downloadCsv('poka-pratika-mensalidades.csv', filteredPayments.map((payment) => ({ atleta: payment.userName ?? 'Minha mensalidade', mes: payment.referenceMonth.slice(0, 7), vencimento: payment.dueDate?.slice(0, 10), pagoEm: payment.paidAt ? payment.paidAt.slice(0, 10) : '', valor: (payment.amountCents / 100).toFixed(2), pago: ((payment.paidAmountCents ?? 0) / 100).toFixed(2), saldo: ((payment.balanceCents ?? 0) / 100).toFixed(2), status: payment.status, pontoAntecipado: payment.earnsPoint, observacao: payment.notes ?? '' })))}>Exportar mensalidades</button>}{filteredCashEntries.length > 0 && <button className="ghost" onClick={() => downloadCsv('poka-pratika-caixa.csv', filteredCashEntries.map((entry) => ({ data: entry.entryDate?.slice(0, 10), tipo: entry.entryType === 'REVENUE' ? 'Receita' : 'Despesa', descricao: entry.description, valor: (entry.amountCents / 100).toFixed(2), origem: entry.paymentId ? 'Mensalidade' : 'Manual', responsavel: entry.recordedByName ?? '' })))}>Exportar caixa</button>}</div>}
      </div>
      {canCoordinate && (summary || cashSummary) && <div className="stat-grid payments-overview-strip">{summary && <><span><b>R$ {(summary.paidCents / 100).toFixed(2)}</b> recebido</span><span><b>R$ {(summary.openCents / 100).toFixed(2)}</b> aberto</span><span><b>{summary.pending}</b> pendente(s)</span><span><b>{summary.late}</b> atraso(s)</span><span><b>{summary.earlyPoints}</b> ponto(s) antecipados</span></>}{cashSummary && <><span><b>{money(cashSummary.revenueCents)}</b> receitas</span><span><b>{money(cashSummary.expenseCents)}</b> despesas</span><span><b>{money(cashSummary.balanceCents)}</b> saldo caixa</span></>}</div>}
      {!canCoordinate && <p className="muted">Você visualiza apenas sua mensalidade e se ela gerou ponto por pagamento antecipado.</p>}
      {message && <p className="muted">{message}</p>}
      {organizedPayments.length === 0 ? <EmptyState title="Sem mensalidades lançadas" text="Gere o mês ou registre uma cobrança individual para começar a acompanhar a tabela financeira." /> : <div className="championship-wrap payments-table-wrap"><table className="championship-table payments-table"><thead><tr><th>{renderFilterHeader('Nome', 'payments-name', paymentFilters.name, paymentFilterOptions('name'), (value) => setPaymentFilters((current) => ({ ...current, name: value })), () => setPaymentFilters((current) => ({ ...current, name: '' })), 'Pesquisar nomes')}</th><th>{renderFilterHeader('Mês', 'payments-month', paymentFilters.month, paymentFilterOptions('month'), (value) => setPaymentFilters((current) => ({ ...current, month: value })), () => setPaymentFilters((current) => ({ ...current, month: '' })), 'Pesquisar mês')}</th><th>{renderFilterHeader('Vencimento', 'payments-dueDate', paymentFilters.dueDate, paymentFilterOptions('dueDate'), (value) => setPaymentFilters((current) => ({ ...current, dueDate: value })), () => setPaymentFilters((current) => ({ ...current, dueDate: '' })), 'Pesquisar vencimento')}</th><th>{renderFilterHeader('Valor', 'payments-amount', paymentFilters.amount, paymentFilterOptions('amount'), (value) => setPaymentFilters((current) => ({ ...current, amount: value })), () => setPaymentFilters((current) => ({ ...current, amount: '' })), 'Pesquisar valor')}</th><th>{renderFilterHeader('Pago', 'payments-paid', paymentFilters.paid, paymentFilterOptions('paid'), (value) => setPaymentFilters((current) => ({ ...current, paid: value })), () => setPaymentFilters((current) => ({ ...current, paid: '' })), 'Pesquisar valor pago')}</th><th>{renderFilterHeader('Pendente', 'payments-balance', paymentFilters.balance, paymentFilterOptions('balance'), (value) => setPaymentFilters((current) => ({ ...current, balance: value })), () => setPaymentFilters((current) => ({ ...current, balance: '' })), 'Pesquisar saldo')}</th><th>{renderFilterHeader('Status', 'payments-status', paymentFilters.status, paymentFilterOptions('status'), (value) => setPaymentFilters((current) => ({ ...current, status: value })), () => setPaymentFilters((current) => ({ ...current, status: '' })), 'Pesquisar status')}</th><th>{renderFilterHeader('Pago em', 'payments-paidAt', paymentFilters.paidAt, paymentFilterOptions('paidAt'), (value) => setPaymentFilters((current) => ({ ...current, paidAt: value })), () => setPaymentFilters((current) => ({ ...current, paidAt: '' })), 'Pesquisar data')}</th><th>{renderFilterHeader('Ponto', 'payments-point', paymentFilters.point, paymentFilterOptions('point'), (value) => setPaymentFilters((current) => ({ ...current, point: value })), () => setPaymentFilters((current) => ({ ...current, point: '' })), 'Pesquisar pontuação')}</th><th>{renderFilterHeader('Observação', 'payments-notes', paymentFilters.notes, paymentFilterOptions('notes'), (value) => setPaymentFilters((current) => ({ ...current, notes: value })), () => setPaymentFilters((current) => ({ ...current, notes: '' })), 'Pesquisar observação')}</th>{canCoordinate && <th>Ação</th>}</tr></thead><tbody>{filteredPayments.length === 0 ? <tr><td colSpan={canCoordinate ? 11 : 10} className="table-empty-cell">Nenhuma mensalidade encontrada com os filtros atuais.</td></tr> : filteredPayments.map((payment) => <tr key={`${payment.userId ?? 'me'}-${payment.referenceMonth}`}><td className="athlete-cell payments-name-cell"><strong>{payment.userName ?? 'Minha mensalidade'}</strong></td><td>{payment.referenceMonth.slice(0, 7)}</td><td>{payment.dueDate?.slice(0, 10) ?? '-'}</td><td>{money(payment.amountCents)}</td><td>{money(payment.paidAmountCents ?? 0)}</td><td className="payments-balance-cell">{money(payment.balanceCents ?? 0)}</td><td><span className={`status ${payment.status === 'PAID' || payment.status === 'WAIVED' ? 'open' : payment.status === 'LATE' ? 'danger' : ''}`}>{statusLabel(payment.status)}</span></td><td>{payment.paidAt ? payment.paidAt.slice(0, 10) : 'Nao informado'}</td><td>{payment.earnsPoint ? <span className="status open">+1 pt</span> : <span className="payments-muted">Sem ponto</span>}</td><td className="payments-notes-cell">{payment.notes?.trim() ? payment.notes : <span className="payments-muted">-</span>}</td>{canCoordinate && <td className="payments-action-cell"><button type="button" className="ghost small" onClick={() => openRegister(payment)}>{(payment.balanceCents ?? 0) > 0 ? 'Baixar saldo' : 'Editar'}</button></td>}</tr>)}</tbody></table></div>}
      {canCoordinate && <section className="cash-ledger"><div className="card-head"><div><h2>Caixa do grupo</h2><p className="muted">Prestação de contas simples: receitas e despesas com data, descrição e valor.</p></div><span className="status open">{filteredCashEntries.length} de {organizedCashEntries.length} lançamento(s)</span></div>{organizedCashEntries.length === 0 ? <EmptyState title="Caixa sem lançamentos" text="Pagamentos de mensalidade entram automaticamente como receita. Despesas podem ser lançadas manualmente." /> : <div className="championship-wrap cash-table-wrap"><table className="championship-table cash-table"><thead><tr><th>{renderFilterHeader('Data', 'cash-date', cashFilters.date, cashFilterOptions('date'), (value) => setCashFilters((current) => ({ ...current, date: value })), () => setCashFilters((current) => ({ ...current, date: '' })), 'Pesquisar data')}</th><th>{renderFilterHeader('Tipo', 'cash-type', cashFilters.type, cashFilterOptions('type'), (value) => setCashFilters((current) => ({ ...current, type: value })), () => setCashFilters((current) => ({ ...current, type: '' })), 'Pesquisar tipo')}</th><th>{renderFilterHeader('Descrição', 'cash-description', cashFilters.description, cashFilterOptions('description'), (value) => setCashFilters((current) => ({ ...current, description: value })), () => setCashFilters((current) => ({ ...current, description: '' })), 'Pesquisar descrição')}</th><th>{renderFilterHeader('Origem', 'cash-origin', cashFilters.origin, cashFilterOptions('origin'), (value) => setCashFilters((current) => ({ ...current, origin: value })), () => setCashFilters((current) => ({ ...current, origin: '' })), 'Pesquisar origem')}</th><th>{renderFilterHeader('Responsável', 'cash-recordedBy', cashFilters.recordedBy, cashFilterOptions('recordedBy'), (value) => setCashFilters((current) => ({ ...current, recordedBy: value })), () => setCashFilters((current) => ({ ...current, recordedBy: '' })), 'Pesquisar responsável')}</th><th>{renderFilterHeader('Valor', 'cash-amount', cashFilters.amount, cashFilterOptions('amount'), (value) => setCashFilters((current) => ({ ...current, amount: value })), () => setCashFilters((current) => ({ ...current, amount: '' })), 'Pesquisar valor')}</th></tr></thead><tbody>{filteredCashEntries.length === 0 ? <tr><td colSpan={6} className="table-empty-cell">Nenhum lançamento encontrado com os filtros atuais.</td></tr> : filteredCashEntries.map((entry) => <tr key={entry.id}><td>{entry.entryDate?.slice(0, 10) ?? '-'}</td><td><span className={`status ${entry.entryType === 'REVENUE' ? 'open' : 'danger'}`}>{entry.entryType === 'REVENUE' ? 'Receita' : 'Despesa'}</span></td><td className="cash-description-cell"><strong>{entry.description}</strong></td><td>{entry.paymentId ? 'Mensalidade' : 'Manual'}</td><td>{entry.recordedByName?.trim() ? entry.recordedByName : <span className="payments-muted">-</span>}</td><td className={`cash-amount-cell ${entry.entryType === 'REVENUE' ? 'is-revenue' : 'is-expense'}`}>{entry.entryType === 'REVENUE' ? '+' : '-'} {money(entry.amountCents)}</td></tr>)}</tbody></table></div>}</section>}
      {paymentModal === 'generate' && <div className="modal"><form className="card modal-card payment-card wide-payment" onSubmit={(event) => { event.preventDefault(); void generateMonth().then(() => setPaymentModal(null)).catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao gerar mensalidades.')); }}><div className="card-head"><div><h2>Gerar mensalidades em lote</h2><p className="muted">Crie vários meses para todos os atletas ou para uma seleção específica.</p></div><button type="button" className="ghost" onClick={() => setPaymentModal(null)}>Fechar</button></div><div className="payment-form-grid"><label><span>Mês inicial</span><input type="month" value={month.slice(0, 7)} onChange={(event) => setMonth(`${event.target.value}-01`)} /></label><label><span>Quantidade de meses</span><input type="number" min="1" max="24" value={monthCount} onChange={(event) => setMonthCount(Number(event.target.value))} /></label><label><span>Vencimento inicial</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label><span>Valor mensal</span><input value={bulkAmount} onChange={(event) => setBulkAmount(event.target.value)} placeholder="Ex. 120,00" /></label></div><div className="segmented"><button type="button" className={generateForAll ? 'primary small' : 'ghost'} onClick={() => setGenerateForAll(true)}>Todos os atletas</button><button type="button" className={!generateForAll ? 'primary small' : 'ghost'} onClick={() => setGenerateForAll(false)}>Selecionar atletas</button></div>{!generateForAll && <div className="user-select-grid">{activeAthletes.map((user) => <label className="payment-user-option" key={user.id}><input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => toggleSelectedUser(user.id)} /> <span>{user.name}</span></label>)}</div>}<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observação opcional" /><div className="payment-preview"><span><b>{generateForAll ? activeAthletes.length : selectedUserIds.length}</b><small>atleta(s)</small></span><span><b>{monthCount}</b><small>mês(es)</small></span><span><b>{money(centsFromInput(bulkAmount || amount || '0') * monthCount * (generateForAll ? activeAthletes.length : selectedUserIds.length))}</b><small>volume gerado</small></span></div><button className="primary" disabled={!generateForAll && selectedUserIds.length === 0}>Gerar cobranças reais</button></form></div>}
      {paymentModal === 'register' && <div className="modal"><form className="card modal-card payment-card wide-payment" onSubmit={(event) => { event.preventDefault(); void save().then(() => setPaymentModal(null)).catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao registrar pagamento.')); }}><div className="card-head"><div><h2>Registrar pagamento</h2><p className="muted">Baixa total ou parcial. Só pagamento total antecipado gera ponto.</p></div><button type="button" className="ghost" onClick={() => setPaymentModal(null)}>Fechar</button></div><div className="payment-form-grid"><label><span>Atleta</span><select value={userId} onChange={(event) => setUserId(event.target.value)}>{activeAthletes.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label><span>Mês</span><input type="month" value={month.slice(0, 7)} onChange={(event) => setMonth(`${event.target.value}-01`)} /></label><label><span>Vencimento</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label><span>Data da baixa</span><input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></label><label><span>Valor da mensalidade</span><input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Valor individual" /></label>{status === 'PARTIAL' && <label><span>Valor recebido agora</span><input value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} placeholder="Valor parcial" /></label>}</div><div className="segmented payment-mode"><button type="button" className={status === 'PAID' ? 'primary small' : 'ghost'} onClick={() => { setStatus('PAID'); setFullPayment(true); }}>Pagamento total</button><button type="button" className={status === 'PARTIAL' ? 'primary small' : 'ghost'} onClick={() => { setStatus('PARTIAL'); setFullPayment(false); }}>Pagamento parcial</button><button type="button" className={status === 'PENDING' ? 'primary small' : 'ghost'} onClick={() => { setStatus('PENDING'); setFullPayment(false); }}>Pendente</button><button type="button" className={status === 'LATE' ? 'primary small' : 'ghost'} onClick={() => { setStatus('LATE'); setFullPayment(false); }}>Atrasado</button><button type="button" className={status === 'WAIVED' ? 'primary small' : 'ghost'} onClick={() => { setStatus('WAIVED'); setFullPayment(false); }}>Isento</button></div><div className="payment-preview"><span><b>{money(registerAmountCents)}</b><small>valor</small></span><span><b>{money(registerPaidCents)}</b><small>pago após baixa</small></span><span><b>{money(registerBalanceCents)}</b><small>saldo restante</small></span></div>{fullPayment && status === 'PAID' && <p className="muted">Se a data da baixa for antes do vencimento, o atleta recebe +1 ponto automaticamente.</p>}<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observação" /><button className="primary">Salvar baixa</button></form></div>}
      {paymentModal === 'cash' && <div className="modal"><form className="card modal-card payment-card wide-payment" onSubmit={(event) => { event.preventDefault(); void saveCashEntry().then(() => setPaymentModal(null)).catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao lançar caixa.')); }}><div className="card-head"><div><h2>Lançamento de caixa</h2><p className="muted">Use para despesas e receitas avulsas. Mensalidades pagas entram automaticamente.</p></div><button type="button" className="ghost" onClick={() => setPaymentModal(null)}>Fechar</button></div><div className="segmented payment-mode"><button type="button" className={cashEntryType === 'REVENUE' ? 'primary small' : 'ghost'} onClick={() => setCashEntryType('REVENUE')}>Receita</button><button type="button" className={cashEntryType === 'EXPENSE' ? 'primary small' : 'ghost'} onClick={() => setCashEntryType('EXPENSE')}>Despesa</button></div><div className="payment-form-grid"><label><span>Data</span><input type="date" value={cashDate} onChange={(event) => setCashDate(event.target.value)} /></label><label><span>Valor</span><input value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} placeholder="Ex. 85,00" /></label></div><input value={cashDescription} onChange={(event) => setCashDescription(event.target.value)} placeholder="Descrição: aluguel da quadra, bola nova, patrocínio, etc." required minLength={3} maxLength={240} /><div className="payment-preview"><span><b>{cashEntryType === 'REVENUE' ? 'Receita' : 'Despesa'}</b><small>tipo</small></span><span><b>{money(centsFromInput(cashAmount))}</b><small>valor</small></span><span><b>{cashDate}</b><small>data</small></span></div><button className="primary" disabled={centsFromInput(cashAmount) <= 0 || cashDescription.trim().length < 3}>Salvar lançamento</button></form></div>}
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
            <th><TableFilterHeader label="Perfil" menuKey="users-role" currentValue={filters.role} options={filterOptions('role')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar perfil" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, role: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, role: '' })); setActiveFilterMenu(null); }} /></th>
            <th><TableFilterHeader label="Posição" menuKey="users-position" currentValue={filters.position} options={filterOptions('position')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar posição" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, position: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, position: '' })); setActiveFilterMenu(null); }} /></th>
            <th><TableFilterHeader label="Status" menuKey="users-status" currentValue={filters.status} options={filterOptions('status')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar status" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, status: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, status: '' })); setActiveFilterMenu(null); }} /></th>
            <th>Ações</th>
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
    if (key === 'startsOn') return season.startsOn?.slice(0, 10) ?? 'Sem início';
    return season.endsOn?.slice(0, 10) ?? 'Sem fim';
  }

  function filterOptions(key: keyof typeof filters) {
    return buildTableFilterOptions(seasons.map((season) => filterValue(season, key)));
  }

  const filteredSeasons = useMemo(() => seasons.filter((season) => Object.entries(filters).every(([key, value]) => !value || normalizeTableFilterValue(filterValue(season, key as keyof typeof filters)).includes(normalizeTableFilterValue(value)))), [seasons, filters]);

  return (
    <div className="championship-wrap management-table-wrap">
      <table className="championship-table management-table">
        <thead>
          <tr>
            <th><TableFilterHeader label="Temporada" menuKey="seasons-name" currentValue={filters.name} options={filterOptions('name')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar temporada" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, name: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, name: '' })); setActiveFilterMenu(null); }} /></th>
            <th><TableFilterHeader label="Ano" menuKey="seasons-year" currentValue={filters.year} options={filterOptions('year')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar ano" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, year: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, year: '' })); setActiveFilterMenu(null); }} /></th>
            <th><TableFilterHeader label="Status" menuKey="seasons-status" currentValue={filters.status} options={filterOptions('status')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar status" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, status: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, status: '' })); setActiveFilterMenu(null); }} /></th>
            <th><TableFilterHeader label="Início" menuKey="seasons-start" currentValue={filters.startsOn} options={filterOptions('startsOn')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar início" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, startsOn: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, startsOn: '' })); setActiveFilterMenu(null); }} /></th>
            <th><TableFilterHeader label="Fim" menuKey="seasons-end" currentValue={filters.endsOn} options={filterOptions('endsOn')} activeMenu={activeFilterMenu} searchValue={filterSearch} placeholder="Pesquisar fim" onToggle={(key) => setActiveFilterMenu((current) => current === key ? null : key)} onSearchChange={setFilterSearch} onSelect={(value) => { setFilters((current) => ({ ...current, endsOn: value })); setActiveFilterMenu(null); }} onClear={() => { setFilters((current) => ({ ...current, endsOn: '' })); setActiveFilterMenu(null); }} /></th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {filteredSeasons.length === 0 ? <tr><td colSpan={6} className="table-empty-cell">Nenhuma temporada encontrada com os filtros atuais.</td></tr> : filteredSeasons.map((season) => <tr key={season.id}><td className="management-main-cell"><strong>{season.name}</strong></td><td>{season.year}</td><td><span className={`status ${season.status.toLowerCase()}`}>{statusLabel(season.status)}</span></td><td>{season.startsOn?.slice(0, 10) ?? 'Sem início'}</td><td>{season.endsOn?.slice(0, 10) ?? 'Sem fim'}</td><td><div className="actions compact-actions">{season.status !== 'OPEN' && season.status !== 'CLOSED' && <button className="primary small" onClick={() => void onStartSeason(season.id)}>Iniciar</button>}{season.status === 'OPEN' && <button className="ghost" onClick={() => void onCloseSeason(season.id)}>Encerrar e liberar votação</button>}{season.status === 'CLOSED' && <span className="payments-muted">Encerrada</span>}</div></td></tr>)}
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
        <td>{user.email}</td>
        <td>{user.role}</td>
        <td>{positionLabel(user.position)}</td>
        <td><span className={`status ${active ? 'open' : 'danger'}`}>{active ? 'ativo' : 'inativo'}</span></td>
        <td>{isAdmin ? <div className="actions compact-actions"><button className="ghost" onClick={() => setOpen(true)}>Editar</button><button className="ghost" onClick={() => void sendActivation()}>Reenviar convite</button></div> : <span className="payments-muted">Sem ações</span>}</td>
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
    const rows = parseStandingClipboard(standingPaste);
    if (!rows.length) {
      setMessage('Cole a tabela do Excel com cabeçalho antes de importar.');
      return;
    }
    const result = await api.request<StandingImportResult>(`/seasons/${activeSeasonId}/standing-adjustments/import`, { method: 'POST', body: JSON.stringify({ replace: true, rows }) });
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
      {isAdmin && adminModal === 'import' && <div className="modal"><section className="card modal-card wide"><div className="card-head"><h2>Importar tabela atual do Excel</h2><button type="button" className="ghost" onClick={() => setAdminModal(null)}>Fechar</button></div><p className="muted">Cole do Excel com cabeçalho. Use e-mail para casar atletas com segurança.</p><textarea className="paste-box" value={standingPaste} onChange={(event) => setStandingPaste(event.target.value)} placeholder="nome\temail\tpontos\tjogos\tpresenças\tv\te\td\tgols\tgols contra\tassistências\tmarcados\tsofridos" /><button className="primary" onClick={() => void importStandings().then(() => setAdminModal(null)).catch((err) => setMessage(err instanceof Error ? err.message : 'Falha ao importar Excel.'))} disabled={!activeSeasonId}>Importar saldo</button>{importResult && <div className="chips"><span className="chip trophy">Importados: {importResult.imported.length}</span>{importResult.skipped.map((item) => <span className="chip danger" key={`${item.identifier}-${item.reason}`}>{item.identifier}: {item.reason}</span>)}</div>}</section></div>}
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
