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
import type { Card, Rect } from "../types";
import { cropImage } from "../services/imageCropper";
import { generateId } from "../utils/idGenerator";

/** 登録ステップ */
export type RegistrationStep = "question" | "answer";

export type UseCardRegistrationReturn = {
  /** 現在の登録ステップ */
  step: RegistrationStep;
  /** 登録済みカード一覧 */
  cards: Card[];
  /** 問題領域を登録してステップを解答選択へ進める */
  registerQuestion: (imageSrc: string, rect: Rect) => void;
  /** 解答領域を登録してカードを生成する */
  registerAnswer: (imageSrc: string, rect: Rect) => Promise<void>;
  /** カードを削除する */
  removeCard: (id: string) => void;
};

export function useCardRegistration(): UseCardRegistrationReturn {
  const [step, setStep] = useState<RegistrationStep>("question");
  const [cards, setCards] = useState<Card[]>([]);
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

      setCards((prev) => [...prev, card]);
      setPendingQuestion(null);
      setStep("question");
    },
    [pendingQuestion]
  );

  const removeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { step, cards, registerQuestion, registerAnswer, removeCard };
}
