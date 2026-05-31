import { describe, expect, it } from "vitest";
import type { Card } from "../../src/types";
import { sortCardsNewestFirst } from "../../src/utils/cardSort";

function createCard(id: string): Card {
  return {
    id,
    questionImage: null,
    questionText: "",
    answerImage: null,
    answerText: "",
  };
}

describe("sortCardsNewestFirst", () => {
  it("returns cards in reverse registration order", () => {
    const cards = [createCard("oldest"), createCard("middle"), createCard("newest")];

    const sortedCards = sortCardsNewestFirst(cards);

    expect(sortedCards.map((card) => card.id)).toEqual(["newest", "middle", "oldest"]);
  });

  it("does not mutate the source array", () => {
    const cards = [createCard("1"), createCard("2"), createCard("3")];

    sortCardsNewestFirst(cards);

    expect(cards.map((card) => card.id)).toEqual(["1", "2", "3"]);
  });
});
