// Utility to get country flag emoji from ISO2 code
export function getCountryFlag(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return "🌍";
  const codePoints = iso2
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Get flag URL (fallback for systems that don't support flag emojis)
export function getCountryFlagUrl(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return "";
  return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
}
