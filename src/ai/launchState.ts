// Launch readiness — centralized capability availability flags.
//
// These flags control which AI features are active and what UX state is shown.
// Each flag is a single-line change to enable at launch.
//
// To enable mental coaching at launch:
//   Set mentalCoachingAvailable: true
//   Prerequisite: cloud AI API (Claude/OpenAI) active + aiMentalCoach Convex action configured
//
// To enable the floating assistant cloud fallback:
//   Set cloudAssistantAvailable: true
//   Prerequisite: wellmateChat Convex action configured and API keys set

export const LAUNCH_STATE = {
  // Advanced mental wellbeing coaching via cloud intelligence infrastructure.
  // When false: informational notices are shown in CoachTabContent and WellMateLauncher.
  // When true: notices are removed; full coaching functionality is available.
  mentalCoachingAvailable: true,

  // WellMate floating assistant cloud fallback (wellmateChat Convex action).
  // When false: assistant gates on local AI readiness only; cloud path is suppressed.
  // When true: cloud fallback is attempted when local AI is unavailable.
  cloudAssistantAvailable: true,
} as const;

export type LaunchState = typeof LAUNCH_STATE;
