/**
 * src/types/index.ts
 * アプリ全体で使用する型定義
 */

/** Canvas上の矩形選択領域 */
export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** 問題・解答のペア */
export type Card = {
  id: string;
  questionImage: string | null;
  questionText: string;
  answerImage: string | null;
  answerText: string;
};

/** セッション保存形式のカード */
export type SessionCard = {
  id: string;
  questionRect: { x: number; y: number; w: number; h: number } | null;
  answerRect: { x: number; y: number; w: number; h: number } | null;
  questionImageSrc: string | null;
  questionText: string;
  answerImageSrc: string | null;
  answerText: string;
};

/** セッション保存形式 */
export type Session = {
  deckName: string;
  cards: SessionCard[];
};

/** CanvasSelectorコンポーネントのProps */
export type CanvasSelectorProps = {
  /** 表示する画像のURL（data URLまたはオブジェクトURL） */
  imageSrc: string;
  /** 選択完了時のコールバック（正規化済みのRect） */
  onSelect: (rect: Rect) => void;
  /** 現在確定している選択領域（外部から制御する場合） */
  selection?: Rect | null;
  /** Canvas幅（省略時は画像の自然な幅） */
  width?: number;
  /** Canvas高さ（省略時は画像の自然な高さ） */
  height?: number;
};

/** useSelectionフックの戻り値 */
export type UseSelectionReturn = {
  /** ドラッグ中の一時的な矩形 */
  draft: Rect | null;
  /** 確定済みの選択矩形 */
  selection: Rect | null;
  /** mousedownイベントハンドラ */
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** mousemoveイベントハンドラ */
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** mouseupイベントハンドラ */
  onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  /** touchstartイベントハンドラ（タブレット対応） */
  onTouchStart: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  /** touchmoveイベントハンドラ（タブレット対応） */
  onTouchMove: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  /** touchendイベントハンドラ（タブレット対応） */
  onTouchEnd: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  /** 選択をリセットする */
  reset: () => void;
};
