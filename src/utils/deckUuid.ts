const DEFAULT_DECK_UUID = "deck";
const SAFE_DECK_UUID_PATTERN = /^[A-Za-z0-9-]+$/;

export function normalizeDeckUuid(deckUuid: string | undefined): string {
  const candidate = deckUuid?.trim();
  if (!candidate) {
    return DEFAULT_DECK_UUID;
  }
  return SAFE_DECK_UUID_PATTERN.test(candidate) ? candidate : DEFAULT_DECK_UUID;
}
