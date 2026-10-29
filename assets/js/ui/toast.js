/* My Mail · Toast（含 aria-live）
   从 app-core.js 拆出：全局提示条，无业务依赖。 */
import { $ } from "../core/dom.js";

let toastTimer = null;

export function toast(msg, action) {
  $("#toastText").textContent = msg;
  $("#toast").setAttribute("aria-live", "polite");
  const btn = $("#toastAction");
  if (action) {
    btn.hidden = false;
    btn.textContent = action.label;
    btn.onclick = () => {
      action.fn();
      hideToast();
    };
  } else {
    btn.hidden = true;
    btn.onclick = null;
  }
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 4200 : 2200);
}

export function hideToast() {
  $("#toast").hidden = true;
}
