/** Named badge colors; the presentation layer maps these to concrete styles. */
export const COLORS = ['gray', 'blue', 'teal', 'green', 'amber', 'red', 'purple', 'pink'] as const;
export type Color = (typeof COLORS)[number];
