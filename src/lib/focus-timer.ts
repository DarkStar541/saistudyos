export type FocusClock = {
  startedAt: number;
  endsAt: number;
  plannedSeconds: number;
  pausedRemainingMs: number | null;
  pausedAt: number | null;
  accumulatedPausedMs: number;
};

export function remainingSeconds(clock: FocusClock, now = Date.now()): number {
  return Math.max(0, Math.ceil((clock.pausedRemainingMs ?? Math.max(0, clock.endsAt - now)) / 1000));
}

export function elapsedSeconds(clock: FocusClock, now = Date.now()): number {
  if (clock.pausedRemainingMs !== null) {
    return Math.max(0, Math.floor((clock.plannedSeconds * 1000 - clock.pausedRemainingMs) / 1000));
  }
  return Math.max(0, Math.min(clock.plannedSeconds, Math.floor((now - clock.startedAt - clock.accumulatedPausedMs) / 1000)));
}

export function pauseClock<T extends FocusClock>(clock: T, now = Date.now()): T {
  if (clock.pausedRemainingMs !== null) return clock;
  return { ...clock, pausedRemainingMs: Math.max(0, clock.endsAt - now), pausedAt: now };
}

export function resumeClock<T extends FocusClock>(clock: T, now = Date.now()): T {
  if (clock.pausedRemainingMs === null) return clock;
  return {
    ...clock,
    endsAt: now + clock.pausedRemainingMs,
    pausedRemainingMs: null,
    accumulatedPausedMs: clock.accumulatedPausedMs + (clock.pausedAt === null ? 0 : Math.max(0, now - clock.pausedAt)),
    pausedAt: null,
  };
}
