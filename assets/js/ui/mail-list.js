/* My Mail · 邮件列表渲染（增量对比，避免搜索抖动时全量重绘闪烁）
   从 app-core.js 拆出。
   无障碍（Lighthouse 实测修复）：列表容器 role="listbox"、行 role="option"，
   aria-selected 只在 option 角色下合法（button 角色下读屏会报冲突），保留选中态语义。 */
import { state, ui } from "../store.js";
import { FOLDERS } from "../data.module.js";
import { esc, initialOf, colorOf } from "../utils.js";
import { $ } from "../core/dom.js";
import { ICONS } from "./icons.js";
import { visibleEmails, labelById, catOf, importantOf } from "../core/visible.js";

const CAT_NAMES = { promo: "推广", social: "社交", updates: "动态" };

/* 列表增量渲染：先渲染前 PAGE_SIZE 封，滚动接近底部时由 IntersectionObserver 追加。
   一次拉几百封（用户可调拉取数量）时避免全量重建 DOM 造成卡顿。 */
export const PAGE_SIZE = 60;
export let renderLimit = PAGE_SIZE;

let lastListIds = [];
let lastSelecting = null; // 多选开关会改变行内结构（勾选框），必须触发整表重建

/* 哨兵进入视口时追加下一页列表行（单例 observer，重渲染后重新挂到新哨兵上） */
let listIO = null;
function ensureListObserver() {
  if (listIO) return listIO;
  listIO = new IntersectionObserver(
    (entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      if (renderLimit >= visibleEmails().length) return;
      renderLimit += PAGE_SIZE;
      lastListIds = []; // 强制整表重建以追加新行
      renderList();
    },
    { rootMargin: "200px" } // 提前一点预加载，滚动不顿挫
  );
  return listIO;
}

export function expandRenderLimitTo(index) {
  // 键盘 j/k 可能跳到尚未渲染的分页行：把渲染上限扩到目标行所在页
  if (index >= renderLimit) {
    renderLimit = (Math.floor(index / PAGE_SIZE) + 1) * PAGE_SIZE;
    lastListIds = [];
  }
}

export function mailItemHtml(m) {
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
    `<li class="mail-item${m.unread ? " unread" : ""}${selected ? " selected" : ""}${checked ? " checked" : ""}" data-id="${esc(m.id)}" role="option" tabindex="0" aria-selected="${selected ? "true" : "false"}">` +
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

export function renderList() {
  const list = visibleEmails();
  const ids = list.map((m) => m.id).join(",");
  const idsChanged = ids !== lastListIds.join(",");
  // 进入/退出多选会改变每行的 DOM 结构（插入或移除 .row-check），
  // 只比较 id 会走原地 patch 分支，导致勾选框永远不出现。
  const needFullRebuild = idsChanged || ui.selecting !== lastSelecting;
  // 列表内容变化（切视图/搜索/翻页）时从头渲染前 PAGE_SIZE 封
  if (idsChanged) renderLimit = PAGE_SIZE;
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
    // 仍用 innerHTML 批量构建，但通过 ids 对比避免同列表内的无效重绘；
    // 超出 renderLimit 的行由哨兵元素触发增量追加
    const shown = list.slice(0, renderLimit);
    // role=listbox：让行上的 aria-selected 对读屏合法（option 角色）
    ul.setAttribute("role", "listbox");
    ul.setAttribute("aria-label", "邮件列表");
    ul.innerHTML =
      shown.map(mailItemHtml).join("") +
      (list.length > shown.length
        ? '<li class="list-sentinel" aria-hidden="true"><span class="list-sentinel-spinner"></span></li>'
        : "");
    const sentinel = ul.querySelector(".list-sentinel");
    if (sentinel) ensureListObserver().observe(sentinel);
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
  return list;
}
