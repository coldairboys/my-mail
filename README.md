# My Mail · 清爽邮件

一个清爽的三栏邮件管理网页版：左边文件夹与标签，中间邮件列表，右边阅读区。
没有日历、没有会议、没有广告，只做邮件本身。

纯静态前端，无后端、无运行时依赖；内置虚构演示邮件，可选接入真实 Gmail（只读 + 发送）与个人 Outlook。

- 在线预览：https://coldairboys.github.io/my-mail/
- 当前版本：**v4.1.0**
- 安全与数据流：见 [SECURITY.md](SECURITY.md)
- 版本历史：见 [CHANGELOG.md](CHANGELOG.md)

---

## 快速开始

### 本地运行

项目本身是纯静态站点，`index.html` + `assets/` 即可运行。入口是 ES Module，**不能直接双击 `index.html`**（`file://` 协议会被 CORS 拦下），需要一个 HTTP 服务器。

```bash
# 方式一：Python 静态服务器（无需 Node）
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000

# 方式二：Vite 开发服务器（先 npm install 装开发工具）
npm install
npm run dev        # http://localhost:5173
```

首次 clone 后 `node_modules/` 不存在，必须先 `npm install`，否则 `npm run dev` 会报「'vite' 不是内部或外部命令」。

### 部署

GitHub Pages：仓库 Settings → Pages → Deploy from a branch，选 `main` 分支、根目录。推送到 `main` 后自动重新发布。

也可以本地构建静态产物：

```bash
npm run build      # 输出到 dist/（已 gitignore）
npm run preview    # 预览构建产物
```

### 开始使用

打开站点后在登录页二选一：

- **先用演示模式进入** —— 内置一批虚构邮件（含中英对照译文、附件、HTML 邮件、退订链接、分类），不需要任何配置，直接看界面与交互。
- **登录真实邮箱** —— 接入 Gmail 或 Outlook，见下一节。

---

## 功能

### 界面

- 📥 **三栏布局，全屏铺满** —— 文件夹 / 标签侧边栏、邮件列表、阅读区，无系统窗口装饰
- ↔️ **可拖拽的列宽** —— 列表栏与阅读区之间的分隔条可拖动（260–942px，阅读区保底 320px），也支持方向键微调（每次 24px），宽度存 `localStorage`，移动端不显示分隔条
- 🗂️ **侧栏可折叠** —— 桌面端可收成 64px 图标栏，图标保留可点，带过渡动画，折叠状态会记住
- 🌗 **主题** —— 白天 / 黑夜 / 跟随系统三档，一键循环切换
- 📊 **显示密度** —— 舒适 / 紧凑两档，紧凑隐藏列表摘要、收紧行高
- 📱 **手机端** —— ≤860px 单栏布局、抽屉式侧边栏、阅读页全屏覆盖、列表左滑删除（滑过阈值松手即删除，可撤销）

### 邮件列表

- ⚡ **悬浮操作与彩色头像** —— 每行显示发件人彩色首字母头像与附件标识，悬停浮出「删除 / 归档 / 标已读 / 星标」快捷按钮
- 🗂️ **分类与重要标记** —— 列表行显示「推广 / 社交 / 动态」小标签与「重要」标记；Gmail 下读 `CATEGORY_*` 与 `IMPORTANT` 标签，Outlook 下按 `importance === "high"` 判断
- 📂 **12 个文件夹** —— 收件箱、已加星标、重要邮件、已延后、草稿、已发送、所有邮件、推广、社交、动态、垃圾邮件、废纸篓，侧栏显示数量（为 0 时不显示）
- 🏷️ **5 个标签** —— 工作 / 生活 / 开发 / 账单 / 订阅，点标签即筛选
- 🔍 **搜索与筛选** —— 输入即搜（防抖 220ms），匹配发件人、地址、主题、摘要与正文；漏斗按钮筛 全部/未读/已读/星标；更多菜单可全部标已读、切换排序、清空废纸篓或垃圾邮件、恢复演示数据
- ✅ **多选与批量操作** —— 更多菜单进入多选模式，行首出现勾选框，批量栏的「全选」作用于当前可见结果，支持批量归档 / 已读 / 删除
- 👤 **发件人分析** —— 侧栏列出当前视图里发件最多的前 12 位（含邮件数、未读数）与汇总，点发件人直接按其地址筛选

### 阅读与操作

- 💬 **内联快捷回复** —— 正文底部常驻轻量回复卡片，可就地回复并发送，支持一键引用原文、插入签名、随时展开为完整编辑窗口
- ☆ **常用动作** —— 延后到明天、归档、星标、标已读/未读、标垃圾、删除；单封删除带「撤销」；顶部 ‹ › 切换上一封 / 下一封
- 📎 **附件板块** —— 邮件带附件时正文下方显示附件列表（文件名 + 大小），真实模式下点附件即下载
- 🖼️ **HTML 邮件沙箱渲染** —— HTML 邮件在 `sandbox` iframe 内按原排版显示（不授予脚本与同源权限）；「隐藏图片」会改写 `img` / `srcset` / 背景图，防邮件追踪
- 🚫 **退订** —— 发件人右侧的「退订」按钮：有 `unsub` 链接时打开官方退订页（`mailto:` 则跳到写退订邮件），没有退订信息时只给提示
- 🌐 **一键翻译** —— 点「翻译成中文」切换译文，再点回原文；演示数据自带中英对照译文，真实邮件走在线翻译接口（主通道 MyMemory，Google 兜底）

### 写信

- ✎ **写信 / 回复 / 转发** —— 整页卡片式排版，标题栏显示类型与原发件人，可选发件账号、收件人（带通讯录补全）、抄送 / 密送、主题；正文工具栏含插入签名、引用原文、实时字数统计；底部丢弃 / 存草稿 / 发送。关闭时自动存草稿
- ✎ **写信窗口三态** —— 桌面端默认右下角浮动小窗，可最小化折叠、还原、最大化全屏；移动端自适应全屏
- ✎ **内联回复** —— 阅读区就地回复，不必切页

### 账号与设置

- 🔐 **多账号管理（Gmail ×2 + Outlook）** —— 侧栏顶部账号列表，每行显示头像（按邮箱哈希取稳定色相）+ 名称 + 邮箱 + 未读角标；登录两个以上账号时多出「全部账号」统一收件箱行；点行即切换视图
- ➕ **添加账号** —— 账号列表右上角「+」选择 Gmail 或 Outlook，未配置 Client ID 时对话框直接说明
- 🗑️ **移除账号** —— 每行「⋯」提供「全部标为已读」与「移除账号…」，移除前弹确认框，默认焦点在「取消」上
- ⚙️ **设置** —— 主题、显示密度、自动已读、快捷键开关、拉取数量、默认发件账号、邮件签名、翻译目标语言、过滤规则、恢复演示数据
- 🧹 **过滤规则** —— 自建规则（发件人含 / 主题含关键词 → 移到垃圾邮件 / 删除 / 归档 / 标已读 / 加星标），真实邮箱加载完成后自动执行并提示命中数量
- 🔄 **刷新与自动刷新** —— 真实账号下重新拉取当前视图；设置里可开启 1 / 5 / 15 分钟自动刷新（仅前台且真实账号时执行，静默）

### 性能与质量

- ⚡ **真实邮箱懒加载** —— Gmail 列表只拉 `format=metadata`（头部 + 摘要 + 标签），点开某封才补拉全文，首屏 API 调用约降一个数量级；六个文件夹列表并发拉取
- ⌨️ **键盘快捷键** —— `j` / `k` 上下切换、`e` 归档、`#` 删除、`r` 回复、`s` 星标、`u` 返回列表、`Esc` 关闭弹窗 / 收起下拉与抽屉；可在设置里整体开关
- ♿ **可访问性** —— 首屏 skip-link 跳转、弹窗焦点陷阱、`aria-live` 播报列表数量与 Toast、列表行支持回车 / 空格激活、`focus-visible` 轮廓
- 💾 **本地持久化** —— 演示邮件与偏好（主题、密度、排序、签名、规则等）存 `localStorage`；真实邮件只在内存
- 🛡️ **安全与质量** —— 生产构建注入 CSP；未捕获异常走全局兜底 toast，不静默白屏；单元测试覆盖转义、解析、状态持久化、翻译；GitHub Actions 每次 push 跑 lint + test + build

---

## 接入真实邮箱

### Gmail（只读 + 发送）

当前 Gmail 登录走 **OAuth 2.0 隐式流程**（`response_type=token`），令牌从 URL 片段返回。原因是 Google 对「Web 应用」类型客户端在授权码换令牌时强制要求 `client_secret`，纯静态网页无法安全持有密钥。详见 [SECURITY.md](SECURITY.md#gmail-隐式流程的取舍)。

1. 打开 [Google Cloud 控制台](https://console.cloud.google.com/)，新建项目（如 `my-mail`）
2. 「API 和服务 → 库」里搜索 **Gmail API** 并启用
3. 「API 和服务 → OAuth 权限请求页面」：选择 External，填应用名与邮箱，把自己的 Gmail 加进「测试用户」（测试模式足够自用）
4. 「API 和服务 → 凭据 → 创建凭据 → OAuth 客户端 ID」：类型选 **Web 应用**，「已获授权的 JavaScript 来源」加 `https://coldairboys.github.io`（本地调试再加 `http://localhost:8000`）
5. 把生成的 **Client ID** 填进 `assets/js/config.js` 的 `GOOGLE_CLIENT_ID`
6. 打开站点 → 登录页点「使用 Google 登录」→ 在 Google 官方页面授权（测试模式会提示「未经验证的应用」，点 高级 → 继续，这是自用项目的正常提示）

### Outlook（可选）

1. 在 [Microsoft Entra 管理中心](https://entra.microsoft.com/) 注册应用（支持个人 Microsoft 账号，代码走 `consumers` 端点）
2. 平台选 **单页应用（SPA）**，重定向 URI 填页面实际地址（代码取 `location.origin + pathname`，例如从 `http://localhost:8000/index.html` 打开就填这一整条）
3. 添加 `User.Read`、`Mail.Read`、`Mail.Send` 三个 Graph 权限
4. 把 **Application (client) ID** 填进 `assets/js/config.js` 的 `MS_CLIENT_ID`

`MS_CLIENT_ID` 为空时，登录页的 Outlook 按钮会提示尚未配置，不影响演示模式与 Gmail。

---

## 隐私

一句话：**真实邮件内容不出你的浏览器，除非你主动点翻译。**

| 数据               | 存放位置                               | 说明                                                                         |
| ------------------ | -------------------------------------- | ---------------------------------------------------------------------------- |
| 演示邮件、界面偏好 | `localStorage`（键 `mymail-state-v2`） | 本地，可随时清空                                                             |
| OAuth 访问令牌     | `sessionStorage`                       | 关标签页即失效，有效期约 1 小时                                              |
| 真实邮件内容       | 仅浏览器内存                           | 不写 localStorage、不上传任何服务器                                          |
| 翻译请求           | 发往 MyMemory / Google                 | **只有你点「翻译成中文」时**，邮件正文会发给在线翻译服务；首次翻译会提示一次 |

仓库里只有 Client ID（公开标识，不是密钥）。**不要把 `client_secret` 提交进仓库** —— 本项目不需要也不使用它。

权限范围刻意压到最小：

- Gmail：`gmail.readonly` + `gmail.send` —— 不能改、不能删服务器上的邮件；界面里的删除 / 归档在真实模式下只在本页会话内生效
- Outlook：`User.Read` + `Mail.Read` + `Mail.Send` —— 同样不含删除 / 改标签

随时可在 Google 账号 → 安全性 → 第三方访问（或微软账号的已授权应用）中撤销授权。

完整的数据流、威胁边界与已知风险见 [SECURITY.md](SECURITY.md)。

---

## 开发

### 脚本

| 命令                   | 作用                                              |
| ---------------------- | ------------------------------------------------- |
| `npm install`          | 安装开发依赖（vite / eslint / prettier / vitest） |
| `npm run dev`          | 启动 Vite 开发服务器（`http://localhost:5173`）   |
| `npm run build`        | 构建到 `dist/`                                    |
| `npm run preview`      | 预览构建产物（`http://localhost:4173`）           |
| `npm run lint`         | ESLint 检查 `assets/js`                           |
| `npm test`             | Vitest 单元测试（`tests/` 目录）                  |
| `npm run test:watch`   | Vitest 监听模式                                   |
| `npm run format`       | Prettier 格式化                                   |
| `npm run format:check` | 只检查格式、不写入                                |

依赖版本记录在 `package-lock.json` 里，CI 上用 `npm ci` 精确复现。

### 目录结构

```
my-mail/
├── index.html                  # 页面结构：三栏布局、全屏页与弹窗、登录页
├── assets/
│   ├── css/
│   │   └── styles.css          # 全部样式（明暗双主题变量、三栏布局、移动端抽屉与左滑）
│   └── js/
│       ├── config.js           # 全局配置：Google / MS Client ID、Gmail 权限范围
│       ├── theme-boot.js       # 首屏主题脚本（外置，避免内联脚本被 CSP 拦）
│       ├── utils.js            # HTML 转义、头像首字母与配色、防抖、rAF 节流、文件大小
│       ├── store.js            # 状态仓库：localStorage 持久化（含 quota 兜底）、多账号 Map
│       ├── mail-parse.js        # 邮件解析：MIME 分段、HTML 转文本（DOMParser）
│       ├── translate.js         # 在线翻译：MyMemory 主通道 + Google 兜底、分段并发、LRU 缓存
│       ├── gmail.js             # Gmail 接入层：隐式授权、拉取/解析、发送、翻译、附件、搜索
│       ├── outlook.js           # Outlook 接入层：Microsoft Graph + PKCE，拉取/发送/搜索
│       ├── app-core.js          # 核心逻辑：渲染、事件绑定、快捷键、写信与设置
│       ├── app-init.js          # 模块入口：首屏渲染、OAuth 回调消费、登录页与账号切换
│       ├── data.module.js       # 演示数据：LABELS / FOLDERS / SEED_EMAILS（中英对照）
│       └── config.module.js     # 配置的 ES Module 包装（备用导出）
├── tests/                      # Vitest 单元测试
├── .github/workflows/ci.yml    # push / PR 跑 lint + test + build
├── package.json                # 开发脚本与 devDependencies
├── vite.config.js              # Vite 配置 + 生产构建注入 CSP
├── eslint.config.js            # ESLint 扁平配置
├── .prettierrc                 # Prettier 约定（printWidth 110、2 空格）
├── LICENSE                     # MIT
├── SECURITY.md
└── CHANGELOG.md
```

`index.html` 的加载顺序是：`theme-boot.js` → `config.js` → `gmail.js` → `outlook.js` → `app-init.js`，全部为 `<script type="module">`，按文档顺序 deferred 执行，所以 `gmail.js` / `outlook.js` 读到 `window.MYMAIL_CONFIG` 时配置已就绪。

> 这些文件必须带 `type="module"`：普通 `<script src>` 在 Vite 构建时无法被打包，`dist/` 里不会复制它们，部署后全部 404、应用起不来。
> 演示数据统一由 `data.module.js` 提供（`store.js` / `app-core.js` 直接 `import`），不维护经典 script 副本，避免两份数据不同步。

### 技术选型

- 纯 HTML + CSS + 原生 JavaScript，无框架、无运行时依赖；Vite / ESLint / Prettier 只是开发期工具
- 模块结构：ES Module 入口 `app-init.js` → 核心 `app-core.js`，状态集中在 `store.js`，接入层 `gmail.js` / `outlook.js` 以 `window.MyMail*` 挂载
- 状态存储：`localStorage`（键 `mymail-state-v2`）；演示数据带 `SEED_VERSION`，扩充示例邮件后旧缓存自动替换，偏好与操作痕迹保留
- 渲染优化：搜索防抖、列表按 id 对比增量更新（避免整表重绘闪烁）、翻译并发 4 路并带内存缓存
- CSP：`vite.config.js` 在构建时注入 `<meta http-equiv="Content-Security-Policy">`；dev 模式不注入（Vite HMR 需要内联脚本与 ws 连接）

---

## 已知限制

- **Token 过期无法静默续期** —— Gmail 授权用 `access_type=online`，为了坚持「纯前端、令牌不落盘、零后端」的隐私优先设计，浏览器拿不到 `refresh_token`（持有它需要后端配合 `client_secret` 与长期安全存储）。Access Token 约 1 小时过期，API 返回 401 时界面明确提示「登录已过期」，点一下即可重新授权
- **浏览器无法直连 IMAP/SMTP** —— 浏览器拿不到原始 TCP 连接，纯网页版只能对接 OAuth + REST（Gmail、Outlook）。Yahoo / iCloud / QQ / 163 等通用 IMAP 邮箱需等桌面版在本地实现
- **管理动作只在本页生效** —— 只申请了只读 + 发送权限，删除、归档、标垃圾、标已读、延后都只改动浏览器内存，不同步服务器，刷新或重新拉取后即恢复
- **真实邮件不落盘** —— 真实邮件只存在内存，关掉页面就要重新拉取；`sessionStorage` 里只有令牌
- **演示数据为虚构内容** —— 内置邮件、发件人全部原创虚构，外部发件域名统一用 `.example` 保留域；其中一封是钓鱼邮件样例，仅作反面示例，请勿点击其中链接
- **附件在演示模式下只展示不下载** —— 演示数据没有真实附件 ID，点附件会提示「仅作展示」
- **HTML 邮件无法自动测高** —— 沙箱没有同源权限，拿不到 `contentDocument`，所以 iframe 用受限高度 + 内部滚动，超长 HTML 邮件需在框内滚动
- **翻译依赖在线接口** —— 真实邮件翻译走公开接口，可能被限频或不可用；Outlook 接入层未提供翻译方法，演示数据的中英对照是内置的、不联网
- **分类文件夹依赖服务商标签** —— 推广 / 社交 / 动态在 Gmail 下读 `CATEGORY_*` 标签；Outlook 数据没有分类字段，这三个文件夹在 Outlook 视图下为空
- **规则只对真实邮箱生效** —— 过滤规则在 Gmail / Outlook 加载完成后执行，演示数据不套用
- **「延后」不会自动回到收件箱** —— 延后只是把邮件移进「已延后」文件夹，没有到期自动恢复的定时逻辑
- **「收件箱拉取数量」下次生效** —— 设置里改 40 / 80 / 120 只影响下一次拉取

---

## Roadmap

1. ✅ **Gmail 只读 + 发送** —— OAuth 登录、真实收件箱、真实发送
2. ✅ **Outlook 接入** —— Microsoft Graph + PKCE，与 Gmail 一起进统一收件箱
3. **通用 IMAP/SMTP** —— 浏览器无法直连 IMAP/POP3（无原始 TCP），需等桌面版（Tauri）在本地实现
4. **日历与通讯录** —— 接 Google Calendar / Microsoft Graph 日历与联系人（需追加权限）
5. **服务端翻译** —— 接 DeepL / 大模型 API 做服务端全文翻译，替换当前的公开翻译接口
6. **打包桌面版** —— 用同一套前端代码套 Tauri，打包成 Windows / macOS 桌面应用

---

## 贡献

欢迎提 Issue 和 PR。改动前请先跑一遍门禁：

```bash
npm run lint && npm test && npm run build
```

约定：

- 纯前端、零运行时依赖是本项目的核心约束，不要引入需要后端或构建期注入依赖的方案
- 真实邮件数据只在内存处理，不要把邮件内容、令牌写进 `localStorage` 或提交进仓库
- 新增功能尽量补单元测试（`tests/`），保持 lint 0 报错
- 文档改动同步更新 README / CHANGELOG

## License

[MIT](LICENSE)
