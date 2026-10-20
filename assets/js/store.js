/* My Mail · 状态仓库（集中管理可变状态与持久化）
   - 演示邮件与偏好存 localStorage（带 quota 兜底）
   - 真实邮件只存内存（不进 localStorage，由调用方注入）
   - 使用 Map 统一多账号：accounts: Map<viewKey, { emails, profile, on }>
*/
import { SEED_EMAILS } from "./data.module.js";

export const STORAGE_KEY = "mymail-state-v2";

/* 演示数据版本号。每次扩充 SEED_EMAILS 就把它 +1。
   否则老用户 localStorage 里存着旧演示数据，loadPersisted 会一直复用它，
   新增的示例邮件（草稿/附件/HTML 邮件等）永远看不到。 */
export const SEED_VERSION = 2;

const DEFAULTS = {
  lang: "zh",
  themeMode: "auto",
  sortDesc: true,
  density: "comfortable",
  rules: [],
  signature: "",
  defaultAccount: "auto",
  autoRead: true,
  shortcuts: true,
  fetchCount: 40,
  seedVersion: 0,
  sidebarCollapsed: false,
  demoChosen: false,
  listWidth: 0,
};

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s.emails)) {
        const merged = { ...DEFAULTS, ...s };
        // 种子数据升级：保留用户偏好与真实操作痕迹，但把演示邮件换成新版
        if ((merged.seedVersion || 0) < SEED_VERSION) {
          merged.emails = structuredClone(SEED_EMAILS);
          merged.seedVersion = SEED_VERSION;
        }
        return merged;
      }
    }
  } catch (e) {}
  return { ...DEFAULTS, seedVersion: SEED_VERSION, emails: structuredClone(SEED_EMAILS) };
}

export const state = loadPersisted();

// 多账号统一容器：viewKey -> { emails:[], profile:null, on:boolean }
export const accounts = new Map([
  ["gmail", { emails: [], profile: null, on: false }],
  ["gmail2", { emails: [], profile: null, on: false }],
  ["outlook", { emails: [], profile: null, on: false }],
]);

// UI 状态（不持久化）
export const ui = {
  view: "demo", // demo | gmail | gmail2 | outlook | unified
  mode: "demo", // demo | live
  currentFolder: "inbox",
  currentLabel: null,
  selectedId: null,
  searchQuery: "",
  filterMode: "all", // all | unread | read | starred
  showTranslated: false,
  selecting: false,
  selectedSet: new Set(),
  liveNoticeShown: false,
};

export function getAccount(viewKey) {
  return accounts.get(viewKey) || null;
}
export function liveCount() {
  let n = 0;
  for (const a of accounts.values()) if (a.on) n++;
  return n;
}
export function isLiveView(v = ui.view) {
  return v !== "demo";
}

// 按当前视图取邮件数组（unified 为聚合视图，返回新数组）
export function src() {
  if (ui.view === "unified") {
    const out = [];
    for (const a of accounts.values()) if (a.on) out.push(...a.emails);
    return out;
  }
  const acc = accounts.get(ui.view);
  if (acc) return acc.emails;
  return state.emails;
}

export function storeOf(mail) {
  if (!mail) return state.emails;
  const acc = accounts.get(mail.provider);
  if (acc) return acc.emails;
  // gmail/gmail2/outlook 之外回落到演示
  return state.emails;
}

export function svcOf(provider) {
  if (provider === "outlook") return window.MyMailOutlook;
  if (provider === "gmail2") return window.MyMailGmail2;
  return window.MyMailGmail;
}

export function byId(id) {
  return src().find((m) => m.id === id);
}

let saveQueued = false;
export function save() {
  if (saveQueued) return;
  saveQueued = true;
  // 合并到下一帧，避免连续操作频繁写盘
  requestAnimationFrame(() => {
    saveQueued = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      if (e && (e.name === "QuotaExceededError" || e.code === 22)) {
        // 演示数据过大时，仅保留偏好与索引，丢弃正文
        try {
          const slim = {
            ...state,
            emails: state.emails.map((m) => ({ ...m, body: [], bodyZh: null, bodyHtml: null })),
          };
          const slimStr = JSON.stringify(slim);
          if (slimStr.length < 4_800_000) {
            localStorage.setItem(STORAGE_KEY, slimStr);
            window.dispatchEvent(new CustomEvent("mymail:quota-trimmed"));
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch (e2) {}
      }
    }
  });
}

export function saveSync() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}
