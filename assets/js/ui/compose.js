/* My Mail · 写信窗（compose modal）：打开/关闭、模式切换、草稿快照、发送
   从 app-core.js 的 bindEvents 拆出。
   焦点陷阱 / renderAll / closeSidebar 由 app-core 的 bindComposeHelpers 注入，
   避免模块间循环依赖。 */
import { state, ui, accounts, save, saveSync, svcOf } from "../store.js";
import { esc } from "../utils.js";
import { $ } from "../core/dom.js";
import { ICONS } from "./icons.js";
import { toast } from "./toast.js";
import { pushMail } from "../core/mail-ops.js";

let helpers = {};
export function bindComposeHelpers({ trapFocus, releaseTrap, renderAll, closeSidebar }) {
  helpers = { trapFocus, releaseTrap, renderAll, closeSidebar };
}

function renderAll() {
  if (helpers.renderAll) helpers.renderAll();
}

let composeMode = state.composeWindowMode || "floating";
let composeCtx = { mode: "new", quote: null, from: "", subject: "" };
let prevFocus = null;

function updateComposeCount() {
  const el = $("#composeCount");
  const body = $("#composeBody");
  if (!el || !body) return;
  const chars = body.value.replace(/\s/g, "").length;
  el.textContent = chars ? chars + " 字" : "0 字";
}

export function getComposeMode() {
  return composeMode;
}

export function applyComposeMode(mode) {
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
    helpers.releaseTrap && helpers.releaseTrap();
  } else if (mode === "fullscreen" && !modal.hidden) {
    helpers.trapFocus && helpers.trapFocus(modal);
  }
}

export function openCompose(prefill = {}) {
  // 保存触发焦点，用于关闭后还原
  prevFocus = document.activeElement;
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
    helpers.trapFocus && helpers.trapFocus($("#composeModal"));
  }
}

export function closeCompose() {
  $("#composeModal").hidden = true;
  $("#composeModal").setAttribute("aria-hidden", "true");
  helpers.releaseTrap && helpers.releaseTrap();
  // 还原焦点
  if (prevFocus && prevFocus.focus)
    try {
      prevFocus.focus();
    } catch (e) {}
}

export function composeTarget() {
  const acc = $("#composeAccount") ? $("#composeAccount").value : "";
  if (acc === "gmail") return { store: accounts.get("gmail").emails, provider: "gmail" };
  if (acc === "gmail2") return { store: accounts.get("gmail2").emails, provider: "gmail2" };
  if (acc === "outlook") return { store: accounts.get("outlook").emails, provider: "outlook" };
  return { store: state.emails, provider: undefined };
}

export function composeSnapshot(folder) {
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

/* ---------- 写信窗事件绑定（由 app-core 的 bindEvents 调用一次） ---------- */
export function bindComposeEvents() {
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
    helpers.closeSidebar && helpers.closeSidebar();
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
}
