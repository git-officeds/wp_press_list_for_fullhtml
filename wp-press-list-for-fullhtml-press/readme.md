# wp-press-list-for-fullhtml-press 実装マニュアル

フルHTMLサイトの投稿一覧ページ（`/press/` など）に、WordPress REST API経由で投稿記事一覧を10件ずつ取得し、ページネーション付きで非同期表示するためのパッケージです。
「wp-press-list-for-fullhtml-top」と共通のデザイン・帯パネルレイアウトを採用しています。

---

## 1. パッケージ構成

```text
wp-press-list-for-fullhtml-press/
├── wp-press-list.css                      # スタイルシート（ページネーション対応）
├── wp-press-list.js                       # 非同期通信・ページネーション生成スクリプト
├── index.html                             # 実装サンプル（デモ）
└── readme.md                              # 本マニュアル
```

---

## 2. 導入手順（どのコード・ファイルをどこに実装するか）

### ステップ1: ファイルの配置
既存のフルHTMLサイトの公開ディレクトリに、以下のファイルを配置します。

1. **CSSファイル**:
   `wp-press-list.css` を、サイトのCSS格納フォルダ（例: `/press/wp-press-list.css` または `/css/wp-press-list.css`）に配置します。
2. **JavaScriptファイル**:
   `wp-press-list.js` を、サイトのJS格納フォルダ（例: `/press/wp-press-list.js` または `/js/wp-press-list.js`）に配置します。
3. **デフォルトサムネイル画像**:
   アイキャッチ未設定時のフォールバック画像として、`/images/default_thumb.jpg` を配置してください。

---

### ステップ2: HTMLヘッダー（`<head>`内）へのCSS読み込み記述
投稿一覧ページのHTMLファイルの `<head>` 〜 `</head>` 内に以下を追加します。

```html
<!-- WordPress投稿一覧スタイル -->
<link rel="stylesheet" href="./wp-press-list.css">
```

---

### ステップ3: 表示させたい場所へのHTMLタグ設置
投稿一覧を表示したい位置に以下のタグを設置します。

```html
<!-- 基本形（10件表示・ページネーション付き） -->
<div id="wp-press-list"></div>
```

---

### ステップ4: フッター（`</body>`直前）へのJavaScript読み込み記述
HTMLファイルの `</body>` 直前に以下を追加します。

```html
<!-- WordPress投稿一覧スクリプト（自動初期化されます） -->
<script src="./wp-press-list.js"></script>
```

※ これだけで、URLクエリ `?p={ページ番号}` を読み取り、該当ページの10件の記事とページネーションが自動出力されます。

---

## 3. 仕様

| 項目 | 実装仕様 |
| :--- | :--- |
| **デザイン・レイアウト** | `wp-press-list-for-fullhtml-top` と同一の帯パネルデザイン（PC: 2カラム、スマホ: 2行構成）。 |
| **表示件数** | 1ページあたり10件。 |
| **ページネーション** | 記事が10件以上ある（複数ページが存在する）場合にのみページネーションを自動生成して表示。 |
| **リンク先仕様** | 各ページのリンク先は `/press/?p=` で、末尾にページ番号（または各記事ID）を付与。 |
| **API通信** | WordPress REST API (`/wp/wp-json/wp/v2/posts`) を非同期で取得。 |
| **カスタマイズ** | `data-show-thumbnail="false"`（サムネイル非表示）、`data-show-category="false"`（カテゴリ非表示）の属性指定もトップ版同様に利用可能。 |
