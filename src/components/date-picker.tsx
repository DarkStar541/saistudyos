import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  value: string; // yyyy-MM-dd or ""
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

/** Polished date picker: calendar popover instead of the browser-native date input. */
export function DatePicker({ value, onChange, placeholder = "Pick a date", className, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(`${value}T00:00:00`) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("h-9 w-full justify-start px-2.5 text-left font-normal", !value && "text-muted-foreground", className)}
        >
          <CalendarIcon className="size-4 shrink-0 opacity-60" />
          <span className="truncate">{date ? format(date, "EEE, MMM d, yyyy") : placeholder}</span>
          {value && (
            <span
              role="button"
              aria-label="Clear date"
              className="ml-auto rounded p-0.5 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            >
              <X className="size-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onChange(d ? format(d, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
