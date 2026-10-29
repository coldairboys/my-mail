/* My Mail · 核心编排层（ES Module · v4.2）
   v4.2 拆分后本文件只保留 bindEvents（事件绑定编排）与 renderAll（渲染编排）：
   - 图标 → ui/icons.js，Toast → ui/toast.js，主题 → ui/theme.js
   - 筛选缓存 → core/visible.js，邮件数组操作 → core/mail-ops.js
   - 侧栏渲染 → ui/sidebar.js，列表渲染 → ui/mail-list.js
   - 阅读区渲染 → ui/reading.js，动作 → ui/mail-actions.js，写信窗 → ui/compose.js
   依赖 store.js / utils.js / data.module.js / translate.js
   安全：对接 Gmail/Outlook 的 OAuth 流程（gmail.js / outlook.js）
   补齐按键：为所有无功能按键补上可操作的逻辑与可访问性
*/
import { SEED_EMAILS } from "./data.module.js";
import { state, ui, accounts, src, byId, save, saveSync, SEED_VERSION } from "./store.js";
import { esc, debounce } from "./utils.js";
import { $ } from "./core/dom.js";
import { ICONS, hydrateIcons } from "./ui/icons.js";
import { toast } from "./ui/toast.js";
import { applyTheme } from "./ui/theme.js";
import { renderAccounts, renderNav, accountUnread, accountLabel } from "./ui/sidebar.js";
import { renderList } from "./ui/mail-list.js";
import { renderReading, setOpenComposeRef, setRerenderAll } from "./ui/reading.js";
import { select, stepSelection, trashMail, actOnSelected, bindActionHelpers } from "./ui/mail-actions.js";
import {
  openCompose,
  closeCompose,
  getComposeMode,
  bindComposeHelpers,
  bindComposeEvents,
} from "./ui/compose.js";
import { invalidateVisible, visibleEmails } from "./core/visible.js";

/* ---------------- 渲染编排 ---------------- */
export function renderAll() {
  invalidateVisible();
  renderAccounts();
  renderNav();
  renderList();
  renderReading();
}

// 注入各拆分模块需要的回调（避免互相 import 成环）
setRerenderAll(renderAll);
bindActionHelpers({ renderAll, renderList, renderNav });

/* ---------------- 事件绑定（由 init 调用一次） ---------------- */
let eventsBound = false;
export function bindEvents(handlers) {
  if (eventsBound) return;
  eventsBound = true;
  const { setView, updateChrome, enterGmail, enterOutlook, enterG2, doGoogleLogin, doMsLogin } = handlers;

  // 写信窗模块需要焦点陷阱 / 渲染回调
  bindComposeHelpers({
    trapFocus,
    releaseTrap,
    renderAll,
    closeSidebar,
  });
  bindComposeEvents();
  // 阅读区「回复 / 转发」要能打开写信窗
  setOpenComposeRef(openCompose);

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
    // 无障碍：role=separator 的值状态实时同步给读屏
    resizer.setAttribute("aria-valuenow", String(clamped));
    return clamped;
  }
  if (resizer) {
    // role=separator 支持 aria-value*；带 tabindex 才能被键盘操作（方向键微调）
    resizer.setAttribute("tabindex", "0");
    resizer.setAttribute("aria-valuemin", String(LIST_MIN));
    resizer.setAttribute("aria-valuemax", String(listMaxWidth()));
    if (state.listWidth) applyListWidth(state.listWidth, false);
    else
      resizer.setAttribute(
        "aria-valuenow",
        String(document.querySelector(".list-pane").getBoundingClientRect().width)
      );

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
    // 窗口变窄时把越界的宽度收回来，同时修正 aria-valuemax
    window.addEventListener("resize", () => {
      resizer.setAttribute("aria-valuemax", String(listMaxWidth()));
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
    state.emails = structuredClone(SEED_EMAILS);
    // 同步种子版本号，避免下次启动又被 loadPersisted 判定为「待升级」而二次覆盖
    state.seedVersion = SEED_VERSION;
    ui.selectedId = null;
    ui.currentFolder = "inbox";
    ui.currentLabel = null;
    ui.filterMode = "all";
    saveSync();
    renderAll();
    toast("演示数据已恢复");
  }
  $("#menuResetData").onclick = () => {
    $("#moreMenu").hidden = true;
    resetData();
  };

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
    const ar = $("#settingAutoRefresh");
    if (ar) ar.value = String(state.autoRefreshSec || 0);
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
  $("#settingAutoRefresh").onchange = (e) => {
    state.autoRefreshSec = Number(e.target.value) || 0;
    saveSync();
    if (handlers.setupAutoRefresh) handlers.setupAutoRefresh();
    toast(
      state.autoRefreshSec
        ? "自动刷新：每 " +
            (state.autoRefreshSec % 60 === 0
              ? state.autoRefreshSec / 60 + " 分钟"
              : state.autoRefreshSec + " 秒") +
            "（页面在前台时生效）"
        : "自动刷新已关闭"
    );
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
    if (container.id === "composeModal" && getComposeMode() !== "fullscreen") {
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
    if (!$("#composeModal").hidden && getComposeMode() === "fullscreen") return;
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
  /* ---------------- 账号管理 ---------------- */
  // 待确认移除的账号：key → { label, run }
  let pendingRemove = null;
  const REMOVE_HANDLERS = {
    gmail: () => handlers.handleAuthGmailToggle,
    gmail2: () => handlers.handleAuthG2Toggle,
    outlook: () => handlers.handleAuthMsToggle,
  };

  function openAddAccount() {
    closeSidebar();
    const gmailOk = Boolean(window.MyMailGmail && window.MyMailGmail.configured());
    const msOk = Boolean(window.MyMailOutlook && window.MyMailOutlook.configured());
    // 未配置 Client ID 时如实说明，而不是让用户点了没反应
    const notes = [];
    if (!gmailOk) notes.push("Gmail 尚未配置 Client ID（见 README 的「接入 Gmail」）。");
    if (!msOk) notes.push("Outlook 尚未配置 Client ID（见 README 的「接入 Outlook」）。");
    $("#addAccountNote").textContent = notes.join(" ");
    $("#addAccountModal").hidden = false;
    $("#addAccountModal").setAttribute("aria-hidden", "false");
    trapFocus($("#addAccountModal"));
  }
  function closeAddAccount() {
    $("#addAccountModal").hidden = true;
    $("#addAccountModal").setAttribute("aria-hidden", "true");
    releaseTrap();
  }
  function askRemoveAccount(key) {
    const acc = accounts.get(key);
    const mail = acc?.profile?.emailAddress || "";
    const label = mail || accountLabel(key);
    pendingRemove = { key, run: REMOVE_HANDLERS[key] };
    $("#removeAccountText").textContent = `确定要移除「${label}」吗？`;
    $("#removeAccountModal").hidden = false;
    $("#removeAccountModal").setAttribute("aria-hidden", "false");
    trapFocus($("#removeAccountModal"));
    // 焦点默认落在「取消」上，误触也不会直接移除
    $("#btnCancelRemove").focus();
  }
  function closeRemoveAccount() {
    $("#removeAccountModal").hidden = true;
    $("#removeAccountModal").setAttribute("aria-hidden", "true");
    releaseTrap();
    pendingRemove = null;
  }
  // 账号行右侧「⋯」菜单：全部标已读 / 移除账号
  function closeAccountMenu() {
    document.querySelectorAll(".acct-menu").forEach((m) => m.remove());
    document.removeEventListener("click", onDocClickCloseMenu, true);
  }
  function onDocClickCloseMenu(e) {
    if (!e.target.closest(".acct-menu") && !e.target.closest("[data-acct-menu]")) closeAccountMenu();
  }
  function openAccountMenu(key, anchor) {
    closeAccountMenu();
    const acc = accounts.get(key);
    if (!acc) return;
    const unread = accountUnread(acc.emails);
    const menu = document.createElement("div");
    menu.className = "dropdown acct-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML =
      `<button type="button" role="menuitem" data-acct-action="readall"${
        unread ? "" : " disabled"
      }>全部标为已读${unread ? `（${unread}）` : ""}</button>` +
      `<button type="button" role="menuitem" class="danger" data-acct-action="remove">移除账号…</button>`;
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = Math.round(r.bottom + 4) + "px";
    menu.style.left = Math.max(8, Math.min(Math.round(r.left - 150), window.innerWidth - 200)) + "px";
    menu.style.zIndex = "70";
    menu.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-acct-action]");
      if (!btn || btn.disabled) return;
      closeAccountMenu();
      if (btn.dataset.acctAction === "readall") {
        acc.emails.forEach((m) => {
          if (m.folder === "inbox" && !m.archived) m.unread = false;
        });
        save();
        renderAll();
        toast("该账号收件箱已全部标为已读");
      } else if (btn.dataset.acctAction === "remove") {
        askRemoveAccount(key);
      }
    });
    setTimeout(() => document.addEventListener("click", onDocClickCloseMenu, true), 0);
  }

  $("#btnAddAccount").onclick = openAddAccount;
  $("#btnCloseAddAccount").onclick = closeAddAccount;
  $("#btnAddGmail").onclick = () => {
    closeAddAccount();
    handlers.doGoogleLogin();
  };
  $("#btnAddOutlook").onclick = () => {
    closeAddAccount();
    handlers.doMsLogin();
  };
  $("#btnCloseRemoveAccount").onclick = closeRemoveAccount;
  $("#btnCancelRemove").onclick = closeRemoveAccount;
  $("#btnConfirmRemove").onclick = () => {
    // REMOVE_HANDLERS 里存的是「取 handler 的 getter」，这里取出来再执行
    const task = pendingRemove;
    closeRemoveAccount();
    if (!task) return;
    const run = task.run && task.run();
    if (typeof run === "function") run();
  };
  // 账号行：点主体切换视图，点「⋯」开菜单
  $("#accountList").addEventListener("click", (e) => {
    const more = e.target.closest("[data-acct-menu]");
    if (more) {
      e.stopPropagation();
      openAccountMenu(more.dataset.acctMenu, more);
      return;
    }
    const view = e.target.closest("[data-acct-view]");
    if (!view) return;
    closeSidebar();
    closeAccountMenu();
    setView(view.dataset.acctView);
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

// 兼容旧导出面（app-init.js 与测试使用的入口）
export { visibleEmails, select, toast, renderAccounts, renderList, invalidateVisible };
