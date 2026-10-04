/** Only same-origin paths: "/library" yes; "//evil.com", "https://evil.com" and "/\\evil.com" no. */
export function safeCallbackPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
