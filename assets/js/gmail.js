/* My Mail · Gmail 接入层（v4 · PKCE 授权码流程）
   安全模型：
   - 登录走 OAuth 2.0 Authorization Code + PKCE，密码只在 Google 官方页面输入
   - 本文件只用 Client ID（公开标识），不需要 client_secret；PKCE 用 S256 校验
   - 流程：生成 code_verifier / code_challenge + state → 跳转 Google 授权 → 回调带 ?code= + state → 前端带 verifier 换取 access_token
   - access_token 只存 sessionStorage（关标签页即失效，约 1 小时），不写 localStorage、不上传任何服务器
   - 回调后立即校验 state 并用 history.replaceState 清理 URL，避免 token / code 进历史记录
   - 邮件数据只在浏览器内存里，页面关掉即消失
   - 权限范围：gmail.readonly（只读）+ gmail.send（发送） */

(function () {
  "use strict";
  const CFG = window.MYMAIL_CONFIG || {};

  function createGmailClient(suffix, providerName) {
    const TOKEN_KEY = "mymail-gmail-token" + suffix;
    const EXP_KEY = "mymail-gmail-token-exp" + suffix;
    const VERIFIER_KEY = "mymail-gmail-verifier" + suffix;
    const STATE_KEY = "mymail-gmail-state" + suffix;

    const configured = () => Boolean(CFG.GOOGLE_CLIENT_ID);

    // ---------- Token 存取 ----------
    function getStoredToken() {
      try {
        const t = sessionStorage.getItem(TOKEN_KEY);
        const exp = Number(sessionStorage.getItem(EXP_KEY) || 0);
        if (t && exp > Date.now() + 30_000) return t;
      } catch (e) {}
      return null;
    }
    function storeToken(accessToken, expiresInSec) {
      try {
        sessionStorage.setItem(TOKEN_KEY, accessToken);
        sessionStorage.setItem(EXP_KEY, String(Date.now() + (expiresInSec || 3600) * 1000));
      } catch (e) {}
    }
    function clearToken() {
      try {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(EXP_KEY);
        sessionStorage.removeItem(VERIFIER_KEY);
        sessionStorage.removeItem(STATE_KEY);
        sessionStorage.removeItem("mymail-login-target");
      } catch (e) {}
    }

    // ---------- PKCE helpers ----------
    const b64url = (buf) =>
      btoa(String.fromCharCode.apply(null, new Uint8Array(buf)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    function randomString(len) {
      const bytes = crypto.getRandomValues(new Uint8Array(len));
      // base64url approx 4/3 expansion, generate enough bytes then slice
      return b64url(bytes).slice(0, len);
    }
    async function pkceChallenge(verifier) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
      return b64url(digest);
    }
    function redirectUri() {
      return window.location.origin + window.location.pathname;
    }

    // 兼容旧版 implicit 流程残留的 hash token（静默迁移）：若 URL 仍有 #access_token=，尝试收取并清理
    function consumeLegacyHashToken() {
      if (!window.location.hash || !window.location.hash.includes("access_token=")) return false;
      try {
        const p = new URLSearchParams(window.location.hash.slice(1));
        const token = p.get("access_token");
        if (token) {
          storeToken(token, Number(p.get("expires_in") || 3600));
          history.replaceState(null, "", window.location.pathname + window.location.search);
          return true;
        }
        history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch (e) {}
      return false;
    }

    // ---------- 发起授权（PKCE） ----------
    async function startRedirectLogin() {
      if (!configured()) throw new Error("尚未配置 GOOGLE_CLIENT_ID（见 README 的接入步骤）");
      // 生成 PKCE verifier / challenge + state
      const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
      const challenge = await pkceChallenge(verifier);
      const state = randomString(24);
      try {
        sessionStorage.setItem(VERIFIER_KEY, verifier);
        sessionStorage.setItem(STATE_KEY, state);
        sessionStorage.setItem("mymail-login-target", suffix);
      } catch (e) {}
      const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      u.searchParams.set("client_id", CFG.GOOGLE_CLIENT_ID);
      u.searchParams.set("redirect_uri", redirectUri());
      u.searchParams.set("response_type", "code");
      u.searchParams.set("scope", CFG.GMAIL_SCOPES);
      u.searchParams.set("code_challenge", challenge);
      u.searchParams.set("code_challenge_method", "S256");
      u.searchParams.set("state", state);
      u.searchParams.set("access_type", "online");
      u.searchParams.set("include_granted_scopes", "true");
      u.searchParams.set("prompt", "consent");
      window.location.assign(u.toString());
    }

    // 兼容旧 API 名称（app.js 曾调用 consumerRedirectToken）
    function consumeRedirectToken() {
      // 先尝试新流程的 code，再兼容旧 hash token
      if (consumeLegacyHashToken()) return true;
      return false;
    }

    function consumeRedirectError() {
      const q = new URLSearchParams(window.location.search);
      const qsError = q.get("error");
      if (qsError) {
        // 清理 URL 上的 error 参数，避免刷新重复提示
        q.delete("error");
        q.delete("error_description");
        q.delete("error_uri");
        q.delete("state");
        const clean =
          window.location.pathname + (q.toString() ? "?" + q.toString() : "") + window.location.hash;
        history.replaceState(null, "", clean);
        return (
          qsError +
          (q.get("error_description") ? "：" + String(q.get("error_description")).slice(0, 160) : "")
        );
      }
      if (window.location.hash && window.location.hash.includes("error=")) {
        const p = new URLSearchParams(window.location.hash.slice(1));
        const err = p.get("error");
        if (err) {
          history.replaceState(null, "", window.location.pathname + window.location.search);
          return err;
        }
      }
      return null;
    }

    // 消费回调中的 ?code=，校验 state 后用 verifier 换取 token；返回 { ok, error } 或 null（无回调）
    async function consumeRedirectCode() {
      // 兼容旧 hash token 场景
      if (window.location.hash && window.location.hash.includes("access_token=")) {
        const ok = consumeLegacyHashToken();
        return ok ? { ok: true } : null;
      }
      const q = new URLSearchParams(window.location.search);
      const code = q.get("code");
      const err = q.get("error");
      const state = q.get("state");
      if (!code && !err) return null;
      // 无论成功失败，先清理 URL 上的敏感参数，避免 code/state 进历史
      const cleanParams = new URLSearchParams(window.location.search);
      cleanParams.delete("code");
      cleanParams.delete("state");
      cleanParams.delete("scope");
      cleanParams.delete("error");
      cleanParams.delete("error_description");
      const cleanUrl =
        window.location.pathname +
        (cleanParams.toString() ? "?" + cleanParams.toString() : "") +
        window.location.hash;
      history.replaceState(null, "", cleanUrl);

      if (err)
        return {
          error:
            err + (q.get("error_description") ? "：" + String(q.get("error_description")).slice(0, 160) : ""),
        };
      if (!code) return null;

      // 校验 state（防 CSRF）
      let expectedState = null;
      try {
        expectedState = sessionStorage.getItem(STATE_KEY);
      } catch (e) {}
      if (expectedState && state !== expectedState)
        return { error: "登录校验失败（state 不匹配），请重新登录" };
      const verifier = (() => {
        try {
          return sessionStorage.getItem(VERIFIER_KEY);
        } catch (e) {
          return null;
        }
      })();
      if (!verifier) return { error: "授权校验信息丢失，请重新登录" };

      // 换取 token（PKCE 公开客户端，无需 client_secret）
      const body = new URLSearchParams({
        client_id: CFG.GOOGLE_CLIENT_ID,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(),
        code_verifier: verifier,
      });
      let data = {};
      try {
        const r = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
        data = await r.json().catch(() => ({}));
        if (!r.ok || !data.access_token) {
          // 若 PKCE 交换被拒（部分旧客户端类型要求 secret），给出明确指引
          const hint = data.error_description || data.error || "HTTP " + r.status;
          return {
            error:
              "令牌交换失败：" +
              hint +
              "（若持续失败，请在 Google 控制台将 OAuth 客户端改为“Web 应用”并确保已登记重定向 URI 为本站地址）",
          };
        }
      } catch (e) {
        return { error: "令牌交换网络失败：" + (e.message || e) };
      }
      storeToken(data.access_token, Number(data.expires_in || 3600));
      try {
        sessionStorage.removeItem(VERIFIER_KEY);
        sessionStorage.removeItem(STATE_KEY);
      } catch (e) {}
      return { ok: true };
    }

    // 供 app.js 兼容调用：旧版 consumeRedirectToken 是同步布尔，新版是异步 code 交换
    // 这里保留一个同步包装，实际异步逻辑在 consumeRedirectCode 中
    function getStoredTokenSync() {
      return getStoredToken();
    }

    async function api(path, options = {}) {
      let token = getStoredToken();
      if (!token) throw new Error("登录已过期，请重新登录");
      const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + path, {
        ...options,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });
      if (resp.status === 401) {
        clearToken();
        throw new Error("登录已过期，请重新登录");
      }
      if (!resp.ok) {
        let msg = "Gmail 接口返回 " + resp.status;
        try {
          const j = await resp.json();
          if (j.error && j.error.message) msg += "：" + j.error.message;
        } catch (e) {}
        throw new Error(msg);
      }
      return resp.status === 204 ? {} : resp.json();
    }

    /* ---------- 邮件解析 ---------- */
    const decodeEntities = (s) => {
      const ta = document.createElement("textarea");
      ta.innerHTML = s || "";
      return ta.value;
    };
    function header(headers, name) {
      const h = (headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
      return h ? decodeEntities(h.value) : "";
    }
    function parseAddress(from) {
      const m = /^(.*?)\s*<([^>]+)>$/.exec(from || "");
      if (m) return { name: m[1].replace(/^"|"$/g, "") || m[2], address: m[2] };
      return { name: from || "(未知)", address: from || "" };
    }
    function b64ToText(data) {
      try {
        const bin = atob((data || "").replace(/-/g, "+").replace(/_/g, "/"));
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        return new TextDecoder("utf-8").decode(bytes);
      } catch (e) {
        return "";
      }
    }
    function collectParts(payload, texts, atts) {
      if (!payload) return;
      if (payload.filename && payload.body) {
        atts.push({
          filename: payload.filename,
          mimeType: payload.mimeType || "",
          size: payload.body.size || 0,
          attachmentId: payload.body.attachmentId || null,
        });
      }
      if (payload.body && payload.body.data)
        texts.push({ mime: payload.mimeType, text: b64ToText(payload.body.data) });
      (payload.parts || []).forEach((p) => collectParts(p, texts, atts));
    }
    function gmailCategory(labelIds) {
      if (labelIds.includes("CATEGORY_PROMOTIONS")) return "promo";
      if (labelIds.includes("CATEGORY_SOCIAL")) return "social";
      if (labelIds.includes("CATEGORY_UPDATES") || labelIds.includes("CATEGORY_FORUMS")) return "updates";
      return null;
    }
    function htmlPart(msg) {
      const parts = [];
      collectParts(msg.payload, parts, []);
      const hp = parts.find((p) => p.mime === "text/html");
      return hp ? hp.text : null;
    }
    function bodyParagraphs(msg) {
      const parts = [];
      collectParts(msg.payload, parts, []);
      let text = "";
      const plain = parts.find((p) => p.mime === "text/plain");
      if (plain) text = plain.text;
      else {
        const html = parts.find((p) => p.mime === "text/html");
        if (html) {
          const div = document.createElement("div");
          div.innerHTML = html.text;
          text = div.textContent || "";
        }
      }
      const paras = text
        .split(/\n{2,}|\r\n{2,}/)
        .map((p) => p.replace(/\s+\n/g, "\n").trim())
        .filter(Boolean);
      return paras.length ? paras : [msg.snippet || "(无正文)"];
    }
    function primaryFolder(labelIds, fallback) {
      if (labelIds.includes("TRASH")) return "trash";
      if (labelIds.includes("SPAM")) return "spam";
      if (labelIds.includes("DRAFT")) return "drafts";
      if (labelIds.includes("SENT")) return "sent";
      return fallback || "inbox";
    }
    function toEmail(msg, fallbackFolder) {
      const h = (msg.payload && msg.payload.headers) || [];
      const from = parseAddress(header(h, "From"));
      const labelIds = msg.labelIds || [];
      const d = new Date(Number(msg.internalDate || Date.now()));
      const pad = (n) => String(n).padStart(2, "0");
      return {
        id: msg.id,
        provider: providerName,
        bodyLoaded: true,
        ts: Number(msg.internalDate || 0),
        from: from.name,
        address: from.address,
        to: header(h, "To") || "我",
        date: `${d.getMonth() + 1}月${d.getDate()}日`,
        time: `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`,
        subject: header(h, "Subject") || "(无主题)",
        snippet: decodeEntities(msg.snippet || ""),
        label: null,
        folder: primaryFolder(labelIds, fallbackFolder),
        archived:
          !labelIds.includes("INBOX") &&
          !["TRASH", "SPAM", "DRAFT", "SENT"].some((x) => labelIds.includes(x)),
        unread: labelIds.includes("UNREAD"),
        starred: labelIds.includes("STARRED"),
        body: bodyParagraphs(msg),
        bodyHtml: htmlPart(msg),
        bodyZh: null,
        attachments: (() => {
          const atts = [];
          collectParts(msg.payload, [], atts);
          return atts;
        })(),
        unsub: (() => {
          const v = header(h, "List-Unsubscribe");
          const mm = /<(https?:[^>]+)>/.exec(v || "");
          const mo = /<(mailto:[^>]+)>/.exec(v || "");
          return mm ? mm[1] : mo ? mo[1] : null;
        })(),
        gmailLabelIds: labelIds,
        important: labelIds.includes("IMPORTANT"),
        category: gmailCategory(labelIds),
        gmailThreadId: msg.threadId,
      };
    }

    async function fetchList(params) {
      const qs = new URLSearchParams(params).toString();
      const data = await api("messages?" + qs);
      const ids = (data.messages || []).map((m) => m.id);
      // 并发拉取（6 路队列，避免 cursor 竞态）：用索引队列 worker 消费
      const msgs = [];
      const queue = ids.slice();
      async function worker() {
        while (queue.length) {
          const id = queue.shift();
          try {
            msgs.push(await api("messages/" + id + "?format=full"));
          } catch (e) {}
        }
      }
      await Promise.all(Array.from({ length: Math.min(6, queue.length || 0) }, worker));
      return msgs;
    }

    async function loadAll() {
      const profile = await api("profile");
      const byIdMap = new Map();
      const jobs = [
        { labelIds: "INBOX", maxResults: String(window.MyMailFetchCount || 40) },
        { labelIds: "SENT", maxResults: "20" },
        { labelIds: "DRAFT", maxResults: "20" },
        { labelIds: "SPAM", maxResults: "20" },
        { labelIds: "TRASH", maxResults: "20" },
        { labelIds: "STARRED", maxResults: "40" },
      ];
      for (const job of jobs) {
        const msgs = await fetchList(job);
        for (const raw of msgs) {
          const em = toEmail(raw);
          if (byIdMap.has(em.id)) {
            const prev = byIdMap.get(em.id);
            prev.starred = prev.starred || em.starred;
          } else byIdMap.set(em.id, em);
        }
      }
      return { profile, emails: [...byIdMap.values()] };
    }

    function utf8ToB64Url(str) {
      const bytes = new TextEncoder().encode(str);
      let bin = "";
      bytes.forEach((b) => (bin += String.fromCharCode(b)));
      return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    async function send({ to, cc, bcc, subject, body, threadId }) {
      // MIME 头里的非 ASCII（中文主题/地址）必须做 RFC 2047 encoded-word 编码，
      // 否则收件端看到的是乱码。纯 ASCII 直接放行，避免无谓编码。
      const encodeHeader = (value) => {
        const str = String(value || "");
        if (/^[\x20-\x7E]*$/.test(str)) return str;
        const bytes = new TextEncoder().encode(str);
        let bin = "";
        bytes.forEach((b) => (bin += String.fromCharCode(b)));
        return "=?UTF-8?B?" + btoa(bin) + "?=";
      };
      const headers = ["To: " + to];
      if (cc && String(cc).trim()) headers.push("Cc: " + String(cc).trim());
      if (bcc && String(bcc).trim()) headers.push("Bcc: " + String(bcc).trim());
      headers.push("Subject: " + encodeHeader(subject));
      headers.push("Content-Type: text/plain; charset=UTF-8");
      const raw = [...headers, "", body || ""].join("\r\n");
      const payload = { raw: utf8ToB64Url(raw) };
      if (threadId) payload.threadId = threadId;
      return api("messages/send", { method: "POST", body: JSON.stringify(payload) });
    }

    // 翻译：并发 + 简单内存缓存
    const translateCache = new Map();
    async function translateParagraphs(paragraphs, target) {
      const tl = target === "en" ? "en" : "zh-CN";
      const results = new Array(paragraphs.length);
      const needFetch = [];
      paragraphs.forEach((p, i) => {
        const key = tl + "\0" + p.slice(0, 1500);
        if (translateCache.has(key)) results[i] = translateCache.get(key);
        else needFetch.push({ idx: i, text: p.slice(0, 1500), key });
      });
      if (needFetch.length) {
        // 并发 4 路，避免一次性打满限频
        const queue = needFetch.slice();
        async function worker() {
          while (queue.length) {
            const job = queue.shift();
            const url =
              "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=" +
              tl +
              "&q=" +
              encodeURIComponent(job.text);
            const r = await fetch(url);
            if (!r.ok) throw new Error("翻译服务返回 " + r.status);
            const data = await r.json();
            const out = (data[0] || []).map((seg) => seg[0]).join("");
            translateCache.set(job.key, out);
            results[job.idx] = out;
          }
        }
        await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
      }
      return results;
    }

    async function searchAll(q) {
      const msgs = await fetchList({ q, maxResults: "30" });
      return msgs.map((raw) => toEmail(raw));
    }
    async function downloadAttachment(messageId, attachmentId) {
      const r = await api("messages/" + messageId + "/attachments/" + attachmentId);
      return r.data || "";
    }

    // 兼容旧调用：部分旧代码会调用 signIn()，新流程下引导到重定向
    async function signIn() {
      const t = getStoredToken();
      if (t) return t;
      throw new Error("登录已过期，请重新登录");
    }

    return {
      configured,
      signIn,
      startRedirectLogin,
      consumeRedirectToken,
      consumeRedirectError,
      consumeRedirectCode,
      getStoredToken,
      getStoredTokenSync,
      clearToken,
      loadAll,
      send,
      translateParagraphs,
      searchAll,
      downloadAttachment,
      suffix,
      providerName,
    };
  }

  window.MyMailGmail = createGmailClient("", "gmail");
  window.MyMailGmail2 = createGmailClient("2", "gmail2");
  window.createGmailClient = createGmailClient;
})();
