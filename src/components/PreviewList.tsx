/**
 * src/components/PreviewList.tsx
 * 登録済みカードのプレビューリストを表示するコンポーネント。
 */

import type { Card } from "../types";

type PreviewListProps = {
  cards: Card[];
  onRemove: (id: string) => void;
};

export function PreviewList({ cards, onRemove }: PreviewListProps) {
  if (cards.length === 0) {
    return (
      <p className="hint">まだカードが登録されていません。</p>
    );
  }

  return (
    <div className="preview-list">
      <h2 className="preview-list__title">登録済みカード（{cards.length}件）</h2>
      <ul className="preview-list__items">
        {cards.map((card, index) => (
          <li key={card.id} className="preview-card">
            <span className="preview-card__index">#{index + 1}</span>
            <div className="preview-card__images">
              <div className="preview-card__image-box">
                <span className="preview-card__label">問題</span>
                {card.questionImage ? (
                  <img
                    src={card.questionImage}
                    alt={`問題 ${index + 1}`}
                    className="preview-card__img"
                  />
                ) : null}
                {card.questionText.trim().length > 0 ? (
                  <p className="preview-card__text">{card.questionText}</p>
                ) : null}
              </div>
              <div className="preview-card__arrow">→</div>
              <div className="preview-card__image-box">
                <span className="preview-card__label">解答</span>
                {card.answerImage ? (
                  <img
                    src={card.answerImage}
                    alt={`解答 ${index + 1}`}
                    className="preview-card__img"
                  />
                ) : null}
                {card.answerText.trim().length > 0 ? (
                  <p className="preview-card__text">{card.answerText}</p>
                ) : null}
              </div>
            </div>
            <button
              className="preview-card__remove"
              onClick={() => onRemove(card.id)}
              aria-label={`カード ${index + 1} を削除`}
            >
              削除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
