import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { colorVar, type Course, type Task } from "@/lib/db";
import { cn } from "@/lib/utils";

export function CalendarTask({ task, course, deadline = false, draggable = false, onOpen }: {
  task: Task; course?: Course | undefined; deadline?: boolean; draggable?: boolean; onOpen: (t: Task) => void;
}) {
  return (
    <Button
      variant="ghost"
      draggable={draggable && !deadline}
      onDragStart={(e) => e.dataTransfer.setData("text/task", task.id)}
      onClick={() => onOpen(task)}
      aria-label={`${deadline ? "Deadline" : "Work on"}: ${task.title}`}
      title={`${deadline ? "Due" : "Work"}: ${task.title}`}
      className={cn("flex h-auto min-h-5 w-full justify-start gap-1 whitespace-normal rounded px-1 py-0.5 text-left text-xs font-normal shadow-none", deadline && "bg-destructive/10 text-destructive hover:bg-destructive/20", task.status === "done" && "line-through opacity-50")}
      style={deadline ? undefined : { background: `color-mix(in oklab, ${course ? colorVar(course.color) : "var(--primary)"} 18%, transparent)` }}
    >
      {deadline && <CalendarClock className="size-3 shrink-0" />}
      <span className="min-w-0 break-words">{deadline && "Due: "}{task.title}</span>
    </Button>
  );
}