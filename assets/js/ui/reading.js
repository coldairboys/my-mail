/* My Mail · 阅读区渲染（含翻译、快捷回复、附件下载、沙箱 iframe 正文）
   从 app-core.js 拆出。写信窗入口由 app-core 的 bindEvents 注入（openComposeRef）。 */
import { state, ui, byId, save, saveSync, storeOf, svcOf } from "../store.js";
import { esc, initialOf, colorOf, fmtSize } from "../utils.js";
import { translateParagraphs } from "../translate.js";
import { $ } from "../core/dom.js";
import { ICONS } from "./icons.js";
import { toast } from "./toast.js";
import { pushMail } from "../core/mail-ops.js";
import { visibleEmails, catOf, importantOf } from "../core/visible.js";

/* renderAll 由 app-core 编排；阅读区内部动作（星标/翻译/发送）通过回调触发，
   由 app-core 的 bindEvents 注入，避免模块间循环依赖。 */
let rerenderAll = null;
export function setRerenderAll(fn) {
  rerenderAll = fn;
}
function renderAll() {
  if (rerenderAll) rerenderAll();
}
const CAT_NAMES = { promo: "推广", social: "社交", updates: "动态" };

/* 写信入口的模块级引用。
   openCompose 定义在 bindEvents 内部（它依赖同作用域的 trapFocus / releaseTrap），
   而 renderReading 是模块级函数，直接引用会抛 "openCompose is not defined"，
   导致阅读区「回复 / 转发」按钮点了没反应。bindEvents 初始化时把函数赋给这个引用。 */
let openComposeRef = null;

export function setOpenComposeRef(fn) {
  openComposeRef = fn;
}

function updatePager(list = visibleEmails()) {
  const i = list.findIndex((m) => m.id === ui.selectedId);
  $("#pagePos").textContent = i >= 0 ? `${i + 1} / ${list.length}` : "";
  $("#btnPrev").disabled = i <= 0;
  $("#btnNext").disabled = i < 0 || i >= list.length - 1;
}

export { updatePager };

export function renderReading() {
  const m = byId(ui.selectedId);
  const box = $("#readingContent");
  const pane = $(".reading-pane");
  if (!m) {
    box.innerHTML = "";
    $("#readingEmpty").hidden = false;
    if (pane) pane.classList.remove("has-email");
    updatePager();
    return;
  }
  $("#readingEmpty").hidden = true;
  if (pane) pane.classList.add("has-email");
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
    // 隐私提示：首次使用翻译功能时在 UI 提示一次，告知正文发送给第三方翻译服务（持久化）
    if (!state.translateNoticeShown) {
      state.translateNoticeShown = true;
      saveSync();
      toast("提示：翻译会把邮件正文发送给在线翻译服务（MyMemory，失败时兜底 Google）");
    }
    if (!m.bodyZh) {
      const btn = $("#btnTranslate");
      btn.textContent = "翻译中…";
      btn.disabled = true;
      try {
        m.bodyZh = await translateParagraphs(m.body, state.lang);
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
