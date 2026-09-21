const STORAGE_PREFIX = "@@auth0spajs@@";

export const AUTH0_CLIENT_CACHE_PREFIX = STORAGE_PREFIX;

export function clearAuth0AppCache(): void {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn("[WellMate Auth] Unable to clear cached Auth0 state:", error);
  }
}
