/* My Mail · 邮件数组操作（pushMail 等）
   从 app-core.js 拆出：对邮件数组的通用写入，不碰 DOM。 */
import { src } from "../store.js";

export function pushMail(partial, target) {
  (target || src()).unshift(
    Object.assign(
      {
        id: "u" + Date.now(),
        ts: Date.now(),
        from: "我",
        address: "demo@mymail.app",
        to: "",
        date: "今天",
        time: "刚刚",
        subject: "（无主题）",
        snippet: "",
        label: null,
        unread: false,
        starred: false,
        folder: "sent",
        body: [],
        bodyZh: null,
      },
      partial
    )
  );
}
