/** Compare unrounded percentages without treating floating-point noise as a breach. */
export function exceedsThreshold(value: number, threshold: number): boolean {
  const roundingNoise = 4 * Number.EPSILON * Math.max(Math.abs(value), Math.abs(threshold))
  return value - threshold > roundingNoise
}
