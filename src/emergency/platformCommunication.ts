import type {
  EmergencyContact,
  EmergencyEscalationAdapter,
  EmergencyEvent,
  EmergencyDeliveryOutcome,
} from "./emergencyEscalation";

export type EmergencyCommunicationCapability =
  | "SUPPORTED"
  | "REQUIRES_USER"
  | "UNAVAILABLE";

function buildEmergencyMessage(event: EmergencyEvent): string {
  const lines = [
    "🚨 WELLMATE EMERGENCY ALERT",
    "A possible accident was detected.",
    "",
    `Time: ${new Date(event.triggeredAt).toLocaleString()}`,
  ];

  const location = event.location
    ? `https://maps.google.com/?q=${event.location.latitude},${event.location.longitude}`
    : null;

  lines.push(`Location: ${location ?? "Location unavailable"}`);

  if (event.profile.bloodType) {
    lines.push(`Blood type: ${event.profile.bloodType}`);
  }

  if (event.profile.allergies?.length) {
    lines.push(`Allergies: ${event.profile.allergies.join(", ")}`);
  }

  lines.push("", "Please check on the user and contact emergency services if needed.");

  return lines.join("\n");
}

export function buildEmergencySmsUri(contact: EmergencyContact, event: EmergencyEvent): string {
  return `sms:${contact.phone}?body=${encodeURIComponent(buildEmergencyMessage(event))}`;
}

export class BrowserCommunicationAdapter implements EmergencyEscalationAdapter {
  public async notifyContact(
    contact: EmergencyContact,
    event: EmergencyEvent,
  ): Promise<EmergencyDeliveryOutcome> {
    if (typeof window === "undefined") {
      throw new Error("SMS composer is unavailable outside a browser");
    }

    window.location.assign(buildEmergencySmsUri(contact, event));
    return "PENDING";
  }

  public async requestEmergencyCall(): Promise<EmergencyCommunicationCapability> {
    return "REQUIRES_USER";
  }
}

export class CapacitorCommunicationAdapter extends BrowserCommunicationAdapter {
  public constructor(private readonly emergencyNumber: string | null = null) {
    super();
  }

  public override async requestEmergencyCall(): Promise<EmergencyCommunicationCapability> {
    if (!this.emergencyNumber || typeof window === "undefined") return "UNAVAILABLE";
    window.location.assign(`tel:${this.emergencyNumber}`);
    return "REQUIRES_USER";
  }
}
