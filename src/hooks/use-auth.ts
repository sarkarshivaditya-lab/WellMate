import { useAuth0 } from "@auth0/auth0-react";

export function useAuth() {
  const { isAuthenticated, isLoading, loginWithRedirect, logout } = useAuth0();

  return { isAuthenticated, isLoading, loginWithRedirect, logout };
}
