import { resetManagedUserPassword } from "../services/userService";
import { getApiErrorMessage } from "./apiError";
import { notify, showToast } from "./swalToast";

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const pickGeneratedPassword = (result) =>
  result?.generatedPassword
  || result?.data?.generatedPassword
  || result?.password
  || "";

/**
 * Confirm → POST reset → modal hiện mật khẩu tạm (chỉ 1 lần) + nút sao chép.
 */
export async function promptResetManagedPassword({ user, lang = "VN" } = {}) {
  const displayName = escapeHtml(user?.fullName || user?.code || "");
  const displayCode = escapeHtml(user?.code || "");

  const confirmResult = await notify({
    icon: "question",
    title: lang === "VN" ? "Đặt lại mật khẩu?" : "Reset password?",
    html: lang === "VN"
      ? `Tạo mật khẩu tạm cho <b>${displayName}</b>${displayCode ? ` (${displayCode})` : ""}?<br/><span style="color:#94a3b8;font-size:12px">Phiên đăng nhập cũ sẽ bị hủy. Mật khẩu mới chỉ hiện một lần.</span>`
      : `Generate a temporary password for <b>${displayName}</b>${displayCode ? ` (${displayCode})` : ""}?<br/><span style="color:#94a3b8;font-size:12px">Old sessions will be revoked. The new password is shown only once.</span>`,
    showCancelButton: true,
    focusCancel: true,
    reverseButtons: true,
    confirmButtonColor: "#124757",
    cancelButtonColor: "#64748b",
    confirmButtonText: lang === "VN" ? "Đặt lại" : "Reset",
    cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
  });

  if (!confirmResult.isConfirmed) return null;

  try {
    const result = await resetManagedUserPassword(user.id || user.userId);
    const password = pickGeneratedPassword(result);
    const safePassword = escapeHtml(password);

    await notify({
      icon: "success",
      dialog: true,
      title: lang === "VN" ? "Mật khẩu tạm" : "Temporary password",
      html: password
        ? (lang === "VN"
          ? `<p style="margin:0 0 10px;font-size:13px;color:#64748b">Gửi mật khẩu này cho nhân viên (chỉ hiện một lần):</p><div style="font-family:ui-monospace,monospace;font-size:16px;font-weight:700;letter-spacing:0.04em;padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;color:#0f172a;word-break:break-all">${safePassword}</div>`
          : `<p style="margin:0 0 10px;font-size:13px;color:#64748b">Share this password with the user (shown once only):</p><div style="font-family:ui-monospace,monospace;font-size:16px;font-weight:700;letter-spacing:0.04em;padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;color:#0f172a;word-break:break-all">${safePassword}</div>`)
        : (lang === "VN"
          ? "Đã đặt lại mật khẩu nhưng máy chủ không trả mật khẩu tạm."
          : "Password was reset but no temporary password was returned."),
      showCancelButton: Boolean(password),
      confirmButtonText: password
        ? (lang === "VN" ? "Sao chép mật khẩu" : "Copy password")
        : (lang === "VN" ? "Đóng" : "Close"),
      cancelButtonText: lang === "VN" ? "Đóng" : "Close",
      confirmButtonColor: "#124757",
      allowOutsideClick: false,
      preConfirm: password
        ? async () => {
          try {
            await navigator.clipboard.writeText(password);
            showToast({
              icon: "success",
              title: lang === "VN" ? "Đã sao chép mật khẩu" : "Password copied",
              timer: 2000,
            });
          } catch {
            showToast({
              icon: "warning",
              title: lang === "VN" ? "Không sao chép được — hãy chọn và copy thủ công" : "Could not copy — select and copy manually",
              timer: 3200,
            });
          }
        }
        : undefined,
    });

    return result;
  } catch (error) {
    console.error("Lỗi đặt lại mật khẩu:", error);
    await notify({
      icon: "error",
      title: lang === "VN" ? "Không đặt lại được" : "Reset failed",
      text: getApiErrorMessage(
        error,
        lang === "VN" ? "Vui lòng thử lại." : "Please try again."
      ),
      confirmButtonColor: "#124757",
    });
    return null;
  }
}
