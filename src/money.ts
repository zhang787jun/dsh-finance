/** Two-decimal amounts are rounded once, half away from zero, then added as cents. */
export function toCents(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`)
  // Shift the decimal representation, avoiding binary errors such as 1.005 * 100.
  const [coefficient, exponent = '0'] = Math.abs(value).toString().split('e')
  const cents = Math.sign(value) * Math.round(Number(`${coefficient}e${Number(exponent) + 2}`))
  assertSafeCents(cents, name)
  return cents
}

function assertSafeCents(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) throw new Error(`${name} exceeds the safe monetary range`)
}

export function addCents(left: number, right: number, name: string): number {
  const result = left + right
  assertSafeCents(result, name)
  return result
}

export function fromCents(value: number): number {
  return value === 0 ? 0 : value / 100
}
