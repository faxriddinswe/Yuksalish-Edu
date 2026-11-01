export const sessionEvent = "yuksalish:session-changed";
export const sessionStorageKey = "yuksalish-session-change";

export function announceSessionChange() {
  window.dispatchEvent(
    new CustomEvent(sessionEvent, { detail: "redirecting" }),
  );
  try {
    localStorage.setItem(sessionStorageKey, `${Date.now()}-${Math.random()}`);
  } catch {
    // Focus and periodic checks still verify the server session.
  }
}
