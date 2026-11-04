import { Atom, BookOpen, Calculator, Code, Dna, FlaskConical, Globe, Landmark, Languages, Music, Palette, PenTool, Dumbbell, Brain, type LucideProps } from "lucide-react";

const MAP = {
  book: BookOpen, calculator: Calculator, flask: FlaskConical, dna: Dna, atom: Atom, globe: Globe, landmark: Landmark,
  languages: Languages, code: Code, palette: Palette, music: Music, pen: PenTool, gym: Dumbbell, brain: Brain,
} as const;
export const COURSE_ICONS = Object.keys(MAP) as (keyof typeof MAP)[];

export function CourseIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = MAP[name as keyof typeof MAP] ?? BookOpen;
  return <Icon {...props} />;
}
