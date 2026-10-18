/* My Mail · 演示数据（v2）
   全部邮件均为本项目原创虚构，不取材于任何真实邮件或截图。
   英文邮件带中文译文（bodyZh），中文邮件带英文译文，点「翻译」切换显示。
   ts 为排序用的时间戳（越大越新）。 */

const LABELS = [
  { id: "work",       name: "工作", color: "#f5a623" },
  { id: "life",       name: "生活", color: "#7ed3a6" },
  { id: "dev",        name: "开发", color: "#5aa2ff" },
  { id: "bills",      name: "账单", color: "#e8736a" },
  { id: "newsletter", name: "订阅", color: "#b8bec9" },
];

const FOLDERS = [
  { id: "inbox",   name: "收件箱",   icon: "inbox" },
  { id: "starred", name: "已加星标", icon: "star" },
  { id: "snoozed", name: "已延后",   icon: "clock" },
  { id: "drafts",  name: "草稿",     icon: "edit" },
  { id: "sent",    name: "已发送",   icon: "send" },
  { id: "all",     name: "所有邮件", icon: "mail" },
  { id: "spam",    name: "垃圾邮件", icon: "spam" },
  { id: "trash",   name: "废纸篓",   icon: "trash" },
];

/* folder：inbox / snoozed / drafts / sent / spam / trash；archived=true 只在「所有邮件」可见 */
const SEED_EMAILS = [
  {
    id: "m01", ts: 202610181930, from: "陈默", address: "chenmo@brightlab.example",
    to: "我", date: "10月18日", time: "10月18日 19:30",
    subject: "明早十点过一遍发布清单",
    snippet: "我把清单整理成了一页纸，明早十点对一下，没问题就…",
    label: "work", folder: "inbox", unread: true, starred: false,
    body: [
      "Yangming，",
      "发布清单我整理成了一页纸，一共十二项，其中三项要你确认：更新说明的措辞、回滚方案的联系人、还有公告发布时间。",
      "明早十点我们对一遍，没问题就按计划走。对完我请你喝楼下那家新换的豆子。",
      "— 陈默"
    ],
    bodyZh: [
      "Yangming,",
      "I've condensed the release checklist into one page — twelve items, three of which need your confirmation: the wording of the release notes, the contact person for the rollback plan, and the announcement time.",
      "Let's go through it tomorrow at 10am. If all is well, we proceed as planned. Coffee afterwards — the place downstairs just got new beans.",
      "— Chen Mo"
    ],
  },
  {
    id: "m02", ts: 202610181705, from: "Mia Chen", address: "mia@fieldnotes.example",
    to: "我", date: "10月18日", time: "10月18日 17:05",
    subject: "Field Notes #42: Walking the Coast Path",
    snippet: "Three days, forty kilometres, and one very patient dog…",
    label: "newsletter", folder: "inbox", unread: true, starred: false,
    body: [
      "Hello reader,",
      "This week I walked the northern coast path: three days, forty kilometres, and one very patient dog who waited at every gate.",
      "The full photo essay is on the site, including the lighthouse keeper's story about the winter the sea froze at the harbour mouth.",
      "Until next week, Mia"
    ],
    bodyZh: [
      "读者你好，",
      "这周我走完了北段海岸步道：三天、四十公里，还有一条在每个栅栏门前都耐心等我的狗。",
      "完整的图文游记在网站上，包括灯塔看守人讲的那个故事——有一年冬天，海水在港口入口结了冰。",
      "下周见，Mia"
    ],
  },
  {
    id: "m03", ts: 202610181420, from: "城市图书馆", address: "notice@citylibrary.example",
    to: "我", date: "10月18日", time: "10月18日 14:20",
    subject: "借阅到期提醒：《海边理发店》还有 3 天",
    snippet: "你借阅的图书将于 10 月 21 日到期，可在线续借一次…",
    label: "life", folder: "inbox", unread: true, starred: true,
    body: [
      "读者你好，",
      "你借阅的《海边理发店》将于 10 月 21 日到期。目前该书无人预约，你可以在小程序里续借一次，延长 30 天。",
      "逾期每天 0.1 元，记得按时处理。祝阅读愉快。",
      "— 城市图书馆"
    ],
    bodyZh: [
      "Dear reader,",
      "The book you borrowed, 'The Seaside Barbershop', is due on October 21. Nobody has reserved it, so you can renew it once in the mini-program for another 30 days.",
      "Overdue fines are 0.1 yuan per day. Happy reading.",
      "— City Library"
    ],
  },
  {
    id: "m04", ts: 202610181105, from: "前端周报", address: "weekly@frontend.example",
    to: "我", date: "10月18日", time: "10月18日 11:05",
    subject: "第 128 期：把按钮做小，把字做大",
    snippet: "本期聊聊移动端可达性：拇指热区、对比度和那些…",
    label: "dev", folder: "inbox", unread: false, starred: false,
    body: [
      "各位好，这里是前端周报第 128 期。",
      "本期主题是移动端可达性：为什么主按钮至少要 44px、为什么正文对比度不能靠感觉、以及三个真实项目踩过的坑。",
      "文末照例有一份可以带走的检查清单。"
    ],
    bodyZh: [
      "Hello everyone, this is Frontend Weekly, issue 128.",
      "This week's topic is mobile accessibility: why primary buttons need at least 44px, why body-text contrast shouldn't be left to gut feeling, and pitfalls from three real projects.",
      "As always, there's a takeaway checklist at the end."
    ],
  },
  {
    id: "m05", ts: 202610180930, from: "云朵面包房", address: "order@cloudbakery.example",
    to: "我", date: "10月18日", time: "10月18日 09:30",
    subject: "订单已备好：桂花米面包 ×2，明早自提",
    snippet: "你的订单已经打包好啦，凭取货码 6 位尾号到店…",
    label: "life", folder: "inbox", unread: false, starred: false,
    body: [
      "你好，",
      "你的订单已经备好了：桂花米面包 ×2。明早 8 点后凭取货码到店自提，当天现烤，放到下午口感会打折，尽量早点来。",
      "谢谢惠顾，云朵面包房"
    ],
    bodyZh: [
      "Hi,",
      "Your order is ready: osmanthus rice bread ×2. Pick it up in store after 8am tomorrow with your pickup code. It's baked fresh that morning — try to come early, it loses its texture by afternoon.",
      "Thanks, Cloud Bakery"
    ],
  },
  {
    id: "m06", ts: 202610172110, from: "Blue Sky Airlines", address: "eticket@bluesky.example",
    to: "我", date: "10月17日", time: "10月17日 21:10",
    subject: "Your e-ticket: Flight BS 2047 confirmed",
    snippet: "Booking ref KX8P2Q — check-in opens 24 hours before…",
    label: "bills", folder: "inbox", unread: false, starred: true,
    body: [
      "Dear passenger,",
      "Your booking is confirmed. Flight BS 2047, booking reference KX8P2Q. Online check-in opens 24 hours before departure, and your baggage allowance is one checked bag up to 23 kg.",
      "Please arrive at the airport at least 90 minutes before departure. Safe travels!",
      "— Blue Sky Airlines"
    ],
    bodyZh: [
      "尊敬的旅客，",
      "你的预订已确认。航班 BS 2047，预订编号 KX8P2Q。在线值机在起飞前 24 小时开放，托运行李额度为一件、不超过 23 公斤。",
      "请至少提前 90 分钟到达机场。祝旅途平安！",
      "— 蓝天航空"
    ],
  },
  {
    id: "m07", ts: 202610171800, from: "慢跑俱乐部", address: "club@runhappy.example",
    to: "我", date: "10月17日", time: "10月17日 18:00",
    subject: "周六夜跑路线：沿江 8 公里，配速分组",
    snippet: "本周六晚七点老地方集合，A 组 5 分半，B 组 6 分半…",
    label: "life", folder: "inbox", unread: false, starred: false,
    body: [
      "各位跑友，",
      "本周六夜跑走沿江路线，全程 8 公里。A 组配速 5 分半，B 组 6 分半，新人跟 B 组，终点有补给和合影。",
      "晚七点老地方集合，下雨自动取消，会在群里通知。"
    ],
    bodyZh: [
      "Hi runners,",
      "This Saturday's night run follows the riverside route, 8 km in total. Group A runs at 5:30/km, Group B at 6:30/km — newcomers, please join Group B. Snacks and a group photo at the finish.",
      "Meet at 7pm at the usual spot. Rain cancels automatically; we'll post in the group chat."
    ],
  },
  {
    id: "m08", ts: 202610171430, from: "苏晴", address: "suqing@brightlab.example",
    to: "我", date: "10月17日", time: "10月17日 14:30",
    subject: "Re: 季度复盘文档，我补了数据部分",
    snippet: "数据口径统一成自然月了，图也换成了新版，你看看…",
    label: "work", folder: "inbox", unread: false, starred: false,
    body: [
      "Yangming，",
      "复盘文档我补完了：数据口径统一改成自然月，图换成了新版，结论部分按你上次的意见收敛到三条。",
      "你有空看一眼，没问题我周五发全员。",
      "— 苏晴"
    ],
    bodyZh: [
      "Yangming,",
      "I've finished my part of the quarterly review doc: all figures now use calendar months, charts are the new version, and the conclusions are trimmed to three points as you suggested.",
      "Take a look when you can — if it's fine, I'll send it to everyone on Friday.",
      "— Su Qing"
    ],
  },
  {
    id: "m09", ts: 202610171015, from: "Harbor Hostel", address: "stay@harborhostel.example",
    to: "我", date: "10月17日", time: "10月17日 10:15",
    subject: "How was your stay? A two-minute survey",
    snippet: "Tell us one thing we did well and one thing to fix…",
    label: "newsletter", folder: "inbox", unread: false, starred: false,
    body: [
      "Hi,",
      "Thanks for staying with us last weekend. We'd love two minutes of your time: tell us one thing we did well and one thing we should fix.",
      "Everyone who completes the survey gets 10% off their next stay.",
      "— Harbor Hostel"
    ],
    bodyZh: [
      "你好，",
      "感谢你上周末入住我们家。想占用你两分钟：告诉我们一件我们做得好的事，和一件应该改进的事。",
      "完成问卷的客人下次入住可享九折。",
      "— 港湾青年旅舍"
    ],
  },
  {
    id: "m10", ts: 202610161955, from: "市政缴费", address: "billing@utility.example",
    to: "我", date: "10月16日", time: "10月16日 19:55",
    subject: "10 月水费账单已生成：¥86.40",
    snippet: "本期用水 12 吨，应缴 86.40 元，缴费截止 10 月 28 日…",
    label: "bills", folder: "inbox", unread: false, starred: false,
    body: [
      "你好，",
      "你户 10 月水费账单已生成：本期用水 12 吨，应缴 86.40 元，缴费截止 10 月 28 日。",
      "已开通自动扣款的用户无需操作，扣款结果会另行通知。"
    ],
    bodyZh: [
      "Hello,",
      "Your October water bill is ready: 12 tonnes used, 86.40 yuan due by October 28.",
      "If you have auto-pay enabled, no action is needed — we'll notify you of the result."
    ],
  },
  {
    id: "m11", ts: 202610161600, from: "月读会", address: "club@monthlyreads.example",
    to: "我", date: "10月16日", time: "10月16日 16:00",
    subject: "十一月共读：《夜晚的潜水艇》，附讨论提纲",
    snippet: "这次选了一本短篇集，四次读完，每周三晚线上聊…",
    label: "newsletter", folder: "inbox", unread: false, starred: false,
    body: [
      "大家好，",
      "十一月共读选的是《夜晚的潜水艇》，一本短篇集，四周读完，每周三晚线上聊一晚。",
      "讨论提纲附在邮件末尾，第一次聚会先聊前两篇，不用有压力，读多少聊多少。"
    ],
    bodyZh: [
      "Hello everyone,",
      "November's shared read is 'The Night Submarine', a short-story collection we'll finish over four weeks, meeting online every Wednesday evening.",
      "Discussion prompts are at the end of this email. For the first session we'll cover the first two stories — no pressure, read as much as you can."
    ],
  },
  {
    id: "m12", ts: 202610161120, from: "阿哲", address: "azhe@travelnotes.example",
    to: "我", date: "10月16日", time: "10月16日 11:20",
    subject: "大理三天实测路线（含避坑）",
    snippet: "上次你问的路线我整理完了，第三天那个市场一定要早去…",
    label: "life", folder: "inbox", unread: true, starred: false,
    body: [
      "Yangming，",
      "上次你问的大理路线我实测完了，整理成三天版：第一天古城慢逛，第二天环海西路骑行，第三天赶早市——那个市场一定要早去，九点以后就只剩游客了。",
      "避坑也写了：两家网红店可以跳过，名单在最后。你去之前喊我，我把定位包发你。",
      "— 阿哲"
    ],
    bodyZh: [
      "Yangming,",
      "I've tested the Dali route you asked about and written it up as a three-day plan: old town on day one, cycling the west lakeshore on day two, and the morning market on day three — go early, after 9am it's all tourists.",
      "Pitfalls included: two influencer-famous restaurants you can skip, listed at the end. Ping me before you go and I'll send you my saved pins.",
      "— Azhe"
    ],
  },
  {
    id: "m13", ts: 202610151340, from: "我", address: "demo@mymail.app",
    to: "林小满", date: "10月15日", time: "10月15日 13:40",
    subject: "阳台的薄荷长疯了，周末来分一盆？",
    snippet: "薄荷已经爬满半个阳台了，你上次说想要，分你一盆…",
    label: null, folder: "sent", unread: false, starred: false,
    body: [
      "小满，",
      "阳台的薄荷已经爬满半个花架了，你上次说想要，周末来分一盆带走吧，顺便在我这儿吃午饭。",
      "不用带东西，人来就行。"
    ],
    bodyZh: [
      "Xiaoman,",
      "The mint on my balcony has taken over half the plant stand. You said you wanted some — come by this weekend and take a pot home, and stay for lunch.",
      "No need to bring anything, just yourself."
    ],
  },
  {
    id: "m14", ts: 202610150815, from: "中奖中心", address: "claim@luckyprize.example",
    to: "我", date: "10月15日", time: "10月15日 08:15",
    subject: "紧急！你的账户有一笔待领取奖励",
    snippet: "名额有限，点击链接填写银行卡信息即可领取…",
    label: null, folder: "spam", unread: false, starred: false,
    body: [
      "恭喜你被抽中！名额有限，请立即点击链接、填写银行卡信息领取奖励。",
      "（演示说明：这是典型的钓鱼话术示例，被归类在垃圾邮件里。真实场景下不要点链接、不要填任何银行卡信息。）"
    ],
    bodyZh: [
      "Congratulations, you've been selected! Limited spots — click the link and enter your bank card details to claim your reward.",
      "(Demo note: this is a typical phishing script, filed under Spam. In real life, never click such links or enter bank details.)"
    ],
  },
];
