import { dateKeyInTimeZone } from "@/lib/task-utils";

export type FocusSessionLike = {
  kind: string;
  started_at: string;
  duration_seconds: number;
};

/** Aggregate recorded focus time once per date, using the student's profile timezone. */
export function focusMinutesByDate(
  sessions: FocusSessionLike[],
  timeZone?: string | null,
): Map<string, number> {
  const secondsByDate = new Map<string, number>();
  for (const session of sessions) {
    if (session.kind !== "focus" || session.duration_seconds <= 0) continue;
    const key = dateKeyInTimeZone(new Date(session.started_at), timeZone);
    secondsByDate.set(key, (secondsByDate.get(key) ?? 0) + session.duration_seconds);
  }
  return new Map([...secondsByDate].map(([key, seconds]) => [key, Math.round(seconds / 60)]));
}
