/* My Mail · 核心应用逻辑（ES Module · v4）
   从原 app.js 拆分：依赖 store.js / utils.js / data.module.js
   性能修复：搜索防抖、列表 diff 渲染、翻译并发+缓存
   安全：对接 Gmail/Outlook 的 PKCE 流程
   补齐按键：为所有无功能按键补上可操作的逻辑与可访问性
*/
import { LABELS, FOLDERS } from "./data.module.js";
import {
  state,
  ui,
  accounts,
  src,
  storeOf,
  svcOf,
  byId,
  save,
  saveSync,
  liveCount,
  SEED_VERSION,
} from "./store.js";
import { esc, initialOf, colorOf, debounce, fmtSize } from "./utils.js";

const $ = (sel) => document.querySelector(sel);

/* 写信入口的模块级引用。
   openCompose 定义在 bindEvents 内部（它依赖同作用域的 trapFocus / releaseTrap），
   而 renderReading 是模块级函数，直接引用会抛 "openCompose is not defined"，
   导致阅读区「回复 / 转发」按钮点了没反应。bindEvents 初始化时把函数赋给这个引用。 */
let openComposeRef = null;

function pushMail(partial, target) {
  (target || src()).unshift(
    Object.assign(
      {
        id: "u" + Date.now(),
        ts: Date.now(),
        from: "我",
        address: "demo@mymail.app",
        to: "",
        date: "今天",
        time: "刚刚",
        subject: "（无主题）",
        snippet: "",
        label: null,
        unread: false,
        starred: false,
        folder: "sent",
        body: [],
        bodyZh: null,
      },
      partial
    )
  );
}

/* ---------------- 图标（同原版，hydration） ---------------- */
const P = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICONS = {
  inbox: P(
    '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'
  ),
  star: P(
    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
  ),
  flag: P(
    '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'
  ),
  tag: P(
    '<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.2"/>'
  ),
  users: P(
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
  ),
  bell: P('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
  clip: P(
    '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'
  ),
  chart: P(
    '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>'
  ),
  clock: P('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 13.5"/>'),
  edit: P('<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
  send: P('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>'),
  mail: P('<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/>'),
  spam: P('<circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/>'),
  trash: P(
    '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>'
  ),
  search: P('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>'),
  sliders: P(
    '<line x1="4" y1="7" x2="20" y2="7"/><circle cx="9" cy="7" r="2.2"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="15" cy="17" r="2.2"/>'
  ),
  filter: P('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'),
  more: P(
    '<circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/>'
  ),
  menu: P(
    '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'
  ),
  x: P('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  "chevron-left": P('<polyline points="15 18 9 12 15 6"/>'),
  "chevron-right": P('<polyline points="9 18 15 12 9 6"/>'),
  archive: P(
    '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/>'
  ),
  sun: P(
    '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.9" y1="4.9" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.1" y2="19.1"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.9" y1="19.1" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.1" y2="4.9"/>'
  ),
  moon: P('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),
  "theme-auto": P(
    '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>'
  ),
  refresh: P(
    '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.15"/><polyline points="1 20 1 14 7 14"/>'
  ),
  minimize: P('<line x1="5" y1="12" x2="19" y2="12"/>'),
  maximize: P(
    '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>'
  ),
  restore: P(
    '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>'
  ),
};
function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    const name = el.dataset.icon;
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });
}

/* ---------------- Toast（含 aria-live） ---------------- */
let toastTimer = null;
export function toast(msg, action) {
  $("#toastText").textContent = msg;
  $("#toast").setAttribute("aria-live", "polite");
  const btn = $("#toastAction");
  if (action) {
    btn.hidden = false;
    btn.textContent = action.label;
    btn.onclick = () => {
      action.fn();
      hideToast();
    };
  } else {
    btn.hidden = true;
    btn.onclick = null;
  }
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 4200 : 2200);
}
function hideToast() {
  $("#toast").hidden = true;
}

/* ---------------- 主题 ---------------- */
const mqDark =
  typeof matchMedia === "function"
    ? matchMedia("(prefers-color-scheme: dark)")
    : { matches: false, addEventListener: null };
function resolvedTheme() {
  if (state.themeMode === "dark") return "dark";
  if (state.themeMode === "light") return "light";
  return mqDark.matches ? "dark" : "light";
}
function applyTheme() {
  document.documentElement.dataset.theme = resolvedTheme();
  const btn = $("#btnTheme");
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

/* ---------------- 筛选与排序（带结果缓存，避免 visibleEmails 被多次调用时重复计算） ---------------- */
const CAT_OF_LABEL = { newsletter: "promo", bills: "updates", life: "social" };
const CAT_NAMES = { promo: "推广", social: "社交", updates: "动态" };
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
function invalidateVisible() {
  visibleCache = null;
}
function folderCount(fid) {
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

function labelById(id) {
  return LABELS.find((l) => l.id === id);
}

/* ---------------- 渲染（列表采用增量对比，避免搜索抖动时全量重绘闪烁） ---------------- */
let lastListIds = [];
let lastSelecting = null; // 多选开关会改变行内结构（勾选框），必须触发整表重建
function renderNav() {
  // 折叠成图标栏后文字会被 CSS 隐藏，title 与 aria-label 成为唯一的可读标识
  $("#folderList").innerHTML = FOLDERS.map((f) => {
    const n = folderCount(f.id);
    const active = !ui.currentLabel && ui.currentFolder === f.id;
    return (
      `<li class="${active ? "active" : ""}" data-folder="${f.id}" role="button" tabindex="0" aria-current="${active ? "true" : "false"}" title="${esc(f.name)}" aria-label="${esc(f.name)}">` +
      `<span class="nav-icon">${ICONS[f.icon] || ""}</span><span>${esc(f.name)}</span>` +
      `${n ? `<span class="nav-count">${n}</span>` : ""}</li>`
    );
  }).join("");
  $("#labelList").innerHTML = LABELS.map((l) => {
    const n = src().filter((m) => m.label === l.id && m.folder !== "trash" && m.folder !== "spam").length;
    const active = ui.currentLabel === l.id;
    return (
      `<li class="${active ? "active" : ""}" data-label="${l.id}" role="button" tabindex="0" aria-current="${active ? "true" : "false"}" title="${esc(l.name)}" aria-label="${esc(l.name)}">` +
      `<span class="label-dot" style="background:${l.color}"></span><span>${esc(l.name)}</span>` +
      `${n ? `<span class="nav-count">${n}</span>` : ""}</li>`
    );
  }).join("");
}

function mailItemHtml(m) {
  const lab = m.label ? labelById(m.label) : null;
  const selected = m.id === ui.selectedId;
  const checked = ui.selectedSet.has(m.id);
  const cat = catOf(m);
  const catChip = cat ? `<span class="cat-chip">${esc(CAT_NAMES[cat])}</span>` : "";
  const impChip = importantOf(m) ? '<span class="cat-chip imp">重要</span>' : "";
  const tagChip = lab ? `<span class="mail-tag">${esc(lab.name)}</span>` : "";
  const hasAttach = Boolean((m.attachments && m.attachments.length) || m.hasAttachments);
  const attachBadge = hasAttach ? `<span class="mail-attach-icon" title="含附件">${ICONS.clip}</span>` : "";
  const avatarInit = esc(initialOf(m.from));
  const avatarBg = colorOf(m.from);

  return (
    `<li class="mail-item${m.unread ? " unread" : ""}${selected ? " selected" : ""}${checked ? " checked" : ""}" data-id="${esc(m.id)}" role="button" tabindex="0" aria-selected="${selected ? "true" : "false"}">` +
    `<div class="swipe-bg" aria-hidden="true">${ICONS.trash}</div>` +
    `<div class="mail-item-inner">` +
    `${m.unread ? '<span class="unread-dot" aria-hidden="true"></span>' : ""}` +
    `${ui.selecting ? `<span class="row-check" aria-hidden="true">${checked ? "☑" : "☐"}</span>` : `<div class="mail-avatar" style="background:${avatarBg}" aria-hidden="true">${avatarInit}</div>`}` +
    `<div class="mail-item-content">` +
    `<div class="mail-row-1">` +
    `<span class="mail-from">${esc(m.from)}</span>` +
    `${attachBadge}` +
    `<div class="mail-meta-right">` +
    `<button type="button" class="mobile-star-btn${m.starred ? " on" : ""}" data-star="${esc(m.id)}" aria-label="${m.starred ? "取消星标" : "加星标"}">${m.starred ? "★" : "☆"}</button>` +
    `<span class="mail-date">${esc(m.date)}</span>` +
    `<div class="hover-actions" role="toolbar" aria-label="快捷操作">` +
    `<button type="button" class="quick-action-btn" data-qa="trash" title="删除">${ICONS.trash}</button>` +
    `<button type="button" class="quick-action-btn" data-qa="archive" title="归档">${ICONS.archive}</button>` +
    `<button type="button" class="quick-action-btn" data-qa="read" title="${m.unread ? "标为已读" : "标为未读"}">${ICONS.mail}</button>` +
    `<button type="button" class="quick-action-btn row-star${m.starred ? " on" : ""}" data-star="${esc(m.id)}" title="${m.starred ? "取消星标" : "加星标"}">★</button>` +
    `</div>` +
    `</div>` +
    `</div>` +
    `<div class="mail-subject">${esc(m.subject)}${catChip}${impChip}</div>` +
    `<div class="mail-snippet">${esc(m.snippet)}${tagChip}</div>` +
    `</div>` +
    `</div></li>`
  );
}

function renderList() {
  const list = visibleEmails();
  const ids = list.map((m) => m.id).join(",");
  // 进入/退出多选会改变每行的 DOM 结构（插入或移除 .row-check），
  // 只比较 id 会走原地 patch 分支，导致勾选框永远不出现。
  const needFullRebuild = ids !== lastListIds.join(",") || ui.selecting !== lastSelecting;
  lastListIds = list.map((m) => m.id);
  lastSelecting = ui.selecting;

  const title = ui.currentLabel
    ? labelById(ui.currentLabel).name
    : (FOLDERS.find((f) => f.id === ui.currentFolder) || FOLDERS[0]).name;
  $("#currentFolderName").textContent = ui.searchQuery ? `搜索：${ui.searchQuery}` : title;
  $("#btnFilter").classList.toggle("on", ui.filterMode !== "all");
  document
    .querySelectorAll("#filterMenu button")
    .forEach((b) => b.classList.toggle("checked", b.dataset.filter === ui.filterMode));
  $("#menuToggleSort").textContent = "排序：" + (state.sortDesc ? "最新在前" : "最早在前");
  const emptyBtn = $("#menuEmptyFolder");
  if (ui.currentFolder === "trash" || ui.currentFolder === "spam") {
    emptyBtn.hidden = false;
    emptyBtn.textContent = ui.currentFolder === "trash" ? "清空废纸篓" : "清空垃圾邮件";
    emptyBtn.classList.add("danger");
  } else emptyBtn.hidden = true;

  const ul = $("#mailList");
  if (needFullRebuild) {
    // 仍用 innerHTML 批量构建，但通过 ids 对比避免同列表内的无效重绘
    ul.innerHTML = list.map(mailItemHtml).join("");
  } else {
    // 仅状态变化（选中/星标/已读），原地 patch 相关节点，避免整表闪烁
    list.forEach((m) => {
      const li = ul.querySelector(`[data-id="${CSS.escape(m.id)}"]`);
      if (!li) return;
      li.classList.toggle("selected", m.id === ui.selectedId);
      li.classList.toggle("unread", Boolean(m.unread));
      li.classList.toggle("checked", ui.selectedSet.has(m.id));
      li.setAttribute("aria-selected", m.id === ui.selectedId ? "true" : "false");
      // 勾选框符号也要跟着更新：只切 class 的话，勾选后仍显示空框 ☐
      const chk = li.querySelector(".row-check");
      if (chk) chk.textContent = ui.selectedSet.has(m.id) ? "☑" : "☐";
      // 未读圆点同理：它是按 m.unread 渲染出来的元素，只切 class 不会增删节点，
      // 于是「标为未读」只有字体变粗、左侧不长蓝点，「标已读」又会残留蓝点。
      const inner = li.querySelector(".mail-item-inner");
      const dot = li.querySelector(".unread-dot");
      if (m.unread && !dot && inner) {
        const span = document.createElement("span");
        span.className = "unread-dot";
        span.setAttribute("aria-hidden", "true");
        inner.prepend(span);
      } else if (!m.unread && dot) {
        dot.remove();
      }
      li.querySelectorAll("[data-star]").forEach((starBtn) => {
        starBtn.textContent = m.starred ? "★" : "☆";
        starBtn.classList.toggle("on", Boolean(m.starred));
        starBtn.setAttribute("aria-label", m.starred ? "取消星标" : "加星标");
        starBtn.setAttribute("aria-pressed", m.starred ? "true" : "false");
      });
      const readQaBtn = li.querySelector('[data-qa="read"]');
      if (readQaBtn) {
        readQaBtn.title = m.unread ? "标为已读" : "标为未读";
      }
    });
  }
  $("#listEmpty").hidden = list.length > 0;
  $("#listCount").textContent = list.length ? `共 ${list.length} 封` : "";
  const sa = $("#btnSearchAll");
  if (ui.mode === "live" && ui.searchQuery) {
    sa.hidden = false;
    sa.textContent = `在邮箱中搜索全部「${ui.searchQuery}」`;
    sa.setAttribute("aria-label", `在服务器中搜索 ${ui.searchQuery}`);
  } else sa.hidden = true;
  updateBatchBar();
  updatePager(list);
  return list;
}

function updateBatchBar() {
  const bar = $("#batchBar");
  // 多选模式下操作栏常显（哪怕一封都没选），这样「全选」入口始终在；
  // 批量按钮本身在没有选中项时禁用。
  bar.hidden = !ui.selecting;
  const list = visibleEmails();
  const total = list.length;
  const picked = list.filter((m) => ui.selectedSet.has(m.id)).length;
  // 用「已选 / 总数」代替长句，中栏 360px 宽时才不至于把按钮挤到第二行
  $("#batchCount").textContent = `${picked} / ${total}`;
  bar.setAttribute("aria-live", "polite");
  const all = $("#batchSelectAll");
  if (all) {
    all.disabled = total === 0;
    all.checked = total > 0 && picked === total;
    all.indeterminate = picked > 0 && picked < total;
  }
  const has = picked > 0;
  ["#batchArchive", "#batchRead", "#batchTrash"].forEach((sel) => {
    const btn = $(sel);
    if (btn) btn.disabled = !has;
  });
}

function updatePager(list = visibleEmails()) {
  const i = list.findIndex((m) => m.id === ui.selectedId);
  $("#pagePos").textContent = i >= 0 ? `${i + 1} / ${list.length}` : "";
  $("#btnPrev").disabled = i <= 0;
  $("#btnNext").disabled = i < 0 || i >= list.length - 1;
}

function renderReading() {
  const m = byId(ui.selectedId);
  const box = $("#readingContent");
  if (!m) {
    box.innerHTML = "";
    $("#readingEmpty").hidden = false;
    updatePager();
    return;
  }
  $("#readingEmpty").hidden = true;
  const body = ui.showTranslated && m.bodyZh ? m.bodyZh : m.body;
  const isDraft = m.folder === "drafts";
  box.innerHTML = `
    <div class="reading-title-row">
      <h2 class="reading-title">${esc(m.subject)}</h2>
      <button type="button" class="star-btn${m.starred ? " starred" : ""}" id="btnStar" aria-label="${m.starred ? "取消星标" : "加星标"}" aria-pressed="${m.starred ? "true" : "false"}">${m.starred ? "★" : "☆"}</button>
    </div>
    <div class="mail-meta">
      <div class="avatar" style="background:${colorOf(m.from)}" aria-hidden="true">${esc(initialOf(m.from))}</div>
      <div>
        <div><span class="meta-from">${esc(m.from)}</span><span class="meta-addr">${esc(m.address)}</span>
        <button type="button" class="meta-unsub" id="btnUnsub">退订</button></div>
        <div class="meta-to">收件人：${esc(m.to)}${catOf(m) ? `<span class="cat-chip">${esc(CAT_NAMES[catOf(m)])}</span>` : ""}${importantOf(m) ? '<span class="cat-chip imp">重要</span>' : ""}</div>
      </div>
      <div class="meta-date">${esc(m.time)}</div>
    </div>
    <div class="mail-actions-row">
      <button type="button" class="chip-btn primary" id="btnTranslate">${ui.showTranslated ? "↩ 看原文" : "🌐 翻译成" + (state.lang === "zh" ? "中文" : "英文")}</button>
      <button type="button" class="chip-btn" id="btnReply">回复</button>
      <button type="button" class="chip-btn" id="btnForward">转发</button>
      <button type="button" class="chip-btn" id="btnShowImages">${m.showImages === false ? "显示图片" : "隐藏图片"}</button>
    </div>
    ${m.bodyHtml && !(ui.showTranslated && m.bodyZh) ? '<div class="mail-html-slot" id="htmlSlot"></div>' : `<div class="mail-body">${body.map((p) => `<p>${esc(p)}</p>`).join("")}</div>`}
    ${m.attachments && m.attachments.length ? `<div class="attach-block"><div class="attach-title">${ICONS.clip}<span>附件（${m.attachments.length}）</span></div><div class="attach-row">${m.attachments.map((at, i) => `<button type="button" class="attach-chip" data-att="${i}"><span class="attach-name">${esc(at.filename || "附件")}</span><span class="attach-size">${fmtSize(at.size)}</span></button>`).join("")}</div></div>` : ""}
    ${
      !isDraft
        ? `
    <section class="quick-reply-box" id="quickReplyBox" aria-label="快捷回复">
      <div class="quick-reply-header">
        <div class="quick-reply-to">
          <span class="quick-reply-avatar" style="background:${colorOf(m.from)}" aria-hidden="true">${esc(initialOf(m.from))}</span>
          <span>回复给 <strong>${esc(m.from)}</strong> &lt;${esc(m.address)}&gt;</span>
        </div>
        <div class="quick-reply-header-tools">
          <button type="button" class="quick-reply-tool-btn" id="btnQuickReplyPopout" title="展开为独立写信窗口" aria-label="展开为独立写信窗口">${ICONS.edit}</button>
        </div>
      </div>
      <div class="quick-reply-body">
        <textarea id="quickReplyText" class="quick-reply-textarea" placeholder="写下回复内容…（快捷回复，按发送立即发出）" rows="3"></textarea>
      </div>
      <div class="quick-reply-footer">
        <div class="quick-reply-left">
          <button type="button" class="quick-tool-btn" id="btnQuickReplyQuote">引用原文</button>
          <button type="button" class="quick-tool-btn" id="btnQuickReplySig">插入签名</button>
        </div>
        <div class="quick-reply-right">
          <button type="button" class="btn-secondary btn-sm" id="btnQuickReplyFull">完整编辑</button>
          <button type="button" class="btn-primary btn-sm" id="btnQuickReplySend">发送回复</button>
        </div>
      </div>
    </section>
    `
        : `
    <div class="draft-prompt-box">
      <span>当前正在查看草稿，可继续编辑或发送。</span>
      <button type="button" class="btn-primary btn-sm" id="btnEditDraft">继续编辑草稿</button>
    </div>
    `
    }`;
  $("#btnStar").onclick = () => {
    m.starred = !m.starred;
    save();
    renderAll();
  };
  box.querySelectorAll("[data-att]").forEach((chip) => {
    chip.onclick = async () => {
      const at = m.attachments[Number(chip.dataset.att)];
      if (ui.mode !== "live" || !at.attachmentId) {
        toast("演示附件仅作展示");
        return;
      }
      chip.disabled = true;
      try {
        const data = await svcOf(m.provider).downloadAttachment(m.id, at.attachmentId);
        const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(
          new Blob([bytes], { type: at.mimeType || "application/octet-stream" })
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = at.filename || "attachment";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } catch (e) {
        toast("附件下载失败：" + e.message);
      }
      chip.disabled = false;
    };
  });
  $("#btnTranslate").onclick = async () => {
    if (!m.bodyZh) {
      if (ui.mode !== "live") {
        toast("这封邮件暂无译文");
        return;
      }
      const btn = $("#btnTranslate");
      btn.textContent = "翻译中…";
      btn.disabled = true;
      try {
        m.bodyZh = await svcOf(m.provider).translateParagraphs(m.body, state.lang);
      } catch (e) {
        toast("翻译失败：" + e.message);
        renderReading();
        return;
      }
    }
    ui.showTranslated = !ui.showTranslated;
    renderReading();
  };
  // 引用原文的文本块：回复/转发时由「引用原文」按钮插入，不默认塞进正文
  const quoteBlock =
    "\n\n—— 原邮件 ——\n" +
    "发件人：" +
    (m.from || "") +
    (m.time ? "（" + m.time + "）" : "") +
    "\n主题：" +
    (m.subject || "") +
    "\n\n" +
    (m.body || []).join("\n\n");
  const openReply = (initialBody = "") =>
    openComposeRef &&
    openComposeRef({
      mode: "reply",
      to: m.address,
      subject: m.subject.startsWith("Re:") ? m.subject : "Re: " + m.subject,
      provider: m.provider,
      from: m.from,
      quote: quoteBlock,
      body: initialBody,
    });
  const openFwd = () =>
    openComposeRef &&
    openComposeRef({
      mode: "forward",
      subject: "Fwd: " + m.subject,
      provider: m.provider,
      from: m.from,
      quote: quoteBlock,
    });
  $("#btnReply").onclick = () => {
    const qrText = $("#quickReplyText");
    if (qrText) {
      qrText.scrollIntoView({ behavior: "smooth", block: "center" });
      qrText.focus();
    } else {
      openReply();
    }
  };
  $("#btnForward").onclick = openFwd;

  if (isDraft) {
    const editBtn = $("#btnEditDraft");
    if (editBtn) {
      editBtn.onclick = () => {
        openComposeRef &&
          openComposeRef({
            mode: "new",
            to: m.to,
            subject: m.subject === "（无主题）" ? "" : m.subject,
            body: (m.body || []).join("\n\n"),
            provider: m.provider,
          });
      };
    }
  } else {
    const qrText = $("#quickReplyText");
    $("#btnQuickReplyQuote")?.addEventListener("click", () => {
      if (!qrText) return;
      if (qrText.value.includes(quoteBlock.slice(0, 24))) {
        toast("已引用原文");
        return;
      }
      qrText.value = (qrText.value.trim() ? qrText.value.trim() + "\n\n" : "") + quoteBlock;
      qrText.focus();
    });

    $("#btnQuickReplySig")?.addEventListener("click", () => {
      if (!qrText) return;
      if (!state.signature) {
        toast("还没有设置签名：可在设置里添加");
        return;
      }
      if (qrText.value.includes(state.signature)) {
        toast("已包含签名");
        return;
      }
      qrText.value = (qrText.value.trim() ? qrText.value.trim() + "\n\n" : "") + "--\n" + state.signature;
      qrText.focus();
    });

    const triggerFull = () => {
      const typed = qrText ? qrText.value : "";
      openReply(typed);
    };
    $("#btnQuickReplyFull")?.addEventListener("click", triggerFull);
    $("#btnQuickReplyPopout")?.addEventListener("click", triggerFull);

    $("#btnQuickReplySend")?.addEventListener("click", async () => {
      const text = qrText ? qrText.value.trim() : "";
      if (!text) {
        toast("请先输入回复内容");
        qrText?.focus();
        return;
      }
      const sendBtn = $("#btnQuickReplySend");
      sendBtn.disabled = true;
      sendBtn.textContent = "发送中…";
      const sub = m.subject.startsWith("Re:") ? m.subject : "Re: " + m.subject;
      try {
        if (ui.mode === "live" && m.provider) {
          const svc = svcOf(m.provider);
          if (!svc) throw new Error("未登录对应账号");
          await svc.send({ to: m.address, subject: sub, body: text });
          pushMail(
            {
              to: m.address,
              from: "我",
              subject: sub,
              snippet: text.slice(0, 60),
              body: text.split(/\n{2,}/).filter(Boolean),
              folder: "sent",
              provider: m.provider,
              bodyLoaded: true,
            },
            storeOf(m)
          );
          toast((m.provider === "outlook" ? "Outlook" : "Gmail") + " 回复已发送");
        } else {
          // 演示模式
          pushMail({
            to: m.address || m.from,
            from: "我",
            subject: sub,
            snippet: text.slice(0, 60),
            body: text.split(/\n{2,}/).filter(Boolean),
            folder: "sent",
            provider: m.provider,
            bodyLoaded: true,
          });
          save();
          toast("回复已发送（演示模式，已存入已发送文件夹）");
        }
        qrText.value = "";
        renderAll();
      } catch (err) {
        toast("发送失败：" + (err.message || "未知错误"));
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = "发送回复";
      }
    });
  }
  $("#btnUnsub").onclick = () => {
    if (m.unsub) {
      if (m.unsub.startsWith("mailto:")) {
        window.location.href = m.unsub;
        toast("已打开退订邮件");
      } else {
        window.open(m.unsub, "_blank", "noopener");
        toast("已打开官方退订页");
      }
    } else if (ui.mode === "live") toast("这封邮件没有提供退订链接");
    else toast("已退订（演示，不会真的发送）");
  };
  $("#btnShowImages").onclick = () => {
    if (!m.bodyHtml) {
      toast("这封是纯文本邮件，没有图片可切换");
      return;
    }
    if (ui.showTranslated) ui.showTranslated = false;
    m.showImages = m.showImages === false ? true : false;
    renderReading();
    toast(m.showImages === false ? "已隐藏图片（隐藏可防邮件追踪）" : "已显示图片");
  };
  const slot = $("#htmlSlot");
  if (slot && m.bodyHtml) {
    const ifr = document.createElement("iframe");
    ifr.className = "mail-html-frame";
    // 安全：不要给 allow-same-origin。srcdoc + allow-same-origin 的组合会让邮件里的
    // 脚本获得与本站同源的权限（能读 localStorage、令牌），等于绕过沙箱。
    // 这里只允许外链点击，且不留 allow-same-origin / allow-scripts。
    ifr.setAttribute("sandbox", "allow-popups");
    ifr.setAttribute("referrerpolicy", "no-referrer");
    ifr.setAttribute("title", "邮件内容");
    let html = m.bodyHtml;
    if (m.showImages === false) {
      html = html
        .replace(/<img([^>]*?)\ssrc\s*=/gi, "<img$1 data-blocked-src=")
        .replace(/\ssrcset\s*=/gi, " data-blocked-srcset=")
        .replace(/background\s*:\s*url\([^)]*\)/gi, "background:none");
    }
    const style =
      '<style>html,body{margin:0;padding:14px;font-family:-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:14px;line-height:1.65;color:#202124;background:#ffffff}img{max-width:100%!important;height:auto!important}table{max-width:100%!important}td,th{word-break:break-word}a{color:#1a73e8}</style><base target="_blank" rel="noopener">';
    if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (x) => x + style);
    else if (/<html[^>]*>/i.test(html))
      html = html.replace(/<html[^>]*>/i, (x) => x + "<head>" + style + "</head>");
    else html = style + html;
    // 沙箱里拿不到 contentDocument（跨域），无法自动量高：
    // 改用受限高度 + 内部滚动，既不会把超长邮件撑爆版面，也不需要同源权限。
    ifr.srcdoc = html;
    slot.appendChild(ifr);
  }
  updatePager();
}

export function renderAll() {
  invalidateVisible();
  renderNav();
  renderList();
  renderReading();
}

/* ---------------- 选择、翻页、动作 ---------------- */
/* openReading=false 用于「程序化预选」场景（首屏、切换视图）：
   这些场景不该在手机上把阅读页盖到列表上——移动端 .reading-pane 是
   position:fixed;inset:0，一旦带上 reading-open，用户开局就进邮件详情，
   连菜单按钮都被盖住点不到。桌面端 reading-open 无视觉效果，故不受影响。 */
export function select(id, markRead = true, openReading = true) {
  ui.selectedId = id;
  ui.showTranslated = false;
  const m = byId(id);
  if (m && m.provider === "outlook" && !m.bodyLoaded) {
    svcOf("outlook")
      .fetchFull(m.id)
      .then(({ body, bodyHtml, attachments }) => {
        m.body = body;
        m.bodyHtml = bodyHtml;
        m.attachments = attachments;
        m.bodyLoaded = true;
        if (ui.selectedId === m.id) {
          invalidateVisible();
          renderReading();
        }
      })
      .catch(() => {
        m.bodyLoaded = true;
      });
  }
  if (m && markRead && state.autoRead !== false && m.unread) {
    m.unread = false;
    save();
  }
  if (openReading) document.querySelector(".app").classList.add("reading-open");
  // 焦点跟随选中项：鼠标点选某行后按 j/k 切换，焦点会留在旧行上，
  // 而「鼠标 + 键盘」混合操作会让旧行命中 :focus-visible，留下一条蓝色描边。
  // 记录「切换前焦点是否在列表行上」，重绘后再同步焦点，避免 DOM 更新把焦点冲掉。
  const activeItem =
    document.activeElement && document.activeElement.closest
      ? document.activeElement.closest("#mailList .mail-item")
      : null;
  const moveFocus = Boolean(activeItem && activeItem.dataset.id !== id);
  renderNav();
  renderList();
  renderReading();
  if (moveFocus) {
    const target = document.querySelector(`#mailList .mail-item[data-id="${CSS.escape(id)}"]`);
    if (target) target.focus({ preventScroll: true });
    else activeItem.blur();
  }
}
function stepSelection(dir) {
  const list = visibleEmails();
  if (!list.length) return;
  let i = list.findIndex((m) => m.id === ui.selectedId);
  i = i < 0 ? 0 : Math.min(list.length - 1, Math.max(0, i + dir));
  if (list[i]) select(list[i].id);
}

function trashMail(m, silent) {
  const arr = storeOf(m);
  const snapshot = { folder: m.folder, archived: m.archived, index: arr.indexOf(m), removed: false };
  if (m.folder === "trash") {
    if (snapshot.index >= 0) arr.splice(snapshot.index, 1);
    snapshot.removed = true;
    if (!silent)
      toast("已彻底删除", {
        label: "撤销",
        fn: () => {
          if (snapshot.index >= 0) arr.splice(snapshot.index, 0, m);
          m.folder = "trash";
          save();
          renderAll();
        },
      });
  } else {
    m.folder = "trash";
    m.archived = false;
    if (!silent)
      toast("已移到废纸篓", {
        label: "撤销",
        fn: () => {
          m.folder = snapshot.folder;
          m.archived = snapshot.archived;
          save();
          renderAll();
        },
      });
  }
  if (ui.selectedId === m.id) ui.selectedId = null;
  save();
  renderAll();
}

function actOnSelected(action) {
  const m = byId(ui.selectedId);
  if (!m) {
    toast("先选一封邮件");
    return;
  }
  if (ui.mode === "live" && !ui.liveNoticeShown) {
    ui.liveNoticeShown = true;
    toast("真实模式下，管理动作只在本页内有效（只读+发送权限不能改服务器）");
  }
  if (action === "archive") {
    m.archived = true;
    ui.selectedId = null;
    toast("已归档，在「所有邮件」里能找到");
  }
  if (action === "snooze") {
    m.folder = "snoozed";
    m.archived = false;
    ui.selectedId = null;
    toast("已延后到明天");
  }
  if (action === "spam") {
    m.folder = "spam";
    m.archived = false;
    ui.selectedId = null;
    toast("已标为垃圾邮件");
  }
  if (action === "underway") {
    m.folder = "inbox";
    m.archived = false;
    m.unread = true;
    ui.selectedId = null;
    toast("已移回收件箱并标为未读");
  }
  if (action === "trash") {
    trashMail(m);
    return;
  }
  if (action === "star") {
    m.starred = !m.starred;
    toast(m.starred ? "已加星标" : "已取消星标");
  }
  if (action === "read") {
    m.unread = !m.unread;
    toast(m.unread ? "已标为未读" : "已标为已读");
  }
  save();
  renderAll();
}

/* ---------------- 事件绑定（由 init 调用一次） ---------------- */
let bound = false;
export function bindEvents(handlers) {
  if (bound) return;
  bound = true;
  const { setView, updateChrome, enterGmail, enterOutlook, enterG2, doGoogleLogin, doMsLogin } = handlers;

  $("#btnPrev").onclick = () => stepSelection(-1);
  $("#btnNext").onclick = () => stepSelection(1);
  $("#btnBack").onclick = () => document.querySelector(".app").classList.remove("reading-open");
  document.querySelector(".reading-toolbar .toolbar-right").addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (b) actOnSelected(b.dataset.action);
  });

  // 工具栏：刷新 / 全部已读 等扩展按钮（若存在则绑定）
  $("#btnRefresh")?.addEventListener("click", async () => {
    const btn = $("#btnRefresh");
    btn.disabled = true;
    try {
      const v = ui.view;
      if (v === "gmail" || v === "gmail2" || v === "outlook") {
        toast("正在刷新…");
        await handlers.refreshCurrent();
      } else if (v === "unified") {
        toast("正在刷新全部账号…");
        await handlers.refreshCurrent();
      } else {
        toast("演示模式无需刷新");
      }
    } catch (e) {
      toast("刷新失败：" + e.message);
    }
    btn.disabled = false;
  });

  /* 左滑删除 */
  let swipe = null;
  let suppressClickUntil = 0;
  const listEl = $("#mailList");
  listEl.addEventListener("pointerdown", (e) => {
    const inner = e.target.closest(".mail-item-inner");
    if (!inner || e.button > 0) return;
    const li = inner.closest(".mail-item");
    swipe = {
      id: li.dataset.id,
      inner,
      bg: li.querySelector(".swipe-bg"),
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      active: false,
    };
  });
  listEl.addEventListener("pointermove", (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.startX,
      dy = e.clientY - swipe.startY;
    if (!swipe.active) {
      if (Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy) * 1.25 && dx < 0) {
        swipe.active = true;
        swipe.inner.classList.remove("anim");
        try {
          swipe.inner.setPointerCapture(e.pointerId);
        } catch (err) {}
      } else if (Math.abs(dy) > 9) {
        swipe = null;
        return;
      } else return;
    }
    swipe.dx = Math.max(-150, Math.min(0, dx));
    swipe.inner.style.transform = `translateX(${swipe.dx}px)`;
    swipe.bg.style.opacity = String(Math.min(1, -swipe.dx / 64));
  });
  function endSwipe(commit) {
    if (!swipe) return;
    const s = swipe;
    swipe = null;
    if (!s.active) return;
    suppressClickUntil = Date.now() + 350;
    s.inner.classList.add("anim");
    if (commit && s.dx < -92) {
      s.inner.style.transform = "translateX(-104%)";
      const m = byId(s.id);
      setTimeout(() => {
        if (m) trashMail(m);
      }, 170);
    } else {
      s.inner.style.transform = "";
      s.bg.style.opacity = "0";
      setTimeout(() => {
        s.inner.style.transform = "";
      }, 200);
    }
  }
  listEl.addEventListener("pointerup", () => endSwipe(true));
  listEl.addEventListener("pointercancel", () => endSwipe(false));
  listEl.addEventListener(
    "click",
    (e) => {
      if (Date.now() < suppressClickUntil) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      // 快捷操作 (Hover Quick Actions)
      const qa = e.target.closest("[data-qa]");
      if (qa) {
        e.stopPropagation();
        const action = qa.dataset.qa;
        const li = qa.closest("[data-id]");
        if (!li) return;
        const m = byId(li.dataset.id);
        if (!m) return;
        if (action === "trash") {
          trashMail(m);
        } else if (action === "archive") {
          if (m.folder === "inbox") {
            m.archived = true;
            m.folder = "all";
            save();
            renderAll();
            toast("已归档 1 封邮件");
          } else {
            toast("仅收件箱中的邮件可归档");
          }
        } else if (action === "read") {
          m.unread = !m.unread;
          save();
          renderAll();
          toast(m.unread ? "已标为未读" : "已标为已读");
        }
        return;
      }
      const star = e.target.closest("[data-star]");
      if (star) {
        e.stopPropagation();
        const m = byId(star.dataset.star);
        if (m) {
          m.starred = !m.starred;
          save();
          renderAll();
        }
        return;
      }
      const li = e.target.closest("[data-id]");
      if (!li) return;
      if (ui.selecting) {
        const id = li.dataset.id;
        ui.selectedSet.has(id) ? ui.selectedSet.delete(id) : ui.selectedSet.add(id);
        renderList();
        return;
      }
      select(li.dataset.id);
    },
    true
  );
  // 键盘可访问：文件夹/标签/邮件行支持回车/空格激活
  $("#folderList").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.target.click();
    }
  });
  $("#labelList").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.target.click();
    }
  });
  listEl.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-id]")) {
      e.preventDefault();
      select(e.target.dataset.id);
    }
  });

  /* 文件夹 / 标签 / 抽屉 / 桌面折叠 */
  const mqNarrow = matchMedia("(max-width: 860px)");
  function isNarrow() {
    return mqNarrow.matches;
  }

  /* ---------- 列表栏 / 阅读栏 拖拽分隔 ---------- */
  // 列宽由 --list-w 驱动，拖拽只改这一个变量；宽度存 localStorage，刷新后保持。
  const resizer = $("#colResizer");
  const appEl = document.querySelector(".app");
  const LIST_MIN = 260; // 再窄就放不下「发件人 + 日期」一行
  const READING_MIN = 320; // 阅读区保底宽度，避免被挤成一条缝

  function listMaxWidth() {
    const sidebarW = appEl.classList.contains("sidebar-collapsed")
      ? parseFloat(getComputedStyle(appEl).getPropertyValue("--sidebar-collapsed-width")) || 64
      : document.querySelector(".sidebar").getBoundingClientRect().width;
    return Math.max(LIST_MIN, Math.round(window.innerWidth - sidebarW - READING_MIN));
  }
  function applyListWidth(width, persist) {
    const clamped = Math.max(LIST_MIN, Math.min(listMaxWidth(), Math.round(width)));
    appEl.style.setProperty("--list-w", clamped + "px");
    state.listWidth = clamped;
    if (persist) saveSync();
    return clamped;
  }
  if (state.listWidth) applyListWidth(state.listWidth, false);

  if (resizer) {
    let drag = null;
    resizer.addEventListener("pointerdown", (e) => {
      if (isNarrow() || e.button > 0) return;
      e.preventDefault();
      drag = {
        startX: e.clientX,
        startW: document.querySelector(".list-pane").getBoundingClientRect().width,
      };
      appEl.classList.add("resizing");
      resizer.classList.add("dragging");
      try {
        resizer.setPointerCapture(e.pointerId);
      } catch (err) {}
    });
    resizer.addEventListener("pointermove", (e) => {
      if (!drag) return;
      applyListWidth(drag.startW + (e.clientX - drag.startX), false);
    });
    const endDrag = () => {
      if (!drag) return;
      drag = null;
      appEl.classList.remove("resizing");
      resizer.classList.remove("dragging");
      saveSync();
    };
    resizer.addEventListener("pointerup", endDrag);
    resizer.addEventListener("pointercancel", endDrag);
    // 键盘可达：左右方向键每次 24px
    resizer.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const cur = document.querySelector(".list-pane").getBoundingClientRect().width;
      applyListWidth(cur + (e.key === "ArrowRight" ? 24 : -24), true);
    });
    // 窗口变窄时把越界的宽度收回来
    window.addEventListener("resize", () => {
      if (isNarrow() || !state.listWidth) return;
      if (state.listWidth > listMaxWidth()) applyListWidth(listMaxWidth(), true);
    });
  }

  function closeSidebar() {
    document.querySelector(".app").classList.remove("sidebar-open");
    $("#sidebarBackdrop").hidden = true;
    $("#sidebarBackdrop").setAttribute("aria-hidden", "true");
  }

  /* 桌面端的侧栏折叠：窄屏用抽屉，宽屏用折叠。
     两者共用一个按钮（#btnCloseSidebar），但语义与图标不同。 */
  function setCollapsed(collapsed, persist = true) {
    const app = document.querySelector(".app");
    app.classList.toggle("sidebar-collapsed", collapsed);
    if (persist) {
      state.sidebarCollapsed = collapsed;
      saveSync();
    }
    updateSidebarToggleUI();
  }
  function updateSidebarToggleUI() {
    const app = document.querySelector(".app");
    const btn = $("#btnCloseSidebar");
    if (!btn) return;
    const narrow = isNarrow();
    if (narrow) {
      // 移动端：关闭抽屉
      btn.dataset.icon = "x";
      btn.innerHTML = ICONS.x;
      btn.setAttribute("aria-label", "关闭菜单");
      btn.title = "关闭菜单";
    } else {
      const collapsed = app.classList.contains("sidebar-collapsed");
      btn.dataset.icon = collapsed ? "chevron-right" : "chevron-left";
      btn.innerHTML = collapsed ? ICONS["chevron-right"] : ICONS["chevron-left"];
      btn.setAttribute("aria-label", collapsed ? "展开侧边栏" : "收起侧边栏");
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.title = collapsed ? "展开侧边栏" : "收起侧边栏";
    }
  }
  $("#btnCloseSidebar").onclick = () => {
    if (isNarrow()) {
      closeSidebar();
      return;
    }
    setCollapsed(!document.querySelector(".app").classList.contains("sidebar-collapsed"));
  };
  // 桌面端不显示三横：抽屉入口只对窄屏有意义。CSS 里也会隐藏，这里同时兜底。
  function syncMenuButton() {
    const btn = $("#btnMenu");
    if (!btn) return;
    btn.hidden = !isNarrow();
  }
  mqNarrow.addEventListener?.("change", () => {
    syncMenuButton();
    updateSidebarToggleUI();
    if (!isNarrow()) closeSidebar(); // 从窄屏切回宽屏时清掉抽屉态
  });
  $("#btnMenu").onclick = () => {
    if (!isNarrow()) return;
    const app = document.querySelector(".app");
    const open = app.classList.toggle("sidebar-open");
    $("#sidebarBackdrop").hidden = !open;
    $("#sidebarBackdrop").setAttribute("aria-hidden", open ? "false" : "true");
    if (open) $("#btnCloseSidebar")?.focus();
  };
  $("#sidebarBackdrop").onclick = closeSidebar;
  $("#folderList").addEventListener("click", (e) => {
    const li = e.target.closest("[data-folder]");
    if (!li) return;
    ui.currentFolder = li.dataset.folder;
    ui.currentLabel = null;
    ui.selectedId = null;
    document.querySelector(".app").classList.remove("reading-open");
    closeSidebar();
    renderAll();
  });
  $("#labelList").addEventListener("click", (e) => {
    const li = e.target.closest("[data-label]");
    if (!li) return;
    ui.currentLabel = li.dataset.label;
    ui.selectedId = null;
    document.querySelector(".app").classList.remove("reading-open");
    closeSidebar();
    renderAll();
  });

  /* 搜索（防抖 220ms） */
  const searchInput = $("#searchInput");
  const debouncedRender = debounce(() => {
    invalidateVisible();
    renderList();
  }, 220);
  searchInput.addEventListener("input", () => {
    ui.searchQuery = searchInput.value.trim();
    $("#btnClearSearch").hidden = !ui.searchQuery;
    debouncedRender();
  });
  // 回车立即执行，不等防抖
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      debouncedRender.flush ? debouncedRender.flush() : (invalidateVisible(), renderList());
    }
  });
  $("#btnClearSearch").onclick = () => {
    searchInput.value = "";
    ui.searchQuery = "";
    $("#btnClearSearch").hidden = true;
    invalidateVisible();
    renderList();
  };
  $("#btnFocusSearch").onclick = () => {
    closeSidebar();
    searchInput.focus();
  };

  /* 下拉菜单：筛选 / 更多 */
  function toggleMenu(id) {
    const menu = $(id);
    const willOpen = menu.hidden;
    document.querySelectorAll(".dropdown").forEach((d) => {
      d.hidden = true;
      d.setAttribute("aria-hidden", "true");
    });
    menu.hidden = !willOpen;
    menu.setAttribute("aria-hidden", willOpen ? "false" : "true");
    if (willOpen) menu.querySelector("button")?.focus();
  }
  $("#btnFilter").onclick = (e) => {
    e.stopPropagation();
    toggleMenu("#filterMenu");
  };
  $("#btnMore").onclick = (e) => {
    e.stopPropagation();
    toggleMenu("#moreMenu");
  };
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".menu-wrap"))
      document.querySelectorAll(".dropdown").forEach((d) => {
        d.hidden = true;
        d.setAttribute("aria-hidden", "true");
      });
  });
  $("#filterMenu").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    ui.filterMode = b.dataset.filter;
    $("#filterMenu").hidden = true;
    $("#filterMenu").setAttribute("aria-hidden", "true");
    invalidateVisible();
    renderList();
    toast(
      { all: "显示全部邮件", unread: "只看未读", read: "只看已读", starred: "只看已加星标" }[ui.filterMode]
    );
  });
  function markAllRead() {
    visibleEmails().forEach((m) => (m.unread = false));
    save();
    renderAll();
    toast("当前列表已全部标为已读");
  }
  function batchDone(msg) {
    const n = ui.selectedSet.size;
    ui.selectedSet.clear();
    ui.selecting = false;
    document.body.classList.remove("selecting");
    save();
    renderAll();
    toast(msg.replace("{n}", n));
  }
  // 全选 / 取消全选：作用于当前可见列表（搜索、筛选后的结果）
  $("#batchSelectAll").addEventListener("change", (e) => {
    const list = visibleEmails();
    if (e.target.checked) list.forEach((m) => ui.selectedSet.add(m.id));
    else ui.selectedSet.clear();
    renderList();
    toast(e.target.checked ? `已全选 ${list.length} 封` : "已取消全选");
  });
  $("#batchArchive").onclick = () => {
    ui.selectedSet.forEach((id) => {
      const m = byId(id);
      if (m && m.folder === "inbox") m.archived = true;
    });
    batchDone("已归档 {n} 封");
  };
  $("#batchRead").onclick = () => {
    ui.selectedSet.forEach((id) => {
      const m = byId(id);
      if (m) m.unread = false;
    });
    batchDone("已标已读 {n} 封");
  };
  $("#batchTrash").onclick = () => {
    const ids = [...ui.selectedSet];
    ids.forEach((id) => {
      const m = byId(id);
      if (m) trashMail(m, true);
    });
    ui.selectedSet.clear();
    ui.selecting = false;
    document.body.classList.remove("selecting");
    renderAll();
    toast(`已删除 ${ids.length} 封（可在废纸篓逐封撤销）`);
  };
  $("#batchCancel").onclick = () => {
    ui.selectedSet.clear();
    ui.selecting = false;
    document.body.classList.remove("selecting");
    renderList();
  };
  $("#menuSelectMode").onclick = () => {
    $("#moreMenu").hidden = true;
    $("#moreMenu").setAttribute("aria-hidden", "true");
    ui.selecting = !ui.selecting;
    if (!ui.selecting) ui.selectedSet.clear();
    document.body.classList.toggle("selecting", ui.selecting);
    renderList();
    toast(ui.selecting ? "多选模式：点邮件行勾选" : "已退出多选");
  };
  $("#btnSearchAll").onclick = async () => {
    const btn = $("#btnSearchAll");
    btn.disabled = true;
    btn.textContent = "正在邮箱中搜索…";
    try {
      let added = 0;
      const jobs = [];
      const G = () => window.MyMailGmail,
        G2 = () => window.MyMailGmail2;
      if (ui.view === "gmail" || ui.view === "unified") jobs.push([G(), accounts.get("gmail").emails]);
      if (ui.view === "gmail2" || ui.view === "unified") jobs.push([G2(), accounts.get("gmail2").emails]);
      if (ui.view === "outlook" || ui.view === "unified")
        jobs.push([window.MyMailOutlook, accounts.get("outlook").emails]);
      for (const [svc, store] of jobs) {
        if (!svc) continue;
        const found = await svc.searchAll(ui.searchQuery);
        const map = new Map(store.map((m) => [m.id, m]));
        for (const em of found)
          if (!map.has(em.id)) {
            store.push(em);
            added++;
          }
      }
      invalidateVisible();
      renderAll();
      toast(added ? `从邮箱服务器找到并载入 ${added} 封` : "没有更多结果了");
    } catch (e) {
      toast("搜索失败：" + e.message);
    }
    btn.disabled = false;
  };
  $("#menuMarkAllRead").onclick = () => {
    $("#moreMenu").hidden = true;
    $("#moreMenu").setAttribute("aria-hidden", "true");
    markAllRead();
  };
  $("#menuToggleSort").onclick = () => {
    state.sortDesc = !state.sortDesc;
    saveSync();
    $("#moreMenu").hidden = true;
    $("#moreMenu").setAttribute("aria-hidden", "true");
    invalidateVisible();
    renderList();
    toast(state.sortDesc ? "排序：最新在前" : "排序：最早在前");
  };
  $("#menuEmptyFolder").onclick = () => {
    const fid = ui.currentFolder;
    const stores =
      ui.view === "unified" ? [...accounts.values()].filter((a) => a.on).map((a) => a.emails) : [src()];
    for (const arr of stores) arr.splice(0, arr.length, ...arr.filter((m) => m.folder !== fid));
    ui.selectedId = null;
    save();
    $("#moreMenu").hidden = true;
    renderAll();
    toast(fid === "trash" ? "废纸篓已清空" : "垃圾邮件已清空");
  };
  function resetData() {
    if (ui.view !== "demo") {
      const jobs = [];
      const gmailOn = accounts.get("gmail").on,
        g2On = accounts.get("gmail2").on,
        outlookOn = accounts.get("outlook").on;
      if (gmailOn) jobs.push(enterGmail(false));
      if (g2On) jobs.push(enterG2(false));
      if (outlookOn) jobs.push(enterOutlook(false));
      Promise.all(jobs)
        .then(() => {
          updateChrome();
          renderAll();
          toast("已重新拉取");
        })
        .catch((e) => toast("拉取失败：" + e.message));
      return;
    }
    localStorage.removeItem("mymail-state-v2");
    // 重新加载演示数据
    import("./data.module.js").then(({ SEED_EMAILS: S }) => {
      state.emails = structuredClone(S);
      // 同步种子版本号，避免下次启动又被 loadPersisted 判定为「待升级」而二次覆盖
      state.seedVersion = SEED_VERSION;
      ui.selectedId = null;
      ui.currentFolder = "inbox";
      ui.currentLabel = null;
      ui.filterMode = "all";
      saveSync();
      renderAll();
      toast("演示数据已恢复");
    });
  }
  $("#menuResetData").onclick = () => {
    $("#moreMenu").hidden = true;
    resetData();
  };

  /* ---------------- 写邮件 ---------------- */
  let composeMode = state.composeWindowMode || "floating";

  function applyComposeMode(mode) {
    if (window.innerWidth <= 860) mode = "fullscreen";
    composeMode = mode;
    state.composeWindowMode = mode;
    saveSync();

    const modal = $("#composeModal");
    if (!modal) return;
    modal.classList.remove("compose-mode-floating", "compose-mode-fullscreen", "compose-mode-minimized");
    modal.classList.add("compose-mode-" + mode);

    const minBtn = $("#btnMinimizeCompose");
    const maxBtn = $("#btnMaximizeCompose");
    if (minBtn) {
      minBtn.innerHTML = mode === "minimized" ? ICONS.maximize : ICONS.minimize;
      minBtn.title = mode === "minimized" ? "还原" : "最小化";
    }
    if (maxBtn) {
      maxBtn.innerHTML = mode === "fullscreen" ? ICONS.restore : ICONS.maximize;
      maxBtn.title = mode === "fullscreen" ? "还原为窗口" : "最大化";
    }
    if (mode === "floating" || mode === "minimized") {
      releaseTrap();
    } else if (mode === "fullscreen" && !modal.hidden) {
      trapFocus(modal);
    }
  }

  $("#btnMinimizeCompose")?.addEventListener("click", (e) => {
    e.stopPropagation();
    applyComposeMode(composeMode === "minimized" ? "floating" : "minimized");
  });
  $("#btnMaximizeCompose")?.addEventListener("click", (e) => {
    e.stopPropagation();
    applyComposeMode(composeMode === "fullscreen" ? "floating" : "fullscreen");
  });
  $("#composeHeader")?.addEventListener("click", (e) => {
    if (composeMode === "minimized" && !e.target.closest("button")) {
      applyComposeMode("floating");
    }
  });

  // 记录当前写信上下文（回复/转发时用于「引用原文」按钮与标题副文案）
  let composeCtx = { mode: "new", quote: null, from: "", subject: "" };

  function updateComposeCount() {
    const el = $("#composeCount");
    const body = $("#composeBody");
    if (!el || !body) return;
    const chars = body.value.replace(/\s/g, "").length;
    el.textContent = chars ? chars + " 字" : "0 字";
  }

  function openCompose(prefill = {}) {
    // 保存触发焦点，用于关闭后还原
    openCompose._prevFocus = document.activeElement;
    const accSel = $("#composeAccount");
    const opts = [];
    if (accounts.get("gmail").on)
      opts.push(["gmail", "Gmail · " + (accounts.get("gmail").profile?.emailAddress || "")]);
    if (accounts.get("gmail2").on)
      opts.push(["gmail2", "Gmail · " + (accounts.get("gmail2").profile?.emailAddress || "")]);
    if (accounts.get("outlook").on)
      opts.push(["outlook", "Outlook · " + (accounts.get("outlook").profile?.emailAddress || "")]);
    $("#composeAccountRow").hidden = opts.length === 0;
    accSel.innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
    if (prefill.provider && opts.some(([v]) => v === prefill.provider)) accSel.value = prefill.provider;
    else if (
      state.defaultAccount &&
      state.defaultAccount !== "auto" &&
      opts.some(([v]) => v === state.defaultAccount)
    )
      accSel.value = state.defaultAccount;
    else if (ui.view === "gmail" || ui.view === "gmail2" || ui.view === "outlook") accSel.value = ui.view;
    const contacts = new Map();
    for (const m of [...state.emails, ...[...accounts.values()].flatMap((a) => a.emails)]) {
      if (m.address) contacts.set(m.address, m.from);
      if (m.to && m.to.includes("@")) contacts.set(m.to, m.to);
    }
    $("#contactsList").innerHTML = [...contacts.entries()]
      .map(([addr, name]) => `<option value="${esc(addr)}">${esc(name || "")}</option>`)
      .join("");

    // 上下文：标题与副标题、引用原文的可用性
    const mode = prefill.mode || "new";
    composeCtx = {
      mode,
      quote: prefill.quote || null,
      from: prefill.from || "",
      subject: prefill.subject || "",
    };
    const titles = { new: "新邮件", reply: "回复邮件", forward: "转发邮件" };
    $("#composeTitle").textContent = titles[mode] || "新邮件";
    $("#composeSubtitle").textContent =
      mode !== "new" && composeCtx.from ? "原邮件来自：" + composeCtx.from : "";
    $("#btnInsertQuote").hidden = !composeCtx.quote;

    $("#composeTo").value = prefill.to || "";
    $("#composeCc").value = "";
    $("#composeBcc").value = "";
    $("#composeCcRow").hidden = true;
    $("#composeBccRow").hidden = true;
    $("#btnToggleCc").setAttribute("aria-expanded", "false");
    $("#composeSubject").value = prefill.subject || "";
    $("#composeBody").value = (prefill.body || "") + (state.signature ? "\n\n--\n" + state.signature : "");
    $("#composeHint").textContent = "";
    updateComposeCount();
    if (composeMode === "minimized") {
      composeMode = "floating";
    }
    applyComposeMode(window.innerWidth <= 860 ? "fullscreen" : composeMode);
    $("#composeModal").hidden = false;
    $("#composeModal").setAttribute("aria-hidden", "false");
    // 焦点陷阱：首个输入框
    requestAnimationFrame(() => $("#composeTo").focus());
    if (composeMode === "fullscreen" || window.innerWidth <= 860) {
      trapFocus($("#composeModal"));
    }
  }
  function closeCompose() {
    $("#composeModal").hidden = true;
    $("#composeModal").setAttribute("aria-hidden", "true");
    releaseTrap();
    // 还原焦点
    if (openCompose._prevFocus && openCompose._prevFocus.focus)
      try {
        openCompose._prevFocus.focus();
      } catch (e) {}
  }
  function pushMail(partial, target) {
    (target || src()).unshift(
      Object.assign(
        {
          id: "u" + Date.now(),
          ts: Date.now(),
          from: "我",
          address: "demo@mymail.app",
          to: "",
          date: "今天",
          time: "刚刚",
          subject: "（无主题）",
          snippet: "",
          label: null,
          unread: false,
          starred: false,
          folder: "sent",
          body: [],
          bodyZh: null,
        },
        partial
      )
    );
  }
  function composeTarget() {
    const acc = $("#composeAccount") ? $("#composeAccount").value : "";
    if (acc === "gmail") return { store: accounts.get("gmail").emails, provider: "gmail" };
    if (acc === "gmail2") return { store: accounts.get("gmail2").emails, provider: "gmail2" };
    if (acc === "outlook") return { store: accounts.get("outlook").emails, provider: "outlook" };
    return { store: state.emails, provider: undefined };
  }
  function composeSnapshot(folder) {
    const to = $("#composeTo").value.trim(),
      subject = $("#composeSubject").value.trim(),
      bodyText = $("#composeBody").value;
    const sigBlock = state.signature ? "\n\n--\n" + state.signature : "";
    if (!to && !subject && (!bodyText.trim() || bodyText === sigBlock)) return false;
    const t = composeTarget();
    pushMail(
      {
        to: to || "（未填收件人）",
        cc: $("#composeCc").value.trim(),
        subject: subject || "（无主题）",
        snippet: bodyText.trim().slice(0, 60),
        body: bodyText.split(/\n{2,}/).filter(Boolean),
        folder,
        provider: t.provider,
        bodyLoaded: true,
      },
      t.store
    );
    return true;
  }

  // 抄送 / 密送：真实可填，发送时一并通过接口下发
  $("#btnToggleCc").onclick = (e) => {
    e.preventDefault();
    const expanded = $("#btnToggleCc").getAttribute("aria-expanded") === "true";
    const next = !expanded;
    $("#btnToggleCc").setAttribute("aria-expanded", String(next));
    $("#composeCcRow").hidden = !next;
    $("#composeBccRow").hidden = !next;
    if (next) $("#composeCc").focus();
  };
  // 插入签名：光标处插入设置里的签名（不是重复追加）
  $("#btnInsertSignature").onclick = () => {
    if (!state.signature) {
      $("#composeHint").textContent = "还没有设置签名：在「设置 → 邮件签名」里添加";
      return;
    }
    const body = $("#composeBody");
    const sig = "\n\n--\n" + state.signature;
    if (body.value.includes(state.signature)) {
      $("#composeHint").textContent = "正文里已经有签名了";
      return;
    }
    body.value += sig;
    body.focus();
    body.setSelectionRange(body.value.length, body.value.length);
    updateComposeCount();
    $("#composeHint").textContent = "";
  };
  // 引用原文：把被回复/转发邮件的正文作为引用块插入
  $("#btnInsertQuote").onclick = () => {
    if (!composeCtx.quote) return;
    const body = $("#composeBody");
    if (body.value.includes(composeCtx.quote.slice(0, 24))) {
      $("#composeHint").textContent = "正文里已经引用了原文";
      return;
    }
    body.value += "\n\n" + composeCtx.quote;
    body.focus();
    body.setSelectionRange(body.value.length, body.value.length);
    updateComposeCount();
    $("#composeHint").textContent = "";
  };
  $("#composeBody").addEventListener("input", updateComposeCount);

  $("#btnCompose").onclick = () => {
    closeSidebar();
    openCompose();
  };
  $("#btnComposeFab").onclick = () => openCompose();
  $("#btnCloseCompose").onclick = () => {
    if (composeSnapshot("drafts")) {
      save();
      toast("已存入草稿");
      renderAll();
    }
    closeCompose();
  };
  $("#btnSaveDraft").onclick = () => {
    if (composeSnapshot("drafts")) {
      save();
      closeCompose();
      renderAll();
      toast("已存入草稿");
    } else $("#composeHint").textContent = "还没写内容";
  };
  // 丢弃：不保存直接关闭
  $("#btnDiscard").onclick = () => {
    closeCompose();
    toast("已丢弃这封邮件");
  };
  $("#btnSend").onclick = async () => {
    const to = $("#composeTo").value.trim();
    if (!to) {
      $("#composeHint").textContent = "先填收件人";
      return;
    }
    const subject = $("#composeSubject").value.trim(),
      bodyText = $("#composeBody").value,
      cc = $("#composeCc").value.trim(),
      bcc = $("#composeBcc").value.trim();
    if (ui.mode === "live") {
      const btn = $("#btnSend");
      const t = composeTarget();
      const svc = svcOf(t.provider);
      if (!svc) {
        $("#composeHint").textContent = "发送失败：未登录该账号";
        return;
      }
      btn.disabled = true;
      btn.textContent = "发送中…";
      try {
        await svc.send({ to, cc, bcc, subject, body: bodyText });
        pushMail(
          {
            to,
            cc,
            subject: subject || "（无主题）",
            snippet: bodyText.trim().slice(0, 60),
            body: bodyText.split(/\n{2,}/).filter(Boolean),
            folder: "sent",
            provider: t.provider,
            bodyLoaded: true,
          },
          t.store
        );
        closeCompose();
        renderAll();
        toast(t.provider === "outlook" ? "已通过 Outlook 发送" : "已通过 Gmail 发送");
      } catch (e) {
        $("#composeHint").textContent = "发送失败：" + e.message;
      }
      btn.disabled = false;
      btn.textContent = "发送";
      return;
    }
    composeSnapshot("sent");
    save();
    closeCompose();
    renderAll();
    toast("已发送（演示，不会真的发出）");
  };
  // 暴露给全局（原 app.js 的内联调用）
  window.__mymailOpenCompose = openCompose;
  // 供模块级 renderReading 使用（回复 / 转发按钮）
  openComposeRef = openCompose;

  /* ---------------- 统计弹窗 ---------------- */
  function renderStats() {
    const all = src().filter((m) => m.folder !== "trash" && m.folder !== "spam");
    const bySender = new Map();
    for (const m of all) {
      const key = m.address || m.from;
      const cur = bySender.get(key) || { name: m.from, addr: key, count: 0, unread: 0 };
      cur.count++;
      if (m.unread) cur.unread++;
      bySender.set(key, cur);
    }
    const top = [...bySender.values()].sort((a, b) => b.count - a.count).slice(0, 12);
    const unreadTotal = all.filter((m) => m.unread).length;
    const attTotal = all.filter((m) => (m.attachments && m.attachments.length) || m.hasAttachments).length;
    $("#statsSummary").textContent =
      `已加载 ${all.length} 封 · 未读 ${unreadTotal} 封 · 带附件 ${attTotal} 封 · 发件人共 ${bySender.size} 个`;
    const ul = $("#statsList");
    if (!top.length) {
      ul.innerHTML = '<li class="stats-empty">暂无数据</li>';
      return;
    }
    ul.innerHTML = top
      .map(
        (t) =>
          `<li><button type="button" class="stats-row" data-addr="${esc(t.addr)}" aria-label="筛选发件人 ${esc(t.name)}"><span class="stats-name">${esc(t.name)}</span><span class="stats-meta">${esc(t.addr)}</span><span class="stats-count">${t.count} 封${t.unread ? ` · 未读 ${t.unread}` : ""}</span></button></li>`
      )
      .join("");
    ul.querySelectorAll("[data-addr]").forEach(
      (b) =>
        (b.onclick = () => {
          ui.searchQuery = b.dataset.addr;
          const si = $("#searchInput");
          si.value = ui.searchQuery;
          $("#btnClearSearch").hidden = false;
          $("#statsModal").hidden = true;
          $("#statsModal").setAttribute("aria-hidden", "true");
          releaseTrap();
          invalidateVisible();
          renderList();
        })
    );
  }
  $("#btnStats").onclick = () => {
    closeSidebar();
    renderStats();
    $("#statsModal").hidden = false;
    $("#statsModal").setAttribute("aria-hidden", "false");
    trapFocus($("#statsModal"));
  };
  $("#btnCloseStats").onclick = () => {
    $("#statsModal").hidden = true;
    $("#statsModal").setAttribute("aria-hidden", "true");
    releaseTrap();
  };

  $("#btnSettings").onclick = () => {
    handlers.renderRules();
    closeSidebar();
    $("#settingLang").value = state.lang;
    $("#settingTheme").value = state.themeMode;
    const d = $("#settingDensity");
    if (d) d.value = state.density || "comfortable";
    $("#settingAutoRead").checked = state.autoRead !== false;
    $("#settingShortcuts").checked = state.shortcuts !== false;
    $("#settingFetchCount").value = String(state.fetchCount || 40);
    $("#settingDefaultAccount").value = state.defaultAccount || "auto";
    $("#settingSignature").value = state.signature || "";
    $("#settingsModal").hidden = false;
    $("#settingsModal").setAttribute("aria-hidden", "false");
    trapFocus($("#settingsModal"));
  };
  const densitySel = $("#settingDensity");
  if (densitySel)
    densitySel.onchange = (e) => {
      state.density = e.target.value;
      saveSync();
      applyDensity();
    };
  $("#btnCloseSettings").onclick = () => {
    $("#settingsModal").hidden = true;
    $("#settingsModal").setAttribute("aria-hidden", "true");
    releaseTrap();
  };
  $("#settingLang").onchange = (e) => {
    state.lang = e.target.value;
    saveSync();
    renderReading();
  };
  $("#settingAutoRead").onchange = (e) => {
    state.autoRead = e.target.checked;
    saveSync();
    toast(state.autoRead ? "打开邮件会自动标为已读" : "打开邮件不再自动标已读");
  };
  $("#settingShortcuts").onchange = (e) => {
    state.shortcuts = e.target.checked;
    saveSync();
    toast(state.shortcuts ? "快捷键已开启" : "快捷键已关闭");
  };
  $("#settingFetchCount").onchange = (e) => {
    state.fetchCount = Number(e.target.value) || 40;
    window.MyMailFetchCount = state.fetchCount;
    saveSync();
    toast("拉取数量已设为 " + state.fetchCount + " 封（下次打开或重新拉取时生效）");
  };
  $("#settingDefaultAccount").onchange = (e) => {
    state.defaultAccount = e.target.value;
    saveSync();
  };
  $("#settingSignature").oninput = debounce((e) => {
    state.signature = e.target.value;
    saveSync();
  }, 400);
  $("#settingTheme").onchange = (e) => {
    state.themeMode = e.target.value;
    saveSync();
    applyTheme();
  };
  $("#btnResetData").onclick = resetData;
  // 点遮罩关闭：hidden 与 aria-hidden 必须同步，否则屏幕阅读器仍认为弹窗存在
  document.querySelectorAll(".modal-backdrop").forEach((bd) =>
    bd.addEventListener("click", (e) => {
      if (e.target === bd) {
        bd.hidden = true;
        bd.setAttribute("aria-hidden", "true");
        releaseTrap();
      }
    })
  );

  // 焦点陷阱（弹窗内 Tab 循环）
  let trapHandler = null;
  function trapFocus(container) {
    releaseTrap();
    if (container.id === "composeModal" && composeMode !== "fullscreen") {
      return;
    }
    const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    trapHandler = (e) => {
      if (e.key !== "Tab") return;
      const focusables = [...container.querySelectorAll(sel)].filter(
        (el) => !el.hidden && !el.disabled && el.offsetParent !== null
      );
      if (!focusables.length) return;
      const first = focusables[0],
        last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", trapHandler);
    container._trapHandler = trapHandler;
  }
  function releaseTrap() {
    document.querySelectorAll(".modal-backdrop").forEach((bd) => {
      if (bd._trapHandler) {
        bd.removeEventListener("keydown", bd._trapHandler);
        bd._trapHandler = null;
      }
    });
  }

  // Esc / 快捷键（避免与输入框冲突）
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("#composeModal").hidden) {
        closeCompose();
        return;
      }
      if (!$("#settingsModal").hidden) {
        $("#settingsModal").hidden = true;
        $("#settingsModal").setAttribute("aria-hidden", "true");
        releaseTrap();
        return;
      }
      if (!$("#statsModal").hidden) {
        $("#statsModal").hidden = true;
        $("#statsModal").setAttribute("aria-hidden", "true");
        releaseTrap();
        return;
      }
      document.querySelectorAll(".dropdown").forEach((d) => {
        d.hidden = true;
        d.setAttribute("aria-hidden", "true");
      });
      closeSidebar();
      document.querySelector(".app").classList.remove("reading-open");
      return;
    }
    if (!$("#composeModal").hidden && composeMode === "fullscreen") return;
    if (!$("#settingsModal").hidden) return;
    if (e.target.matches("input, textarea, select")) return;
    if (state.shortcuts === false) return;
    if (e.key === "j") stepSelection(1);
    if (e.key === "k") stepSelection(-1);
    if (e.key === "e") actOnSelected("archive");
    if (e.key === "#") actOnSelected("trash");
    if (e.key === "r") {
      const b = $("#btnReply");
      if (b && ui.selectedId) b.click();
    }
    if (e.key === "u") {
      // 新增：u 返回列表（Gmail 习惯）
      document.querySelector(".app").classList.remove("reading-open");
    }
    if (e.key === "s" && !e.ctrlKey && !e.metaKey) {
      // s 加星
      const m = byId(ui.selectedId);
      if (m) {
        m.starred = !m.starred;
        save();
        renderAll();
      }
    }
  });

  /* 主题按钮 */
  $("#btnTheme").onclick = () => {
    state.themeMode = state.themeMode === "auto" ? "light" : state.themeMode === "light" ? "dark" : "auto";
    saveSync();
    applyTheme();
    toast(
      "主题已切换：" +
        (state.themeMode === "dark" ? "黑夜" : state.themeMode === "light" ? "白天" : "跟随系统")
    );
  };

  // 登录 / 侧栏账号按钮（委托给 handlers，由 app-init 注入具体实现）
  $("#btnGoogleLogin").onclick = () => doGoogleLogin();
  $("#btnMsLogin").onclick = () => doMsLogin();
  $("#btnDemoEnter").onclick = () => {
    // 记住「用户主动选择了演示模式」，刷新后不再强制弹登录页
    state.demoChosen = true;
    saveSync();
    handlers.hideLogin();
    setView("demo");
    toast("演示模式：数据为虚构示例");
  };
  $("#btnAuth").onclick = () => {
    closeSidebar();
    handlers.handleAuthGmailToggle();
  };
  $("#btnAuthMs").onclick = () => {
    closeSidebar();
    handlers.handleAuthMsToggle();
  };
  $("#btnAuthG2").onclick = () => {
    closeSidebar();
    handlers.handleAuthG2Toggle();
  };
  $("#accountSwitch").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-view]");
    if (chip) {
      closeSidebar();
      setView(chip.dataset.view);
    }
  });

  function applyDensity() {
    document.body.classList.toggle("density-compact", state.density === "compact");
  }

  // 初始化 UI
  hydrateIcons();
  applyTheme();
  applyDensity();
  // 恢复上次的侧栏折叠状态（仅宽屏生效；窄屏一律走抽屉）
  if (state.sidebarCollapsed) document.querySelector(".app").classList.add("sidebar-collapsed");
  syncMenuButton();
  updateSidebarToggleUI();
}

// 暴露给 app-init.js
// 注意：renderAll / select / visibleEmails 已在上方以 export function 声明导出，
// 此处若再次列出会触发 "Duplicate export" 语法错误，导致整个模块加载失败。
export { hydrateIcons, applyTheme, renderNav, renderList, renderReading, invalidateVisible, ICONS };
