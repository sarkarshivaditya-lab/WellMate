export const CRISIS_KEYWORDS = [
  "suicide",
  "suicidal",
  "kill myself",
  "end my life",
  "want to die",
  "hurt myself",
  "self harm",
  "self-harm",
  "harming myself",
  "overdose",
  "no reason to live",
  "can't go on",
  "cant go on",
  "don't want to be here",
  "feeling hopeless",
  "hopeless",
] as const;

export const EMERGENCY_COPY = {
  title: "If you are in immediate danger",
  body: "WellMate is not a replacement for emergency services or professional medical care. If someone is seriously injured, unconscious, not breathing normally, or in immediate danger, contact emergency services now.",
  resources: [
    { label: "Emergency services", description: "112 in India" },
    { label: "Emergency contact", description: "Use the contact configured in WellMate" },
    { label: "Local ambulance", description: "Use the local number configured in your emergency profile" },
    { label: "Mental health support", description: "Tele-MANAS — 14416" },
  ],
} as const;

export const GOLDEN_HOUR_DISCLAIMER = {
  title: "WellMate health & safety notice",
  body: "WellMate provides wellness guidance, health tracking, and emergency-support features. AI guidance is informational and is not medical advice, diagnosis, or treatment. Golden Hour features are designed to help you act quickly during an emergency, but they depend on device permissions, connectivity, configured contacts, and platform capabilities. Always contact emergency services for an immediate medical emergency.",
  privacy: "Your health and profile information is used to personalize WellMate features and emergency readiness. Keep emergency contacts, medical details, and permissions accurate and up to date.",
} as const;

export type PolicyItem = {
  label: string;
  text: string;
};

export type PolicySubsection = {
  title: string;
  intro?: string;
  items?: PolicyItem[];
  bullets?: readonly string[];
};

export type PolicyGroup = {
  groupTitle: string;
  intro?: string;
  items?: PolicyItem[];
  subsections?: PolicySubsection[];
};

export const POLICY_DOCUMENT: PolicyGroup[] = [
  {
    groupTitle: "WellMate Terms & Health Safety",
    intro:
      "WellMate is a digital wellness and health-support application designed to help users understand their wellbeing, build healthier habits, and respond more quickly when an emergency may be occurring.",
    items: [
      {
        label: "AI guidance is not medical advice",
        text: "WellMate's AI features provide informational and wellness-oriented guidance. They do not replace a qualified doctor, emergency clinician, diagnosis, prescription, or treatment plan.",
      },
      {
        label: "Emergency support is not a guarantee of rescue",
        text: "Golden Hour features can help surface an emergency, prepare location and profile context, and initiate supported contact actions. Actual delivery depends on device permissions, connectivity, operating-system capabilities, configured contacts, and available emergency services.",
      },
      {
        label: "Use emergency services for urgent danger",
        text: "If there is an immediate threat to life or serious injury, contact emergency services directly. In India, call 112. Do not wait for an AI response before seeking urgent care.",
      },
      {
        label: "Keep emergency information current",
        text: "Emergency contacts, local ambulance numbers, blood type, allergies, and other profile information should be kept accurate. WellMate cannot independently verify the information you provide.",
      },
    ],
  },
  {
    groupTitle: "Privacy & Data",
    subsections: [
      {
        title: "How information is used",
        intro:
          "WellMate may use information you provide or generate through the app to personalize wellness features, provide AI guidance, support emergency readiness, and maintain app functionality.",
      },
      {
        title: "Your responsibility",
        items: [
          {
            label: "Accuracy",
            text: "Review your profile and emergency settings regularly, especially after changing phone numbers, contacts, location, or relevant health information.",
          },
          {
            label: "Permissions",
            text: "Location, motion, notification, calling, messaging, and other device capabilities may be required for particular features. You can control these permissions through your device settings.",
          },
          {
            label: "Third-party services",
            text: "Some WellMate features rely on external infrastructure or device services. Their availability may vary by platform, network, region, or service provider.",
          },
        ],
      },
    ],
  },
];

export const FIRST_LAUNCH_POINTS: readonly string[] = [
  "WellMate provides wellness and health-support features; AI guidance is not medical advice.",
  "Golden Hour features are designed to help you act quickly during emergencies but depend on permissions, connectivity, configured contacts, and platform capabilities.",
  "For immediate danger or serious injury, contact emergency services directly. In India, call 112.",
  "Keep emergency contacts and health information accurate and up to date.",
];

export const DISCLAIMER_SECTIONS: readonly { title: string; body: string }[] = [
  { title: GOLDEN_HOUR_DISCLAIMER.title, body: GOLDEN_HOUR_DISCLAIMER.body },
  { title: "Privacy", body: GOLDEN_HOUR_DISCLAIMER.privacy },
];
