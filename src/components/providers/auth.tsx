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

export const CAPACITOR_CALLBACK_URI = "com.wellmate.app://YOUR_AUTH0_DOMAIN/capacitor/com.wellmate.app/callback";

function resolveRedirectUri(domain?: string): string {
  if (isCapacitorNative) {
    const configured = import.meta.env.VITE_AUTH0_NATIVE_REDIRECT_URI as string | undefined;
    if (configured) return configured;

    if (!domain) return "";
    return `com.wellmate.app://${domain}/capacitor/com.wellmate.app/callback`;
  }

  const envUri = import.meta.env.VITE_AUTH0_REDIRECT_URI as string | undefined;
  if (envUri) return envUri;
  return typeof window !== "undefined" ? window.location.origin : "";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;

  if (!domain || !clientId) {
    if (import.meta.env.DEV) {
      console.warn("[AuthProvider] Auth0 is not configured; protected routes cannot authenticate.");
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
        redirect_uri: resolveRedirectUri(domain),
        audience: import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined,
        scope: "openid profile email",
      }}
      cacheLocation="localstorage"
      useRefreshTokens
      useRefreshTokensFallback={false}
    >
      {children}
    </Auth0Provider>
  );
}
