import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

export const isCapacitorNative =
  typeof window !== "undefined" &&
  window.Capacitor?.isNativePlatform?.() === true;

export const CAPACITOR_CALLBACK_URI = "com.wellmate.app://callback";

function resolveRedirectUri(): string {
  if (isCapacitorNative) return CAPACITOR_CALLBACK_URI;

  const envUri = (import.meta.env.VITE_AUTH0_REDIRECT_URI as string | undefined)?.trim();
  if (envUri) return envUri;

  return typeof window !== "undefined" ? window.location.origin : "";
}

function AuthProviderWithNavigation({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const domain = (import.meta.env.VITE_AUTH0_DOMAIN as string | undefined)?.trim();
  const clientId = (import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined)?.trim();

  if (!domain || !clientId) {
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
        ...(import.meta.env.VITE_AUTH0_AUDIENCE
          ? { audience: import.meta.env.VITE_AUTH0_AUDIENCE as string }
          : {}),
        scope: "openid profile email",
      }}
      cacheLocation="localstorage"
      useRefreshTokens
      onRedirectCallback={(appState) => {
        if (isCapacitorNative) return;

        const returnTo =
          typeof appState?.returnTo === "string" && appState.returnTo.startsWith("/")
            ? appState.returnTo
            : "/";

        navigate(returnTo, { replace: true });
      }}
    >
      {children}
    </Auth0Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (isCapacitorNative) {
    // Capacitor does not use BrowserRouter for its external callback scheme.
    // The callback is completed by CapacitorAuthHandler.
    return (
      <Auth0Provider
        domain={((import.meta.env.VITE_AUTH0_DOMAIN as string | undefined) ?? "").trim()}
        clientId={((import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined) ?? "").trim()}
        authorizationParams={{
          redirect_uri: CAPACITOR_CALLBACK_URI,
          ...(import.meta.env.VITE_AUTH0_AUDIENCE
            ? { audience: import.meta.env.VITE_AUTH0_AUDIENCE as string }
            : {}),
          scope: "openid profile email",
        }}
        cacheLocation="localstorage"
        useRefreshTokens
      >
        {children}
      </Auth0Provider>
    );
  }

  return <BrowserAuthProvider>{children}</BrowserAuthProvider>;
}

function BrowserAuthProvider({ children }: { children: React.ReactNode }) {
  return <BrowserAuthProviderInner>{children}</BrowserAuthProviderInner>;
}

function BrowserAuthProviderInner({ children }: { children: React.ReactNode }) {
  return (
    <BrowserAuthProviderWithRouter>
      {children}
    </BrowserAuthProviderWithRouter>
  );
}

function BrowserAuthProviderWithRouter({ children }: { children: React.ReactNode }) {
  return <AuthProviderWithNavigate>{children}</AuthProviderWithNavigate>;
}
