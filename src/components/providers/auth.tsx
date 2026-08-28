import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";
import { Capacitor } from "@capacitor/core";

export const isCapacitorNative = Capacitor.isNativePlatform();

// Auth0's documented Ionic/Capacitor callback format:
// <packageId>://<auth0Domain>/capacitor/<packageId>/callback
export const CAPACITOR_CALLBACK_URI = `com.wellmate.app://${import.meta.env.VITE_AUTH0_DOMAIN}/capacitor/com.wellmate.app/callback`;

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
          "Auth-gated routes cannot authenticate until the Auth0 environment is configured.",
      );
    }

    return (
      <Auth0Provider
        domain="placeholder.auth0.com"
        clientId="placeholder"
        authorizationParams={{
          redirect_uri: typeof window !== "undefined" ? window.location.origin : "",
        }}
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
        ...(import.meta.env.VITE_AUTH0_AUDIENCE
          ? { audience: import.meta.env.VITE_AUTH0_AUDIENCE as string }
          : {}),
        scope: "openid profile email",
      }}
      cacheLocation="localstorage"
      useRefreshTokens
      useRefreshTokensFallback={false}
      onRedirectCallback={(appState) => {
        const returnTo =
          typeof appState?.returnTo === "string" && appState.returnTo.startsWith("/")
            ? appState.returnTo
            : "/physical";
        window.history.replaceState({}, document.title, returnTo);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }}
    >
      {children}
    </Auth0Provider>
  );
}
