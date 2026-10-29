/* My Mail · 主题应用
   从 app-core.js 拆出：theme-boot.js 已在首屏前同步执行，这里负责运行时切换。 */
import { state } from "../store.js";
import { $ } from "../core/dom.js";
import { ICONS } from "./icons.js";

const mqDark =
  typeof matchMedia === "function"
    ? matchMedia("(prefers-color-scheme: dark)")
    : { matches: false, addEventListener: null };

export function resolvedTheme() {
  if (state.themeMode === "dark") return "dark";
  if (state.themeMode === "light") return "light";
  return mqDark.matches ? "dark" : "light";
}

export function applyTheme() {
  document.documentElement.dataset.theme = resolvedTheme();
  const btn = $("#btnTheme");
  if (!btn) return;
  const icon = state.themeMode === "dark" ? "moon" : state.themeMode === "light" ? "sun" : "theme-auto";
  btn.dataset.icon = icon;
  btn.innerHTML = ICONS[icon];
  btn.title =
    "主题：" +
    (state.themeMode === "dark" ? "黑夜" : state.themeMode === "light" ? "白天" : "跟随系统") +
    "（点击切换）";
  btn.setAttribute("aria-label", btn.title);
  const sel = $("#settingTheme");
  if (sel) sel.value = state.themeMode;
}

mqDark.addEventListener?.("change", () => {
  if (state.themeMode === "auto") applyTheme();
});
