/* My Mail · 筛选与排序（带结果缓存，避免 visibleEmails 被多次调用时重复计算）
   从 app-core.js 拆出：纯数据层，不碰 DOM。 */
import { state, ui, src, liveCount } from "../store.js";
import { LABELS } from "../data.module.js";

const CAT_OF_LABEL = { newsletter: "promo", bills: "updates", life: "social" };
const catOf = (m) => m.category || CAT_OF_LABEL[m.label] || null;
const importantOf = (m) => Boolean(m.important);

let visibleCache = null;
let visibleCacheKey = "";

function cacheKey() {
  return [
    ui.view,
    ui.currentFolder,
    ui.currentLabel || "",
    ui.filterMode,
    ui.searchQuery,
    String(state.sortDesc),
    String(liveCount()),
    String(src().length),
  ].join("|");
}

function computeVisible() {
  let list;
  const s = src();
  if (ui.currentLabel)
    list = s.filter((m) => m.label === ui.currentLabel && m.folder !== "trash" && m.folder !== "spam");
  else if (ui.currentFolder === "important")
    list = s.filter((m) => importantOf(m) && m.folder !== "trash" && m.folder !== "spam");
  else if (ui.currentFolder.startsWith("cat-"))
    list = s.filter((m) => catOf(m) === ui.currentFolder.slice(4) && m.folder === "inbox" && !m.archived);
  else if (ui.currentFolder === "starred") list = s.filter((m) => m.starred && m.folder !== "trash");
  else if (ui.currentFolder === "all") list = s.filter((m) => m.folder !== "trash" && m.folder !== "spam");
  else list = s.filter((m) => m.folder === ui.currentFolder && !m.archived);

  if (ui.filterMode === "unread") list = list.filter((m) => m.unread);
  if (ui.filterMode === "read") list = list.filter((m) => !m.unread);
  if (ui.filterMode === "starred") list = list.filter((m) => m.starred);
  if (ui.searchQuery) {
    const q = ui.searchQuery.toLowerCase();
    list = list.filter((m) =>
      [m.from, m.address, m.subject, m.snippet, ...(m.body || [])].join(" ").toLowerCase().includes(q)
    );
  }
  return list
    .slice()
    .sort((a, b) => (state.sortDesc ? (b.ts || 0) - (a.ts || 0) : (a.ts || 0) - (b.ts || 0)));
}

export function visibleEmails() {
  const k = cacheKey();
  if (visibleCache && visibleCacheKey === k) return visibleCache;
  visibleCache = computeVisible();
  visibleCacheKey = k;
  return visibleCache;
}

export function invalidateVisible() {
  visibleCache = null;
}

export function folderCount(fid) {
  const s = src();
  if (fid === "important")
    return s.filter((m) => importantOf(m) && m.folder !== "trash" && m.folder !== "spam").length;
  if (fid.startsWith("cat-"))
    return s.filter((m) => catOf(m) === fid.slice(4) && m.folder === "inbox" && !m.archived).length;
  if (fid === "starred") return s.filter((m) => m.starred && m.folder !== "trash").length;
  if (fid === "all") return s.filter((m) => m.folder !== "trash" && m.folder !== "spam").length;
  if (fid === "inbox") return s.filter((m) => m.folder === "inbox" && !m.archived).length;
  return s.filter((m) => m.folder === fid && !m.archived).length;
}

export function labelById(id) {
  return LABELS.find((l) => l.id === id);
}

export { catOf, importantOf, CAT_OF_LABEL };
