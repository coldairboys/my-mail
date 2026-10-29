/* My Mail · 邮件动作：选择、翻页、删除/归档/星标等
   从 app-core.js 拆出。renderAll / renderList / renderReading 由 app-core 注入。 */
import { state, ui, accounts, byId, save, storeOf, svcOf } from "../store.js";
import { toast } from "./toast.js";
import { visibleEmails, invalidateVisible } from "../core/visible.js";
import { expandRenderLimitTo } from "./mail-list.js";
import { renderReading } from "./reading.js";

let actions = {};
export function bindActionHelpers({ renderAll, renderList, renderNav }) {
  actions = { renderAll, renderList, renderNav };
}

function renderAll() {
  if (actions.renderAll) actions.renderAll();
}

export function select(id, markRead = true, openReading = true) {
  ui.selectedId = id;
  ui.showTranslated = false;
  const m = byId(id);
  // 真实账号的列表邮件是 metadata 摘要（bodyLoaded=false）：点开时补拉正文与附件
  if (m && !m.bodyLoaded && m.provider && accounts.get(m.provider)) {
    const svc = svcOf(m.provider);
    if (svc && svc.fetchFull) {
      svc
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
        .catch((err) => {
          // 加载失败时保留 bodyLoaded=false，允许用户再次点击重试
          m.bodyLoaded = false;
          toast("正文加载失败" + (err?.message ? `（${err.message}）` : "") + "，点击可重试", {
            label: "重试",
            fn: () => select(m.id, false, false),
          });
          if (ui.selectedId === m.id) {
            renderReading();
          }
        });
    }
  }
  const list = visibleEmails();
  const selIdx = list.findIndex((x) => x.id === id);
  expandRenderLimitTo(selIdx);
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
  if (actions.renderNav) actions.renderNav();
  if (actions.renderList) actions.renderList();
  renderReading();
  if (moveFocus) {
    const target = document.querySelector(`#mailList .mail-item[data-id="${CSS.escape(id)}"]`);
    if (target) target.focus({ preventScroll: true });
    else activeItem.blur();
  }
}

export function stepSelection(dir) {
  const list = visibleEmails();
  if (!list.length) return;
  let i = list.findIndex((m) => m.id === ui.selectedId);
  i = i < 0 ? 0 : Math.min(list.length - 1, Math.max(0, i + dir));
  if (list[i]) select(list[i].id);
}

export function trashMail(m, silent) {
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

export function actOnSelected(action) {
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
