/**
 * Returns a YYYY-MM-DD string in the device's local timezone.
 * Using toISOString() would return UTC date, which is wrong for users east of UTC
 * or west of UTC after midnight local time.
 */
export function localDateIso(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA");
}
