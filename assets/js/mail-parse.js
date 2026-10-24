/* My Mail · Gmail 邮件解析层（纯函数，无网络依赖）
   从 gmail.js 拆出来，便于单测；列表用 format=metadata 拉摘要，
   点开邮件时才 format=full 拉正文（payloadHasBody 判定走哪条路）。 */

export const decodeEntities = (s) => {
  const ta = document.createElement("textarea");
  ta.innerHTML = s || "";
  return ta.value;
};

export function header(headers, name) {
  const h = (headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? decodeEntities(h.value) : "";
}

export function parseAddress(from) {
  const m = /^(.*?)\s*<([^>]+)>$/.exec(from || "");
  if (m) return { name: m[1].replace(/^"|"$/g, "") || m[2], address: m[2] };
  return { name: from || "(未知)", address: from || "" };
}

export function b64ToText(data) {
  try {
    const bin = atob((data || "").replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch (e) {
    return "";
  }
}

export function collectParts(payload, texts, atts) {
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

export function payloadHasBody(payload) {
  if (!payload) return false;
  if (payload.body && payload.body.data) return true;
  return (payload.parts || []).some((p) => payloadHasBody(p));
}

export function gmailCategory(labelIds) {
  if (labelIds.includes("CATEGORY_PROMOTIONS")) return "promo";
  if (labelIds.includes("CATEGORY_SOCIAL")) return "social";
  if (labelIds.includes("CATEGORY_UPDATES") || labelIds.includes("CATEGORY_FORUMS")) return "updates";
  return null;
}

export function htmlPart(msg) {
  const parts = [];
  collectParts(msg.payload, parts, []);
  const hp = parts.find((p) => p.mime === "text/html");
  return hp ? hp.text : null;
}

export function bodyParagraphs(msg) {
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

export function primaryFolder(labelIds, fallback) {
  if (labelIds.includes("TRASH")) return "trash";
  if (labelIds.includes("SPAM")) return "spam";
  if (labelIds.includes("DRAFT")) return "drafts";
  if (labelIds.includes("SENT")) return "sent";
  return fallback || "inbox";
}

export function toEmail(msg, fallbackFolder, providerName) {
  const h = (msg.payload && msg.payload.headers) || [];
  const from = parseAddress(header(h, "From"));
  const labelIds = msg.labelIds || [];
  const d = new Date(Number(msg.internalDate || Date.now()));
  const pad = (n) => String(n).padStart(2, "0");
  // metadata 格式不带正文：先用 snippet 占位、bodyLoaded=false，
  // 点开时由 select() 调 fetchFull 补全正文与附件
  const hasBody = payloadHasBody(msg.payload);
  const snippet = decodeEntities(msg.snippet || "");
  return {
    id: msg.id,
    provider: providerName,
    bodyLoaded: hasBody,
    ts: Number(msg.internalDate || 0),
    from: from.name,
    address: from.address,
    to: header(h, "To") || "我",
    date: `${d.getMonth() + 1}月${d.getDate()}日`,
    time: `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`,
    subject: header(h, "Subject") || "(无主题)",
    snippet,
    label: null,
    folder: primaryFolder(labelIds, fallbackFolder),
    archived:
      !labelIds.includes("INBOX") && !["TRASH", "SPAM", "DRAFT", "SENT"].some((x) => labelIds.includes(x)),
    unread: labelIds.includes("UNREAD"),
    starred: labelIds.includes("STARRED"),
    body: hasBody ? bodyParagraphs(msg) : snippet ? [snippet] : ["(正文加载中…)"],
    bodyHtml: hasBody ? htmlPart(msg) : null,
    bodyZh: null,
    attachments: hasBody
      ? (() => {
          const atts = [];
          collectParts(msg.payload, [], atts);
          return atts;
        })()
      : [],
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
