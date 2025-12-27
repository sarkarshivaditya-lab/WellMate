import { Auth0Provider } from "@auth0/auth0-react";

const redirectUri = import.meta.env.VITE_AUTH0_REDIRECT_URI;

if (!redirectUri) {
  throw new Error(
    "VITE_AUTH0_REDIRECT_URI is not defined. This is required for Auth0 to work correctly on web and mobile."
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        scope: "openid profile email",
      }}
      cacheLocation="localstorage"
      useRefreshTokens
    >
      {children}
    </Auth0Provider>
  );
}
