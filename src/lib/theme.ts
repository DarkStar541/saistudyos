export type Theme = "light" | "dark" | "system";
export type VisualStyle = "neutral" | "evergreen" | "paper-ink" | "nocturne" | "daydream" | "ember-aurora";

const STYLE_KEY = "studyos-visual-style";

export function applyTheme(theme: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("studyos-theme", theme);
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function applyStyle(_style: VisualStyle) {
  if (typeof document === "undefined") return;
  localStorage.setItem(STYLE_KEY, "neutral");
  const root = document.documentElement;
  root.classList.remove("theme-evergreen", "theme-paper-ink", "theme-nocturne", "theme-daydream", "theme-ember-aurora");
  root.classList.add("theme-neutral");
}

export function getSavedStyle(): VisualStyle {
  return "neutral";
}
