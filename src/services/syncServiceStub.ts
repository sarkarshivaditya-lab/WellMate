// TODO: This is a stub for future backend sync functionality
// Replace with actual server sync when backend is ready

export interface SyncConfig {
  enabled: boolean;
  serverUrl?: string;
  apiKey?: string;
}

export class SyncService {
  private config: SyncConfig;

  constructor(config: SyncConfig = { enabled: false }) {
    this.config = config;
  }

  async syncMeals(): Promise<void> {
    if (!this.config.enabled) {
      console.log("Sync disabled, skipping meal sync");
      return;
    }
    // TODO: Implement actual sync logic
    console.log("Syncing meals to server...");
  }

  async syncExercises(): Promise<void> {
    if (!this.config.enabled) {
      console.log("Sync disabled, skipping exercise sync");
      return;
    }
    // TODO: Implement actual sync logic
    console.log("Syncing exercises to server...");
  }

  async syncUserProfile(): Promise<void> {
    if (!this.config.enabled) {
      console.log("Sync disabled, skipping user profile sync");
      return;
    }
    // TODO: Implement actual sync logic
    console.log("Syncing user profile to server...");
  }
}

export const syncService = new SyncService({
  enabled: import.meta.env.VITE_SYNC_ENABLED === "true",
  serverUrl: import.meta.env.VITE_SYNC_SERVER_URL,
  apiKey: import.meta.env.VITE_SYNC_API_KEY,
});
