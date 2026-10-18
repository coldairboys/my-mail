/* My Mail · 应用逻辑（v2）
   - 状态存 localStorage（mymail-state-v2）：邮件、语言、主题模式、排序
   - 主题：auto 跟随系统（prefers-color-scheme），或手动白天/黑夜
   - 手机端：列表左滑删除（Gmail 式红色背景揭示 + 超过阈值松手删除，带撤销）
   - 工具栏：漏斗=筛选菜单，三个点=更多菜单，‹ ›=上一封/下一封 */

(function () {
  "use strict";

  const STORAGE_KEY = "mymail-state-v2";
  const $ = (sel) => document.querySelector(sel);

  /* ---------------- 图标（统一用内联 SVG，避免系统字体把符号渲染错） ---------------- */
  const P = (inner) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICONS = {
    inbox: P('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
    star: P('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
    flag: P('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'),
    tag: P('<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.2"/>'),
    users: P('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    bell: P('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
    clip: P('<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'),
    chart: P('<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>'),
    clock: P('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 13.5"/>'),
    edit: P('<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
    send: P('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>'),
    mail: P('<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/>'),
    spam: P('<circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/>'),
    trash: P('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>'),
    search: P('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>'),
    sliders: P('<line x1="4" y1="7" x2="20" y2="7"/><circle cx="9" cy="7" r="2.2"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="15" cy="17" r="2.2"/>'),
    filter: P('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'),
    more: P('<circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/>'),
    menu: P('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'),
    x: P('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    "chevron-left": P('<polyline points="15 18 9 12 15 6"/>'),
    "chevron-right": P('<polyline points="9 18 15 12 9 6"/>'),
    archive: P('<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/>'),
    sun: P('<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.9" y1="4.9" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.1" y2="19.1"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.9" y1="19.1" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.1" y2="4.9"/>'),
    moon: P('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),
    "theme-auto": P('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>'),
  };
  function hydrateIcons(root = document) {
    root.querySelectorAll("[data-icon]").forEach((el) => {
      const name = el.dataset.icon;
      if (ICONS[name]) el.innerHTML = ICONS[name];
    });
  }

  /* ---------------- 状态 ---------------- */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.emails)) return Object.assign({ lang: "zh", themeMode: "auto", sortDesc: true, density: "comfortable", rules: [] }, s);
      }
    } catch (e) { /* 存档损坏就重置 */ }
    return { emails: structuredClone(SEED_EMAILS), lang: "zh", themeMode: "auto", sortDesc: true, density: "comfortable", rules: [] };
  }
  const state = loadState();
  let mode = "demo";            // demo = 演示数据 | live = 任一真实账号
  let view = "demo";            // demo | gmail | outlook | unified（统一收件箱）
  let gmailEmails = [], outlookEmails = [];
  let gmailOn = false, outlookOn = false;
  let gmailProfile = null, outlookProfile = null;
  let liveNoticeShown = false;
  const src = () => view === "gmail" ? gmailEmails
    : view === "outlook" ? outlookEmails
    : view === "unified" ? [...gmailEmails, ...outlookEmails]
    : state.emails;
  const storeOf = (m) => (m && m.provider === "outlook") ? outlookEmails
    : (m && m.provider === "gmail") ? gmailEmails : state.emails;
  let currentFolder = "inbox";
  let currentLabel = null;
  let selectedId = null;
  let searchQuery = "";
  let filterMode = "all"; // all | unread | read | starred
  let showTranslated = false;

  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} };
  const labelById = (id) => LABELS.find((l) => l.id === id);
  const byId = (id) => src().find((m) => m.id === id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initialOf = (name) => (name || "?").trim().charAt(0).toUpperCase();
  const AVATAR_COLORS = ["#e8736a", "#f5a623", "#5aa2ff", "#7ed3a6", "#9b7ede", "#e87fb0", "#4db6c9"];
  function colorOf(name) { let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATAR_COLORS[h % AVATAR_COLORS.length]; }

  let toastTimer = null;
  function toast(msg, action) {
    $("#toastText").textContent = msg;
    const btn = $("#toastAction");
    if (action) { btn.hidden = false; btn.textContent = action.label; btn.onclick = () => { action.fn(); hideToast(); }; }
    else { btn.hidden = true; btn.onclick = null; }
    $("#toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 4200 : 2200);
  }
  function hideToast() { $("#toast").hidden = true; }

  /* ---------------- 主题 ---------------- */
  const mqDark = typeof matchMedia === "function"
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
    btn.title = "主题：" + (state.themeMode === "dark" ? "黑夜" : state.themeMode === "light" ? "白天" : "跟随系统") + "（点击切换）";
    const sel = $("#settingTheme");
    if (sel) sel.value = state.themeMode;
  }
  mqDark.addEventListener?.("change", () => { if (state.themeMode === "auto") applyTheme(); });
  $("#btnTheme").onclick = () => {
    state.themeMode = state.themeMode === "auto" ? "light" : state.themeMode === "light" ? "dark" : "auto";
    save(); applyTheme();
    toast("主题已切换：" + (state.themeMode === "dark" ? "黑夜" : state.themeMode === "light" ? "白天" : "跟随系统"));
  };

  /* ---------------- 筛选与排序 ---------------- */
  const CAT_OF_LABEL = { newsletter: "promo", bills: "updates", life: "social" };
  const CAT_NAMES = { promo: "推广", social: "社交", updates: "动态" };
  const catOf = (m) => m.category || CAT_OF_LABEL[m.label] || null;
  const importantOf = (m) => Boolean(m.important);
  const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : n > 1024 ? Math.round(n / 1024) + " KB" : (n || 0) + " B");

  function visibleEmails() {
    let list;
    if (currentLabel) list = src().filter((m) => m.label === currentLabel && m.folder !== "trash" && m.folder !== "spam");
    else if (currentFolder === "important") list = src().filter((m) => importantOf(m) && m.folder !== "trash" && m.folder !== "spam");
    else if (currentFolder.startsWith("cat-")) list = src().filter((m) => catOf(m) === currentFolder.slice(4) && m.folder === "inbox" && !m.archived);
    else if (currentFolder === "starred") list = src().filter((m) => m.starred && m.folder !== "trash");
    else if (currentFolder === "all") list = src().filter((m) => m.folder !== "trash" && m.folder !== "spam");
    else list = src().filter((m) => m.folder === currentFolder && !m.archived);

    if (filterMode === "unread") list = list.filter((m) => m.unread);
    if (filterMode === "read") list = list.filter((m) => !m.unread);
    if (filterMode === "starred") list = list.filter((m) => m.starred);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) => [m.from, m.address, m.subject, m.snippet, ...(m.body || [])].join(" ").toLowerCase().includes(q));
    }
    return list.slice().sort((a, b) => (state.sortDesc ? (b.ts || 0) - (a.ts || 0) : (a.ts || 0) - (b.ts || 0)));
  }
  function folderCount(fid) {
    if (fid === "important") return src().filter((m) => importantOf(m) && m.folder !== "trash" && m.folder !== "spam").length;
    if (fid.startsWith("cat-")) return src().filter((m) => catOf(m) === fid.slice(4) && m.folder === "inbox" && !m.archived).length;
    if (fid === "starred") return src().filter((m) => m.starred && m.folder !== "trash").length;
    if (fid === "all") return src().filter((m) => m.folder !== "trash" && m.folder !== "spam").length;
    if (fid === "inbox") return src().filter((m) => m.folder === "inbox" && !m.archived && m.unread).length;
    return src().filter((m) => m.folder === fid && !m.archived).length;
  }

  /* ---------------- 渲染 ---------------- */
  function renderNav() {
    $("#folderList").innerHTML = FOLDERS.map((f) => {
      const n = folderCount(f.id);
      return `<li class="${!currentLabel && currentFolder === f.id ? "active" : ""}" data-folder="${f.id}">
        <span class="nav-icon">${ICONS[f.icon] || ""}</span><span>${f.name}</span>
        ${n ? `<span class="nav-count">${n}</span>` : ""}</li>`;
    }).join("");
    $("#labelList").innerHTML = LABELS.map((l) => {
      const n = src().filter((m) => m.label === l.id && m.folder !== "trash" && m.folder !== "spam").length;
      return `<li class="${currentLabel === l.id ? "active" : ""}" data-label="${l.id}">
        <span class="label-dot" style="background:${l.color}"></span><span>${esc(l.name)}</span>
        ${n ? `<span class="nav-count">${n}</span>` : ""}</li>`;
    }).join("");
  }

  function renderList() {
    const list = visibleEmails();
    const title = currentLabel ? labelById(currentLabel).name : FOLDERS.find((f) => f.id === currentFolder).name;
    $("#currentFolderName").textContent = searchQuery ? `搜索：${searchQuery}` : title;
    $("#btnFilter").classList.toggle("on", filterMode !== "all");
    document.querySelectorAll("#filterMenu button").forEach((b) => b.classList.toggle("checked", b.dataset.filter === filterMode));
    $("#menuToggleSort").textContent = "排序：" + (state.sortDesc ? "最新在前" : "最早在前");
    const emptyBtn = $("#menuEmptyFolder");
    if (currentFolder === "trash" || currentFolder === "spam") {
      emptyBtn.hidden = false;
      emptyBtn.textContent = currentFolder === "trash" ? "清空废纸篓" : "清空垃圾邮件";
      emptyBtn.classList.add("danger");
    } else emptyBtn.hidden = true;

    $("#mailList").innerHTML = list.map((m) => {
      const lab = m.label ? labelById(m.label) : null;
      return `<li class="mail-item${m.unread ? " unread" : ""}${m.id === selectedId ? " selected" : ""}${selectedSet.has(m.id) ? " checked" : ""}" data-id="${m.id}">
        <div class="swipe-bg">${ICONS.trash}</div>
        <div class="mail-item-inner">
          ${selecting ? `<span class="row-check">${selectedSet.has(m.id) ? "☑" : "☐"}</span>` : ""}
          ${m.unread ? '<span class="unread-dot"></span>' : ""}
          <div class="mail-row-1">
            <span class="mail-from">${esc(m.from)}</span>
            <span class="row-star${m.starred ? " on" : ""}" data-star="${m.id}" title="星标">${m.starred ? "★" : "☆"}</span>
            <span class="mail-date">${esc(m.date)}</span>
          </div>
          <div class="mail-subject">${esc(m.subject)}</div>
          <div class="mail-snippet">${esc(m.snippet)}${lab ? `<span class="mail-tag">${esc(lab.name)}</span>` : ""}</div>
        </div>
      </li>`;
    }).join("");
    $("#listEmpty").hidden = list.length > 0;
    $("#listCount").textContent = list.length ? `共 ${list.length} 封` : "";
    const sa = $("#btnSearchAll");
    if (mode === "live" && searchQuery) { sa.hidden = false; sa.textContent = `在邮箱中搜索全部「${searchQuery}」`; }
    else sa.hidden = true;
    updateBatchBar();
    updatePager(list);
    return list;
  }
  function updateBatchBar() {
    const bar = $("#batchBar");
    bar.hidden = !(selecting && selectedSet.size > 0);
    $("#batchCount").textContent = `已选 ${selectedSet.size} 封`;
  }

  function updatePager(list = visibleEmails()) {
    const i = list.findIndex((m) => m.id === selectedId);
    $("#pagePos").textContent = i >= 0 ? `${i + 1} / ${list.length}` : "";
    $("#btnPrev").disabled = i <= 0;
    $("#btnNext").disabled = i < 0 || i >= list.length - 1;
  }

  function renderReading() {
    const m = byId(selectedId);
    const box = $("#readingContent");
    if (!m) { box.innerHTML = ""; $("#readingEmpty").hidden = false; updatePager(); return; }
    $("#readingEmpty").hidden = true;
    const body = showTranslated && m.bodyZh ? m.bodyZh : m.body;
    box.innerHTML = `
      <div class="reading-title-row">
        <h2 class="reading-title">${esc(m.subject)}</h2>
        <button class="star-btn${m.starred ? " starred" : ""}" id="btnStar" title="加星标">${m.starred ? "★" : "☆"}</button>
      </div>
      <div class="mail-meta">
        <div class="avatar" style="background:${colorOf(m.from)}">${esc(initialOf(m.from))}</div>
        <div>
          <div><span class="meta-from">${esc(m.from)}</span><span class="meta-addr">${esc(m.address)}</span>
          <span class="meta-unsub" id="btnUnsub">退订</span></div>
          <div class="meta-to">收件人：${esc(m.to)}${catOf(m) ? `<span class="cat-chip">${CAT_NAMES[catOf(m)]}</span>` : ""}${importantOf(m) ? '<span class="cat-chip imp">重要</span>' : ""}</div>
        </div>
        <div class="meta-date">${esc(m.time)}</div>
      </div>
      <div class="mail-actions-row">
        <button class="chip-btn primary" id="btnTranslate">${showTranslated ? "↩ 看原文" : "🌐 翻译成" + (state.lang === "zh" ? "中文" : "英文")}</button>
        <button class="chip-btn" id="btnReply">回复</button>
        <button class="chip-btn" id="btnForward">转发</button>
        <button class="chip-btn" id="btnShowImages">${m.showImages ? "隐藏图片" : "显示图片"}</button>
      </div>
      ${m.bodyHtml ? '<div class="mail-html-slot" id="htmlSlot"></div>' : `<div class="mail-body">${body.map((p) => `<p>${esc(p)}</p>`).join("")}</div>`}
      ${m.attachments && m.attachments.length ? `<div class="attach-block"><div class="attach-title">${ICONS.clip}<span>附件（${m.attachments.length}）</span></div><div class="attach-row">${m.attachments.map((at, i) => `<button class="attach-chip" data-att="${i}"><span class="attach-name">${esc(at.filename || "附件")}</span><span class="attach-size">${fmtSize(at.size)}</span></button>`).join("")}</div></div>` : ""}
      <div class="reading-actions">
        <button class="btn-primary" id="btnReply2">回复</button>
        <button class="btn-secondary" id="btnForward2">转发</button>
      </div>`;
    $("#btnStar").onclick = () => { m.starred = !m.starred; save(); renderAll(); };
    box.querySelectorAll("[data-att]").forEach((chip) => {
      chip.onclick = async () => {
        const at = m.attachments[Number(chip.dataset.att)];
        if (mode !== "live" || !at.attachmentId) { toast("演示附件仅作展示"); return; }
        chip.disabled = true;
        try {
          const data = await (m.provider === "outlook" ? window.MyMailOutlook : window.MyMailGmail).downloadAttachment(m.id, at.attachmentId);
          const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
          const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bytes], { type: at.mimeType || "application/octet-stream" }));
          const a = document.createElement("a");
          a.href = url; a.download = at.filename || "attachment";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
        } catch (e) { toast("附件下载失败：" + e.message); }
        chip.disabled = false;
      };
    });
    $("#btnTranslate").onclick = async () => {
      if (!m.bodyZh) {
        if (mode !== "live") { toast("这封邮件暂无译文"); return; }
        const btn = $("#btnTranslate");
        btn.textContent = "翻译中…"; btn.disabled = true;
        try {
          m.bodyZh = await window.MyMailGmail.translateParagraphs(m.body, state.lang);
        } catch (e) { toast("翻译失败：" + e.message); renderReading(); return; }
      }
      showTranslated = !showTranslated; renderReading();
    };
    const openReply = () => openCompose({ to: m.address, subject: "Re: " + m.subject, provider: m.provider });
    const openFwd = () => openCompose({ subject: "Fwd: " + m.subject, body: "\n\n—— 转发邮件 ——\n" + (m.body || []).join("\n") });
    $("#btnReply").onclick = openReply; $("#btnReply2").onclick = openReply;
    $("#btnForward").onclick = openFwd; $("#btnForward2").onclick = openFwd;
    $("#btnUnsub").onclick = () => {
      if (m.unsub) { window.open(m.unsub, "_blank", "noopener"); toast("已打开官方退订页"); }
      else if (mode === "live") toast("这封邮件没有提供退订链接");
      else toast("已退订（演示，不会真的发送）");
    };
    $("#btnShowImages").onclick = () => {
      if (!m.bodyHtml) { toast("这封是纯文本邮件，没有图片可切换"); return; }
      m.showImages = !m.showImages;
      renderReading();
      toast(m.showImages ? "已显示图片" : "已隐藏图片（默认隐藏可防邮件追踪）");
    };
    const slot = $("#htmlSlot");
    if (slot && m.bodyHtml) {
      const ifr = document.createElement("iframe");
      ifr.className = "mail-html-frame";
      ifr.setAttribute("sandbox", "allow-same-origin allow-popups allow-popups-to-escape-sandbox");
      ifr.setAttribute("title", "邮件内容");
      let html = m.bodyHtml;
      if (!m.showImages) {
        html = html.replace(/<img([^>]*?)\ssrc\s*=/gi, "<img$1 data-blocked-src=")
                   .replace(/\ssrcset\s*=/gi, " data-blocked-srcset=")
                   .replace(/background\s*:\s*url\([^)]*\)/gi, "background:none");
      }
      const style = '<style>html,body{margin:0;padding:14px;font-family:-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:14px;line-height:1.65;color:#202124;background:#ffffff}img{max-width:100%!important;height:auto!important}table{max-width:100%!important}td,th{word-break:break-word}a{color:#1a73e8}</style><base target="_blank" rel="noopener">';
      if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (x) => x + style);
      else if (/<html[^>]*>/i.test(html)) html = html.replace(/<html[^>]*>/i, (x) => x + "<head>" + style + "</head>");
      else html = style + html;
      ifr.addEventListener("load", () => {
        try {
          const h = ifr.contentDocument && ifr.contentDocument.documentElement ? ifr.contentDocument.documentElement.scrollHeight : 0;
          if (h) ifr.style.height = Math.min(h + 4, 4000) + "px";
        } catch (e) {}
      });
      ifr.srcdoc = html;
      slot.appendChild(ifr);
    }
    updatePager();
  }

  function renderAll() { renderNav(); renderList(); renderReading(); }

  /* ---------------- 选择、翻页、动作 ---------------- */
  function select(id, markRead = true) {
    selectedId = id;
    showTranslated = false;
    const m = byId(id);
    if (m && m.provider === "outlook" && !m.bodyLoaded) {
      window.MyMailOutlook.fetchFull(m.id).then(({ body, bodyHtml, attachments }) => {
        m.body = body; m.bodyHtml = bodyHtml; m.attachments = attachments; m.bodyLoaded = true;
        if (selectedId === m.id) renderReading();
      }).catch(() => { m.bodyLoaded = true; });
    }
    if (m && markRead && m.unread) { m.unread = false; save(); }
    document.querySelector(".app").classList.add("reading-open");
    renderNav(); renderList(); renderReading();
  }
  function stepSelection(dir) {
    const list = visibleEmails();
    if (!list.length) return;
    let i = list.findIndex((m) => m.id === selectedId);
    i = i < 0 ? 0 : Math.min(list.length - 1, Math.max(0, i + dir));
    if (list[i]) select(list[i].id);
  }
  $("#btnPrev").onclick = () => stepSelection(-1);
  $("#btnNext").onclick = () => stepSelection(1);
  $("#btnBack").onclick = () => document.querySelector(".app").classList.remove("reading-open");

  function trashMail(m, silent) {
    const arr = storeOf(m);
    const snapshot = { folder: m.folder, archived: m.archived, index: arr.indexOf(m), removed: false };
    if (m.folder === "trash") {
      arr.splice(snapshot.index, 1);
      snapshot.removed = true;
      if (!silent) toast("已彻底删除", { label: "撤销", fn: () => { arr.splice(snapshot.index, 0, m); m.folder = "trash"; save(); renderAll(); } });
    } else {
      m.folder = "trash"; m.archived = false;
      if (!silent) toast("已移到废纸篓", { label: "撤销", fn: () => { m.folder = snapshot.folder; m.archived = snapshot.archived; save(); renderAll(); } });
    }
    if (selectedId === m.id) selectedId = null;
    save(); renderAll();
  }

  function actOnSelected(action) {
    const m = byId(selectedId);
    if (!m) { toast("先选一封邮件"); return; }
    if (mode === "live" && !liveNoticeShown) {
      liveNoticeShown = true;
      toast("真实模式下，管理动作只在本页内有效（只读+发送权限不能改 Gmail 服务器）");
    }
    if (action === "archive") { m.archived = true; selectedId = null; toast("已归档，在「所有邮件」里能找到"); }
    if (action === "snooze") { m.folder = "snoozed"; m.archived = false; selectedId = null; toast("已延后到明天"); }
    if (action === "spam") { m.folder = "spam"; m.archived = false; selectedId = null; toast("已标为垃圾邮件"); }
    if (action === "trash") { trashMail(m); return; }
    save(); renderAll();
  }
  document.querySelector(".reading-toolbar .toolbar-right").addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (b) actOnSelected(b.dataset.action);
  });

  /* ---------------- 左滑删除（指针事件，触摸和鼠标都生效） ---------------- */
  const selectedSet = new Set();
  let selecting = false;
  let swipe = null;         // {id, inner, bg, startX, startY, dx, active}
  let suppressClickUntil = 0;
  const listEl = $("#mailList");

  listEl.addEventListener("pointerdown", (e) => {
    const inner = e.target.closest(".mail-item-inner");
    if (!inner || e.button > 0) return;
    const li = inner.closest(".mail-item");
    swipe = { id: li.dataset.id, inner, bg: li.querySelector(".swipe-bg"), startX: e.clientX, startY: e.clientY, dx: 0, active: false };
  });
  listEl.addEventListener("pointermove", (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.startX, dy = e.clientY - swipe.startY;
    if (!swipe.active) {
      if (Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy) * 1.25 && dx < 0) {
        swipe.active = true;
        swipe.inner.classList.remove("anim");
        try { swipe.inner.setPointerCapture(e.pointerId); } catch (err) {}
      } else if (Math.abs(dy) > 9) { swipe = null; return; }
      else return;
    }
    swipe.dx = Math.max(-150, Math.min(0, dx));
    swipe.inner.style.transform = `translateX(${swipe.dx}px)`;
    swipe.bg.style.opacity = String(Math.min(1, -swipe.dx / 64));
  });
  function endSwipe(commit) {
    if (!swipe) return;
    const s = swipe; swipe = null;
    if (!s.active) return;
    suppressClickUntil = Date.now() + 350;
    s.inner.classList.add("anim");
    if (commit && s.dx < -92) {
      s.inner.style.transform = "translateX(-104%)";
      const m = byId(s.id);
      setTimeout(() => { if (m) trashMail(m); }, 170);
    } else {
      s.inner.style.transform = "";
      s.bg.style.opacity = "0";
      setTimeout(() => { s.inner.style.transform = ""; }, 200);
    }
  }
  listEl.addEventListener("pointerup", () => endSwipe(true));
  listEl.addEventListener("pointercancel", () => endSwipe(false));
  listEl.addEventListener("click", (e) => {
    if (Date.now() < suppressClickUntil) { e.stopPropagation(); e.preventDefault(); return; }
    const star = e.target.closest("[data-star]");
    if (star) {
      const m = byId(star.dataset.star);
      if (m) { m.starred = !m.starred; save(); renderNav(); renderList(); }
      return;
    }
    const li = e.target.closest("[data-id]");
    if (!li) return;
    if (selecting) {
      const id = li.dataset.id;
      selectedSet.has(id) ? selectedSet.delete(id) : selectedSet.add(id);
      renderList();
      return;
    }
    select(li.dataset.id);
  }, true);

  /* ---------------- 文件夹 / 标签 / 抽屉 ---------------- */
  function closeSidebar() {
    document.querySelector(".app").classList.remove("sidebar-open");
    $("#sidebarBackdrop").hidden = true;
  }
  $("#btnMenu").onclick = () => {
    document.querySelector(".app").classList.add("sidebar-open");
    $("#sidebarBackdrop").hidden = false;
  };
  $("#btnCloseSidebar").onclick = closeSidebar;
  $("#sidebarBackdrop").onclick = closeSidebar;
  $("#folderList").addEventListener("click", (e) => {
    const li = e.target.closest("[data-folder]");
    if (!li) return;
    currentFolder = li.dataset.folder; currentLabel = null; selectedId = null;
    document.querySelector(".app").classList.remove("reading-open");
    closeSidebar(); renderAll();
  });
  $("#labelList").addEventListener("click", (e) => {
    const li = e.target.closest("[data-label]");
    if (!li) return;
    currentLabel = li.dataset.label; selectedId = null;
    document.querySelector(".app").classList.remove("reading-open");
    closeSidebar(); renderAll();
  });

  /* ---------------- 搜索 ---------------- */
  const searchInput = $("#searchInput");
  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value.trim();
    $("#btnClearSearch").hidden = !searchQuery;
    renderList();
  });
  $("#btnClearSearch").onclick = () => { searchInput.value = ""; searchQuery = ""; $("#btnClearSearch").hidden = true; renderList(); };
  $("#btnFocusSearch").onclick = () => { closeSidebar(); searchInput.focus(); };

  /* ---------------- 下拉菜单：筛选 / 更多 ---------------- */
  function toggleMenu(id) {
    const menu = $(id);
    const willOpen = menu.hidden;
    document.querySelectorAll(".dropdown").forEach((d) => (d.hidden = true));
    menu.hidden = !willOpen;
  }
  $("#btnFilter").onclick = (e) => { e.stopPropagation(); toggleMenu("#filterMenu"); };
  $("#btnMore").onclick = (e) => { e.stopPropagation(); toggleMenu("#moreMenu"); };
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".menu-wrap")) document.querySelectorAll(".dropdown").forEach((d) => (d.hidden = true));
  });
  $("#filterMenu").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    filterMode = b.dataset.filter;
    $("#filterMenu").hidden = true;
    renderList();
    toast({ all: "显示全部邮件", unread: "只看未读", read: "只看已读", starred: "只看已加星标" }[filterMode]);
  });
  function markAllRead() {
    visibleEmails().forEach((m) => (m.unread = false));
    save(); renderAll(); toast("当前列表已全部标为已读");
  }
  function batchDone(msg) {
    const n = selectedSet.size;
    selectedSet.clear(); selecting = false;
    document.body.classList.remove("selecting");
    save(); renderAll();
    toast(msg.replace("{n}", n));
  }
  $("#batchArchive").onclick = () => { selectedSet.forEach((id) => { const m = byId(id); if (m && m.folder === "inbox") m.archived = true; }); batchDone("已归档 {n} 封"); };
  $("#batchRead").onclick = () => { selectedSet.forEach((id) => { const m = byId(id); if (m) m.unread = false; }); batchDone("已标已读 {n} 封"); };
  $("#batchTrash").onclick = () => { const ids = [...selectedSet]; ids.forEach((id) => { const m = byId(id); if (m) trashMail(m, true); }); selectedSet.clear(); selecting = false; document.body.classList.remove("selecting"); renderAll(); toast(`已删除 ${ids.length} 封（可逐封在废纸篓恢复）`); };
  $("#batchCancel").onclick = () => { selectedSet.clear(); selecting = false; document.body.classList.remove("selecting"); renderList(); };
  $("#menuSelectMode").onclick = () => {
    $("#moreMenu").hidden = true;
    selecting = !selecting;
    if (!selecting) selectedSet.clear();
    document.body.classList.toggle("selecting", selecting);
    renderList();
    toast(selecting ? "多选模式：点邮件行勾选" : "已退出多选");
  };
  $("#btnSearchAll").onclick = async () => {
    const btn = $("#btnSearchAll");
    btn.disabled = true; btn.textContent = "正在 Gmail 中搜索…";
    try {
      let added = 0;
      const jobs = [];
      if (view === "gmail" || view === "unified") jobs.push([G(), gmailEmails]);
      if (view === "outlook" || view === "unified") jobs.push([window.MyMailOutlook, outlookEmails]);
      for (const [svc, store] of jobs) {
        const found = await svc.searchAll(searchQuery);
        const map = new Map(store.map((m) => [m.id, m]));
        for (const em of found) if (!map.has(em.id)) { store.push(em); added++; }
      }
      renderAll();
      toast(added ? `从邮箱服务器找到并载入 ${added} 封` : "没有更多结果了");
    } catch (e) { toast("搜索失败：" + e.message); }
    btn.disabled = false;
  };
  $("#menuMarkAllRead").onclick = () => { $("#moreMenu").hidden = true; markAllRead(); };
  $("#menuToggleSort").onclick = () => {
    state.sortDesc = !state.sortDesc; save();
    $("#moreMenu").hidden = true; renderList();
    toast(state.sortDesc ? "排序：最新在前" : "排序：最早在前");
  };
  $("#menuEmptyFolder").onclick = () => {
    const fid = currentFolder;
    const stores = view === "unified" ? [gmailEmails, outlookEmails] : [src()];
    for (const arr of stores) arr.splice(0, arr.length, ...arr.filter((m) => m.folder !== fid));
    selectedId = null; save();
    $("#moreMenu").hidden = true; renderAll();
    toast(fid === "trash" ? "废纸篓已清空" : "垃圾邮件已清空");
  };
  function resetData() {
    if (view !== "demo") {
      const jobs = [];
      if (gmailOn) jobs.push(enterGmail(false));
      if (outlookOn) jobs.push(enterOutlook(false));
      Promise.all(jobs).then(() => { updateChrome(); renderAll(); toast("已重新拉取"); });
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    state.emails = structuredClone(SEED_EMAILS);
    selectedId = null; currentFolder = "inbox"; currentLabel = null; filterMode = "all";
    save(); renderAll(); toast("演示数据已恢复");
  }
  $("#menuResetData").onclick = () => { $("#moreMenu").hidden = true; resetData(); };

  /* ---------------- 写邮件 ---------------- */
  function openCompose(prefill = {}) {
    const accSel = $("#composeAccount");
    const opts = [];
    if (gmailOn) opts.push(["gmail", "Gmail · " + (gmailProfile.emailAddress || "")]);
    if (outlookOn) opts.push(["outlook", "Outlook · " + (outlookProfile.emailAddress || "")]);
    $("#composeAccountRow").hidden = opts.length === 0;
    accSel.innerHTML = opts.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("");
    if (prefill.provider && opts.some(([v]) => v === prefill.provider)) accSel.value = prefill.provider;
    else if (view === "gmail" || view === "outlook") accSel.value = view;
    const contacts = new Map();
    for (const m of [...state.emails, ...gmailEmails, ...outlookEmails]) {
      if (m.address) contacts.set(m.address, m.from);
      if (m.to && m.to.includes("@")) contacts.set(m.to, m.to);
    }
    $("#contactsList").innerHTML = [...contacts.entries()].map(([addr, name]) => `<option value="${esc(addr)}">${esc(name || "")}</option>`).join("");
    $("#composeTo").value = prefill.to || "";
    $("#composeSubject").value = prefill.subject || "";
    $("#composeBody").value = prefill.body || "";
    $("#composeHint").textContent = "";
    $("#composeModal").hidden = false;
    $("#composeTo").focus();
  }
  function closeCompose() { $("#composeModal").hidden = true; }
  function pushMail(partial, target) {
    (target || src()).unshift(Object.assign({
      id: "u" + Date.now(), ts: Date.now(), from: "我", address: "demo@mymail.app", to: "",
      date: "今天", time: "刚刚", subject: "（无主题）", snippet: "",
      label: null, unread: false, starred: false, folder: "sent", body: [], bodyZh: null,
    }, partial));
  }
  function composeTarget() {
    const acc = $("#composeAccount") ? $("#composeAccount").value : "";
    if (acc === "gmail") return { store: gmailEmails, provider: "gmail" };
    if (acc === "outlook") return { store: outlookEmails, provider: "outlook" };
    return { store: state.emails, provider: undefined };
  }
  function composeSnapshot(folder) {
    const to = $("#composeTo").value.trim(), subject = $("#composeSubject").value.trim(), bodyText = $("#composeBody").value;
    if (!to && !subject && !bodyText.trim()) return false;
    const t = composeTarget();
    pushMail({ to: to || "（未填收件人）", subject: subject || "（无主题）", snippet: bodyText.trim().slice(0, 60), body: bodyText.split(/\n{2,}/).filter(Boolean), folder, provider: t.provider, bodyLoaded: true }, t.store);
    return true;
  }
  $("#btnCompose").onclick = () => { closeSidebar(); openCompose(); };
  $("#btnComposeFab").onclick = () => openCompose();
  $("#btnCloseCompose").onclick = () => { if (composeSnapshot("drafts")) { save(); toast("已存入草稿"); renderAll(); } closeCompose(); };
  $("#btnSaveDraft").onclick = () => { if (composeSnapshot("drafts")) { save(); closeCompose(); renderAll(); toast("已存入草稿"); } else $("#composeHint").textContent = "还没写内容"; };
  $("#btnSend").onclick = async () => {
    const to = $("#composeTo").value.trim();
    if (!to) { $("#composeHint").textContent = "先填收件人"; return; }
    const subject = $("#composeSubject").value.trim(), bodyText = $("#composeBody").value;
    if (mode === "live") {
      const btn = $("#btnSend");
      const t = composeTarget();
      const svc = t.provider === "outlook" ? window.MyMailOutlook : window.MyMailGmail;
      btn.disabled = true; btn.textContent = "发送中…";
      try {
        await svc.send({ to, subject, body: bodyText });
        pushMail({ to, subject: subject || "（无主题）", snippet: bodyText.trim().slice(0, 60), body: bodyText.split(/\n{2,}/).filter(Boolean), folder: "sent", provider: t.provider, bodyLoaded: true }, t.store);
        closeCompose(); renderAll(); toast(t.provider === "outlook" ? "已通过 Outlook 发送" : "已通过 Gmail 发送");
      } catch (e) { $("#composeHint").textContent = "发送失败：" + e.message; }
      btn.disabled = false; btn.textContent = "发送";
      return;
    }
    composeSnapshot("sent"); save(); closeCompose(); renderAll(); toast("已发送（演示，不会真的发出）");
  };

  /* ---------------- 设置 ---------------- */
  function renderStats() {
    const all = src().filter((m) => m.folder !== "trash" && m.folder !== "spam");
    const bySender = new Map();
    for (const m of all) {
      const key = m.address || m.from;
      const cur = bySender.get(key) || { name: m.from, addr: key, count: 0, unread: 0 };
      cur.count++; if (m.unread) cur.unread++;
      bySender.set(key, cur);
    }
    const top = [...bySender.values()].sort((a, b) => b.count - a.count).slice(0, 12);
    const unreadTotal = all.filter((m) => m.unread).length;
    const attTotal = all.filter((m) => (m.attachments && m.attachments.length) || m.hasAttachments).length;
    $("#statsSummary").textContent = `已加载 ${all.length} 封 · 未读 ${unreadTotal} 封 · 带附件 ${attTotal} 封 · 发件人共 ${bySender.size} 个`;
    $("#statsList").innerHTML = top.map((t) =>
      `<li><button class="stats-row" data-addr="${esc(t.addr)}"><span class="stats-name">${esc(t.name)}</span><span class="stats-meta">${esc(t.addr)}</span><span class="stats-count">${t.count} 封${t.unread ? ` · 未读 ${t.unread}` : ""}</span></button></li>`).join("");
    $("#statsList").querySelectorAll("[data-addr]").forEach((b) => (b.onclick = () => {
      searchQuery = b.dataset.addr;
      const si = $("#searchInput"); si.value = searchQuery;
      $("#btnClearSearch").hidden = false;
      $("#statsModal").hidden = true;
      renderList();
    }));
  }
  $("#btnStats").onclick = () => { closeSidebar(); renderStats(); $("#statsModal").hidden = false; };
  $("#btnCloseStats").onclick = () => { $("#statsModal").hidden = true; };
  $("#btnSettings").onclick = () => { renderRules(); closeSidebar(); $("#settingLang").value = state.lang; $("#settingTheme").value = state.themeMode; const d = $("#settingDensity"); if (d) d.value = state.density || "comfortable"; $("#settingsModal").hidden = false; };
  const densitySel = $("#settingDensity");
  if (densitySel) densitySel.onchange = (e) => { state.density = e.target.value; save(); applyDensity(); };
  function applyDensity() { document.body.classList.toggle("density-compact", state.density === "compact"); }
  $("#btnCloseSettings").onclick = () => { $("#settingsModal").hidden = true; };
  $("#settingLang").onchange = (e) => { state.lang = e.target.value; save(); renderReading(); };
  $("#settingTheme").onchange = (e) => { state.themeMode = e.target.value; save(); applyTheme(); };
  $("#btnResetData").onclick = resetData;
  document.querySelectorAll(".modal-backdrop").forEach((bd) => bd.addEventListener("click", (e) => { if (e.target === bd) bd.hidden = true; }));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      $("#composeModal").hidden = true; $("#settingsModal").hidden = true;
      document.querySelectorAll(".dropdown").forEach((d) => (d.hidden = true));
      closeSidebar();
      document.querySelector(".app").classList.remove("reading-open");
    }
    if (!$("#composeModal").hidden || !$("#settingsModal").hidden) return;
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === "j") stepSelection(1);
    if (e.key === "k") stepSelection(-1);
    if (e.key === "e") actOnSelected("archive");
    if (e.key === "#") actOnSelected("trash");
    if (e.key === "r") { const b = $("#btnReply2"); if (b && selectedId) b.click(); }
  });

  /* ---------------- Gmail 登录 ---------------- */
  const G = () => window.MyMailGmail;
  function setAccountUI(name, mail, initial) {
    $("#accountName").textContent = name;
    $("#accountMail").textContent = mail;
    $("#accountAvatar").textContent = initial;
    $("#btnAuthText").textContent = mode === "live" ? "退出登录" : "登录 Gmail";
  }
  function showLogin(errorMsg) {
    $("#loginError").hidden = !errorMsg;
    if (errorMsg) $("#loginError").textContent = errorMsg;
    $("#loginConfigNote").hidden = G().configured();
    const mn = $("#loginMsNote"); if (mn) mn.hidden = !window.MyMailOutlook || window.MyMailOutlook.configured();
    $("#loginScreen").hidden = false;
  }
  function hideLogin() { $("#loginScreen").hidden = true; }
  /* ---------------- 过滤规则 ---------------- */
  const RULE_ACTIONS = { spam: "移到垃圾邮件", trash: "删除", archive: "归档", read: "标已读", star: "加星标" };
  function applyRules(list) {
    const rules = state.rules || [];
    if (!rules.length) return 0;
    let hit = 0;
    for (const m of list) for (const r of rules) {
      const hay = r.field === "subject" ? (m.subject || "") : ((m.from || "") + " " + (m.address || ""));
      if (r.kw && hay.toLowerCase().includes(String(r.kw).toLowerCase())) {
        hit++;
        if (r.action === "star") m.starred = true;
        else if (r.action === "read") m.unread = false;
        else if (r.action === "archive" && m.folder === "inbox") m.archived = true;
        else if (r.action === "spam") { m.folder = "spam"; m.archived = false; }
        else if (r.action === "trash") { m.folder = "trash"; m.archived = false; }
      }
    }
    return hit;
  }
  function renderRules() {
    const ul = $("#rulesList");
    if (!ul) return;
    const rules = state.rules || [];
    ul.innerHTML = rules.length ? rules.map((r, i) =>
      `<li><span>${r.field === "subject" ? "主题" : "发件人"}含「${esc(r.kw)}」→ ${RULE_ACTIONS[r.action] || r.action}</span><button class="rules-del" data-rule="${i}" title="删除规则">×</button></li>`).join("")
      : '<li class="rules-empty">暂无规则</li>';
    ul.querySelectorAll("[data-rule]").forEach((b) => (b.onclick = () => {
      state.rules.splice(Number(b.dataset.rule), 1); save(); renderRules(); toast("规则已删除");
    }));
  }
  $("#btnAddRule").onclick = () => {
    const kw = $("#ruleKeyword").value.trim();
    if (!kw) { toast("先填关键词"); return; }
    state.rules = state.rules || [];
    state.rules.push({ field: $("#ruleField").value, kw, action: $("#ruleAction").value });
    $("#ruleKeyword").value = "";
    save(); renderRules(); toast("规则已添加，下次加载邮箱时生效");
  };

  /* ---------------- 多账号 ---------------- */
  const MS = () => window.MyMailOutlook;
  function updateChrome() {
    let name = "Yangming", mail = "demo@mymail.app", init = "Y";
    if (view === "gmail" && gmailProfile) { mail = gmailProfile.emailAddress || ""; name = (mail.split("@")[0] || "Gmail"); init = initialOf(mail || "G"); }
    if (view === "outlook" && outlookProfile) { mail = outlookProfile.emailAddress || ""; name = (mail.split("@")[0] || "Outlook"); init = initialOf(mail || "O"); }
    if (view === "unified") { name = "全部账号"; mail = "Gmail + Outlook"; init = "全"; }
    setAccountUI(name, mail, init);
    $("#btnAuthText").textContent = gmailOn ? "退出 Gmail" : "登录 Gmail";
    $("#btnAuthMsText").textContent = outlookOn ? "退出 Outlook" : "登录 Outlook";
    mode = view === "demo" ? "demo" : "live";
    document.body.classList.toggle("live-mode", (gmailOn || outlookOn) && view !== "demo");
    const sw = $("#accountSwitch");
    if (!gmailOn && !outlookOn) sw.hidden = true;
    else {
      sw.hidden = false;
      const chips = [];
      if (gmailOn && outlookOn) chips.push(["unified", "全部"]);
      if (gmailOn) chips.push(["gmail", "Gmail"]);
      if (outlookOn) chips.push(["outlook", "Outlook"]);
      chips.push(["demo", "演示"]);
      sw.innerHTML = chips.map(([v, t]) => `<button class="account-chip${view === v ? " active" : ""}" data-view="${v}">${t}</button>`).join("");
    }
    const foot = document.querySelector(".sidebar-footer");
    if (view === "gmail" && gmailProfile) foot.innerHTML = '<span class="sync-dot"></span> 已同步 · ' + (gmailProfile.messagesTotal ? `邮箱共 ${gmailProfile.messagesTotal} 封 · ` : "") + 'Gmail 实时数据（不落盘）';
    else if (view === "outlook" && outlookProfile) foot.innerHTML = '<span class="sync-dot"></span> 已同步 · ' + (outlookProfile.messagesTotal ? `邮箱共 ${outlookProfile.messagesTotal} 封 · ` : "") + 'Outlook 实时数据（不落盘）';
    else if (view === "unified") foot.innerHTML = '<span class="sync-dot"></span> 已同步 · 统一收件箱（Gmail + Outlook，不落盘）';
    else foot.innerHTML = '<span class="sync-dot"></span> 已同步 · 演示数据';
    const sn = $("#settingsNote");
    if (sn) sn.textContent = view === "demo"
      ? "演示模式：数据只保存在本机浏览器（localStorage），为虚构示例邮件。"
      : "真实模式：邮件只在内存中显示、不落盘；令牌约 1 小时有效。只读+发送权限下，删除/归档仅在本页内生效；过滤规则在邮箱加载时自动执行。";
    const rl = $("#resetLabel"); if (rl) rl.textContent = view === "demo" ? "恢复演示数据" : "重新拉取当前邮箱";
    const rb = $("#btnResetData"); if (rb) rb.textContent = view === "demo" ? "恢复" : "拉取";
  }
  function setView(v) {
    view = v; selectedId = null; currentLabel = null;
    updateChrome(); renderAll();
    const f = visibleEmails()[0];
    if (f) select(f.id, false);
  }
  $("#accountSwitch").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-view]");
    if (chip) { closeSidebar(); setView(chip.dataset.view); }
  });
  async function enterGmail(switchTo = true) {
    toast("正在拉取你的 Gmail…");
    const { profile, emails } = await G().loadAll();
    gmailProfile = profile; gmailEmails = emails; gmailOn = true;
    const hit = applyRules(gmailEmails);
    if (switchTo) { currentFolder = "inbox"; setView("gmail"); } else { updateChrome(); renderAll(); }
    hideLogin();
    toast("已登录 Gmail：" + (profile.emailAddress || "") + (hit ? `（规则处理了 ${hit} 封）` : ""));
  }
  async function enterOutlook(switchTo = true) {
    toast("正在拉取你的 Outlook…");
    const { profile, emails } = await MS().loadAll();
    outlookProfile = profile; outlookEmails = emails; outlookOn = true;
    const hit = applyRules(outlookEmails);
    if (switchTo) { currentFolder = "inbox"; setView("outlook"); } else { updateChrome(); renderAll(); }
    hideLogin();
    toast("已登录 Outlook：" + (profile.emailAddress || "") + (hit ? `（规则处理了 ${hit} 封）` : ""));
  }
  function doGoogleLogin() {
    if (!G().configured()) { showLogin("尚未配置 Google Client ID（见 README 的接入步骤）"); return; }
    const btn = $("#btnGoogleLogin");
    btn.disabled = true; btn.textContent = "正在跳转到 Google 登录…";
    G().startRedirectLogin();
  }
  function doMsLogin() {
    if (!MS() || !MS().configured()) {
      showLogin();
      const n = $("#loginMsNote"); if (n) n.hidden = false;
      return;
    }
    const btn = $("#btnMsLogin");
    btn.disabled = true; btn.textContent = "正在跳转到微软登录…";
    MS().startRedirectLogin();
  }
  $("#btnGoogleLogin").onclick = doGoogleLogin;
  $("#btnMsLogin").onclick = doMsLogin;
  $("#btnDemoEnter").onclick = () => { hideLogin(); setView("demo"); toast("演示模式：数据为虚构示例"); };
  $("#btnAuth").onclick = () => {
    closeSidebar();
    if (!gmailOn) { showLogin(); return; }
    G().clearToken(); gmailOn = false; gmailEmails = []; gmailProfile = null;
    if (view === "gmail" || view === "unified") setView(outlookOn ? "outlook" : "demo");
    else { updateChrome(); renderAll(); }
    toast("已退出 Gmail");
  };
  $("#btnAuthMs").onclick = () => {
    closeSidebar();
    if (!outlookOn) { doMsLogin(); return; }
    MS().clearToken(); outlookOn = false; outlookEmails = []; outlookProfile = null;
    if (view === "outlook" || view === "unified") setView(gmailOn ? "gmail" : "demo");
    else { updateChrome(); renderAll(); }
    toast("已退出 Outlook");
  };

  /* ---------------- 启动 ---------------- */
  hydrateIcons();
  applyTheme();
  applyDensity();
  save();
  renderAll();
  const first = visibleEmails()[0];
  if (first) select(first.id, false);
  (async function initAuth() {
    const ms = window.MyMailOutlook;
    if (ms && ms.configured()) {
      let res = null;
      try { res = await ms.consumeRedirectCode(); } catch (e) {}
      if (res && res.ok) { try { await enterOutlook(); } catch (e) { showLogin("Outlook 拉取失败：" + e.message); } return; }
      if (res && res.error) { showLogin("Outlook 登录失败：" + res.error); return; }
      if (ms.getStoredToken()) { try { await enterOutlook(false); } catch (e) {} }
    }
    if (G().configured()) {
      const oauthErr = G().consumeRedirectError();
      if (oauthErr) { showLogin("Google 授权未完成：" + oauthErr + "（请重新点登录，并在验证页点左侧小字「继续」、权限页点「继续/允许」，不要点『返回到安全网页』）"); return; }
      if (G().consumeRedirectToken()) {
        try {
          await enterGmail(false);
          setView(outlookOn ? "unified" : "gmail");
        } catch (e) { showLogin("拉取邮件失败，请重新登录"); }
        return;
      }
      if (G().getStoredToken()) {
        try {
          await enterGmail(false);
          setView(outlookOn ? "unified" : "gmail");
        } catch (e) { showLogin("会话已过期，请重新登录"); }
        return;
      }
      if (outlookOn) { setView("outlook"); return; }
      showLogin();
    } else if (outlookOn) setView("outlook");
  })();
})();
