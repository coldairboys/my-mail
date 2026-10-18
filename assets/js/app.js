/* My Mail · 应用逻辑
   状态保存在 localStorage（键 mymail-state-v1），刷新不丢失；
   在「设置」里可以一键恢复演示数据。 */

(function () {
  "use strict";

  const STORAGE_KEY = "mymail-state-v1";
  const $ = (sel) => document.querySelector(sel);

  /* ---------------- 状态 ---------------- */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.emails)) return s;
      }
    } catch (e) { /* 损坏的存档直接重置 */ }
    return { emails: structuredClone(SEED_EMAILS), lang: "zh" };
  }

  const state = loadState();
  let currentFolder = "inbox";   // 当前文件夹 / 特殊视图（starred 是视图，不是 folder 值）
  let currentLabel = null;       // 当前标签筛选
  let selectedId = null;         // 当前打开的邮件
  let searchQuery = "";
  let onlyUnread = false;
  let showTranslated = false;

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._h);
    toast._h = setTimeout(() => (t.hidden = true), 2200);
  }

  const labelById = (id) => LABELS.find((l) => l.id === id);
  const byId = (id) => state.emails.find((m) => m.id === id);
  const initialOf = (name) => (name || "?").trim().charAt(0).toUpperCase();
  const AVATAR_COLORS = ["#e8736a", "#f5a623", "#5aa2ff", "#7ed3a6", "#9b7ede", "#e87fb0", "#4db6c9"];
  function colorOf(name) {
    let h = 0;
    for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------------- 筛选 ---------------- */
  function visibleEmails() {
    let list;
    if (currentLabel) {
      list = state.emails.filter((m) => m.label === currentLabel && m.folder !== "trash" && m.folder !== "spam");
    } else if (currentFolder === "starred") {
      list = state.emails.filter((m) => m.starred && m.folder !== "trash");
    } else if (currentFolder === "all") {
      list = state.emails.filter((m) => m.folder !== "trash" && m.folder !== "spam");
    } else {
      list = state.emails.filter((m) => m.folder === currentFolder && !m.archived);
    }
    if (onlyUnread) list = list.filter((m) => m.unread);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) =>
        [m.from, m.address, m.subject, m.snippet, ...(m.body || [])]
          .join(" ").toLowerCase().includes(q)
      );
    }
    return list;
  }

  function folderCount(fid) {
    if (fid === "starred") return state.emails.filter((m) => m.starred && m.folder !== "trash").length;
    if (fid === "all") return state.emails.filter((m) => m.folder !== "trash" && m.folder !== "spam").length;
    if (fid === "inbox") return state.emails.filter((m) => m.folder === "inbox" && !m.archived && m.unread).length;
    return state.emails.filter((m) => m.folder === fid && !m.archived).length;
  }

  /* ---------------- 渲染：左栏 ---------------- */
  function renderNav() {
    $("#folderList").innerHTML = FOLDERS.map((f) => {
      const n = folderCount(f.id);
      const active = !currentLabel && currentFolder === f.id ? " active" : "";
      return `<li class="${active.trim()}" data-folder="${f.id}">
        <span class="nav-icon">${f.icon}</span><span>${f.name}</span>
        ${n ? `<span class="nav-count">${n}</span>` : ""}</li>`;
    }).join("");

    $("#labelList").innerHTML = LABELS.map((l) => {
      const n = state.emails.filter((m) => m.label === l.id && m.folder !== "trash" && m.folder !== "spam").length;
      const active = currentLabel === l.id ? " active" : "";
      return `<li class="${active.trim()}" data-label="${l.id}">
        <span class="label-dot" style="background:${l.color}"></span><span>${esc(l.name)}</span>
        ${n ? `<span class="nav-count">${n}</span>` : ""}</li>`;
    }).join("");
  }

  /* ---------------- 渲染：列表 ---------------- */
  function renderList() {
    const list = visibleEmails();
    const title = currentLabel
      ? labelById(currentLabel).name
      : FOLDERS.find((f) => f.id === currentFolder).name;
    $("#currentFolderName").textContent = searchQuery ? `搜索：${searchQuery}` : title;

    $("#mailList").innerHTML = list.map((m) => {
      const lab = m.label ? labelById(m.label) : null;
      return `<li class="mail-item${m.unread ? " unread" : ""}${m.id === selectedId ? " selected" : ""}" data-id="${m.id}">
        ${m.unread ? '<span class="unread-dot"></span>' : ""}
        <div class="mail-row-1">
          <span class="mail-from">${esc(m.from)}${m.starred ? '<span class="mail-star">★</span>' : ""}</span>
          <span class="mail-date">${esc(m.date)}</span>
        </div>
        <div class="mail-subject">${esc(m.subject)}</div>
        <div class="mail-snippet">${esc(m.snippet)}${lab ? `<span class="mail-tag">${esc(lab.name)}</span>` : ""}</div>
      </li>`;
    }).join("");

    $("#listEmpty").hidden = list.length > 0;
    return list;
  }

  /* ---------------- 渲染：阅读区 ---------------- */
  function renderReading() {
    const m = byId(selectedId);
    const box = $("#readingContent");
    if (!m) {
      box.innerHTML = "";
      $("#readingEmpty").hidden = false;
      return;
    }
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
        <button class="chip-btn" id="btnReply">↩ 回复</button>
        <button class="chip-btn" id="btnForward">↪ 转发</button>
        <button class="chip-btn" id="btnShowImages">显示图片</button>
      </div>
      <div class="mail-body">${body.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
      <div class="reading-actions">
        <button class="btn-primary" id="btnReply2">回复</button>
        <button class="btn-secondary" id="btnForward2">转发</button>
      </div>`;

    $("#btnStar").onclick = () => { m.starred = !m.starred; save(); renderAll(); };
    $("#btnTranslate").onclick = () => {
      if (!m.bodyZh) { toast("这封邮件暂无译文"); return; }
      showTranslated = !showTranslated;
      renderReading();
    };
    const openReply = () => openCompose({ to: m.address, subject: "Re: " + m.subject });
    const openFwd = () => openCompose({ subject: "Fwd: " + m.subject, body: "\n\n—— 转发邮件 ——\n" + (m.body || []).join("\n") });
    $("#btnReply").onclick = openReply; $("#btnReply2").onclick = openReply;
    $("#btnForward").onclick = openFwd; $("#btnForward2").onclick = openFwd;
    $("#btnUnsub").onclick = () => toast("已退订（演示，不会真的发送）");
    $("#btnShowImages").onclick = () => toast("已显示此发件人的图片（演示）");
  }

  function renderAll() { renderNav(); renderList(); renderReading(); }

  /* ---------------- 选择与导航 ---------------- */
  function select(id, markRead = true) {
    selectedId = id;
    showTranslated = false;
    const m = byId(id);
    if (m && markRead && m.unread) { m.unread = false; save(); }
    document.querySelector(".app-window").classList.add("reading-open");
    renderList(); renderReading(); renderNav();
  }

  function stepSelection(dir) {
    const list = visibleEmails();
    if (!list.length) return;
    let i = list.findIndex((m) => m.id === selectedId);
    i = i < 0 ? 0 : Math.min(list.length - 1, Math.max(0, i + dir));
    select(list[i].id);
  }

  /* ---------------- 工具栏动作 ---------------- */
  function actOnSelected(action) {
    const m = byId(selectedId);
    if (!m) { toast("先选一封邮件"); return; }
    if (action === "prev") return stepSelection(-1);
    if (action === "next") return stepSelection(1);
    if (action === "archive") { m.archived = true; toast("已归档，在「所有邮件」里能找到"); }
    if (action === "snooze") { m.folder = "snoozed"; m.archived = false; toast("已延后到明天"); }
    if (action === "spam") { m.folder = "spam"; m.archived = false; toast("已标为垃圾邮件"); }
    if (action === "trash") {
      if (m.folder === "trash") {
        state.emails = state.emails.filter((x) => x.id !== m.id);
        toast("已彻底删除");
      } else { m.folder = "trash"; m.archived = false; toast("已移到废纸篓"); }
    }
    selectedId = null;
    save(); renderAll();
  }

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
    state.emails.unshift(Object.assign({
      id: "u" + Date.now(), from: "我", address: "demo@mymail.app", to: "",
      date: "今天", time: "刚刚", subject: "（无主题）", snippet: "",
      label: null, unread: false, starred: false, folder: "sent", body: [], bodyZh: null,
    }, partial));
  }

  function composeSnapshot(folder) {
    const to = $("#composeTo").value.trim();
    const subject = $("#composeSubject").value.trim();
    const bodyText = $("#composeBody").value;
    if (!to && !subject && !bodyText.trim()) return false;
    pushMail({
      to: to || "（未填收件人）", subject: subject || "（无主题）",
      snippet: bodyText.trim().slice(0, 60),
      body: bodyText.split(/\n{2,}/).filter(Boolean),
      folder,
    });
    return true;
  }

  /* ---------------- 事件绑定 ---------------- */
  $("#folderList").addEventListener("click", (e) => {
    const li = e.target.closest("[data-folder]");
    if (!li) return;
    currentFolder = li.dataset.folder; currentLabel = null;
    selectedId = null; document.querySelector(".app-window").classList.remove("reading-open");
    renderAll();
  });
  $("#labelList").addEventListener("click", (e) => {
    const li = e.target.closest("[data-label]");
    if (!li) return;
    currentLabel = li.dataset.label;
    selectedId = null; document.querySelector(".app-window").classList.remove("reading-open");
    renderAll();
  });
  $("#mailList").addEventListener("click", (e) => {
    const li = e.target.closest("[data-id]");
    if (li) select(li.dataset.id);
  });
  document.querySelector(".reading-toolbar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (b) actOnSelected(b.dataset.action);
  });

  const searchInput = $("#searchInput");
  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value.trim();
    $("#btnClearSearch").hidden = !searchQuery;
    renderList();
  });
  $("#btnClearSearch").onclick = () => { searchInput.value = ""; searchQuery = ""; $("#btnClearSearch").hidden = true; renderList(); };
  $("#btnFocusSearch").onclick = () => searchInput.focus();
  $("#btnFilterUnread").onclick = (e) => { onlyUnread = !onlyUnread; e.currentTarget.classList.toggle("on", onlyUnread); renderList(); };
  $("#btnMarkAllRead").onclick = () => {
    visibleEmails().forEach((m) => (m.unread = false));
    save(); renderAll(); toast("当前列表已全部标为已读");
  };

  $("#btnCompose").onclick = () => openCompose();
  $("#btnCloseCompose").onclick = () => { if (composeSnapshot("drafts")) { save(); toast("已存入草稿"); } closeCompose(); };
  $("#btnSaveDraft").onclick = () => { if (composeSnapshot("drafts")) { save(); closeCompose(); toast("已存入草稿"); } else { $("#composeHint").textContent = "还没写内容"; } };
  $("#btnSend").onclick = () => {
    if (!$("#composeTo").value.trim()) { $("#composeHint").textContent = "先填收件人"; return; }
    composeSnapshot("sent"); save(); closeCompose(); renderAll(); toast("已发送（演示，不会真的发出）");
  };

  $("#btnSettings").onclick = () => { $("#settingLang").value = state.lang; $("#settingsModal").hidden = false; };
  $("#btnCloseSettings").onclick = () => { $("#settingsModal").hidden = true; };
  $("#settingLang").onchange = (e) => { state.lang = e.target.value; save(); renderReading(); };
  $("#btnResetData").onclick = () => {
    localStorage.removeItem(STORAGE_KEY);
    state.emails = structuredClone(SEED_EMAILS);
    selectedId = null; currentFolder = "inbox"; currentLabel = null;
    save(); renderAll(); toast("演示数据已恢复");
  };
  document.querySelectorAll(".modal-backdrop").forEach((bd) =>
    bd.addEventListener("click", (e) => { if (e.target === bd) bd.hidden = true; })
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { $("#composeModal").hidden = true; $("#settingsModal").hidden = true; }
    if (!$("#composeModal").hidden || !$("#settingsModal").hidden) return;
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === "j") stepSelection(1);
    if (e.key === "k") stepSelection(-1);
  });

  /* ---------------- 启动 ---------------- */
  save();
  renderAll();
  const first = visibleEmails()[0];
  if (first) select(first.id, false);
})();
