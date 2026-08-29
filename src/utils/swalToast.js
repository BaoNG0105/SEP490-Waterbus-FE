import Swal from "sweetalert2";

const toastCustomClass = {
  popup: "admin-swal-toast",
  title: "admin-swal-toast-title",
  htmlContainer: "admin-swal-toast-html",
  timerProgressBar: "admin-swal-toast-timer",
  icon: "admin-swal-toast-icon",
};

const TONE_CONFIRM_CLASS = {
  brand: "admin-swal-confirm admin-swal-confirm--brand",
  danger: "admin-swal-confirm admin-swal-confirm--danger",
  warning: "admin-swal-confirm admin-swal-confirm--warning",
};

const buildDialogClasses = (tone, extraClass) => {
  const confirmClass = TONE_CONFIRM_CLASS[tone] || TONE_CONFIRM_CLASS.brand;
  return {
    popup: "admin-swal-popup",
    title: "admin-swal-title",
    htmlContainer: "admin-swal-html",
    actions: "admin-swal-actions",
    confirmButton: confirmClass,
    cancelButton: "admin-swal-cancel",
    input: "admin-swal-input",
    inputLabel: "admin-swal-input-label",
    validationMessage: "admin-swal-validation",
    icon: "admin-swal-icon",
    ...(extraClass || {}),
  };
};

const stripLegacyColors = (options = {}) => {
  const next = { ...options };
  delete next.confirmButtonColor;
  delete next.cancelButtonColor;
  delete next.buttonsStyling;
  return next;
};

const resolveTone = (options = {}) => {
  if (options.tone) return options.tone;
  const icon = String(options.icon || "");
  if (icon === "error") return "danger";
  if (icon === "warning") return "warning";
  const confirmColor = String(options.confirmButtonColor || "").toLowerCase();
  if (confirmColor.includes("d33") || confirmColor.includes("dc26") || confirmColor.includes("e11d") || confirmColor.includes("rose")) {
    return "danger";
  }
  return "brand";
};

/**
 * Điểm vào duy nhất cho thông báo góc phải (toast).
 * Dùng cho success / info / error / warning — không có nút OK.
 */
export const showToast = ({
  icon = "info",
  title = "",
  text = "",
  html,
  timer = 3200,
} = {}) => {
  const hasDetail = Boolean(text || html);
  const tone = ["success", "error", "warning", "info", "question"].includes(icon) ? icon : "info";

  return Swal.fire({
    toast: true,
    position: "top-end",
    icon,
    title,
    text: text || undefined,
    html: html || undefined,
    showConfirmButton: false,
    timer,
    timerProgressBar: true,
    buttonsStyling: false,
    showClass: {
      popup: "swal2-show admin-swal-toast-enter",
    },
    customClass: {
      ...toastCustomClass,
      popup: `admin-swal-toast admin-swal-toast--${tone}${hasDetail ? "" : " admin-swal-toast--single"}`,
    },
  });
};

/**
 * Thông báo góc phải — alias của showToast (tương thích code cũ gọi alert giữa màn).
 */
export const showAlertDialog = (options = {}) => {
  const {
    icon = "info",
    title = "",
    text = "",
    html,
    timer,
  } = stripLegacyColors(options);

  return showToast({
    icon,
    title,
    text,
    html,
    timer: timer ?? (icon === "error" ? 4500 : icon === "warning" ? 4000 : 3200),
  });
};

/**
 * Dialog hỏi giữa màn — 1 template duy nhất (confirm / input).
 * @param {"brand"|"danger"|"warning"} [options.tone]
 */
export const showConfirmDialog = (options = {}) => {
  const cleaned = stripLegacyColors(options);
  const { customClass: extraClass, tone, ...rest } = cleaned;
  const resolvedTone = tone || resolveTone(options);
  const hasCancel = rest.showCancelButton !== false && (
    rest.showCancelButton === true
    || Boolean(rest.cancelButtonText)
    || Boolean(rest.input)
  );

  return Swal.fire({
    reverseButtons: true,
    focusCancel: hasCancel,
    buttonsStyling: false,
    showCancelButton: hasCancel,
    showClass: {
      popup: "swal2-show admin-swal-enter",
    },
    customClass: buildDialogClasses(resolvedTone, {
      ...(hasCancel ? {} : { actions: "admin-swal-actions admin-swal-actions--single" }),
      ...(extraClass || {}),
    }),
    ...rest,
  });
};

/**
 * Router thông minh — điểm vào thay Swal.fire cho toàn app:
 * - toast / thông báo thường → góc phải (1 template)
 * - hỏi / nhập liệu / nội dung cần đọc → dialog giữa màn (1 template)
 *
 * Ép kiểu: { toast: true } | { dialog: true }
 */
export const notify = (options = {}) => {
  const raw = typeof options === "string"
    ? { title: options }
    : (options || {});

  const {
    toast: toastFlag,
    dialog: dialogFlag,
    position: _position,
    ...opts
  } = raw;

  if (toastFlag === true) return showAlertDialog(opts);
  if (dialogFlag === true || toastFlag === false) return showConfirmDialog(opts);

  const needsDialog = Boolean(
    opts.showCancelButton
    || opts.cancelButtonText
    || opts.input
    || opts.preConfirm
    || opts.inputValidator
    || opts.didOpen
    || opts.willOpen
    || opts.allowOutsideClick === false
    || (opts.html && opts.showConfirmButton !== false),
  );

  if (needsDialog) {
    return showConfirmDialog({
      showCancelButton: Boolean(opts.showCancelButton || opts.cancelButtonText || opts.input),
      ...opts,
    });
  }
  return showAlertDialog(opts);
};

/** Alias ngắn — cùng showToast. */
export const toast = showToast;

/** Alias ngắn — cùng showConfirmDialog. */
export const ask = showConfirmDialog;

/** Dùng trong preConfirm của showConfirmDialog. */
export const showValidationMessage = (...args) => Swal.showValidationMessage(...args);

/** Chip mã booking + mô tả — dùng trong html confirm. */
export const buildConfirmBodyHtml = ({
  code = "",
  text = "",
  note = "",
} = {}) => {
  const parts = [];
  if (code) {
    parts.push(
      `<div class="admin-swal-chip"><span class="admin-swal-chip-value">${String(code)}</span></div>`,
    );
  }
  if (text) {
    parts.push(`<p class="admin-swal-body-text">${text}</p>`);
  }
  if (note) {
    parts.push(`<p class="admin-swal-body-note">${note}</p>`);
  }
  return `<div class="admin-swal-body">${parts.join("")}</div>`;
};
