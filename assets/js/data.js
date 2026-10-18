/* My Mail · 演示数据
   全部为虚构示例邮件，不含任何真实账号信息。
   每封英文邮件都带一份中文译文（bodyZh），点「翻译」时切换显示；
   中文邮件带英文译文（bodyEn），逻辑相同。 */

const LABELS = [
  { id: "work",       name: "工作",     color: "#f5a623" },
  { id: "reading",    name: "阅读",     color: "#7ed3a6" },
  { id: "dev",        name: "开发",     color: "#5aa2ff" },
  { id: "bills",      name: "账单",     color: "#e8736a" },
  { id: "newsletter", name: "newsletter", color: "#b8bec9" },
];

const FOLDERS = [
  { id: "inbox",   name: "收件箱",   icon: "▤" },
  { id: "starred", name: "已加星标", icon: "☆" },
  { id: "snoozed", name: "已延后",   icon: "◷" },
  { id: "drafts",  name: "草稿",     icon: "✎" },
  { id: "sent",    name: "已发送",   icon: "➤" },
  { id: "all",     name: "所有邮件", icon: "✉" },
  { id: "spam",    name: "垃圾邮件", icon: "⊘" },
  { id: "trash",   name: "废纸篓",   icon: "🗑" },
];

/* folder 字段表示邮件当前所在位置：inbox / snoozed / drafts / sent / spam / trash
   archived=true 表示已归档（只在「所有邮件」可见） */
const SEED_EMAILS = [
  {
    id: "m01", from: "Anne-Laure Le Cunff", address: "annelaure@nesslabs.com",
    to: "我", date: "10月15日", time: "10月15日 21:07",
    subject: "Ness Labs: Outsourcing Discovery 🍎",
    snippet: "What do we lose when we outsource the process of discovery?…",
    label: "reading", folder: "inbox", unread: true, starred: false,
    body: [
      "Hi friends,",
      "What do we lose when we outsource the process of discovery? This question has been on my mind these past few weeks, as I've followed the debate around OpenAI's claims to have solved hundreds of longstanding mathematical problems.",
      "As a hypercurious neuroscientist and writer, I know how much joy can be found in research and creative work. So beyond the very real practical concerns, I wanted to explore the human side of the debate: what happens to our curiosity and sense of meaning when machines start doing the work we love?",
      "I don't have all the answers, but I hope today's essay opens up a conversation about what we might lose in the race of increasing productive efficiency at the cost of human curiosity.",
      "— Anne-Laure"
    ],
    bodyZh: [
      "朋友们好，",
      "当我们把「发现」的过程外包出去时，我们会失去什么？过去几周我一直在想这个问题——起因是关于 OpenAI 声称解决了数百个长期未解数学难题的争论。",
      "作为一名充满好奇心的神经科学家和写作者，我深知研究与创作的乐趣所在。所以抛开现实层面的担忧，我想探讨这场争论中更人性的一面：当机器开始做我们热爱的工作时，我们的好奇心和意义感会变成什么样？",
      "我没有全部答案，但希望今天这篇文章能开启一场讨论：在以牺牲人类好奇心为代价、不断提高生产效率的竞赛中，我们可能会失去什么。",
      "— Anne-Laure"
    ],
  },
  {
    id: "m02", from: "Rajesh Rajput", address: "rajesh@example.com",
    to: "我", date: "10月15日", time: "10月15日 18:42",
    subject: "New Release — Blubird Typeface",
    snippet: "Blubird is a warm, rounded typeface family, now with…",
    label: "reading", folder: "inbox", unread: true, starred: false,
    body: [
      "Hi there,",
      "Blubird 1.2 is out. This release adds a full set of rounded alternates, better kerning for display sizes, and — finally — proper support for Vietnamese.",
      "Existing customers can download the update for free from their library page.",
      "Enjoy, Rajesh"
    ],
    bodyZh: [
      "你好，",
      "Blubird 1.2 发布了。这个版本加入了整套圆角替代字形、优化了大字号的字距，并且——终于——完整支持越南语。",
      "老用户可以在自己的库页面免费下载更新。",
      "祝用得开心，Rajesh"
    ],
  },
  {
    id: "m03", from: "TypeSafe AI", address: "hello@typesafe.example",
    to: "我", date: "10月15日", time: "10月15日 15:03",
    subject: "Happy JevDay! Jev 1.14.0 is here",
    snippet: "Jev 1.14.0, images, a new plugin system and…",
    label: "dev", folder: "inbox", unread: true, starred: true,
    body: [
      "Hey developer,",
      "Jev 1.14.0 is here: inline image support in the terminal, a brand-new plugin system, and startup time cut in half.",
      "Run `jev update` to get it, and check the changelog for migration notes.",
      "— The TypeSafe team"
    ],
    bodyZh: [
      "开发者你好，",
      "Jev 1.14.0 来了：终端内嵌图片支持、全新的插件系统，启动时间缩短了一半。",
      "运行 `jev update` 即可升级，迁移注意事项见更新日志。",
      "— TypeSafe 团队"
    ],
  },
  {
    id: "m04", from: "Sesame Team", address: "team@sesame.example",
    to: "我", date: "10月15日", time: "10月15日 11:26",
    subject: "Your Sesame app just got better",
    snippet: "Pick the perfect moment: scheduled sends are…",
    label: null, folder: "inbox", unread: false, starred: false,
    body: [
      "Hi,",
      "Your Sesame app just got better: you can now schedule messages, pin up to five conversations, and export your history in one tap.",
      "Update the app to try it out.",
      "— Sesame Team"
    ],
    bodyZh: [
      "你好，",
      "你的 Sesame 应用刚刚升级：现在可以定时发送消息、置顶最多五个对话，并一键导出历史记录。",
      "更新应用即可体验。",
      "— Sesame 团队"
    ],
  },
  {
    id: "m05", from: "Google Developers", address: "developers@google.example",
    to: "我", date: "10月15日", time: "10月15日 09:14",
    subject: "[Action Advised] Migrate your API keys before Nov 1",
    snippet: "Legacy keys will stop working after the deadline…",
    label: "work", folder: "inbox", unread: false, starred: false,
    body: [
      "Hello,",
      "This is a reminder that legacy API keys will stop working after November 1. Please migrate to the new key format in your console before the deadline to avoid service interruption.",
      "No action is needed if you have already migrated.",
      "— Google Developers"
    ],
    bodyZh: [
      "你好，",
      "提醒你：旧版 API 密钥将在 11 月 1 日后停止工作。请在截止日期前到控制台迁移到新版密钥格式，以免服务中断。",
      "如果你已经迁移完成，无需任何操作。",
      "— Google Developers"
    ],
  },
  {
    id: "m06", from: "Avec Early Access", address: "early@avec.example",
    to: "我", date: "10月15日", time: "10月15日 08:30",
    subject: "Needs reply / Awaiting reply + Desktop invite",
    snippet: "Your desktop invite is ready — one link, no waitlist…",
    label: "work", folder: "inbox", unread: false, starred: false,
    body: [
      "Hi,",
      "Your Avec desktop invite is ready. One link, no waitlist — click to activate your workspace.",
      "We're also testing 'awaiting reply' nudges this week. Tell us what you think.",
      "— Avec"
    ],
    bodyZh: [
      "你好，",
      "你的 Avec 桌面端邀请已经准备好。一个链接，无需排队——点击即可激活你的工作区。",
      "本周我们还在测试「等待回复」提醒功能，欢迎告诉我们你的想法。",
      "— Avec"
    ],
  },
  {
    id: "m07", from: "DEX 周刊", address: "weekly@dex.example",
    to: "我", date: "10月14日", time: "10月14日 20:00",
    subject: "#367 压缩和解压缩：DEX 周刊",
    snippet: "本周阅读原文 #367：把复杂讲简单，把简单讲透…",
    label: "reading", folder: "inbox", unread: false, starred: false,
    body: [
      "大家好，这里是 DEX 周刊第 367 期。",
      "本期主题是「压缩和解压缩」：好的表达就像好的压缩算法——把复杂讲简单，把简单讲透。文末附本周精选的五篇文章和两个小工具。",
      "下周见。"
    ],
    bodyZh: [
      "Hello, this is DEX Weekly, issue 367.",
      "This week's theme is 'compression and decompression': good writing is like a good compression algorithm — it makes the complex simple, and the simple profound. Five curated articles and two small tools are attached at the end.",
      "See you next week."
    ],
  },
  {
    id: "m08", from: "Nosana", address: "news@nosana.example",
    to: "我", date: "10月14日", time: "10月14日 17:45",
    subject: "We're live: From AI idea to working product",
    snippet: "Our mainnet launch recap and what's next…",
    label: "newsletter", folder: "inbox", unread: true, starred: false,
    body: [
      "We're live!",
      "From AI idea to working product: our mainnet is now open to everyone. This recap covers the launch numbers, the roadmap for Q1, and how to get started in five minutes.",
      "Thanks for being early. — Nosana"
    ],
    bodyZh: [
      "我们上线了！",
      "从 AI 想法到可用的产品：主网现已向所有人开放。这篇回顾包括上线数据、第一季度路线图，以及如何在五分钟内上手。",
      "感谢你来得这么早。— Nosana"
    ],
  },
  {
    id: "m09", from: "Vercel", address: "notifications@vercel.example",
    to: "我", date: "10月14日", time: "10月14日 14:12",
    subject: "1 domain needs configuration on team 'demo'",
    snippet: "A DNS record is missing for your custom domain…",
    label: "dev", folder: "inbox", unread: false, starred: false,
    body: [
      "Hi,",
      "One domain on your team needs configuration: a DNS record is missing for your custom domain. Add the CNAME record shown in your dashboard to finish setup.",
      "— Vercel"
    ],
    bodyZh: [
      "你好，",
      "你团队里有一个域名需要配置：自定义域名缺少一条 DNS 记录。把控制台里显示的 CNAME 记录加上即可完成设置。",
      "— Vercel"
    ],
  },
  {
    id: "m10", from: "GitHub", address: "notifications@github.example",
    to: "我", date: "10月14日", time: "10月14日 10:05",
    subject: "[GitHub] Cursor is requesting updated permissions",
    snippet: "A third-party app is requesting broader access…",
    label: "dev", folder: "inbox", unread: false, starred: true,
    body: [
      "Hey there,",
      "A third-party application is requesting updated permissions for your account, including read access to your repositories.",
      "If you didn't request this, you can ignore this email — nothing changes until you approve.",
      "— GitHub"
    ],
    bodyZh: [
      "你好，",
      "有一个第三方应用正在请求你账号的更高权限，包括读取你的仓库。",
      "如果你没有发起这个请求，忽略这封邮件即可——在你批准之前，什么都不会改变。",
      "— GitHub"
    ],
  },
  {
    id: "m11", from: "Craft Docs", address: "news@craft.example",
    to: "我", date: "10月14日", time: "10月14日 09:00",
    subject: "Craft 更新：快捷指令、小组件、本地化",
    snippet: "这次更新带来快捷指令支持和全新的桌面小组件…",
    label: "newsletter", folder: "inbox", unread: false, starred: false,
    body: [
      "你好，",
      "Craft 本次更新带来：快捷指令支持、全新的桌面小组件，以及更完整的简体中文本地化。",
      "打开应用即可更新，更新日志里有详细列表。"
    ],
    bodyZh: [
      "Hi,",
      "This Craft update brings: Shortcuts support, brand-new desktop widgets, and more complete Simplified Chinese localization.",
      "Open the app to update — the full list is in the changelog."
    ],
  },
  {
    id: "m12", from: "长桥证券（香港）", address: "service@longbridge.example",
    to: "我", date: "10月14日", time: "10月14日 08:15",
    subject: "换汇提醒：尊敬的用户，您的综合账户有一笔…",
    snippet: "您有一笔换汇订单已成交，详情见账户流水…",
    label: "bills", folder: "inbox", unread: false, starred: false,
    body: [
      "尊敬的用户，",
      "您的综合账户有一笔换汇订单已成交，成交汇率与金额详见账户流水。如非本人操作，请立即联系客服。",
      "— 长桥证券"
    ],
    bodyZh: [
      "Dear customer,",
      "A currency exchange order in your integrated account has been executed. Please see your account statement for the rate and amount. If this wasn't you, contact support immediately.",
      "— Longbridge Securities"
    ],
  },
  {
    id: "m13", from: "Lemon Squeezy", address: "receipts@lemonsqueezy.example",
    to: "我", date: "10月14日", time: "10月14日 07:30",
    subject: "You've been paid!",
    snippet: "Your weekly payout of $128.40 is on its way…",
    label: "bills", folder: "inbox", unread: false, starred: false,
    body: [
      "Good news — you've been paid!",
      "Your weekly payout of $128.40 is on its way to your bank account and should arrive within 2 business days.",
      "A detailed breakdown is attached to this email.",
      "— Lemon Squeezy"
    ],
    bodyZh: [
      "好消息——你收到付款了！",
      "你本周的 $128.40 付款正在汇往你的银行账户，预计 2 个工作日内到账。",
      "详细明细附在这封邮件里。",
      "— Lemon Squeezy"
    ],
  },
  {
    id: "m14", from: "我", address: "demo@mymail.app",
    to: "朋友", date: "10月13日", time: "10月13日 22:18",
    subject: "周末去试新开的咖啡店？",
    snippet: "楼下新开了一家，听说手冲不错，周六下午…",
    label: null, folder: "sent", unread: false, starred: false,
    body: [
      "周六下午有空吗？楼下新开了一家咖啡店，听说手冲不错，一起去试试。",
      "三点左右，我请客。"
    ],
    bodyZh: [
      "Free on Saturday afternoon? A new coffee shop opened downstairs — I hear their pour-over is great. Let's try it together.",
      "Around 3pm, my treat."
    ],
  },
  {
    id: "m15", from: "Prize Center", address: "win@prize-center.example",
    to: "我", date: "10月13日", time: "10月13日 03:11",
    subject: "CONGRATS! You won a $1000 gift card!!!",
    snippet: "Click NOW to claim your prize before it expires…",
    label: null, folder: "spam", unread: false, starred: false,
    body: [
      "CONGRATS! You have been selected to win a $1000 gift card.",
      "Click the link within 24 hours to claim. (演示：这是一封被正确归类到垃圾邮件的中奖诈骗示例。)"
    ],
    bodyZh: [
      "恭喜！你被选中赢得一张 1000 美元礼品卡。",
      "请在 24 小时内点击链接领取。（演示：这是一封被正确归类到垃圾邮件的中奖诈骗示例。）"
    ],
  },
];
