# wp-press-list-for-fullhtml-top 実装マニュアル

フルHTMLサイトのトップページに、WordPress REST API経由で投稿一覧を非同期表示するためのパッケージです。

---

## 1. パッケージ構成

```text
wp_press_list_for_fullhtml/
├── prompt.md                                  # トップページ用仕様書
├── prompt2.md                                 # 投稿一覧ページ用仕様書
├── readme.md                                  # 実装マニュアル
├── wp-press-list-for-fullhtml-top/            # トップページ向けパッケージ（最新3件表示）
│   ├── wp-press-list.css
│   ├── wp-press-list.js
│   ├── index.html
│   └── readme.md
└── wp-press-list-for-fullhtml-press/          # 投稿一覧ページ向けパッケージ（10件＋ページネーション）
    ├── wp-press-list.css
    ├── wp-press-list.js
    ├── index.html
    └── readme.md
```

---

## 2. 導入手順（どのコード・ファイルをどこに実装するか）

### ステップ1: ファイルの配置
既存のフルHTMLサイトの公開ディレクトリに、以下のファイルを配置します。

1. **CSSファイル**:
   `wp-press-list-for-fullhtml-top/wp-press-list.css` を、サイトのCSS格納フォルダ（例: `/css/wp-press-list.css`）に配置します。
2. **JavaScriptファイル**:
   `wp-press-list-for-fullhtml-top/wp-press-list.js` を、サイトのJS格納フォルダ（例: `/js/wp-press-list.js`）に配置します。
3. **デフォルトサムネイル画像**:
   アイキャッチ未設定時のフォールバック画像として、`/images/default_thumb.jpg` を配置してください。

---

### ステップ2: HTMLヘッダー（`<head>`内）へのCSS読み込み記述
トップページのHTMLファイルの `<head>` 〜 `</head>` 内に、以下を追加します。

```html
<!-- WordPress投稿一覧スタイル -->
<link rel="stylesheet" href="/css/wp-press-list.css">
```

---

### ステップ3: 表示させたい場所へのHTMLタグ設置
トップページの本文中、お知らせ一覧を表示したい位置に以下のタグを設置します。

```html
<!-- 基本形（デフォルト：サムネイル表示あり、カテゴリ表示あり） -->
<div id="wp-press-list"></div>
```

---

### ステップ4: フッター（`</body>`直前）へのJavaScript読み込み記述
HTMLファイルの `</body>` 直前に以下を追加します。

```html
<!-- WordPress投稿一覧スクリプト（自動初期化されます） -->
<script src="/js/wp-press-list.js"></script>
```

※ これだけで、WordPress REST API (`/wp/wp-json/wp/v2/posts?_embed`) から最新記事が自動取得され、一覧が表示されます。

---

## 3. パラメータ指定によるカスタマイズ

HTMLの `data-*` 属性を指定するだけで、デザインや表示項目を柔軟に変更できます。

### ① サムネイル画像なし（非表示）にする場合
画像なしに設定すると、左カラムがなくなり、右カラムの内容が左端に寄るレイアウトに自動で切り替わります。

```html
<div data-wp-press-list data-show-thumbnail="false"></div>
```

### ② カテゴリ名を非表示にする場合
```html
<div data-wp-press-list data-show-category="false"></div>
```

### ③ サムネイルなし かつ カテゴリ非表示にする場合
```html
<div data-wp-press-list data-show-thumbnail="false" data-show-category="false"></div>
```

### ④ 利用可能な `data-*` 属性一覧

| 属性名 | デフォルト値 | 説明 |
| :--- | :--- | :--- |
| `data-show-thumbnail` | `true` | サムネイル画像の表示（`true`）/ 非表示（`false`）。非表示時は左詰めレイアウトになります。 |
| `data-show-category` | `true` | カテゴリ名の表示（`true`）/ 非表示（`false`）。 |
| `data-endpoint` | `/wp/wp-json/wp/v2/posts` | WordPress REST APIのエンドポイントURL。 |
| `data-default-thumbnail` | `/images/default_thumb.jpg` | アイキャッチ画像が設定されていない場合の代替画像パス。 |
| `data-archive-url` | `/press/` | 3件を超える記事がある場合に表示される「投稿一覧」ボタンのリンク先。 |
| `data-archive-button-text`| `投稿一覧` | 投稿一覧ボタンのラベル。 |
| `data-read-more-text` | `続きを読む` | 80文字超過時や画像含有時に末尾に付与されるボタンのラベル。 |
| `data-excerpt-length` | `80` | 本文の抜粋文字数。 |

---

## 4. JavaScriptから手動初期化する場合

スクリプト側で動的にパラメータを制御したい場合は、グローバル関数 `WpPressList.init()` を呼び出すことも可能です。

```html
<div id="my-custom-press"></div>

<script src="/js/wp-press-list.js"></script>
<script>
  WpPressList.init({
    target: '#my-custom-press',
    showThumbnail: true,             // サムネイル表示
    showCategory: false,            // カテゴリ非表示
    defaultThumbnail: '/assets/no-image.jpg',
    archiveUrl: '/press/',
    excerptLength: 80
  });
</script>
```

---

## 5. 仕様準拠・動作解説

| 項目 | 実装仕様 |
| :--- | :--- |
| **API通信** | `fetch()` APIを用いた非同期処理。`_embed` オプションによりアイキャッチ画像とカテゴリ情報を1リクエストで取得。 |
| **WordPressパス** | サーバー直下の `/wp/` （`/wp/wp-json/wp/v2/posts`）をデフォルト参照。 |
| **取得・表示件数** | 最新3件を表示。総件数が4件以上ある場合は末尾に「投稿一覧」ボタン（リンク先: `/press/`）を自動出力。3件以下の場合はボタン非表示。 |
| **記事リンク先** | 各記事の詳細リンク（タイトル・サムネイル・続きを読む）は `/press/?p={記事ID}` 形式で出力。 |
| **サムネイル表示** | 縦横比 `1:1` の正方形領域内に `background-size: contain;` で縮小配置。余白部分は指定通り `#eee`（薄いグレー）で塗りつぶし。 |
| **本文抜粋** | HTMLタグおよび画像タグを完全除去し、80文字程度まで抜粋。「記事内に画像が含まれる場合」または「80文字を超える場合」に末尾へ「続きを読む」リンクボタンを自動設置。 |
| **PCレイアウト** | 帯パネル形式。左カラムに正方形サムネイル画像、右カラムにメタ情報（日付・カテゴリ）・タイトル・本文抜粋を配置。 |
| **スマホレイアウト**<br>（480px未満） | 帯パネル形式。<br>・1行目: 左カラムにサムネイル、右カラムに日付・カテゴリ・タイトル<br>・2行目: 1カラムに結合して本文抜粋をワイドに配置。 |
