/* My Mail · 工具函数（防抖 / 节流 / 存储 / 转义等） */
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
export const initialOf = (name) => (name || "?").trim().charAt(0).toUpperCase();
export const AVATAR_COLORS = ["#e8736a", "#f5a623", "#5aa2ff", "#7ed3a6", "#9b7ede", "#e87fb0", "#4db6c9"];
export function colorOf(name) {
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
export function debounce(fn, ms) {
  let t = null;
  function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  }
  debounced.flush = function (...args) {
    clearTimeout(t);
    fn.apply(this, args);
  };
  debounced.cancel = function () {
    clearTimeout(t);
  };
  return debounced;
}
export function throttleRaf(fn) {
  let queued = false,
    lastArgs = null;
  return function (...args) {
    lastArgs = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn.apply(this, lastArgs);
    });
  };
}
export const fmtSize = (n) =>
  n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : n > 1024 ? Math.round(n / 1024) + " KB" : (n || 0) + " B";
