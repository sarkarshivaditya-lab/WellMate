// Haptic semantics — intentional physical feedback for meaningful moments.
//
// Philosophy: haptics carry meaning, not noise.
// Every vibration must be earned by a significant interaction.
// Silence is the default; sound only when the moment matters.
//
// Implementation: Web Vibration API (mobile web only).
// Falls back silently on desktop and unsupported browsers.

const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' && 'vibrate' in navigator;

// Vibration patterns (ms). Arrays = vibrate → pause → vibrate.
// Durations chosen for wellness context: restrained, never aggressive.
const patterns = {
  // Micro acknowledgment — any significant tap (log entry, settings toggle)
  light:       8,

  // Action completion — meal logged, habit checked, journal saved
  complete:    [20, 12, 20] as number[],

  // Milestone / wellness goal achieved — streak, target hit
  success:     [30, 18, 60] as number[],

  // Caution — pre-confirmation for destructive action
  caution:     [70, 35, 70] as number[],

  // Destructive — final confirm (delete entry, reset data)
  destructive: 180,

  // Gentle reinforcement — streak maintained, check-in done, quiet encouragement
  gentle:      [10, 8, 10] as number[],

  // Dismissal — swiping away a sheet, cancelling a modal
  dismiss:     8,
} as const;

type HapticType = keyof typeof patterns;

function vibrate(type: HapticType): void {
  if (!canVibrate()) return;
  navigator.vibrate(patterns[type]);
}

export const haptics = {
  light:       () => vibrate('light'),
  complete:    () => vibrate('complete'),
  success:     () => vibrate('success'),
  caution:     () => vibrate('caution'),
  destructive: () => vibrate('destructive'),
  gentle:      () => vibrate('gentle'),
  dismiss:     () => vibrate('dismiss'),
} as const;

export type HapticType_ = HapticType;
