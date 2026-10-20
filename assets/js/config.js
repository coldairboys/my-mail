/* My Mail · 配置
   GOOGLE_CLIENT_ID 是 Google Cloud 控制台里「OAuth 客户端 ID（Web 应用）」的编号。
   它是公开标识（不是密钥）：纯前端应用的设计就是把它写在页面里。
   本项目不使用、也不得提交 client_secret 或任何密码到仓库。 */
window.MYMAIL_CONFIG = {
  GOOGLE_CLIENT_ID: "604020902487-v36v81m8lnj9b9jptphdmam46i0m2g6k.apps.googleusercontent.com",
  MS_CLIENT_ID: "", // ← 在 Microsoft Entra 注册应用后填入（公开标识，PKCE 流程不用密钥）
  GMAIL_SCOPES: [
    "https://www.googleapis.com/auth/gmail.readonly", // 只读：看邮件
    "https://www.googleapis.com/auth/gmail.send", // 发送：发邮件（不含删除/改标签权限）
  ].join(" "),
};
