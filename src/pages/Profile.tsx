import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Profile / Settings
 *
 * UI ONLY
 * - No auth logic
 * - No redirects
 * - No side effects
 * - Safe offline
 */
export default function Profile() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
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
            onClick={() => {
              // AUTH WILL BE WIRED HERE LATER
              // UI ONLY FOR NOW
            }}
          >
            Sign in
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data & Privacy</CardTitle>
        </CardHeader>

        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            Your data is stored locally on this device by default.
          </p>
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

