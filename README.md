# My Mail · 清爽邮件

一个清爽的三栏邮件管理网页版：左边文件夹与标签，中间邮件列表，右边阅读区。
没有日历、没有会议、没有广告，只做邮件本身。

> 当前版本是**前端演示版**：内置虚构的示例邮件，数据保存在浏览器 localStorage，
> 不连接任何真实邮箱。接入 Gmail / Outlook 的计划见下方 [Roadmap](#roadmap)。

## 在线预览

GitHub Pages：**https://coldairboys.github.io/my-mail/**

（部署由 GitHub Actions 自动完成，推送到 `main` 分支后稍等一两分钟即可刷新。）

## 功能

- 📥 **三栏布局** — 文件夹 / 标签侧边栏、邮件列表、阅读区，仿桌面客户端的悬浮窗口造型
- 📂 **文件夹** — 收件箱、已加星标、已延后、草稿、已发送、所有邮件、垃圾邮件、废纸篓，带未读计数
- 🏷️ **标签分类** — 工作 / 阅读 / 开发 / 账单 / newsletter，点标签即筛选
- 🔍 **全文搜索** — 按发件人、主题、正文搜索；支持只看未读、一键全部已读
- 🌐 **一键翻译** — 英文邮件点「翻译成中文」切换译文，再点回到原文（中文邮件可译成英文）
- ✎ **写邮件** — 写新邮件、回复、转发；发送进「已发送」，关掉自动存草稿（本地演示，不真发出）
- ☆ **常用动作** — 星标、归档、延后、标垃圾、删除，都在阅读区顶部工具栏
- ⌨️ **键盘** — `j` / `k` 上下切换邮件，`Esc` 关闭弹窗
- 💾 **本地持久化** — 已读、星标、草稿等状态存在 localStorage，刷新不丢失；设置里可恢复演示数据
- 📱 **响应式** — 窄屏自动切换为列表 / 阅读两态

## 本地运行

没有任何构建步骤，纯静态文件。任选一种：

```bash
# 方式一：直接双击打开 index.html

# 方式二：起一个本地服务器（推荐）
cd my-mail
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 目录结构

```
my-mail/
├── index.html                  # 页面结构：三栏布局、写邮件/设置弹窗
├── assets/
│   ├── css/
│   │   └── styles.css          # 全部样式（留白、浅灰分隔、蓝色选中态）
│   └── js/
│       ├── data.js             # 演示数据：文件夹、标签、示例邮件（含中英对照译文）
│       └── app.js              # 应用逻辑：筛选、渲染、翻译切换、写邮件、localStorage 持久化
├── .github/
│   └── workflows/
│       └── pages.yml           # GitHub Actions：自动部署到 GitHub Pages
├── LICENSE                     # MIT
└── README.md
```

## Roadmap

演示版验收通过后，按这个顺序接真实邮箱：

1. **Gmail 只读接入** — Google OAuth 登录 + Gmail API 拉取收件箱（先只读，不碰发送）
2. **发送 / 回复** — 走 Gmail API 发送，发送前加确认步骤
3. **Outlook 接入** — Microsoft OAuth + Graph API，与 Gmail 共用同一套界面
4. **通用 IMAP/SMTP** — 支持任意邮箱服务商（QQ 邮箱、163、iCloud 等用应用专用密码）
5. **服务端翻译** — 接 DeepL / 大模型 API 做真实全文翻译，替换演示译文
6. **打包桌面版** — 用同一套前端代码套 Tauri，打包成 Windows / macOS 桌面应用

## 技术说明

- 纯 HTML + CSS + 原生 JavaScript，无框架、无构建、无依赖，打开即跑
- 状态存储：`localStorage`（键 `mymail-state-v1`）
- 部署：GitHub Actions → GitHub Pages

## License

[MIT](LICENSE)
