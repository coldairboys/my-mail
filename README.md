# My Mail · 清爽邮件

一个清爽的三栏邮件管理网页版：左边文件夹与标签，中间邮件列表，右边阅读区。
没有日历、没有会议、没有广告，只做邮件本身。

> 当前是 **v4 前端版**：内置虚构的示例邮件（演示模式），同时已支持用 Google
> OAuth 登录真实 Gmail（只读 + 发送），以及用 Microsoft Graph 登录个人 Outlook。
> 真实邮件只在浏览器内存里，不落盘、不进仓库。
> 接入方法见下方 [接入 Gmail](#接入-gmail真实邮箱只读--发送) 与 [接入 Outlook](#接入-outlook可选)。

## 在线预览

GitHub Pages：**https://coldairboys.github.io/my-mail/**

（部署方式：仓库 Settings → Pages → Deploy from a branch，选 `main` 分支、根目录。
推送到 `main` 后，Pages 会自动重新发布，稍等一两分钟刷新即可。）

## 功能

- 📥 **三栏布局，全屏铺满** — 文件夹 / 标签侧边栏、邮件列表、阅读区（不是窗口模式，无系统窗口装饰）
- ↔️ **可拖拽的列宽** — 列表栏与阅读区之间的分隔条可拖动调整宽度（260–942px 之间，阅读区保底 320px），悬停 / 拖动时显示强调色细线；也支持键盘左右方向键微调（每次 24px）；宽度存 `localStorage`，刷新后保持；移动端不显示该分隔条
- 🗂️ **侧栏可折叠** — 桌面端侧栏顶部按钮可把左栏收成 64px 图标栏（图标保留且可点，文字隐藏，悬停有提示），带过渡动画；折叠状态也会记住
- ⚡ **列表悬浮操作与彩色头像** — 每行列表显示发件人彩色首字母头像与附件标识；鼠标悬停即平滑浮出「删除 / 归档 / 标已读 / 星标」快捷操作按钮；选中态重构为左侧品牌色竖条与柔和底色，告别深蓝刺眼铺满；移动端保留直接点击星标与左滑删除
- 💬 **内联快捷回复** — 阅读区正文底部常驻轻量快捷回复卡片，支持就地回复并一键发送（演示模式存已发送，真实模式直发接口）；支持一键引用原文、插入签名与随时展开为完整编辑窗口
- ✎ **写信窗口三态切换（浮动 / 最小化 / 全屏）** — 桌面端写信窗口默认以右下角浮动小窗呈现，不遮挡背景阅读与操作，可一边查阅收件箱一边起草；支持最小化折叠停靠、还原为浮动窗口或最大化全屏扩展；移动端自适应全屏
- 📂 **12 个文件夹** — 收件箱、已加星标、重要邮件、已延后、草稿、已发送、所有邮件、推广、社交、动态、垃圾邮件、废纸篓，侧栏显示邮件数量（为 0 时不显示）
- 🏷️ **5 个标签** — 工作 / 生活 / 开发 / 账单 / 订阅，点标签即筛选
- 🔍 **搜索与筛选** — 输入即搜（防抖 220ms），匹配发件人、地址、主题、摘要与正文；漏斗按钮可筛 全部/未读/已读/星标；真实模式下只要有关键词，列表下方会出现「在邮箱中搜索全部「xxx」」，点了直接去 Gmail / Outlook 服务器搜并补进列表；三个点菜单可全部标已读、切换排序（最新/最早在前）、清空废纸篓或垃圾邮件、恢复演示数据
- 🗂️ **分类与重要邮件** — 列表行上显示「推广 / 社交 / 动态」分类小标签与「重要」标记；真实 Gmail 下读 `CATEGORY_*` 与 `IMPORTANT` 标签，Outlook 下按 `importance === "high"` 判断重要
- ✅ **多选与批量操作** — 三个点菜单进入多选模式，行首出现勾选框，批量栏顶部有 **全选** 方框（作用于当前可见列表，即搜索 / 筛选后的结果），勾选后浮出批量栏：归档（仅收件箱内的邮件）/ 已读 / 删除 / 取消；未选中任何邮件时批量按钮自动禁用；批量删除不弹撤销，需去废纸篓逐封撤销
- 👤 **发件人分析** — 侧栏「发件人分析」列出当前视图（不含废纸篓与垃圾邮件）里发件最多的前 12 位（含邮件数、未读数）与汇总（总封数 / 未读 / 带附件 / 发件人数），点某位发件人直接按其地址筛选列表
- 🌐 **一键翻译** — 英文邮件点「翻译成中文」切换译文，再点回到原文（中文邮件可译成英文）；演示数据自带中英对照译文，真实 Gmail 邮件走在线翻译接口（按段并发、带内存缓存）
- ✎ **写信 / 回复 / 转发** — 整页卡片式排版：标题栏显示「新邮件 / 回复邮件 / 转发邮件」与原发件人，字段区可选发件账号、收件人、**抄送 / 密送**（点一下展开，真实模式下随发送一并下发）、主题；正文区带工具栏（**插入签名**、**引用原文**、实时字数统计）；底部为 丢弃 / 存草稿 / 发送。回复自动填 `Re:` 与原发件人，转发自动填 `Fwd:`；引用原文按需插入、不默认塞进正文；关闭时自动存草稿；演示模式不真发出
- ☆ **常用动作** — 阅读工具栏 6 个动作：延后到明天、归档、星标、标已读/未读、标垃圾、删除；单封删除带「撤销」，在废纸篓里再删是彻底删除（同样可撤销）；顶部 ‹ › 切换上一封/下一封并显示当前位置计数
- 📎 **附件板块** — 邮件带附件时正文下方出现附件列表（文件名 + 大小）；真实模式下点附件即下载，演示附件仅作展示
- 🚫 **退订** — 发件人一行右侧有「退订」按钮：邮件带 `unsub` 链接时打开官方退订页（`mailto:` 则跳到写退订邮件），没有退订信息时只给提示、不跳转
- 🖼️ **HTML 邮件沙箱渲染** — HTML 邮件在 `sandbox` iframe 内按原排版显示（不授予脚本与同源权限）；「隐藏图片」会把 `img`/`srcset`/背景图改写掉，用于防邮件追踪
- 🧹 **过滤规则** — 设置里自建规则（发件人含 / 主题含关键词 → 移到垃圾邮件 / 删除 / 归档 / 标已读 / 加星标），真实邮箱加载完成后自动执行并提示命中数量；规则可逐条删除
- ⚙️ **设置与写信全屏** — 设置、写信、回复、转发都是整页全屏，正文块居中限宽（宽屏下不会把控件拉到两端）；设置项包含主题、显示密度、自动已读、快捷键开关、拉取数量、默认发件账号、邮件签名、翻译目标语言、过滤规则、恢复演示数据
- 🔄 **刷新** — 列表工具栏刷新按钮：真实账号下重新拉取当前视图（统一收件箱会并发拉全部已登录账号），演示模式提示无需刷新
- 📊 **显示密度** — 设置里可选 舒适 / 紧凑；紧凑模式隐藏列表摘要、收紧行高
- 🌗 **主题** — 白天 / 黑夜 / 跟随系统三档，右上角按钮一键循环切换，选择会记住
- 📱 **手机端** — ≤860px 单栏布局、抽屉式侧边栏、阅读页全屏覆盖；邮件列表支持 **左滑删除**（Gmail 式红色揭示，滑过阈值松手即删除，可撤销）；右下角悬浮写邮件按钮
- ⌨️ **键盘快捷键** — `j` / `k` 上下切换、`e` 归档、`#` 删除、`r` 回复、`s` 星标、`u` 返回列表（收起移动端阅读页）、`Esc` 关闭弹窗 / 收起下拉与抽屉；设置里可整体开关，关闭后 `Esc` 仍有效
- ♿ **可访问性** — 首屏 `skip-link` 跳转、弹窗焦点陷阱（Tab 在弹窗内循环；写信页关闭后还原原焦点）、`aria-live` 播报列表数量/分页位置/Toast、列表行与导航项可用回车或空格激活、`focus-visible` 轮廓
- 💾 **本地持久化** — 演示邮件与偏好（主题、密度、排序、签名、规则、自动已读、快捷键开关、拉取数量）存在 `localStorage`，刷新不丢失；真实邮件只在内存
- 🔐 **多账号（Gmail ×2 + Outlook）** — Gmail 走 OAuth 2.0 PKCE 整页跳转（只读 + 发送）；Outlook 走 Microsoft Graph PKCE（`User.Read` + `Mail.Read` + `Mail.Send`）；可同时登录三个账号，顶部 chips 切 全部 / 各账号 / 演示，写信时可选发件账号，收件人输入框带通讯录补全（来自已加载邮件的联系人）；同一 Gmail 账号重复添加会被拦下；侧栏底部显示同步状态（服务商返回总量时附邮箱总封数）
- 🧪 **演示数据** — 内置邮件均为本项目原创虚构（含中英对照译文、附件、HTML 邮件、退订链接、分类），不取材于任何真实邮件

## 本地运行

项目本身是纯静态站点：`index.html` + `assets/` 即可运行，没有运行时依赖。
仓库同时提供了 Vite / ESLint / Prettier 的开发脚本（见 `package.json`）。

```bash
npm install        # 安装开发依赖（vite / eslint / prettier），仅开发时需要
npm run dev        # 启动 Vite 开发服务器（默认 http://localhost:5173）
npm run build      # 构建到 dist/
npm run preview    # 预览构建产物（默认 http://localhost:4173）
npm run lint       # ESLint 检查 assets/js
npm run format     # Prettier 格式化 assets 下的 js/css/html
npm run format:check  # 只检查格式、不写入
```

不装 npm 也能用，起一个静态服务器即可（推荐，因为入口是 ES Module）：

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

> 直接双击 `index.html`（`file://` 协议）在部分浏览器里可能被 CORS 拦下，导致
> `assets/js/app-init.js` 这个 ES Module 入口加载失败。用上面的
> 本地服务器或 `npm run dev` 即可。

## 目录结构

```
my-mail/
├── index.html                  # 页面结构：三栏布局、写邮件/设置/发件人分析全屏页与弹窗、登录页
├── assets/
│   ├── css/
│   │   └── styles.css          # 全部样式（明暗双主题变量、三栏布局、手机端抽屉与左滑）
│   └── js/
│       ├── config.js           # 全局配置：Google Client ID、MS Client ID、Gmail 权限范围（普通 script）
│       ├── config.module.js    # 配置的 ES Module 包装：导出 MYMAIL_CONFIG 并回挂 window（当前入口未引用）
│       ├── data.js             # 演示数据（普通 script 版），供旧 app.js 回退路径读 window 全局
│       ├── data.module.js      # 演示数据（ES Module 版）：LABELS / FOLDERS / SEED_EMAILS
│       ├── utils.js            # 工具函数：HTML 转义、头像首字母与配色、防抖、rAF 节流、文件大小格式化
│       ├── store.js            # 状态仓库：localStorage 持久化（含 quota 兜底）、多账号 Map、当前视图取数
│       ├── app-core.js         # 核心逻辑：导航/列表/阅读区渲染、事件绑定、快捷键、主题密度、写信与设置
│       ├── app-init.js         # 模块入口：首屏渲染、OAuth 回调消费、登录页与账号切换、过滤规则表单
│       ├── gmail.js            # Gmail 接入层：PKCE 授权、拉取/解析邮件、发送、翻译、附件下载、服务器搜索
│       ├── outlook.js          # Outlook 接入层：Microsoft Graph + PKCE，拉取/正文附件按需加载、发送、搜索
│       └── app.js              # v2 旧版单文件应用逻辑，保留作回退，当前 index.html 不再加载
├── package.json                # 开发脚本与 devDependencies（vite / eslint / prettier）
├── vite.config.js              # Vite 配置：根为项目根，构建输出 dist/
├── eslint.config.js            # ESLint 扁平配置（ES2022 module，浏览器全局）
├── .prettierrc                 # Prettier 格式约定（printWidth 110、2 空格）
├── .editorconfig               # 编辑器基础约定（utf-8 / LF / 2 空格）
├── LICENSE                     # MIT
└── README.md
```

`index.html` 的加载顺序是：`config.js` → `data.js` → `gmail.js` → `outlook.js`
（四个普通 script，同步执行，保证 `window.MYMAIL_CONFIG` 与全局数据就绪），
再由 `<script type="module" src="assets/js/app-init.js">` 拉起模块化入口。

## 接入 Gmail（真实邮箱，只读 + 发送）

1. 打开 [Google Cloud 控制台](https://console.cloud.google.com/)，新建一个项目（名字随意，如 `my-mail`）
2. 「API 和服务 → 库」里搜索 **Gmail API** 并启用
3. 「API 和服务 → OAuth 权限请求页面」：选择 External，填应用名和你的邮箱；
   在「测试用户」里把你自己的 Gmail 加进去（测试模式足够自用）
4. 「API 和服务 → 凭据 → 创建凭据 → OAuth 客户端 ID」：类型选 **Web 应用**，
   在「已获授权的 JavaScript 来源」里加上 `https://coldairboys.github.io`
   （本地调试再加 `http://localhost:8000`）
5. 把生成的 **Client ID** 填进 `assets/js/config.js` 的 `GOOGLE_CLIENT_ID`，推送即可
6. 打开 Pages 站点 → 登录页点「使用 Google 登录」→ 在 Google 官方页面授权
   （测试模式会提示「未经验证的应用」，点 高级 → 继续，这是自用项目的正常提示）

登录页还有一个「先用演示模式进入」，不想授权也能直接看界面与交互。

## 接入 Outlook（可选）

1. 在 [Microsoft Entra 管理中心](https://entra.microsoft.com/) 注册一个应用（支持个人 Microsoft 账号，代码走 `consumers` 端点）
2. 平台选 **单页应用（SPA）**，重定向 URI 填页面实际地址（代码取 `location.origin + pathname`，
   例如从 `http://localhost:8000/index.html` 打开就填这一整条）
3. 添加 `User.Read`、`Mail.Read`、`Mail.Send` 三个 Graph 权限
4. 把 **Application (client) ID** 填进 `assets/js/config.js` 的 `MS_CLIENT_ID`

`MS_CLIENT_ID` 为空时，登录页的 Outlook 按钮会提示尚未配置，不影响演示模式与 Gmail。

### 安全说明

- 密码只在 Google / 微软官方页面输入，本应用没有任何密码框，也拿不到密码
- 仓库里只有 Client ID（公开标识，不是密钥）；**不要把 client_secret 提交进仓库**
- 两种登录都走 **OAuth 2.0 授权码 + PKCE（S256）**，校验 `state` 后用 `code_verifier` 换令牌，
  回调后立即用 `history.replaceState` 清掉 URL 上的 `code` / `state`，避免进浏览历史
- access token 只存浏览器 `sessionStorage`，关标签页即失效，有效期约 1 小时
- 真实邮件只在内存中处理，不写 localStorage、不上传任何服务器
  （GitHub Pages 是纯静态托管，收不到任何数据）
- Gmail 权限只有 `gmail.readonly` + `gmail.send`：不能改、不能删服务器上的邮件；
  界面里的删除/归档在真实模式下只在本页会话内生效。需要服务器级管理时，
  把 `assets/js/config.js` 的权限加上 `gmail.modify` 即可（风险也相应变大，自行权衡）
- Outlook 权限为 `User.Read` + `Mail.Read` + `Mail.Send`，同样不含删除/改标签
- 随时可在 Google 账号 → 安全性 → 第三方访问（或微软账号的已授权应用）中撤销授权

## 已知限制

- **浏览器无法直连 IMAP/SMTP** — 浏览器拿不到原始 TCP 连接，所以纯网页版只能对接
  OAuth + REST 的邮箱（Gmail、Outlook）。Yahoo / iCloud / QQ / 163 等通用 IMAP 邮箱
  要等桌面版在本地实现
- **管理动作只在本页生效** — 当前申请的是只读 + 发送权限，所以删除、归档、标垃圾、
  标已读、延后都只是改动浏览器内存里的数据，不会同步到服务器；刷新或重新拉取后即恢复
- **真实邮件不落盘** — 真实邮件只存在内存，关掉页面就要重新拉取；`sessionStorage` 里只有令牌
- **演示数据为虚构内容** — 内置邮件、发件人全部原创虚构，外部发件域名统一用
  `.example` 保留域（本机演示账号为 `demo@mymail.app`）；其中一封是钓鱼邮件样例，
  仅作反面示例，请勿点击其中链接
- **附件在演示模式下只展示不下载** — 演示数据没有真实的附件 ID，点附件会提示「仅作展示」
- **HTML 邮件无法自动测高** — 沙箱没有同源权限，拿不到 `contentDocument`，所以 iframe
  用受限高度 + 内部滚动，超长 HTML 邮件不会撑爆版面，但需要在框内滚动
- **翻译依赖在线接口** — 真实 Gmail 邮件的翻译走公开翻译接口，可能被限频或不可用；
  Outlook 接入层未提供翻译方法，演示数据的中英对照是内置的、不联网
- **分类文件夹依赖服务商标签** — 推广 / 社交 / 动态在 Gmail 下读 `CATEGORY_*` 标签；
  Outlook 数据没有分类字段，这三个文件夹在 Outlook 视图下为空
- **规则只对真实邮箱生效** — 过滤规则在 Gmail / Outlook 加载完成后执行，演示数据不套用
- **「延后」不会自动回到收件箱** — 延后动作只是把邮件移进「已延后」文件夹，
  没有到期自动恢复的定时逻辑，需要手动处理
- **部分动作只对演示数据生效** — 「恢复演示数据」「清空当前文件夹」在真实账号下
  分别变成「重新拉取」与「清空本页内存里的该文件夹」，都不写服务器
- **「收件箱拉取数量」下次生效** — 设置里改 40 / 80 / 120 只影响下一次拉取

## Roadmap

1. ✅ **Gmail 只读 + 发送** — OAuth 2.0 PKCE 登录、真实收件箱、真实发送（见上）
2. ✅ **Outlook 接入** — Microsoft Graph + PKCE，与 Gmail 一起进统一收件箱（见上）
3. **通用 IMAP/SMTP** — 浏览器无法直连 IMAP/POP3（无原始 TCP），纯网页版做不到；Yahoo / iCloud / QQ / 163 等需等桌面版（Tauri）在本地实现
4. **日历与通讯录** — 接 Google Calendar / Microsoft Graph 日历与联系人（需追加日历与通讯录权限）
5. **服务端翻译** — 接 DeepL / 大模型 API 做服务端全文翻译，替换当前的公开翻译接口
6. **打包桌面版** — 用同一套前端代码套 Tauri，打包成 Windows / macOS 桌面应用

## 技术说明

- 纯 HTML + CSS + 原生 JavaScript，无框架、无运行时依赖；Vite / ESLint / Prettier 只是开发期工具
- 模块结构：ES Module 入口 `app-init.js` → 核心 `app-core.js`，状态集中在 `store.js`，
  接入层 `gmail.js` / `outlook.js` 以普通 script 挂到 `window.MyMail*`
- 状态存储：`localStorage`（键 `mymail-state-v2`）；演示数据带版本号 `SEED_VERSION`，
  扩充示例邮件后旧缓存会被自动替换，偏好与操作痕迹保留
- 渲染优化：搜索防抖、列表按 id 对比做增量更新（避免整表重绘闪烁）、翻译并发 4 路并带内存缓存
- 部署：GitHub Pages（从 `main` 分支根目录发布）；`npm run build` 的产物在 `dist/`（已 gitignore）

## License

[MIT](LICENSE)
