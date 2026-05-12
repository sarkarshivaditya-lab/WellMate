import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";

/**
 * Detect Capacitor native runtime at module load time.
 * When running inside a Capacitor Android/iOS app, window.Capacitor is set.
 * The app is served from https://localhost in this context (androidScheme: "https"),
 * so Auth0 must redirect back to https://localhost, not the dev server URL.
 */
declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}
const isCapacitorNative =
  typeof window !== "undefined" &&
  window.Capacitor?.isNativePlatform?.() === true;

function resolveRedirectUri(): string {
  // In Capacitor Android (androidScheme: "https") the origin is https://localhost.
  // Auth0 must redirect back to that origin — NOT the dev server.
  if (isCapacitorNative) return "https://localhost";

  // Explicit env var takes priority for web / custom deploys.
  const envUri = import.meta.env.VITE_AUTH0_REDIRECT_URI as string | undefined;
  if (envUri) return envUri;

  // Last resort: current origin (works for most web hosting scenarios).
  return typeof window !== "undefined" ? window.location.origin : "";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;

  // If Auth0 is not configured at all, render children without the Auth0 context.
  // The app will work in offline/guest mode; auth-gated features degrade gracefully.
  if (!domain || !clientId) {
    if (import.meta.env.DEV) {
      console.warn(
        "[AuthProvider] VITE_AUTH0_DOMAIN or VITE_AUTH0_CLIENT_ID is missing. " +
          "Running without Auth0 — auth-gated routes will loop to onboarding."
      );
    }
    // Provide a minimal stub so useAuth0() doesn't crash when called by child components.
    // We re-export the real Auth0Provider with placeholder values; Auth0 will fail to
    // initialize and leave isAuthenticated=false, isLoading=false — safe for offline mode.
    return (
      <Auth0Provider
        domain="placeholder.auth0.com"
        clientId="placeholder"
        authorizationParams={{ redirect_uri: typeof window !== "undefined" ? window.location.origin : "" }}
        cacheLocation="localstorage"
      >
        {children}
      </Auth0Provider>
    );
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: resolveRedirectUri(),
        audience: import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined,
        scope: "openid profile email",
      }}
      cacheLocation="localstorage"
      useRefreshTokens
    >
      {children}
    </Auth0Provider>
  );
}
