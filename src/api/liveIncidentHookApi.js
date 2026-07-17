/**
 * Live GPS webhook — KHÔNG dùng JWT Azure.
 * Header: X-Live-Hook-Secret
 * POST {LIVE_BASE}/api/incidents/hook
 */

const stripTrailingSlash = (url) => {
  let value = String(url || "");
  while (value.endsWith("/")) value = value.slice(0, -1);
  return value;
};

export const getLiveBaseUrl = () => {
  const fromEnv = stripTrailingSlash(import.meta.env.VITE_LIVE_BASE_URL || "");
  // Dev: gửi cùng origin qua Vite proxy để tránh CORS từ Live server.
  if (import.meta.env.DEV && fromEnv) return "/live-hook";
  if (fromEnv) return fromEnv;
  return "";
};

export const getLiveHookSecret = () =>
  String(import.meta.env.VITE_LIVE_HOOK_SECRET || "").trim();

export const isLiveHookConfigured = () =>
  Boolean(getLiveBaseUrl() && getLiveHookSecret());

/** POST /api/incidents/hook — không gắn Bearer token. */
export const postLiveIncidentHook = async (payload) => {
  const base = getLiveBaseUrl();
  const secret = getLiveHookSecret();
  if (!base || !secret) {
    const err = new Error("Live hook chưa cấu hình (VITE_LIVE_BASE_URL / VITE_LIVE_HOOK_SECRET).");
    err.code = "LIVE_HOOK_NOT_CONFIGURED";
    throw err;
  }

  const url = `${base}/api/incidents/hook`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Live-Hook-Secret": secret,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const err = new Error(
      (data && (data.message || data.detail || data.title))
      || `Live hook failed (${response.status})`,
    );
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
};
