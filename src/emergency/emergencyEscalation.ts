export type EmergencyNotificationStatus =
  | "PENDING"
  | "SUCCESS"
  | "PARTIAL_SUCCESS"
  | "FAILED";

export type EmergencyLocation = {
  latitude: number;
  longitude: number;
  accuracyM?: number;
  capturedAt: number;
};

export type EmergencyProfile = {
  bloodType?: string;
  allergies?: string[];
};

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
};

export type EmergencyEvent = {
  eventId: string;
  triggeredAt: number;
  reason: "TIMEOUT" | "USER_NOT_OK" | "MANUAL" | "SHORTCUT";
  location: EmergencyLocation | null;
  profile: EmergencyProfile;
  contacts: EmergencyContact[];
};

export type EmergencyDelivery = {
  contactId: string;
  status: EmergencyNotificationStatus;
  error?: string;
};

export type EmergencyEscalationResult = {
  event: EmergencyEvent;
  status: EmergencyNotificationStatus;
  deliveries: EmergencyDelivery[];
};

export interface EmergencyEscalationAdapter {
  notifyContact(contact: EmergencyContact, event: EmergencyEvent): Promise<void>;
  requestEmergencyCall(): Promise<"SUPPORTED" | "REQUIRES_USER" | "UNAVAILABLE">;
}

export function createEmergencyEvent(input: Omit<EmergencyEvent, "eventId">): EmergencyEvent {
  const eventId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { ...input, eventId };
}

export async function escalateEmergency(
  adapter: EmergencyEscalationAdapter,
  event: EmergencyEvent,
): Promise<EmergencyEscalationResult> {
  const deliveries: EmergencyDelivery[] = event.contacts.map((contact) => ({
    contactId: contact.id,
    status: "PENDING",
  }));

  if (event.contacts.length === 0) {
    return {
      event,
      status: "FAILED",
      deliveries,
    };
  }

  let successful = 0;

  for (const delivery of deliveries) {
    const contact = event.contacts.find((item) => item.id === delivery.contactId);
    if (!contact) {
      delivery.status = "FAILED";
      delivery.error = "Contact no longer exists";
      continue;
    }

    try {
      await adapter.notifyContact(contact, event);
      delivery.status = "SUCCESS";
      successful += 1;
    } catch (error) {
      delivery.status = "FAILED";
      delivery.error = error instanceof Error ? error.message : "Notification failed";
    }
  }

  const status: EmergencyNotificationStatus =
    successful === deliveries.length
      ? "SUCCESS"
      : successful > 0
        ? "PARTIAL_SUCCESS"
        : "FAILED";

  return { event, status, deliveries };
}
