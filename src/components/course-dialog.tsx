import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { COURSE_COLORS, colorVar, useSave, type Course } from "@/lib/db";
import { COURSE_ICONS, CourseIcon } from "@/components/course-icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type Slot = { day: number; start: string; end: string; location?: string };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CourseDialog({ open, onOpenChange, course }: { open: boolean; onOpenChange: (o: boolean) => void; course?: Course | null }) {
  const save = useSave("courses");
  const [f, setF] = useState({ name: "", code: "", teacher: "", semester: "", color: "purple", icon: "book", aliases: "" });
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    if (!open) return undefined;
    setF({
      name: course?.name ?? "", code: course?.code ?? "", teacher: course?.teacher ?? "", semester: course?.semester ?? "",
      color: course?.color ?? "purple", icon: course?.icon ?? "book", aliases: course?.aliases.join(", ") ?? "",
    });
    setSlots(((course?.schedule as Slot[] | undefined) ?? []).map((s) => ({ ...s })));
  }, [open, course]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return toast.error("Course name is required");
    await save.mutateAsync({
      id: course?.id, name: f.name.trim().slice(0, 120), code: f.code || null, teacher: f.teacher || null, semester: f.semester || null,
      color: f.color, icon: f.icon, aliases: f.aliases.split(",").map((a) => a.trim()).filter(Boolean).slice(0, 20), schedule: slots,
    });
    toast.success(course ? "Course updated" : "Course added");
    onOpenChange(false);
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{course ? "Edit course" : "New course"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1"><Label className="text-xs">Name</Label><Input autoFocus value={f.name} onChange={set("name")} placeholder="Biology" /></div>
            <div className="space-y-1"><Label className="text-xs">Code</Label><Input value={f.code} onChange={set("code")} placeholder="BIO 101" /></div>
            <div className="col-span-2 space-y-1"><Label className="text-xs">Teacher</Label><Input value={f.teacher} onChange={set("teacher")} /></div>
            <div className="space-y-1"><Label className="text-xs">Semester</Label><Input value={f.semester} onChange={set("semester")} placeholder="Fall 2026" /></div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nicknames & abbreviations</Label>
            <Input value={f.aliases} onChange={set("aliases")} placeholder="bio, apbio" />
            <p className="text-xs text-muted-foreground">How you write this class in shorthand. Used later by AI Quick Add to recognise it.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex flex-wrap gap-2">
              {COURSE_COLORS.map((c) => (
                <button type="button" key={c} aria-label={c} onClick={() => setF((p) => ({ ...p, color: c }))}
                  className={cn("size-7 rounded-full ring-offset-2 ring-offset-background", f.color === c && "ring-2 ring-ring")} style={{ background: colorVar(c) }} />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {COURSE_ICONS.map((i) => (
                <button type="button" key={i} aria-label={i} onClick={() => setF((p) => ({ ...p, icon: i }))}
                  className={cn("grid size-9 place-items-center rounded-lg border border-border", f.icon === i && "border-primary bg-accent")}>
                  <CourseIcon name={i} className="size-4" />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Weekly schedule</Label>
            {slots.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={s.day} onChange={(e) => setSlots((p) => p.map((x, j) => (j === i ? { ...x, day: +e.target.value } : x)))}>
                  {DAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}
                </select>
                <Input type="time" value={s.start} onChange={(e) => setSlots((p) => p.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                <Input type="time" value={s.end} onChange={(e) => setSlots((p) => p.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                <Input placeholder="Room" value={s.location ?? ""} onChange={(e) => setSlots((p) => p.map((x, j) => (j === i ? { ...x, location: e.target.value } : x)))} />
                <Button type="button" size="icon" variant="ghost" onClick={() => setSlots((p) => p.filter((_, j) => j !== i))}><X className="size-4" /></Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setSlots((p) => [...p, { day: 1, start: "09:00", end: "10:00" }])}><Plus className="size-4" /> Add class time</Button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{course ? "Save" : "Add course"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const DAY_NAMES = DAYS;
