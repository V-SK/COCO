/** Trigger haptic feedback on native platforms */
export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  const h = (window as unknown as Record<string, Record<string, () => void>>).__haptics;
  if (h?.[style]) {
    h[style]();
  }
}
