/* My Mail · 在线翻译（共享模块，Gmail / Outlook 通用）
   - 通道：MyMemory（api.mymemory.translated.net，返回 Access-Control-Allow-Origin: *，
     是少数能被浏览器 fetch 直连的免费翻译接口；Autodetect 自动识别源语言）；
     Google gtx 接口保留为兜底——它没有 CORS 头，纯浏览器环境会被拦，
     但在放宽了跨域限制的容器（如某些桌面壳）里可用。
   - 按段并发（4 路）+ LRU 内存缓存（上限 200 条）；超长段落按句切分成 ≤480 字的块。
   - 隐私：邮件正文会发送给在线翻译服务，UI 首次使用时提示一次。
   - 容错：单个段落请求失败只回退为原文，不拖垮整封邮件的翻译。 */

const CACHE_LIMIT = 200;
const SEG_MAX = 480; // MyMemory 单次查询建议 ≤500 字符
const translateCache = new Map();

function cacheSet(key, val) {
  if (translateCache.has(key)) translateCache.delete(key);
  translateCache.set(key, val);
  while (translateCache.size > CACHE_LIMIT) translateCache.delete(translateCache.keys().next().value);
}

/* 超长段落按句读边界切块（硬保证每块 ≤ SEG_MAX），翻译后原样拼回 */
export function splitSegments(text) {
  const src = String(text ?? "");
  if (src.length <= SEG_MAX) return [src];
  const sentences = src.split(/(?<=[。！？!?;；；.])\s*/);
  const merged = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && (cur + s).length > SEG_MAX) {
      merged.push(cur);
      cur = s;
    } else cur += s;
  }
  if (cur) merged.push(cur);
  const out = [];
  for (const p of merged) {
    if (p.length <= SEG_MAX) out.push(p);
    else for (let i = 0; i < p.length; i += SEG_MAX) out.push(p.slice(i, i + SEG_MAX));
  }
  return out;
}

/* 主通道：MyMemory。de 参数带一个联系邮箱可把匿名配额从 5k 字/天提到 50k 字/天 */
async function viaMyMemory(text, tl) {
  const url =
    "https://api.mymemory.translated.net/get?langpair=Autodetect%7C" +
    encodeURIComponent(tl) +
    "&de=demo%40mymail.app&q=" +
    encodeURIComponent(text);
  const r = await fetch(url);
  if (!r.ok) throw new Error("翻译服务返回 " + r.status);
  const data = await r.json();
  if (data.responseStatus !== 200 || !data.responseData)
    throw new Error(data.responseDetails || "翻译服务无结果");
  return String(data.responseData.translatedText || "");
}

/* 兜底通道：Google gtx（无 CORS 头，仅在被放宽跨域的环境里可用） */
async function viaGoogle(text, tl) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=" +
    tl +
    "&q=" +
    encodeURIComponent(text);
  const r = await fetch(url);
  if (!r.ok) throw new Error("翻译服务返回 " + r.status);
  const data = await r.json();
  return (data[0] || []).map((seg) => seg[0]).join("");
}

async function translateOne(text, tl) {
  const segs = splitSegments(text);
  const out = [];
  for (const seg of segs) {
    const key = tl + "\0" + seg;
    if (translateCache.has(key)) {
      out.push(translateCache.get(key));
      continue;
    }
    let translated;
    try {
      translated = await viaMyMemory(seg, tl);
    } catch (e) {
      translated = await viaGoogle(seg, tl);
    }
    cacheSet(key, translated);
    out.push(translated);
  }
  return out.join("");
}

export async function translateParagraphs(paragraphs, target) {
  const tl = target === "en" ? "en" : "zh-CN";
  const results = new Array(paragraphs.length);
  const needFetch = [];
  paragraphs.forEach((p, i) => {
    const key = tl + "\0" + p;
    if (translateCache.has(key)) results[i] = translateCache.get(key);
    else needFetch.push({ idx: i, text: p, key });
  });
  if (!needFetch.length) return results;
  const queue = needFetch.slice();
  async function worker() {
    while (queue.length) {
      const job = queue.shift();
      try {
        results[job.idx] = await translateOne(job.text, tl);
      } catch (e) {
        // 段落级容错：主+兜底都失败时保持原文，不缓存失败结果
        results[job.idx] = job.text;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
  return results;
}
