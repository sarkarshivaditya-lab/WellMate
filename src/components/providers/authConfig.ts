declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

export const isCapacitorNative =
  typeof window !== "undefined" &&
  window.Capacitor?.isNativePlatform?.() === true;

export function getCapacitorCallbackUri(domain: string): string {
  const configured = import.meta.env.VITE_AUTH0_NATIVE_REDIRECT_URI as string | undefined;
  return configured ?? `com.wellmate.app://${domain}/capacitor/com.wellmate.app/callback`;
}

export function resolveRedirectUri(domain?: string): string {
  if (isCapacitorNative) {
    if (!domain) return "";
    return getCapacitorCallbackUri(domain);
  }

  const envUri = import.meta.env.VITE_AUTH0_REDIRECT_URI as string | undefined;
  if (envUri) return envUri;
  return typeof window !== "undefined" ? window.location.origin : "";
}
