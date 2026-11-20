import { describe, expect, it } from "vitest";
import { createFocusTimerState, elapsedSeconds, pauseClock, remainingSeconds, resumeClock, type FocusClock } from "@/lib/focus-timer";

const clock: FocusClock = {
  startedAt: 1_000,
  endsAt: 301_000,
  plannedSeconds: 300,
  pausedRemainingMs: null,
  pausedAt: null,
  accumulatedPausedMs: 0,
};

describe("timestamp-based focus clock", () => {
  it("preserves the selected session kind and only attaches tasks to focus sessions", () => {
    const focus = createFocusTimerState("focus", 25, "task-1", 10_000);
    const shortBreak = createFocusTimerState("short_break", 5, "task-1", 10_000);
    const longBreak = createFocusTimerState("long_break", 15, "task-1", 10_000);

    expect(focus).toMatchObject({ kind: "focus", taskId: "task-1", plannedSeconds: 1500, endsAt: 1_510_000 });
    expect(shortBreak).toMatchObject({ kind: "short_break", taskId: null, plannedSeconds: 300, endsAt: 310_000 });
    expect(longBreak).toMatchObject({ kind: "long_break", taskId: null, plannedSeconds: 900, endsAt: 910_000 });
  });

  it("calculates remaining time from the deadline, not interval ticks", () => {
    expect(remainingSeconds(clock, 61_000)).toBe(240);
    expect(remainingSeconds(clock, 400_000)).toBe(0);
  });

  it("accounts for elapsed time while paused without continuing the countdown", () => {
    const paused = pauseClock(clock, 61_000);
    expect(paused.pausedRemainingMs).toBe(240_000);
    expect(remainingSeconds(paused, 200_000)).toBe(240);
    expect(elapsedSeconds(paused, 200_000)).toBe(60);
  });

  it("excludes paused time after resuming", () => {
    const paused = pauseClock(clock, 61_000);
    const resumed = resumeClock(paused, 121_000);
    expect(resumed.endsAt).toBe(361_000);
    expect(resumed.accumulatedPausedMs).toBe(60_000);
    expect(remainingSeconds(resumed, 181_000)).toBe(180);
    expect(elapsedSeconds(resumed, 181_000)).toBe(120);
  });

  it("does not change an already paused or running clock", () => {
    const paused = pauseClock(clock, 61_000);
    expect(pauseClock(paused, 80_000)).toEqual(paused);
    expect(resumeClock(clock, 80_000)).toEqual(clock);
  });
});
