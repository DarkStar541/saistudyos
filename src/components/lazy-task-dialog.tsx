import { lazy, Suspense } from "react";
import type { TaskDialogProps } from "@/components/task-dialog";

const TaskDialog = lazy(() =>
  import("@/components/task-dialog").then((module) => ({ default: module.TaskDialog })),
);

/** Keeps the task editor and its form dependencies out of the initial page bundle. */
export function LazyTaskDialog(props: TaskDialogProps) {
  return (
    <Suspense fallback={null}>
      <TaskDialog {...props} />
    </Suspense>
  );
}
