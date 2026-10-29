import { describe, it, expect } from "vitest";
import { parseHtmlToText, bodyParagraphs, htmlPart } from "../assets/js/mail-parse.js";

// btoa 只接受 latin1：中文正文先按 UTF-8 编成字节再逐字节转，模拟 Gmail 的 base64url 正文
function b64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

describe("parseHtmlToText", () => {
  it("提取纯文本，去掉标签", () => {
    expect(parseHtmlToText("<p>hello <b>world</b></p>")).toBe("hello world");
  });

  it("解码 HTML 实体", () => {
    expect(parseHtmlToText("<p>A &amp; B</p>")).toBe("A & B");
  });

  it("script/style 内容不进入文本", () => {
    const t = parseHtmlToText("<style>.x{color:red}</style><p>hi</p><script>alert(1)</script>");
    expect(t).not.toContain("alert");
    expect(t).not.toContain("color:red");
    expect(t).toContain("hi");
  });

  it("img 的 src 不进入文本（textContent 本不含 alt）", () => {
    const t = parseHtmlToText('<p><img src="https://tracker.example/pixel" alt="logo">x</p>');
    expect(t).not.toContain("tracker.example");
    expect(t).toContain("x");
  });

  it("空输入与空文档返回空串，不抛错", () => {
    expect(parseHtmlToText("")).toBe("");
    expect(parseHtmlToText(undefined)).toBe("");
    expect(parseHtmlToText("<div></div>")).toBe("");
  });
});

describe("bodyParagraphs（HTML 正文降级路径）", () => {
  it("无 text/plain 时从 text/html 提取段落", () => {
    const html = "<p>第一段</p>\n\n<p>第二段</p>";
    const msg = {
      payload: {
        parts: [{ mimeType: "text/html", body: { data: b64(html) } }],
      },
    };
    expect(bodyParagraphs(msg)).toEqual(["第一段", "第二段"]);
  });

  it("HTML 提取结果为空时回退 snippet", () => {
    const msg = {
      snippet: "这是摘要",
      payload: {
        parts: [{ mimeType: "text/html", body: { data: btoa("<div></div>") } }],
      },
    };
    expect(bodyParagraphs(msg)).toEqual(["这是摘要"]);
  });
});

describe("htmlPart", () => {
  it("返回 text/html 部分原文", () => {
    const msg = {
      payload: {
        parts: [
          { mimeType: "text/plain", body: { data: btoa("plain") } },
          { mimeType: "text/html", body: { data: btoa("<p>rich</p>") } },
        ],
      },
    };
    expect(htmlPart(msg)).toBe("<p>rich</p>");
  });

  it("无 HTML 部分返回 null", () => {
    const msg = { payload: { parts: [{ mimeType: "text/plain", body: { data: btoa("plain") } }] } };
    expect(htmlPart(msg)).toBeNull();
  });
});
