/**
 * src/hooks/useCardRegistration.ts
 * 問題・解答ペアの登録フローを管理するフック。
 *
 * フロー：
 *   1. 問題画像で矩形を選択
 *   2. 「問題を登録」ボタン → 問題領域を保存、ステップを「解答選択」へ
 *   3. 解答画像で矩形を選択
 *   4. 「解答を登録」ボタン → カードを作成してリストへ追加、ステップを「問題選択」へ
 */

import { useCallback, useState } from "react";
import type { Card, Rect, SessionCard } from "../types";
import { cropImage } from "../services/imageCropper";
import { generateId } from "../utils/idGenerator";

/** 登録ステップ */
export type RegistrationStep = "question" | "answer";

export type UseCardRegistrationReturn = {
  /** 現在の登録ステップ */
  step: RegistrationStep;
  /** 登録済みカード一覧 */
  cards: Card[];
  /** セッション保存用カード一覧 */
  sessionCards: SessionCard[];
  /** 問題領域を登録してステップを解答選択へ進める */
  registerQuestion: (imageSrc: string, rect: Rect) => void;
  /** 解答領域を登録してカードを生成する */
  registerAnswer: (imageSrc: string, rect: Rect) => Promise<void>;
  /** セッションからカード一覧を復元する */
  restoreFromSession: (sessionCards: SessionCard[]) => Promise<void>;
  /** カードを削除する */
  removeCard: (id: string) => void;
};

export function useCardRegistration(): UseCardRegistrationReturn {
  const [step, setStep] = useState<RegistrationStep>("question");
  const [cards, setCards] = useState<Card[]>([]);
  const [sessionCards, setSessionCards] = useState<SessionCard[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<{
    imageSrc: string;
    rect: Rect;
  } | null>(null);

  const registerQuestion = useCallback((imageSrc: string, rect: Rect) => {
    setPendingQuestion({ imageSrc, rect });
    setStep("answer");
  }, []);

  const registerAnswer = useCallback(
    async (imageSrc: string, rect: Rect) => {
      if (!pendingQuestion) return;

      const [questionImage, answerImage] = await Promise.all([
        cropImage(pendingQuestion.imageSrc, pendingQuestion.rect),
        cropImage(imageSrc, rect),
      ]);

      const card: Card = {
        id: generateId(),
        questionImage,
        answerImage,
      };
      const sessionCard: SessionCard = {
        id: card.id,
        questionRect: {
          x: pendingQuestion.rect.x,
          y: pendingQuestion.rect.y,
          w: pendingQuestion.rect.width,
          h: pendingQuestion.rect.height,
        },
        answerRect: {
          x: rect.x,
          y: rect.y,
          w: rect.width,
          h: rect.height,
        },
        questionImageSrc: pendingQuestion.imageSrc,
        answerImageSrc: imageSrc,
      };

      setCards((prev) => [...prev, card]);
      setSessionCards((prev) => [...prev, sessionCard]);
      setPendingQuestion(null);
      setStep("question");
    },
    [pendingQuestion]
  );

  const restoreFromSession = useCallback(async (loadedSessionCards: SessionCard[]) => {
    const restoredCards = await Promise.all(
      loadedSessionCards.map(async (sessionCard): Promise<Card> => {
        try {
          const [questionImage, answerImage] = await Promise.all([
            cropImage(sessionCard.questionImageSrc, {
              x: sessionCard.questionRect.x,
              y: sessionCard.questionRect.y,
              width: sessionCard.questionRect.w,
              height: sessionCard.questionRect.h,
            }),
            cropImage(sessionCard.answerImageSrc, {
              x: sessionCard.answerRect.x,
              y: sessionCard.answerRect.y,
              width: sessionCard.answerRect.w,
              height: sessionCard.answerRect.h,
            }),
          ]);
          return {
            id: sessionCard.id,
            questionImage,
            answerImage,
          };
        } catch (error) {
          const detail = error instanceof Error ? error.message : "不明なエラー";
          throw new Error(`カード（id: ${sessionCard.id}）の復元に失敗しました: ${detail}`);
        }
      })
    );

    setCards(restoredCards);
    setSessionCards(loadedSessionCards);
    setPendingQuestion(null);
    setStep("question");
  }, []);

  const removeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    setSessionCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return {
    step,
    cards,
    sessionCards,
    registerQuestion,
    registerAnswer,
    restoreFromSession,
    removeCard,
  };
}
