/* My Mail · 配置模块（ES Module）
   导出全局配置供其他模块使用，保持对旧 window.MYMAIL_CONFIG 的兼容。 */
export const MYMAIL_CONFIG = window.MYMAIL_CONFIG || {
  GOOGLE_CLIENT_ID: "604020902487-v36v81m8lnj9b9jptphdmam46i0m2g6k.apps.googleusercontent.com",
  MS_CLIENT_ID: "",
  GMAIL_SCOPES: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
  ].join(" "),
};
window.MYMAIL_CONFIG = MYMAIL_CONFIG;
