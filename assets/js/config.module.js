/* My Mail · 配置模块（ES Module）
   只读 config.js 写入的 window.MYMAIL_CONFIG，不在这里兜底具体 Client ID——
   否则换 Client ID 要改两处，必然漂移。Client ID 是公开标识，唯一出处是 config.js。 */
export const MYMAIL_CONFIG = window.MYMAIL_CONFIG || {
  GOOGLE_CLIENT_ID: "",
  MS_CLIENT_ID: "",
  GMAIL_SCOPES: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
  ].join(" "),
};
window.MYMAIL_CONFIG = MYMAIL_CONFIG;
