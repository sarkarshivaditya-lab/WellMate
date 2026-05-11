export const DISCLAIMER_SHORT =
  "WellMate is a wellness companion, not a medical device. Content is for informational purposes only and is not a substitute for professional medical advice.";

export const AI_DISCLAIMER_SHORT =
  "AI guidance only — not medical advice. Consult a qualified professional for health concerns.";

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

export const EMERGENCY_COPY = {
  title: "If you're in crisis",
  body: "Reach out immediately — help is available 24/7.",
  resources: [
    { label: "1066", description: "Suicide & Crisis Lifeline — call or text" },
    { label: "100/112", description: "Crisis Text Line — text HOME" },
    { label: "102", description: "Emergency services" },
  ],
} as const;

export const FIRST_LAUNCH_POINTS = [
  "WellMate is a personal wellness companion, not a certified medical device.",
  "AI-generated suggestions are for general informational purposes only — not a substitute for professional medical advice, diagnosis, or treatment.",
  "Always consult a qualified healthcare provider before making health-related decisions.",
  "If you are experiencing a medical or mental health emergency, call 911 or text 988 immediately.",
  "Your data is stored privately on this device by default.",
] as const;

export const DISCLAIMER_SECTIONS = [
  {
    title: "Not Medical Advice",
    body: "WellMate is a personal wellness application designed to support healthy habits. It is not a medical device and does not provide medical advice, diagnosis, or treatment. Information provided within the app — including AI-generated content — is for general informational and educational purposes only.",
  },
  {
    title: "AI & Automated Suggestions",
    body: "AI-generated responses are based on general wellness knowledge and your self-reported inputs. They are not personalized medical guidance and may not be accurate or appropriate for your specific situation. Do not rely on AI responses in place of professional consultation.",
  },
  {
    title: "Mental Wellness Features",
    body: "Journaling, mood tracking, and the AI coach are tools for personal reflection and general wellbeing support. They are not a replacement for therapy, counseling, or psychiatric care. If you are experiencing significant mental health challenges, please reach out to a qualified mental health professional.",
  },
  {
    title: "Emergency Situations",
    body: "WellMate is not an emergency service. If you are experiencing a medical or mental health emergency, call 911 immediately. For crisis support, call or text 988 (Suicide & Crisis Lifeline) or text HOME to 741741 (Crisis Text Line). Do not rely on this app in an emergency.",
  },
  {
    title: "Your Responsibility",
    body: "You are solely responsible for decisions you make based on information within this app. WellMate, its developers, and its affiliates are not liable for outcomes arising from use of this application. Use your own judgment and consult professionals for health decisions.",
  },
  {
    title: "Data & Privacy",
    body: "Your health data is stored locally on this device by default. When you sign in, data may be synced to secure cloud storage. WellMate does not sell your personal health information. You can review your data at any time in Profile settings.",
  },
] as const;
