import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth0 } from "@auth0/auth0-react";

/**
 * Profile / Settings
 *
 * - Auth0 sign-in wired
 * - No redirects unless user clicks
 * - Safe offline
 * - No Convex coupling
 */
export default function Profile() {
  const {
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    user,
  } = useAuth0();

  return (
    <div className="space-y-6">
      {/* =========================
          ACCOUNT
         ========================= */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {!isAuthenticated ? (
            <>
              <div className="text-sm text-muted-foreground">
                You’re currently using WellMate without an account.
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <div className="text-sm font-medium">
                  Sign in to enable sync & backup
                </div>
                <div className="text-xs text-muted-foreground">
                  Signing in lets you back up your data and access it on other
                  devices. Your app works fully offline even without signing in.
                </div>
              </div>

              <Button
                className="w-full"
                disabled={isLoading}
                onClick={() => {
                  loginWithRedirect();
                }}
              >
                {isLoading ? "Preparing sign in…" : "Sign in"}
              </Button>
            </>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                You’re signed in{user?.email ? ` as ${user.email}` : ""}.
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <div className="text-sm font-medium">
                  Account connected
                </div>
                <div className="text-xs text-muted-foreground">
                  Your data can now be securely synced and backed up.
                </div>
              </div>

              <Button className="w-full" disabled>
                Signed in
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* =========================
          DATA & PRIVACY
         ========================= */}
      <Card>
        <CardHeader>
          <CardTitle>Data & Privacy</CardTitle>
        </CardHeader>

        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>Your data is stored locally on this device by default.</p>
          <p>
            Signing in enables secure cloud backup and syncing across devices.
          </p>
          <p>
            You stay in control — signing out will never delete local data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
