// Crisis detection keywords — used by AI safety layer, not for display.
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
];

// Emergency copy used by WellMateLauncher crisis detection UI.
export const EMERGENCY_COPY = {
  title: "If you're in crisis",
  body: "This is not a crisis intervention service. Please contact national helplines immediately.",
  resources: [
    { label: "Tele-MANAS", description: "14416" },
    { label: "Toll-Free", description: "844-844-0632" },
    { label: "Emergency", description: "Visit nearest psychiatric emergency facility" },
  ],
} as const;

// ── Policy document types ──────────────────────────────────────────────────────

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

// ── Full policy document ───────────────────────────────────────────────────────
// Exact wording per ToS & Privacy Policy. Do not paraphrase or reorder.

export const POLICY_DOCUMENT: PolicyGroup[] = [
  {
    groupTitle: "Terms of Service (ToS) & Non-Clinical Disclaimer",
    intro:
      "Dr Anuradha Palta's consultancy operates as a non-clinical, educational, and advisory platform. We specialise in interdisciplinary research mentorship, corporate wellness, and cognitive performance coaching.",
    items: [
      {
        label: "No Medical Advice",
        text: "The information provided on this website and during consultations is for educational and developmental purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment.",
      },
      {
        label: "No Clinical Intervention",
        text: "We do not provide clinical therapy, psychiatric medication management.",
      },
      {
        label: "No Crisis Support",
        text: "This is not a crisis intervention service. In the event of an emergency, self-harm thoughts, or acute psychological distress, please contact national helplines such as Tele-MANAS (14416) or Toll-Free Number: 844-844-0632 OR visit the nearest psychiatric emergency facility.",
      },
    ],
  },
  {
    groupTitle: "Privacy Policy (DPDP Act 2023 Compliant)",
    subsections: [
      {
        title: "Data Collection & Purpose",
        intro:
          "In compliance with the Digital Personal Data Protection Act (DPDP) of India, we collect personal data (Name, Contact, Academic/Professional background) only with your explicit consent. This data is used solely for:",
        bullets: [
          "Tailoring research mentorship and wellness frameworks.",
          "Processing psychometric assessments.",
          "Managing service bookings and billing.",
        ],
      },
      {
        title: "Your Rights (The Data Principal)",
        items: [
          {
            label: "Right to Correction",
            text: "You may update or correct your data at any time.",
          },
          {
            label: "Right to Erasure",
            text: "You may request the deletion of your personal data once the service contract is fulfilled.",
          },
          {
            label: "Data Security",
            text: "We implement industry-standard encryption to protect your “Digital Personal Data” from unauthorized access. We do not sell or share your data with third-party marketing firms.",
          },
        ],
      },
      {
        title: "Conflict of Interest & Professional Ethics",
        items: [
          {
            label: "Academic Neutrality",
            text: "Dr. Palta maintains strict academic neutrality. Consultancy provided to corporate entities does not influence her independent research or university-affiliated duties.",
          },
          {
            label: "Dual-Role Disclosure",
            text: "In cases where Dr. Palta serves both an institution (College/School) and an individual within that institution, the boundaries of confidentiality and reporting will be established in a separate tripartite agreement to prevent conflicts of interest.",
          },
          {
            label: "Third-Party Tools",
            text: "Any psychometric or digital health tools recommended are selected based on merit. We disclose any prior professional associations with tool developers, if applicable.",
          },
        ],
      },
    ],
  },
];

// ── Legacy aliases — kept so non-disclaimer code that imports these still compiles.
// These are no longer rendered in the disclaimer UI.
// @deprecated use POLICY_DOCUMENT instead.
export const FIRST_LAUNCH_POINTS: readonly string[] = [
  "Dr Anuradha Palta's consultancy is a non-clinical, educational, and advisory platform.",
  "No Medical Advice: information is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.",
  "No Clinical Intervention: we do not provide clinical therapy or psychiatric medication management.",
  "No Crisis Support: contact Tele-MANAS (14416) or 844-844-0632 for emergencies or acute distress.",
  "Your personal data is collected only with explicit consent and is not sold to third-party marketing firms.",
];

// @deprecated use POLICY_DOCUMENT instead.
export const DISCLAIMER_SECTIONS: readonly { title: string; body: string }[] = [];
