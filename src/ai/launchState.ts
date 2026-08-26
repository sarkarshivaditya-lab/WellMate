export const LAUNCH_STATE = {
  mentalCoachingAvailable: false,
  cloudAssistantAvailable: false,
} as const;

export type LaunchState = typeof LAUNCH_STATE;
