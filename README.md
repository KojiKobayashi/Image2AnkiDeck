# Image2AnkiDeck

Image2AnkiDeck は、問題・解答を画像とテキストで登録して Anki デッキ用のカードデータ（ZIP）を作成するための Web アプリです。

## デプロイリンク（GitHub Pages）

- master（本番）: https://kojikobayashi.github.io/Image2AnkiDeck/
- develop（開発）: https://kojikobayashi.github.io/Image2AnkiDeck/develop/

## 簡易な使い方

1. デッキ名を入力する
2. 問題に画像（範囲選択）またはテキスト（または両方）を入力して「問題を登録」
3. 解答に画像（範囲選択）またはテキスト（または両方）を入力して「解答を登録」
4. 2〜3 を必要なカード枚数だけ繰り返す
5. 「ZIPを保存」でデッキデータをダウンロードする

## 生成された ZIP の使い方（Anki 取り込み手順）

1. ダウンロードした ZIP を解凍する
2. 解凍してできた `deck.csv` を選択し、Ankiで開く

> ⚠️ 先に Anki を起動してから CSV をインポートすると、画像が表示されないことがあります。  
> 必ず「ZIPを解凍 → CSVを選択して開く（その操作で Anki を起動）」の手順で取り込んでください。
