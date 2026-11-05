// Global Pomodoro/focus timer. Lives outside React so navigation and rerenders
// never reset it; the active session is mirrored to localStorage so a refresh
// resumes where it left off. Completed sessions are written to focus_sessions.
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FocusPhase = "idle" | "focus" | "short_break" | "long_break";

export type FocusSettings = {
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  longBreakEvery: number;
};

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4 };

type State = {
  phase: FocusPhase;
  taskId: string | null;
  courseId: string | null;
  taskTitle: string | null;
  startedAt: number | null; // epoch ms when the current phase started (adjusted for pauses)
  totalSec: number; // planned length of current phase
  remainingSec: number;
  paused: boolean;
  focusStreak: number; // completed focus sessions since last long break
  sessionStartedAt: string | null; // ISO of the current focus session (for the DB row)
};

const IDLE: State = {
  phase: "idle", taskId: null, courseId: null, taskTitle: null,
  startedAt: null, totalSec: 0, remainingSec: 0, paused: false, focusStreak: 0, sessionStartedAt: null,
};

const STORE_KEY = "studyos-focus";
let state: State = IDLE;
let settings: FocusSettings = DEFAULT_FOCUS_SETTINGS;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();
let invalidate: (() => void) | null = null;

const emit = () => listeners.forEach((l) => l());
const persist = () => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch { /* storage unavailable */ }
};

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  persist();
  emit();
}

function tick() {
  if (state.paused || state.phase === "idle" || !state.startedAt) return;
  const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
  const remaining = Math.max(0, state.totalSec - elapsed);
  if (remaining !== state.remainingSec) setState({ remainingSec: remaining });
  if (remaining <= 0) void completePhase();
}

function ensureTimer() {
  if (!timer) timer = setInterval(tick, 500);
}

async function recordSession(completed: boolean) {
  if (state.phase !== "focus" || !state.sessionStartedAt || !state.startedAt) return;
  const durationSec = Math.min(state.totalSec, Math.floor((Date.now() - state.startedAt) / 1000));
  if (durationSec < 30) return; // ignore accidental taps
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("focus_sessions").insert({
    user_id: u.user.id,
    task_id: state.taskId,
    course_id: state.courseId,
    kind: "focus",
    started_at: state.sessionStartedAt,
    ended_at: new Date().toISOString(),
    planned_seconds: state.totalSec,
    duration_seconds: durationSec,
    completed,
  });
  invalidate?.();
}

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch { /* audio unavailable */ }
}

async function completePhase() {
  beep();
  if (state.phase === "focus") {
    await recordSession(true);
    const streak = state.focusStreak + 1;
    const long = streak % Math.max(1, settings.longBreakEvery) === 0;
    const min = long ? settings.longBreakMin : settings.shortBreakMin;
    setState({
      phase: long ? "long_break" : "short_break",
      focusStreak: streak,
      totalSec: min * 60,
      remainingSec: min * 60,
      startedAt: Date.now(),
      paused: false,
      sessionStartedAt: null,
    });
  } else if (state.phase === "short_break" || state.phase === "long_break") {
    // Break over → ready for the next focus block on the same task (auto-paused).
    const total = settings.focusMin * 60;
    setState({
      phase: "focus", totalSec: total, remainingSec: total,
      startedAt: Date.now(), paused: true, sessionStartedAt: new Date().toISOString(),
    });
  }
}

export const focusTimer = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getState: () => state,
  getSettings: () => settings,
  configure(s: FocusSettings) {
    settings = s;
  },
  onInvalidate(fn: () => void) {
    invalidate = fn;
  },
  start(task: { id?: string | null; title?: string | null; courseId?: string | null } = {}) {
    const total = settings.focusMin * 60;
    setState({
      phase: "focus",
      taskId: task.id ?? null,
      courseId: task.courseId ?? null,
      taskTitle: task.title ?? null,
      totalSec: total,
      remainingSec: total,
      startedAt: Date.now(),
      paused: false,
      sessionStartedAt: new Date().toISOString(),
    });
    ensureTimer();
  },
  pause() {
    if (state.paused || !state.startedAt) return;
    const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    setState({ paused: true, remainingSec: Math.max(0, state.totalSec - elapsed), startedAt: null });
  },
  resume() {
    if (!state.paused) return;
    setState({ paused: false, startedAt: Date.now() - (state.totalSec - state.remainingSec) * 1000 });
    ensureTimer();
  },
  /** Stop the current phase early. Focus time so far is recorded as interrupted. */
  async stop() {
    if (state.phase === "focus") await recordSession(false);
    setState({ ...IDLE, focusStreak: state.focusStreak });
  },
  /** Skip the current break and go straight to the next focus block. */
  skipBreak() {
    if (state.phase !== "short_break" && state.phase !== "long_break") return;
    const total = settings.focusMin * 60;
    setState({ phase: "focus", totalSec: total, remainingSec: total, startedAt: Date.now(), paused: false, sessionStartedAt: new Date().toISOString() });
  },
  /** End the break early without starting focus. */
  endBreak() {
    if (state.phase !== "short_break" && state.phase !== "long_break") return;
    setState({ ...IDLE, focusStreak: state.focusStreak });
  },
  restore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as State & { savedAt: number };
      if (saved.phase === "idle" || !saved.startedAt) return;
      const adjusted = saved.paused ? saved : { ...saved, startedAt: saved.startedAt + (Date.now() - saved.savedAt) };
      state = adjusted;
      const elapsed = Math.floor((Date.now() - (state.startedAt ?? Date.now())) / 1000);
      state = { ...state, remainingSec: Math.max(0, state.totalSec - elapsed) };
      if (state.remainingSec <= 0) void completePhase();
      else ensureTimer();
      emit();
    } catch { /* ignore corrupt state */ }
  },
};

export function useFocusTimer(): State {
  return useSyncExternalStore(focusTimer.subscribe, focusTimer.getState, () => IDLE);
}

export const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
