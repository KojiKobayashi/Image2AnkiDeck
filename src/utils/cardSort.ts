import type { Card } from "../types";

export function sortCardsNewestFirst(cards: Card[]): Card[] {
  return [...cards].reverse();
}
