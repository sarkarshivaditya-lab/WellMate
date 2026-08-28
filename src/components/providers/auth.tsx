import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";
import { Capacitor } from "@capacitor/core";

export const isCapacitorNative = Capacitor.isNativePlatform();

// Custom URI scheme used for Auth0 callback on Capacitor Android/iOS.
// Must be registered in AndroidManifest.xml and in Auth0 Allowed Callback URLs.
export const CAPACITOR_CALLBACK_URI = "com.wellmate.app://callback";

function resolveRedirectUri(): string {
  if (isCapacitorNative) return CAPACITOR_CALLBACK_URI;

  const envUri = import.meta.env.VITE_AUTH0_REDIRECT_URI as string | undefined;
  if (envUri) return envUri;

  return typeof window !== "undefined" ? window.location.origin : "";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;

  if (!domain || !clientId) {
    if (import.meta.env.DEV) {
      console.warn(
        "[AuthProvider] VITE_AUTH0_DOMAIN or VITE_AUTH0_CLIENT_ID is missing. " +
          "Running without Auth0 — auth-gated routes will loop to onboarding."
      );
    }
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
