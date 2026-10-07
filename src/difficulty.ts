export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultySettings {
  label: string;
  description: string;
  patrolSpeed: number;
  investigateSpeed: number;
  chaseSpeed: number;
  finalChaseSpeed: number;
  detectionRange: number;
  hearingMultiplier: number;
  reactionTime: number;
  attackWindup: number;
  attackRange: number;
  lostSightTime: number;
  searchTime: number;
  investigateTime: number;
  chaseRepath: number;
  checkpointGrace: number;
  objectiveGrace: number;
  revealGrace: number;
  stunTime: number;
  stunImmunity: number;
  encounterInterval: number;
  batteryDrain: number;
  batteryPickup: number;
  restoredBattery: number;
}

// Metres and seconds. Medium retains the original movement/resource baseline.
// All modes share navigation, perception, progression and encounter scheduling.
export const difficultySettings: Readonly<Record<Difficulty, Readonly<DifficultySettings>>> = {
  easy: {
    label: 'Easy', description: 'More time to react. A slower Celestina, quieter nights and longer-lasting batteries.',
    patrolSpeed: .95, investigateSpeed: 1.3, chaseSpeed: 1.95, finalChaseSpeed: 2.2,
    detectionRange: 7.5, hearingMultiplier: .75, reactionTime: .9, attackWindup: .65, attackRange: .65,
    lostSightTime: .8, searchTime: 30, investigateTime: 7, chaseRepath: 1.2,
    checkpointGrace: 17, objectiveGrace: 8, revealGrace: 13, stunTime: 2.8, stunImmunity: 6,
    encounterInterval: 1.4, batteryDrain: .12, batteryPickup: 70, restoredBattery: 40,
  },
  medium: {
    label: 'Medium', description: 'The balanced night. Stay quiet, watch your light and break her line of sight.',
    patrolSpeed: 1.2, investigateSpeed: 1.65, chaseSpeed: 2.4, finalChaseSpeed: 2.7,
    detectionRange: 9.5, hearingMultiplier: 1, reactionTime: .35, attackWindup: .25, attackRange: .72,
    lostSightTime: 1.35, searchTime: 30, investigateTime: 10, chaseRepath: .9,
    checkpointGrace: 12, objectiveGrace: 5, revealGrace: 9, stunTime: 2, stunImmunity: 6,
    encounterInterval: 1, batteryDrain: .17, batteryPickup: 55, restoredBattery: 25,
  },
  hard: {
    label: 'Hard', description: 'She hears more and pursues longer. React quickly and make every battery count.',
    patrolSpeed: 1.45, investigateSpeed: 1.95, chaseSpeed: 2.85, finalChaseSpeed: 3.15,
    detectionRange: 12, hearingMultiplier: 1.3, reactionTime: .15, attackWindup: .12, attackRange: .78,
    lostSightTime: 2.3, searchTime: 30, investigateTime: 13, chaseRepath: .55,
    checkpointGrace: 8, objectiveGrace: 3, revealGrace: 6, stunTime: 1.5, stunImmunity: 7,
    encounterInterval: .75, batteryDrain: .23, batteryPickup: 40, restoredBattery: 20,
  },
};

export function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}
