export const getApiErrorMessage = (error, fallback) => {
  const data = error?.response?.data;

  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data.message === "string" && data.message) return data.message;
  if (typeof data.title === "string" && data.title) return data.title;
  if (data.errors && typeof data.errors === "object") {
    const messages = Object.values(data.errors).flat().filter(Boolean);
    if (messages.length > 0) return messages.join("\n");
  }

  return fallback;
};
