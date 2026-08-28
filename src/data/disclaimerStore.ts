const KEY = "wellmate_disclaimer_acked_v2";

export function hasAckedDisclaimer(): boolean {
  return localStorage.getItem(KEY) === "true";
}

export function setDisclaimerAcked(): void {
  localStorage.setItem(KEY, "true");
}
