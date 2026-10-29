# 更新日志

本项目的版本记录基于 Git 提交历史整理。仓库尚未打 git tag，因此这里按 `package.json` 的版本号与提交意图划分版本段落。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

---

## [未发布]

### 新增

- 新增 `SECURITY.md`：完整说明数据流、信任边界、CSP 与沙箱策略、已知风险
- README 重构为「快速开始 / 功能 / 隐私 / 开发 / 贡献」结构，测试数量与流程描述与实现对齐
- `CHANGELOG.md` 首次建立，回溯 v3.7 → v4.1

### 变更

- README 更正 Gmail 登录流程描述：从「PKCE」改为实测的**隐式流程**（`response_type=token`），并说明 Google 对 Web 应用客户端强制要求 `client_secret` 的原因
- README 不再硬编码测试用例数量，改为描述实际覆盖范围，避免每次新增用例都要改文档
- **CSP 收紧**：`script-src` 去掉 `'unsafe-inline'`（首屏主题脚本已外置为 `theme-boot.js`，页面无内联脚本），同步修正 `vite.config.js` 里过时的注释
- **HTML 转文本改用 `DOMParser`**：不再用游离 div 的 `innerHTML` 解析服务端 HTML，返回独立文档且不触发资源加载 / 脚本执行语义
- **清理 v4 遗留的 PKCE 死键**：Gmail 接入层保留 `code_verifier` 键名仅为清理旧会话残留，不再写入

---

## [4.1.0] - 2026-10-24

### 新增

- **多账号管理面板重做**（参考 inboxed 的账号栏设计）：侧栏顶部改为账号列表，每行显示头像（按邮箱哈希取稳定色相）、名称、邮箱、未读数角标（99+ 截断）；登录两个以上真实账号时，列表最上方出现「全部账号」统一收件箱行
- **账号添加 / 移除流程**：列表右上角「+」打开对话框选择 Gmail 或 Outlook，未配置对应 Client ID 时直接说明而不是点击无反应；每行「⋯」提供「全部标为已读」与「移除账号…」，移除前弹确认框并说明只清空本页数据、服务器邮件与账号不受影响，确认框默认焦点在「取消」上
- **Gmail 列表懒加载**：列表只拉 `format=metadata`（头部 + 摘要 + 标签），点开某封才 `format=full` 补正文与附件，首屏 API 调用约降一个数量级；六个文件夹列表改为并发拉取
- **深色层级优化与视觉美化**

### 变更

- **Gmail 登录流程从 PKCE 改回隐式流程**（`response_type=token`）：Google 对「Web 应用」类型客户端在授权码换令牌时强制要求 `client_secret`，纯静态网页无法安全持有密钥
- **CSP 策略优化**：`connect-src` 收敛到实际调用的 API 域（Gmail / OAuth / Graph / 翻译）
- **正文拉取加入重试**，降低偶发失败率
- `app-core.js` / `app-init.js` 等模块随新功能同步调整

---

## [4.0.0] - 2026-10-20

### 新增

- **模块化重构**：单文件 `app.js` 拆分为 ES Module —— `app-init.js`（入口）/ `app-core.js`（核心逻辑）/ `store.js`（状态仓库）/ `gmail.js` / `outlook.js`（接入层）/ `mail-parse.js` / `translate.js` / `utils.js` / `config.js`
- **设计 token 统一**，全站样式变量收敛
- **写信页重做**：整页卡片式排版，可选发件账号、收件人、抄送 / 密送、主题，正文工具栏含插入签名、引用原文、实时字数统计
- **修复 12 个真实缺陷**（详见提交 `a82f556`）

### 变更

- 演示数据统一由 `data.module.js` 提供，不再维护经典 script 副本，避免两份数据不同步
- `store.js` 用 `Map` 统一多账号：`gmail` / `gmail2` / `outlook` / `unified`

---

## [3.9.0] - 2026-10-19

### 新增

- **设置 / 写信 / 回复 / 转发全屏化**，正文块居中限宽（宽屏下不会把控件拉到两端）
- **设置项扩充**：邮件签名、默认发件账号、自动已读、快捷键开关、收件箱拉取数量

### 修复

- **全按钮审计修复**：HTML 邮件翻译无反应、汉堡键不切换、设置注记空指针、正文溢出选择器等

---

## [3.7.0] - 2026-10-19

### 新增

- **双 Gmail 账号**：可添加第二个 Gmail 账号、统一收件箱、写信时选发件账号
- **HTML 邮件图片改为默认显示**，仍可手动隐藏（防追踪）

---

## [3.6.0] - 2026-10-19

### 新增

- **HTML 邮件沙箱渲染**（保留原排版）：在 `sandbox` iframe 内显示，不授予脚本与同源权限
- **「显示图片」开关真实生效**：默认拦图防追踪，可手动开启

---

## [3.5.0] - 2026-10-19

### 新增

- **多账号（Gmail + Outlook）** 与 **统一收件箱**
- **过滤规则**：发件人含 / 主题含关键词 → 移到垃圾邮件 / 删除 / 归档 / 标已读 / 加星标；真实邮箱加载完成后自动执行并提示命中数量
- **通讯录补全**：收件人输入框可从已加载邮件的联系人里补全
- **发件人分析**：列出当前视图里发件最多的前 12 位与汇总，点发件人直接筛选
- **真实退订**：读 `List-Unsubscribe`，有链接时打开官方退订页，`mailto:` 则跳到写退订邮件

> Outlook 接入层已就绪，但需在 `assets/js/config.js` 填入 `MS_CLIENT_ID` 才激活。

---

## [3.4.0] - 2026-10-19

### 新增

- 仿 Gmail 网页端补强：**重要邮件**、**分类文件夹**（推广 / 社交 / 动态）、**多选与批量操作**、**附件列表**、**服务器端全量搜索**、**显示密度**

### 修复

- 设置注记空指针、正文溢出框外选择器

---

## [3.3.0] - 2026-10-19

### 修复

- 列表滚不到底、正文溢出框外
- 拉取改并发提速
- 设置文案与标签按演示 / 真实模式区分

---

## [3.2.0] - 2026-10-19

### 变更

- **登录改走整页跳转**为唯一路径，修复内嵌浏览器弹窗令牌回不来的死循环

---

## [3.1.0] - 2026-10-19

### 新增

- 授权弹窗被拦时自动回退整页跳转登录
- 授权客户端预初始化

---

## [3.0.0] - 2026-10-19

### 新增

- **登录页**
- **Gmail OAuth 接入**（只读 + 发送），Client ID 填入配置

---

## [2.0.0] - 2026-10-19

### 新增

- 全屏布局、原创演示数据、深色模式、手机端左滑删除、筛选 / 更多菜单、上一封 / 下一封切换

---

## [1.0.0] - 2026-10-19

初始版本：项目骨架、三栏布局页面结构、全部样式、演示数据与基础逻辑。

---

[未发布]: https://github.com/coldairboys/my-mail/compare/v4.1.0...HEAD
[4.1.0]: https://github.com/coldairboys/my-mail/compare/v4.0.0...v4.1.0
[4.0.0]: https://github.com/coldairboys/my-mail/compare/v3.9.0...v4.0.0
[3.9.0]: https://github.com/coldairboys/my-mail/compare/v3.7.0...v3.9.0
[3.7.0]: https://github.com/coldairboys/my-mail/compare/v3.6.0...v3.7.0
[3.6.0]: https://github.com/coldairboys/my-mail/compare/v3.5.0...v3.6.0
[3.5.0]: https://github.com/coldairboys/my-mail/compare/v3.4.0...v3.5.0
[3.4.0]: https://github.com/coldairboys/my-mail/compare/v3.3.0...v3.4.0
[3.3.0]: https://github.com/coldairboys/my-mail/compare/v3.2.0...v3.3.0
[3.2.0]: https://github.com/coldairboys/my-mail/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/coldairboys/my-mail/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/coldairboys/my-mail/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/coldairboys/my-mail/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/coldairboys/my-mail/compare/v1.0.0...v1.0.0
