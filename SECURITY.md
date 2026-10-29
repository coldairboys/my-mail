# 安全与数据流

My Mail 是一个**纯静态前端**项目：没有后端服务器，没有数据库，没有自建 API。全部逻辑跑在你的浏览器里。

这份文档说明三件事：**数据往哪儿走**、**安全边界在哪儿**、**已知风险有哪些**。

---

## 一、信任边界

```
┌─────────────────────────────────────────────────────────┐
│  你的浏览器（本站唯一可信的执行环境）                      │
│                                                         │
│  index.html + assets/js/*                                │
│      ↓                                                  │
│  · 演示数据 & 偏好 ──→ localStorage                      │
│  · OAuth 令牌    ──→ sessionStorage                      │
│  · 真实邮件内容 ──→ 仅内存（刷新即失）                    │
│      ↓                                                  │
│  ┌───────────────────────────────────────────┐           │
│  │ sandbox iframe（HTML 邮件渲染）              │  ← 不可信内容 │
│  │  仅 allow-popups，无 allow-scripts          │           │
│  │  无 allow-same-origin → 拿不到本站存储      │           │
│  └───────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────┘
        │  ① OAuth 授权跳转（浏览器整页跳到 Google / Microsoft）
        │  ② 邮件 API 调用（Gmail / Graph）
        │  ③ 翻译调用（MyMemory / Google）—— 仅你主动点翻译
        ▼
  Google / Microsoft 官方服务    第三方翻译服务
```

**唯一不可信的两块输入**：第三方翻译服务返回的文本、服务商返回的邮件 HTML。两者都在下面「HTML 邮件沙箱」和「转义」两节里有对应处理。

---

## 二、数据流

### 令牌（最敏感）

| 提供商  | 流程                                            | 令牌存放         | 有效期    |
| ------- | ----------------------------------------------- | ---------------- | --------- |
| Gmail   | OAuth 2.0 **隐式流程**（`response_type=token`） | `sessionStorage` | 约 1 小时 |
| Outlook | OAuth 2.0 **授权码 + PKCE（S256）**             | `sessionStorage` | 约 1 小时 |

- 令牌**只**写 `sessionStorage`，**不写** `localStorage`，**不落盘**，**不上传**任何自建服务器。
- 关掉标签页 → `sessionStorage` 即清空 → 令牌失效。
- 授权回调返回后，代码立刻用 `history.replaceState` 把 URL 上的 `code` / `state` / `access_token` 片段清掉，避免进入浏览历史或被复制出去。
- 仓库里只有 **Client ID**（公开标识，不是密钥）。**不要提交 `client_secret`**，本项目不需要也不使用它。

### 邮件内容

- 真实邮件（主题 / 正文 / 附件 / 发件人）**只存在于浏览器内存**，不写 `localStorage`，刷新或关页即消失。
- `localStorage`（键 `mymail-state-v2`）里只有：演示数据（虚构）+ 界面偏好（主题、密度、排序、签名、过滤规则、拉取数量等）。
- 读取邮件时，页面会向 `gmail.googleapis.com` 或 `graph.microsoft.com` 发起带 `Authorization: Bearer <token>` 的请求。这是浏览器直连服务商，**没有中间服务器**。
- 发送邮件时同理，请求直接发给服务商。

### 翻译（唯一会把正文发出去的功能）

- 只有你点「翻译成中文」时才会发生。
- 邮件正文按段发送给 **MyMemory**（`api.mymemory.translated.net`，主通道）；失败时兜底 **Google gtx**（`translate.googleapis.com`）。
- 首次使用翻译会弹一次提示（该提示状态记在 `localStorage`，每个浏览器只提示一次）。
- 演示数据自带中英对照译文，**不联网**。
- 请求参数里带了一个联系邮箱 `demo@mymail.app`，用于把 MyMemory 匿名配额从 5k 字/天提到 50k 字/天。这是个占位地址，**不是真实用户的邮箱**；如果你自用并在意这一点，把它换成自己的邮箱或删掉这个参数。

### 附件

- 点击附件时向服务商请求附件数据（Gmail 用 `attachments/{id}`，Graph 用 `/attachments/{id}/$value`），浏览器拿到数据后本地触发下载。
- 附件**不经过**任何第三方服务。

---

## 三、防护措施

### CSP（内容安全策略）

`vite.config.js` 在 **生产构建时**注入 `<meta http-equiv="Content-Security-Policy">`；dev 模式不注入（Vite HMR 需要内联脚本与 ws 连接，否则热更新会被自己的 CSP 拦掉）。

```
default-src 'self';
connect-src 'self' https://gmail.googleapis.com https://graph.microsoft.com
            https://oauth2.googleapis.com https://accounts.google.com
            https://login.microsoftonline.com https://translate.googleapis.com
            https://api.mymemory.translated.net;
frame-src 'self' blob: data:;
img-src 'self' data: https: blob:;
media-src 'self' data: blob:;
font-src 'self' data:;
style-src 'self' 'unsafe-inline';
script-src 'self';
object-src 'none';
base-uri 'self';
```

要点：

- `script-src 'self'` —— **不含** `'unsafe-inline'`。首屏主题脚本早已外置为 `theme-boot.js`，页面没有内联脚本、没有内联事件属性，应用也不会动态注入 `<script>`。
- `style-src` 仍保留 `'unsafe-inline'`，因为模板大量使用行内 `style` 属性。
- `connect-src` 收敛到实际调用的 API 域，不允许任意域名外发数据。
- `object-src 'none'`、`base-uri 'self'` 防止插件对象注入与 `<base>` 标签劫持。

> ⚠️ CSP 通过 `<meta>` 注入，因此**只对 `<meta>` 之后的内容生效**，且不能使用 `frame-ancestors` 等部分指令。若要更强防护，建议在托管层（GitHub Pages 的 `_headers` 文件或自有服务器）加 HTTP 响应头。

### HTML 邮件沙箱

服务商返回的 HTML 邮件正文是不可信内容，可能包含脚本、追踪像素、外部资源。项目对它的处理：

```js
ifr.setAttribute("sandbox", "allow-popups"); // 只允许外链弹窗
ifr.setAttribute("referrerpolicy", "no-referrer");
ifr.srcdoc = html;
```

- **不给** `allow-scripts` → 邮件里的 `<script>` 不执行。
- **不给** `allow-same-origin` → iframe 是独立的不透明源，拿不到本站的 `localStorage` / `sessionStorage`，也就拿不到 OAuth 令牌。
- **不给** `allow-top-navigation` → 邮件里的链接不能把本站跳走；`<base target="_blank" rel="noopener">` 让外链在新标签打开。
- `referrerpolicy="no-referrer"` → 邮件里的资源请求不携带本站 URL 作为 Referer。
- 沙箱没有同源权限，所以拿不到 `contentDocument`，**无法自动测量高度**；iframe 用受限高度 + 内部滚动，超长邮件不会撑爆版面。

### HTML 转文本（取摘要时）

服务端返回的 HTML 在提取纯文本时，用 `DOMParser` 解析到**独立 document**，并先移除 `script` / `style` / `noscript` / `template`：

```js
const doc = new DOMParser().parseFromString(html || "", "text/html");
doc.querySelectorAll("script, style, noscript, template").forEach((el) => el.remove());
return doc.body.textContent || "";
```

`DOMParser` 解析出的文档处于 inert 状态，不加载图片、不执行脚本、不发请求。

其余渲染到 DOM 的邮件字段（主题、发件人、正文段落）统一走 `esc()` 转义（`utils.js`），把 `& < > " '` 换成实体。

### 追踪防护

「隐藏图片」开关会把 HTML 邮件里的 `img src` / `srcset` / CSS 背景图改写掉，阻止邮件追踪像素回传「已读」信号。

### 其他

- 未捕获异常走全局兜底 toast，不静默白屏。
- 登录态校验：Outlook 的 PKCE 回调严格比对 `state`（不匹配即拒绝并要求重新登录）；Gmail 隐式流程用随机 `state` 防 CSRF。
- CI 门禁：每次 push / PR 跑 `lint` + `test` + `build`。

---

## 四、已知风险

### Gmail 隐式流程的取舍

Google 对「Web 应用」类型客户端在**授权码换令牌**时强制要求 `client_secret`。纯静态网页无法安全持有密钥，所以项目改用**隐式流程**（`response_type=token`），令牌从 URL 片段返回。

代价：

| 问题                  | 影响                                                   | 缓解                                                                               |
| --------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 令牌走 URL 片段返回   | 若回调 URL 被记录（浏览器历史、Referer、截图）可能泄露 | 落地后立刻 `replaceState` 清 URL；`referrerpolicy` 收紧；令牌只在 `sessionStorage` |
| 无法主动吊销          | 授权后只能靠 Google 账号页手动撤销，或等令牌过期       | 有效期约 1 小时；只申请 `gmail.readonly` + `gmail.send` 最小权限                   |
| Google 已不推荐该流程 | 长期看有被弃用风险                                     | 代码里保留了迁回 code flow 的路径注释                                              |

**展望**：Google 的 GIS「Token client」模式允许无 `client_secret` 做 code 交换，若将来可用，应优先迁回 PKCE code flow。

Outlook 走的是标准 PKCE（`code_challenge_method=S256`），没有这个问题。

### 令牌无法静默续期

授权用 `access_type=online`，浏览器拿不到 `refresh_token`（持有它需要后端配合 `client_secret` 与长期安全存储，违背纯静态零服务器的初衷）。Access Token 过期后 API 返回 401，界面提示「登录已过期」，点一下重新授权即可。

### 第三方翻译服务可见正文

翻译是本项目唯一会把邮件正文发到第三方服务商的路径。MyMemory 是公开的免费接口，理论上会记录请求内容。介意的话：不要点翻译，或在设置里保留演示模式。

### 本地存储被同源脚本读取

令牌在 `sessionStorage`、邮件在内存里。如果**本机上有其他恶意脚本**运行在同一个源（`origin`）下——比如某个被攻破的依赖、一个同域名的用户脚本——它能读到令牌和内存数据。这是纯前端架构无法消除的固有问题：没有后端就没有第二道隔离。

缓解：只从官方 Pages 域访问、不要在同域部署其他应用、不要安装来源不明的浏览器扩展。

### `localStorage` 里存着演示数据与偏好

演示数据是虚构的，不敏感；但偏好里可能包含**邮件签名**（`state.signature`）——如果你在签名里写了敏感信息，它会明文留在 `localStorage`。清除方式：浏览器设置里清站点数据，或应用内「恢复演示数据」。

### 单页应用部署在 GitHub Pages

Pages 是纯静态托管，**收不到任何数据**——这一点既是隐私保证，也是能力上限：没有服务端就做不了服务端翻译、refresh token、服务端过滤规则。

### CSP 的 `<meta>` 注入局限

见上文「CSP」小节：`frame-ancestors` 无法用 `<meta>` 设置；且 `<meta>` 必须在文档前部。

---

## 五、给部署者的建议

1. **用 HTTPS**（GitHub Pages 默认提供）。令牌走 URL 片段返回，明文 HTTP 下会被网络中间人看到。
2. **不要**在 `assets/js/config.js` 里填 `client_secret`，也不要新增任何服务端密钥。
3. 若自建托管，考虑加 HTTP 响应头版的 CSP（比 `<meta>` 更强，能用 `frame-ancestors`）：
   ```
   Content-Security-Policy: default-src 'self'; script-src 'self'; ...
   X-Frame-Options: DENY
   Referrer-Policy: no-referrer
   ```
4. 想彻底清空本地状态：浏览器开发者工具 → Application → Clear site data，或地址栏访问 `chrome://settings/content/all` 删掉本站记录。

---

## 六、漏洞报告

这是一个个人自用项目，没有正式的安全响应流程。如果你发现了真实可利用的问题，欢迎直接提 Issue 或联系作者（仓库地址见 [README](README.md)）。请**不要**在公开 Issue 里贴出他人的真实邮件内容、令牌或凭据。

---

## 相关文档

- 功能与用法：[README.md](README.md)
- 版本历史：[CHANGELOG.md](CHANGELOG.md)
