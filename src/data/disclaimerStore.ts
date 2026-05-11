const KEY = "wellmate_disclaimer_acked";

export function hasAckedDisclaimer(): boolean {
  return localStorage.getItem(KEY) === "true";
}

export function setDisclaimerAcked(): void {
  localStorage.setItem(KEY, "true");
}
