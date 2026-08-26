import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";
import { resolveRedirectUri } from "./authConfig";

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
        redirect_uri: resolveRedirectUri(domain),
        ...(import.meta.env.VITE_AUTH0_AUDIENCE
          ? { audience: import.meta.env.VITE_AUTH0_AUDIENCE as string }
          : {}),
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
