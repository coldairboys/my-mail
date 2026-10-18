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
        if (Array.isArray(s.emails)) return Object.assign({ lang: "zh", themeMode: "auto", sortDesc: true }, s);
      }
    } catch (e) { /* 存档损坏就重置 */ }
    return { emails: structuredClone(SEED_EMAILS), lang: "zh", themeMode: "auto", sortDesc: true };
  }
  const state = loadState();
  let mode = "demo";            // demo = 演示数据 | live = 真实 Gmail（内存，不落盘）
  let liveEmails = [];
  let gmailProfile = null;
  let liveNoticeShown = false;
  const src = () => (mode === "live" ? liveEmails : state.emails);
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
  function visibleEmails() {
    let list;
    if (currentLabel) list = src().filter((m) => m.label === currentLabel && m.folder !== "trash" && m.folder !== "spam");
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
      return `<li class="mail-item${m.unread ? " unread" : ""}${m.id === selectedId ? " selected" : ""}" data-id="${m.id}">
        <div class="swipe-bg">${ICONS.trash}</div>
        <div class="mail-item-inner">
          ${m.unread ? '<span class="unread-dot"></span>' : ""}
          <div class="mail-row-1">
            <span class="mail-from">${esc(m.from)}${m.starred ? '<span class="mail-star">★</span>' : ""}</span>
            <span class="mail-date">${esc(m.date)}</span>
          </div>
          <div class="mail-subject">${esc(m.subject)}</div>
          <div class="mail-snippet">${esc(m.snippet)}${lab ? `<span class="mail-tag">${esc(lab.name)}</span>` : ""}</div>
        </div>
      </li>`;
    }).join("");
    $("#listEmpty").hidden = list.length > 0;
    updatePager(list);
    return list;
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
          <div class="meta-to">收件人：${esc(m.to)}</div>
        </div>
        <div class="meta-date">${esc(m.time)}</div>
      </div>
      <div class="mail-actions-row">
        <button class="chip-btn primary" id="btnTranslate">${showTranslated ? "↩ 看原文" : "🌐 翻译成" + (state.lang === "zh" ? "中文" : "英文")}</button>
        <button class="chip-btn" id="btnReply">回复</button>
        <button class="chip-btn" id="btnForward">转发</button>
        <button class="chip-btn" id="btnShowImages">显示图片</button>
      </div>
      <div class="mail-body">${body.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
      <div class="reading-actions">
        <button class="btn-primary" id="btnReply2">回复</button>
        <button class="btn-secondary" id="btnForward2">转发</button>
      </div>`;
    $("#btnStar").onclick = () => { m.starred = !m.starred; save(); renderAll(); };
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
    const openReply = () => openCompose({ to: m.address, subject: "Re: " + m.subject });
    const openFwd = () => openCompose({ subject: "Fwd: " + m.subject, body: "\n\n—— 转发邮件 ——\n" + (m.body || []).join("\n") });
    $("#btnReply").onclick = openReply; $("#btnReply2").onclick = openReply;
    $("#btnForward").onclick = openFwd; $("#btnForward2").onclick = openFwd;
    $("#btnUnsub").onclick = () => toast("已退订（演示，不会真的发送）");
    $("#btnShowImages").onclick = () => toast("已显示此发件人的图片（演示）");
    updatePager();
  }

  function renderAll() { renderNav(); renderList(); renderReading(); }

  /* ---------------- 选择、翻页、动作 ---------------- */
  function select(id, markRead = true) {
    selectedId = id;
    showTranslated = false;
    const m = byId(id);
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
    const arr = src();
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
    const li = e.target.closest("[data-id]");
    if (li) select(li.dataset.id);
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
  $("#menuMarkAllRead").onclick = () => { $("#moreMenu").hidden = true; markAllRead(); };
  $("#menuToggleSort").onclick = () => {
    state.sortDesc = !state.sortDesc; save();
    $("#moreMenu").hidden = true; renderList();
    toast(state.sortDesc ? "排序：最新在前" : "排序：最早在前");
  };
  $("#menuEmptyFolder").onclick = () => {
    const fid = currentFolder;
    const arr = src();
    arr.splice(0, arr.length, ...arr.filter((m) => m.folder !== fid));
    selectedId = null; save();
    $("#moreMenu").hidden = true; renderAll();
    toast(fid === "trash" ? "废纸篓已清空" : "垃圾邮件已清空");
  };
  function resetData() {
    if (mode === "live") { enterLive(); toast("已重新从 Gmail 拉取"); return; }
    localStorage.removeItem(STORAGE_KEY);
    state.emails = structuredClone(SEED_EMAILS);
    selectedId = null; currentFolder = "inbox"; currentLabel = null; filterMode = "all";
    save(); renderAll(); toast("演示数据已恢复");
  }
  $("#menuResetData").onclick = () => { $("#moreMenu").hidden = true; resetData(); };

  /* ---------------- 写邮件 ---------------- */
  function openCompose(prefill = {}) {
    $("#composeTo").value = prefill.to || "";
    $("#composeSubject").value = prefill.subject || "";
    $("#composeBody").value = prefill.body || "";
    $("#composeHint").textContent = "";
    $("#composeModal").hidden = false;
    $("#composeTo").focus();
  }
  function closeCompose() { $("#composeModal").hidden = true; }
  function pushMail(partial) {
    src().unshift(Object.assign({
      id: "u" + Date.now(), ts: Date.now(), from: "我", address: "demo@mymail.app", to: "",
      date: "今天", time: "刚刚", subject: "（无主题）", snippet: "",
      label: null, unread: false, starred: false, folder: "sent", body: [], bodyZh: null,
    }, partial));
  }
  function composeSnapshot(folder) {
    const to = $("#composeTo").value.trim(), subject = $("#composeSubject").value.trim(), bodyText = $("#composeBody").value;
    if (!to && !subject && !bodyText.trim()) return false;
    pushMail({ to: to || "（未填收件人）", subject: subject || "（无主题）", snippet: bodyText.trim().slice(0, 60), body: bodyText.split(/\n{2,}/).filter(Boolean), folder });
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
      btn.disabled = true; btn.textContent = "发送中…";
      try {
        await window.MyMailGmail.send({ to, subject, body: bodyText });
        pushMail({ to, subject: subject || "（无主题）", snippet: bodyText.trim().slice(0, 60), body: bodyText.split(/\n{2,}/).filter(Boolean), folder: "sent" });
        closeCompose(); renderAll(); toast("已通过 Gmail 发送");
      } catch (e) { $("#composeHint").textContent = "发送失败：" + e.message; }
      btn.disabled = false; btn.textContent = "发送";
      return;
    }
    composeSnapshot("sent"); save(); closeCompose(); renderAll(); toast("已发送（演示，不会真的发出）");
  };

  /* ---------------- 设置 ---------------- */
  $("#btnSettings").onclick = () => { closeSidebar(); $("#settingLang").value = state.lang; $("#settingTheme").value = state.themeMode; $("#settingsModal").hidden = false; };
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
    $("#loginScreen").hidden = false;
  }
  function hideLogin() { $("#loginScreen").hidden = true; }
  async function enterLive() {
    toast("正在拉取你的 Gmail…");
    const { profile, emails } = await G().loadAll();
    gmailProfile = profile;
    liveEmails = emails;
    mode = "live";
    selectedId = null; currentFolder = "inbox"; currentLabel = null;
    const addr = profile.emailAddress || "";
    setAccountUI(addr.split("@")[0] || "Gmail", addr, initialOf(addr || "G"));
    document.querySelector(".sidebar-footer").innerHTML =
      '<span class="sync-dot"></span> 已同步 · Gmail 实时数据（不落盘）';
    hideLogin(); renderAll();
    const firstLive = visibleEmails()[0];
    if (firstLive) select(firstLive.id, false);
    toast("已登录 Gmail：" + addr);
  }
  function doGoogleLogin() {
    if (!G().configured()) { showLogin("尚未配置 Google Client ID（见 README 的接入步骤）"); return; }
    const btn = $("#btnGoogleLogin");
    btn.disabled = true; btn.textContent = "正在跳转到 Google 登录…";
    // 整页跳转是唯一路径：弹窗在 App 内嵌浏览器里会「假打开」，
    // 授权完成后令牌无法回传原页面（卡在「正在打开 Google 授权…」）。
    G().startRedirectLogin();
  }
  $("#btnGoogleLogin").onclick = doGoogleLogin;
  $("#btnDemoEnter").onclick = () => { hideLogin(); toast("演示模式：数据为虚构示例"); };
  $("#btnAuth").onclick = async () => {
    closeSidebar();
    if (mode === "live") {
      G().clearToken();
      mode = "demo"; liveEmails = []; gmailProfile = null; selectedId = null;
      setAccountUI("Yangming", "demo@mymail.app", "Y");
      document.querySelector(".sidebar-footer").innerHTML =
        '<span class="sync-dot"></span> 已同步 · 演示数据';
      renderAll();
      const f = visibleEmails()[0];
      if (f) select(f.id, false);
      toast("已退出登录，回到演示模式");
    } else showLogin();
  };

  /* ---------------- 启动 ---------------- */
  hydrateIcons();
  applyTheme();
  save();
  renderAll();
  const first = visibleEmails()[0];
  if (first) select(first.id, false);
  if (G().configured()) {
    const oauthErr = G().consumeRedirectError();
    if (oauthErr) showLogin("Google 授权未完成：" + oauthErr + "（请重新点登录，并在验证页点左侧小字「继续」、权限页点「继续/允许」，不要点『返回到安全网页』）");
    else if (G().consumeRedirectToken()) enterLive().catch(() => showLogin("拉取邮件失败，请重新登录"));
    else if (G().getStoredToken()) enterLive().catch(() => showLogin("会话已过期，请重新登录"));
    else showLogin();
  }
})();
