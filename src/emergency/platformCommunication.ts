import type {
  EmergencyContact,
  EmergencyEscalationAdapter,
  EmergencyEvent,
} from "./emergencyEscalation";

export type EmergencyCommunicationCapability =
  | "SUPPORTED"
  | "REQUIRES_USER"
  | "UNAVAILABLE";

function buildEmergencyMessage(event: EmergencyEvent): string {
  const lines = [
    "WellMate emergency alert: a possible accident was detected.",
    `Time: ${new Date(event.triggeredAt).toLocaleString()}`,
  ];

  if (event.location) {
    lines.push(`Location: https://maps.google.com/?q=${event.location.latitude},${event.location.longitude}`);
  }

  if (event.profile.bloodType) lines.push(`Blood type: ${event.profile.bloodType}`);
  if (event.profile.allergies && event.profile.allergies.length > 0) {
    lines.push(`Allergies: ${event.profile.allergies.join(", ")}`);
  }

  return lines.join("\n");
}

export class BrowserCommunicationAdapter implements EmergencyEscalationAdapter {
  public async notifyContact(contact: EmergencyContact, event: EmergencyEvent): Promise<void> {
    const message = encodeURIComponent(buildEmergencyMessage(event));
    const uri = `sms:${contact.phone}?body=${message}`;

    if (typeof window === "undefined") {
      throw new Error("SMS composer is unavailable outside a browser");
    }

    window.location.assign(uri);
    // Opening the system composer does not confirm delivery. Keep the caller's
    // delivery status pending rather than reporting success.
    await Promise.resolve();
  }

  public async requestEmergencyCall(): Promise<"SUPPORTED" | "REQUIRES_USER" | "UNAVAILABLE"> {
    // A normal browser/third-party WebView cannot silently place an emergency
    // call. The app must use an explicit user-driven tel: handoff instead.
    return "REQUIRES_USER";
  }
}

export class CapacitorCommunicationAdapter extends BrowserCommunicationAdapter {
  public constructor(private readonly emergencyNumber: string | null = null) {
    super();
  }

  public override async requestEmergencyCall(): Promise<"SUPPORTED" | "REQUIRES_USER" | "UNAVAILABLE"> {
    if (!this.emergencyNumber) return "UNAVAILABLE";
    if (typeof window === "undefined") return "UNAVAILABLE";

    window.location.assign(`tel:${this.emergencyNumber}`);
    return "REQUIRES_USER";
  }
}
