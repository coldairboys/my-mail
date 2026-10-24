import { describe, it, expect } from "vitest";
import {
  decodeEntities,
  header,
  parseAddress,
  b64ToText,
  collectParts,
  payloadHasBody,
  gmailCategory,
  primaryFolder,
  toEmail,
} from "../assets/js/mail-parse.js";

describe("decodeEntities", () => {
  it("解码 HTML 实体", () => {
    expect(decodeEntities("A &amp; B &lt;tag&gt;")).toBe("A & B <tag>");
  });
  it("空输入返回空串", () => {
    expect(decodeEntities("")).toBe("");
    expect(decodeEntities(undefined)).toBe("");
  });
});

describe("header", () => {
  it("大小写不敏感取头并解码实体", () => {
    const hs = [{ name: "Subject", value: "Hi &amp; bye" }];
    expect(header(hs, "subject")).toBe("Hi & bye");
  });
  it("缺失的头返回空串", () => {
    expect(header([{ name: "From", value: "x" }], "To")).toBe("");
    expect(header(undefined, "To")).toBe("");
  });
});

describe("parseAddress", () => {
  it("解析「名字 <地址>」并去掉引号", () => {
    expect(parseAddress('"Zhang San" <zhang@gmail.com>')).toEqual({
      name: "Zhang San",
      address: "zhang@gmail.com",
    });
  });
  it("无引号名字", () => {
    expect(parseAddress("Zhang San <zhang@gmail.com>")).toEqual({
      name: "Zhang San",
      address: "zhang@gmail.com",
    });
  });
  it("纯地址:名字与地址相同", () => {
    expect(parseAddress("a@b.com")).toEqual({ name: "a@b.com", address: "a@b.com" });
  });
  it("空输入回退为(未知)", () => {
    expect(parseAddress("")).toEqual({ name: "(未知)", address: "" });
  });
});

describe("b64ToText", () => {
  it("解码 UTF-8 base64url", () => {
    // "你好" 的 UTF-8 字节编码为 5L2g5aW9
    expect(b64ToText("5L2g5aW9")).toBe("你好");
  });
  it("标准 base64 的 + / 字符(URL 形态为 - _)也能解码", () => {
    // "Hi~" 的标准 base64 是 SGl+（含 +），URL 形态为 SGl-
    expect(b64ToText("SGl-")).toBe("Hi~");
    // "OK?~" 的标准 base64 是 T0s/fg==（含 /），URL 形态为 T0s_fg==
    expect(b64ToText("T0s_fg==")).toBe("OK?~");
  });
  it("非法输入返回空串而不是抛错", () => {
    expect(b64ToText("!!!not-base64!!!")).toBe("");
    expect(b64ToText(undefined)).toBe("");
  });
});

describe("payloadHasBody", () => {
  it("full 格式判定有正文", () => {
    expect(payloadHasBody({ body: { data: "abcd" } })).toBe(true);
    expect(payloadHasBody({ parts: [{ parts: [{ body: { data: "x" } }] }] })).toBe(true);
  });
  it("metadata 格式(无 body.data)判定无正文", () => {
    expect(payloadHasBody({ headers: [], body: { size: 0 } })).toBe(false);
    expect(payloadHasBody({ headers: [] })).toBe(false);
    expect(payloadHasBody(undefined)).toBe(false);
  });
});

describe("collectParts", () => {
  it("递归收集正文文本与附件", () => {
    const texts = [];
    const atts = [];
    collectParts(
      {
        mimeType: "multipart/mixed",
        parts: [
          { mimeType: "text/plain", body: { data: "aGVsbG8" } },
          { filename: "a.pdf", mimeType: "application/pdf", body: { size: 123, attachmentId: "att1" } },
        ],
      },
      texts,
      atts
    );
    expect(texts).toEqual([{ mime: "text/plain", text: "hello" }]);
    expect(atts).toEqual([
      { filename: "a.pdf", mimeType: "application/pdf", size: 123, attachmentId: "att1" },
    ]);
  });
});

describe("gmailCategory", () => {
  it("映射 Gmail 分类标签", () => {
    expect(gmailCategory(["CATEGORY_PROMOTIONS"])).toBe("promo");
    expect(gmailCategory(["CATEGORY_SOCIAL"])).toBe("social");
    expect(gmailCategory(["CATEGORY_UPDATES"])).toBe("updates");
    expect(gmailCategory(["CATEGORY_FORUMS"])).toBe("updates");
    expect(gmailCategory(["INBOX"])).toBeNull();
  });
});

describe("primaryFolder", () => {
  it("按标签优先级归文件夹", () => {
    expect(primaryFolder(["TRASH", "INBOX"])).toBe("trash");
    expect(primaryFolder(["SPAM"])).toBe("spam");
    expect(primaryFolder(["DRAFT"])).toBe("drafts");
    expect(primaryFolder(["SENT"])).toBe("sent");
    expect(primaryFolder(["INBOX"])).toBe("inbox");
    expect(primaryFolder([], "archive")).toBe("archive");
  });
});

describe("toEmail", () => {
  const fullMsg = {
    id: "m1",
    threadId: "t1",
    internalDate: "1735000000000",
    snippet: "hello world",
    labelIds: ["INBOX", "UNREAD", "CATEGORY_PROMOTIONS", "IMPORTANT"],
    payload: {
      headers: [
        { name: "From", value: "Sender <s@x.com>" },
        { name: "To", value: "me@x.com" },
        { name: "Subject", value: "Greeting" },
        { name: "List-Unsubscribe", value: "<https://x.com/unsub>, <mailto:u@x.com>" },
      ],
      mimeType: "text/plain",
      body: { data: "aGVsbG8" },
    },
  };
  const metaMsg = {
    id: "m2",
    threadId: "t2",
    internalDate: "1735000000000",
    snippet: "这是一段摘要",
    labelIds: ["INBOX"],
    payload: {
      headers: [
        { name: "From", value: "S2 <s2@x.com>" },
        { name: "Subject", value: "Meta" },
      ],
      body: { size: 0 },
    },
  };

  it("full 邮件:bodyLoaded=true,解析正文/分类/未读/退订", () => {
    const em = toEmail(fullMsg, undefined, "gmail");
    expect(em.bodyLoaded).toBe(true);
    expect(em.body).toEqual(["hello"]);
    expect(em.category).toBe("promo");
    expect(em.important).toBe(true);
    expect(em.unread).toBe(true);
    expect(em.address).toBe("s@x.com");
    expect(em.subject).toBe("Greeting");
    expect(em.unsub).toBe("https://x.com/unsub");
    expect(em.provider).toBe("gmail");
  });

  it("metadata 邮件:bodyLoaded=false,正文用 snippet 占位,等点开再补", () => {
    const em = toEmail(metaMsg, undefined, "gmail");
    expect(em.bodyLoaded).toBe(false);
    expect(em.body).toEqual(["这是一段摘要"]);
    expect(em.bodyHtml).toBeNull();
    expect(em.attachments).toEqual([]);
    expect(em.subject).toBe("Meta");
    expect(em.snippet).toBe("这是一段摘要");
  });

  it("无 List-Unsubscribe 时 unsub 为 null", () => {
    const em = toEmail(metaMsg, undefined, "gmail");
    expect(em.unsub).toBeNull();
  });
});
