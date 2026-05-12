import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

export const isCapacitorNative =
  typeof window !== "undefined" &&
  window.Capacitor?.isNativePlatform?.() === true;

// Custom URI scheme used for Auth0 callback on Capacitor Android/iOS.
// Must be registered in AndroidManifest.xml intent-filter and in the
// Auth0 dashboard under "Allowed Callback URLs".
export const CAPACITOR_CALLBACK_URI = "com.wellmate.app://callback";

function resolveRedirectUri(): string {
  // On Capacitor native, we open Auth0 in the system browser via @capacitor/browser
  // and intercept the callback via the custom URI scheme. The WebView never navigates away.
  if (isCapacitorNative) return CAPACITOR_CALLBACK_URI;

  // Explicit env var takes priority for web / custom deploys.
  const envUri = import.meta.env.VITE_AUTH0_REDIRECT_URI as string | undefined;
  if (envUri) return envUri;

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
