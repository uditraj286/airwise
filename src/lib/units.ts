/** Expand measurement abbreviations in advice and other text shown to families. */
export function spellOutUnits(text: string): string {
  return text
    .replace(/([0-9])\s*(?:[µμu]g|mcg)\s*\/\s*m[³3]/gi, "$1 micrograms per cubic metre")
    .replace(/([0-9])\s*mg\s*\/\s*m[³3]/gi, "$1 milligrams per cubic metre")
    .replace(/([0-9])\s*m[³3]\s*\/\s*h(?:r)?\b/gi, "$1 cubic metres per hour")
    .replace(/([0-9])\s*(?:[µμu]g|mcg)\b/gi, "$1 micrograms")
    .replace(/([0-9])\s*m³/g, "$1 cubic metres")
    .replace(/([0-9])\s*km\s*\/\s*h(?:r)?\b/gi, "$1 kilometres per hour")
    .replace(/([0-9])\s*°\s*C\b/g, "$1 degrees Celsius")
    .replace(/([0-9])\s*kg\b/g, "$1 kilograms")
    .replace(/([0-9])\s*g\b/g, "$1 grams");
}
