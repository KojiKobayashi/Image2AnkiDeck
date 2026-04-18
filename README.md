# Image2AnkiDeck

Image2AnkiDeck は、問題画像と解答画像を切り出して Anki デッキ用のカード画像セット（ZIP）を作成するための Web アプリです。

## デプロイリンク（GitHub Pages）

- master（本番）: https://kojikobayashi.github.io/Image2AnkiDeck/
- develop（開発）: https://kojikobayashi.github.io/Image2AnkiDeck/develop/

## 簡易な使い方

1. デッキ名を入力する
2. 「問題画像」をアップロードし、範囲を選択して「問題を登録」
3. 「解答画像」をアップロードし、範囲を選択して「解答を登録」
4. 2〜3 を必要なカード枚数だけ繰り返す
5. 「ZIPを保存」でデッキデータをダウンロードする

> 📷 **モバイルでカメラを使う場合**  
> 画像選択エリアに「ファイルから選ぶ」と「📷 カメラで撮影」の 2 つのボタンがあります。  
> 「📷 カメラで撮影」を使うと、Android・iOS どちらでもカメラアプリが直接起動します。

## 生成された ZIP の使い方（Anki 取り込み手順）

1. ダウンロードした ZIP を解凍する
2. 解凍してできた `deck.csv` を選択し、Ankiで開く

> ⚠️ 先に Anki を起動してから CSV をインポートすると、画像が表示されないことがあります。  
> 必ず「ZIPを解凍 → CSVを選択して開く（その操作で Anki を起動）」の手順で取り込んでください。
