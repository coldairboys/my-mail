/* My Mail · 工具函数（防抖 / 节流 / 存储 / 转义等） */
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
export const initialOf = (name) => (name || "?").trim().charAt(0).toUpperCase();
export const AVATAR_COLORS = ["#e8736a", "#f5a623", "#5aa2ff", "#7ed3a6", "#9b7ede", "#e87fb0", "#4db6c9"];
/* 统一的字符串哈希：头像色板、账号色相都从它派生，保证同一输入永远同一结果 */
export function strHash(str) {
  let h = 0;
  for (const c of String(str ?? "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
export function colorOf(name) {
  return AVATAR_COLORS[strHash(name) % AVATAR_COLORS.length];
}
/* Uint8Array → base64url。分块转换：String.fromCharCode.apply 一次传几万个参数会栈溢出 */
export function bytesToB64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
