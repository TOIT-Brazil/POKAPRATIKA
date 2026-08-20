export type LinePlayerRotationInput = {
  id: string;
  name: string;
  rotationOrder: number;
  startsOnBench: boolean;
};

export type TeamRotationPlan = {
  reserves: number;
  firstCycleMinutes: number;
  secondCycleMinutes: number;
  exchangeSize: number;
  schedule: Array<{
    minute: number;
    second: number;
    label: string;
    entering: string[];
    leaving: string[];
  }>;
};

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

export function buildTeamRotationPlan(players: LinePlayerRotationInput[], availableMinutes: number): TeamRotationPlan {
  const ordered = [...players].sort((a, b) => a.rotationOrder - b.rotationOrder);
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
    return new Set(Array.from({ length: activeSlots }, (_item, index) => ordered[(startIndex + index) % ordered.length].id));
  };

  const schedule = Array.from({ length: Math.max(0, cycleCount - 1) }, (_item, index) => {
    const currentWindow = windowForStep(index);
    const nextWindow = windowForStep(index + 1);
    const enteringPlayers = ordered.filter((player) => nextWindow.has(player.id) && !currentWindow.has(player.id));
    const leavingPlayers = ordered.filter((player) => currentWindow.has(player.id) && !nextWindow.has(player.id));
    const switchAtSeconds = Math.round(intervalSeconds * (index + 1));
    return {
      minute: Math.min(Math.max(0, availableMinutes - 1), Math.floor(switchAtSeconds / 60)),
      second: switchAtSeconds,
      label: `${index + 1}ª troca`,
      entering: enteringPlayers.map((player) => player.name),
      leaving: leavingPlayers.map((player) => player.name)
    };
  });

  return { reserves, firstCycleMinutes: Number((intervalSeconds / 60).toFixed(1)), secondCycleMinutes: 0, exchangeSize: reserves, schedule };
}
