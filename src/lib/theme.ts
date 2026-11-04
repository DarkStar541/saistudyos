export type Theme = "light" | "dark" | "system";

export function applyTheme(theme: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("studyos-theme", theme);
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}
