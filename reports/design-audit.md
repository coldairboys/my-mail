# My Mail 视觉、暗色对比度与无障碍审查报告

- **审查对象**：`E:\GITHUB\my-mail-main`
- **执行角色**：辅鲸-设计（视觉与无障碍）
- **审查日期**：2026-10-29
- **审查环境**：Node.js v24.14.0 / Chromium 1234 (Headless) / Lighthouse 13.6.0
- **测试标准**：WCAG 2.1 / 2.2 AA、WAI-ARIA 1.2、Lighthouse 审计规范
- **说明**：本审查遵循只读原则，未改动现有 CSS 与业务代码，所有结论均基于真实浏览器实测、CDP 自动化渲染与精准光度公式计算。

---

## 一、Lighthouse 移动端与桌面端双端实测

测试服务：本地静态托管（模拟生产环境单页加载）。

### 1.1 双端综合评分矩阵

| 评估维度                       | 移动端（Mobile 360x640 / 4G 模拟） | 桌面端（Desktop 1350x940） | 评级与状态                          |
| :----------------------------- | :--------------------------------: | :------------------------: | :---------------------------------- |
| **Performance（性能）**        |               **89**               |           **97**           | 优良（移动端受未压缩 JS 阻塞）      |
| **Accessibility（无障碍）**    |               **80**               |           **79**           | 需整改（DOM/ARIA 语义与对比度扣分） |
| **Best Practices（最佳实践）** |              **100**               |          **100**           | 满分通过                            |
| **SEO（搜索引擎优化）**        |              **100**               |          **100**           | 满分通过                            |

---

### 1.2 关键扣分项与问题清单（双端合并）

#### (1) 无障碍领域（重点整改项，得分 79-80）

1. **`[aria-allowed-attr]`（严重·得分 0）**
   - **违规节点**：`li.mail-item[role="button"][aria-selected="true|false"]`
   - **根因**：根据 W3C WAI-ARIA 规范，`role="button"` **不支持** `aria-selected` 属性。
   - **整改**：改为 `role="option"`（搭配父级 `role="listbox"`）或将选中态改用 `aria-pressed="true|false"`。
2. **`[aria-required-children]`（严重·得分 0）**
   - **违规节点**：`ul#mailList.mail-list[role="list"]`
   - **根因**：父容器显式声明了 `role="list"`，但子级被赋予 `role="button"`，破坏了 ARIA 规范中 `list` 必须包含 `listitem` 子角色的结构约束。
   - **整改**：子项恢复 `role="listitem"`，或移除父级 `role="list"` 改用标准 `role="listbox"`。
3. **`[aria-required-attr]`（严重·得分 0）**
   - **违规节点**：`div#colResizer.col-resizer[role="separator"][tabindex="0"]`
   - **根因**：可键盘聚焦的 `role="separator"` 属于可调节分割条（Window Splitter），强制要求提供 `aria-valuenow`、`aria-valuemin` 与 `aria-valuemax`。
   - **整改**：在 DOM 上增加 `aria-valuenow="360" aria-valuemin="240" aria-valuemax="600"`，并在拖拽时动态更新 `aria-valuenow`。
4. **`[color-contrast]`（得分 0）**
   - **违规节点**：`.accounts-title`、`.acct-mail`、`#navFolderTitle`、`#navLabelTitle`、`.sidebar-footer`、`#listCount`
   - **根因**：弱文本变量 `--text-3` 在明暗背景下对比度均低于 4.5:1。
5. **`[target-size]`（移动端严重·得分 0）**
   - **违规节点**：`button.mobile-star-btn`（邮件列表项中的移动端星标按钮）
   - **根因**：渲染尺寸仅 14×24px，热区远低于 WCAG 要求的 24×24px（推荐 44×44px），极易误触整行。
6. **`[label-content-name-mismatch]`（中危·得分 0）**
   - **违规节点**：`ul#folderList > li.active[data-folder="inbox"]`
   - **根因**：DOM 可见内容为 `收件箱\n17`，但属性强制设置 `aria-label="收件箱"`，屏幕朗读器读出的名称与屏幕可见文本不一致。

#### (2) 性能与体验领域

1. **桌面端 `Cumulative Layout Shift (CLS)` = 0.106（扣分）**
   - **受影响元素**：`ul#mailList.mail-list`
   - **根因**：首屏 JS 加载完成前列表高度未撑满，渲染邮件数据后发生垂直抖动偏移。建议设置 `min-height: 100%` 或预留占位骨架。
2. **静态资源未压缩（Unminified CSS/JS）**
   - `assets/css/styles.css`（76.3KB 未压缩，建议上线构建 minify 节省 20KB）
   - `assets/js/app-core.js`（88.8KB 未压缩，未拆分模块）

---

## 二、暗色主题 WCAG AA 对比度实测

### 2.1 颜色系统基准测算（WCAG 2.1 相对亮度算法）

WCAG AA 标准门槛：

- **普通文本（< 18pt / 24px，或 < 14pt / 18.66px 粗体）**：对比度阈值 **≥ 4.5:1**
- **大文本（≥ 18pt 或 ≥ 14pt 粗体）**：对比度阈值 **≥ 3.0:1**
- **UI 控件边界与交互图标（Non-text Contrast）**：对比度阈值 **≥ 3.0:1**

#### 暗色变量矩阵对比度计算表

| 前景色变量 / 颜色值         | 底色变量 / 颜色值            | 实测对比度  | WCAG AA 普通文本（4.5:1） | 状态与诊断                             |
| :-------------------------- | :--------------------------- | :---------: | :-----------------------: | :------------------------------------- |
| `--text` (#e8eaed)          | `--bg` (#17191d)             | **14.60:1** |         **PASS**          | 主文本极清晰                           |
| `--text-2` (#9aa1ad)        | `--bg` (#17191d)             | **6.77:1**  |         **PASS**          | 次级文本合规                           |
| **`--text-3` (#6f7684)**    | **`--bg` (#17191d)**         | **3.86:1**  |         **FAIL**          | **弱文本不达标（仅支持大文本）**       |
| **`--text-3` (#6f7684)**    | **`--sidebar-bg` (#1b1e24)** | **3.66:1**  |         **FAIL**          | **侧栏标题/底栏不达标**                |
| **`--text-3` (#6f7684)**    | **`--nav-active` (#2b2f38)** | **2.94:1**  |         **FAIL**          | **严重超标（完全低于 3:1）**           |
| **`--text-3` (#6f7684)**    | **`--panel` (#1d2026)**      | **3.58:1**  |         **FAIL**          | **阅读区次级弱字不达标**               |
| `--accent` (#5aa2ff)        | `--bg` (#17191d)             | **6.74:1**  |         **PASS**          | 蓝色图标/标题达标                      |
| `--on-accent` (#0d1117)     | `--accent` (#5aa2ff)         | **7.25:1**  |         **PASS**          | 深色字落在浅蓝按钮上达标               |
| **`#ffffff`（纯白）**       | **`--accent` (#5aa2ff)**     | **2.61:1**  |         **FAIL**          | **深色模式下若按钮写死白字则严重违规** |
| **`--star-idle` (#4a4f59)** | **`--bg` (#17191d)**         | **2.14:1**  |         **FAIL**          | **未点亮星标图标对比度不足 3:1**       |
| **`--star-idle` (#4a4f59)** | **`--hover` (#262a31)**      | **1.75:1**  |         **FAIL**          | **悬浮底色上星标几乎不可辨认**         |

---

### 2.2 真实 DOM 渲染下的不达标具体颜色对清单

通过无头浏览器加载页面并在暗色模式（`data-theme="dark"`）下对全部可见元素进行计算，不达标的节点明细如下：

| 违规选择器                     | 渲染文本            | 字号/字重  | 前景色 (Computed) | 底色 (Effective) | 实际对比度 | 达标要求 |
| :----------------------------- | :------------------ | :--------: | :---------------: | :--------------: | :--------: | :------: |
| `span.accounts-title`          | "账号"              | 11px / 400 |     `#6f7684`     |    `#1b1e24`     | **3.66:1** |  4.5:1   |
| `span.acct-mail`               | "demo@mymail.app"   | 11px / 400 |     `#6f7684`     |    `#2b2f38`     | **2.94:1** |  4.5:1   |
| `div#navFolderTitle.nav-title` | "邮件"              | 11px / 400 |     `#6f7684`     |    `#1b1e24`     | **3.66:1** |  4.5:1   |
| `div#navLabelTitle.nav-title`  | "标签"              | 11px / 400 |     `#6f7684`     |    `#1b1e24`     | **3.66:1** |  4.5:1   |
| `div.sidebar-footer`           | "已同步 · 演示数据" | 11px / 400 |     `#6f7684`     |    `#1b1e24`     | **3.66:1** |  4.5:1   |
| `span#listCount.list-count`    | "共 17 封"          | 12px / 400 |     `#6f7684`     |    `#17191d`     | **3.86:1** |  4.5:1   |
| `button.mobile-star-btn`       | "☆"                 | 14px / 400 |     `#6f7684`     |    `#17191d`     | **3.86:1** |  4.5:1   |
| `button#btnStar.star-btn`      | "☆"                 | 19px / 400 |     `#4a4f59`     |    `#17191d`     | **2.14:1** |  3.0:1   |
| `p.login-scope`                | 权限申请说明文字    | 11px / 400 |     `#6f7684`     |    `#17191d`     | **3.86:1** |  4.5:1   |
| `div.mail-avatar`（黄/橙底）   | 发件人首字 "陈"     | 11px / 600 |     `#ffffff`     |    `#f5a623`     | **2.03:1** |  4.5:1   |
| `div.mail-avatar`（浅绿底）    | 发件人首字 "M"      | 11px / 600 |     `#ffffff`     |    `#7ed3a6`     | **1.79:1** |  4.5:1   |
| `div.mail-avatar`（青蓝底）    | 发件人首字 "B"      | 11px / 600 |     `#ffffff`     |    `#4db6c9`     | **2.37:1** |  4.5:1   |
| `div.mail-avatar`（粉红底）    | 发件人首字 "H"      | 11px / 600 |     `#ffffff`     |    `#e87fb0`     | **2.59:1** |  4.5:1   |
| `span.cat-chip.imp`            | "重要" 标签         | 11px / 600 |     `#ff8a80`     |    `#d93025`     | **2.09:1** |  4.5:1   |

---

## 三、视口布局一致性实测（375 / 390 / 1280 / 1920）

通过 CDP 注入不同分辨率实测结果：

| 测试项 / 视口                            |      375×667 (iPhone SE)      |    390×844 (iPhone 13-15)     | 1280×800 (典型笔记本) | 1920×1080 (全高清桌面) |
| :--------------------------------------- | :---------------------------: | :---------------------------: | :-------------------: | :--------------------: |
| **水平溢出（scrollWidth > innerWidth）** |        **无 (375px)**         |        **无 (390px)**         |    **无 (1280px)**    |    **无 (1920px)**     |
| **侧边栏 (Sidebar)**                     | `fixed` 隐藏（-285.6px 抽屉） | `fixed` 隐藏（-285.6px 抽屉） |   静态展示 (236px)    |    静态展示 (236px)    |
| **邮件列表栏 (List Pane)**               |       100% 占满 (375px)       |       100% 占满 (390px)       |    360px（可拖拽）    |    360px（可拖拽）     |
| **阅读区 (Reading Pane)**                |     抽屉/分屏控制 (375px)     |     抽屉/分屏控制 (390px)     |  弹性自适应 (684px)   |  宽屏自适应 (1324px)   |
| **超小触控目标数 (< 40px)**              |             64 处             |             64 处             |        115 处         |         115 处         |

### 布局一致性诊断分析：

1. **响应式断点平滑**：页面在 `860px` 断点正确切换了桌面三栏布局与手机端抽屉/卡片布局，未发生任何超出视口的水平溢出。
2. **宽屏（1920px）阅读体验良好**：阅读正文受 `--reading-width: 820px` 限制，文本行长没有被过度拉伸，保持了舒适阅读感。
3. **触控面积缺陷**：
   - 移动端下（375/390），`.mobile-star-btn`（14×24px）、`.accounts-add`（24×24px）、`.icon-btn`（32×32px）在手指点击时极其局促，容易误点相邻元素。

---

## 四、键盘焦点顺序与无障碍（a11y）覆盖

1. **可聚焦元素统计**：
   - 全页面共 **139 个可键盘聚焦节点**（`button`, `a`, `input`, `select`, `textarea`, `[tabindex="0"]`）。
   - **名称覆盖率**：139 / 139 均具备通过 `aria-label`、`title`、占位符或文本派生的无障碍名称，**无完全未命名的无主控件**。
2. **焦点可见性（Focus Visible & Outline）**：
   - **实测发现致命缺陷**：页面未针对暗色模式配置定制的高对比度 `:focus-visible` 样式，大量元素回退到浏览器默认的 `outline: rgb(16, 16, 16) auto 1px`。
   - 在暗色模式（`#17191d` 背景）下，**纯黑的 1px outline 完全隐形**，键盘导航用户无法感知当前焦点位置！
   - `.icon-btn.menu-btn` 的计算样式甚至出现 `outlineStyle: "none"`，Tab 键移入时没有任何视觉反馈。

---

## 五、交付辅鲸-编程的落地建议（含具体选择器与色值）

请 @辅鲸-编程 根据以下具体选择器与色值进行修复（无额外重构负担，纯属性与变量级修正）：

### 5.1 CSS 变量与对比度修复（`assets/css/styles.css`）

1. **提亮暗色模式下的三级弱文本**：

   ```css
   /* 修改 assets/css/styles.css 中 [data-theme="dark"] 区块 */
   [data-theme="dark"] {
     /* 原值 #6f7684 (对比度仅 3.6:1 - 3.8:1，不达标) */
     /* 改为 #8f96a4 (在 #17191d 上对比度 5.48:1，在 #1b1e24 上对比度 5.19:1，全达标 WCAG AA) */
     --text-3: #8f96a4;

     /* 原值 #4a4f59 (对比度仅 2.14:1) */
     /* 改为 #727986 (对比度达到 3.32:1，满足非文本组件 3.0:1 门槛) */
     --star-idle: #727986;
   }
   ```

2. **头像背景色盘（Avatar Palette）光度微调**：
   - 在 `data.module.js` 或生成头像颜色的逻辑中，将过亮的颜色替换为深色底色，或给浅底色强制配黑字：

   ```javascript
   // 浅绿 #7ed3a6 -> #2e8b57 (深海绿)
   // 亮黄 #f5a623 -> #b36b00 (深琥珀)
   // 浅青 #4db6c9 -> #00838f (深青)
   // 浅粉 #e87fb0 -> #ad1457 (深玫红)
   // 亮蓝 #5aa2ff -> #1565c0 (深宝蓝)
   ```

3. **全局高亮键盘焦点样式（Focus Appearance）**：

   ```css
   /* 全局增加高对比度 focus-visible 环 */
   :focus-visible {
     outline: 2px solid var(--accent) !important;
     outline-offset: 2px !important;
   }
   ```

4. **移动端触控热区补充（Touch Target Size）**：
   ```css
   @media (max-width: 860px) {
     .mobile-star-btn {
       min-width: 36px;
       min-height: 36px;
       display: inline-flex;
       align-items: center;
       justify-content: center;
     }
     .accounts-add {
       min-width: 36px;
       min-height: 36px;
     }
   }
   ```

### 5.2 HTML / DOM / ARIA 规范修正（`index.html` 与 JS 渲染层）

1. **邮件列表项角色约束**：
   - 将 `mail-item` 上的 `role="button"` 改为 `role="option"`，同时 `ul#mailList` 的 `role="list"` 改为 `role="listbox"`；或者保留列表结构（`role="listitem"`）并将点击行为交由内层按钮。
2. **拖拽分割条 ARIA 属性**：
   - 在 `index.html` 的 `#colResizer` 上补充：
     ```html
     <div
       class="col-resizer"
       id="colResizer"
       role="separator"
       aria-orientation="vertical"
       aria-label="拖动调整列表宽度"
       tabindex="0"
       aria-valuenow="360"
       aria-valuemin="240"
       aria-valuemax="600"
     ></div>
     ```
3. **文件夹无障碍名称对齐**：
   - 去掉 `li` 上覆盖的硬编码 `aria-label="收件箱"`，改为使用包含未读计数的动态 label，例如 `aria-label="收件箱，17 封未读"`，保持与可视内容一致。
