# 写真収集 進捗ページ

都道府県ごとの写真収集状況（達成／未達成の二値）を、日本地図と一覧表で表示する静的ページ。
GitHub Pages で公開する。

- 静的ページ1枚（`index.html`）。ランタイム依存ゼロ・ビルドなし。
- 表示するのは「達成／未達成」だけ。件数・金額・個人に関する情報は持たない。
- `<meta name="robots" content="noindex, nofollow">` と `robots.txt` で検索エンジンのインデックスを避ける。
- 閲覧数の記録は GoatCounter（Cookie 不使用）。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | ページ本体（地図 SVG を含む） |
| `data.json` | **現在のラウンドの達成状態**。運用中に触るのはこのファイルだけ |
| `sample.json` | 表示確認用の見本データ（宮城県・神奈川県・熊本県が達成） |
| `rounds/round1.json`, `rounds/round2.json` | 各ラウンドの対象都道府県（全て未達成の初期状態） |
| `scripts/update-status.mjs` | `data.json` を更新するスクリプト |
| `scripts/generate-map.mjs` | 地図 SVG の再生成（通常は不要） |
| `.github/workflows/update-status.yml` | 毎時の自動更新と手動更新 |

## data.json の形式

```json
{
  "round": 1,
  "updatedAt": "2026-10-15T00:00:00+09:00",
  "prefectures": [
    { "code": 13, "name": "東京都", "done": false },
    ...
  ]
}
```

- `code` は都道府県コード（JIS X 0401）。地図の塗り分けはこのコードで行う。
- `done` を `true` にするとその都道府県が「達成」になる。
- 一覧表はコード順（北から南）。ページ側で並べ替えるので記述順は自由。
- `updatedAt` は「最終更新」として表示される。

## 達成状態の更新方法

いずれも変更を `main` に push すれば GitHub Pages に反映される（通常 1〜2 分、CDN キャッシュ込みで最大 10 分程度）。

### A. 手元で編集

```sh
node scripts/update-status.mjs --set 13=true      # 東京都を達成に
node scripts/update-status.mjs --set 愛知県=true   # 名前でも可
git commit -am "Update status" && git push
```

`data.json` を手で編集して `done` を書き換え、`updatedAt` を更新してもよい。

### B. GitHub の画面から（手元に環境がないとき）

Actions → `update-status` → Run workflow → `prefecture` に `13` や `東京都`、`done` に `true` を入れて実行。
変更があれば自動でコミットされる。

### C. 毎時の自動取り込み

リポジトリの Settings → Secrets and variables → Actions に `STATUS_SOURCE_URL` を登録すると、
毎時 7 分にその URL を取得して `data.json` に反映する。URL の応答は次のどちらかの JSON:

```json
{ "done": [13, 23, "福岡県"] }
```

```json
{ "prefectures": [ { "code": 13, "done": true }, { "code": 23, "done": true } ] }
```

Secret 未設定のときは毎時のジョブは何もしない。
また、ページを開いたままのタブも 1 時間ごとに `data.json` を再読み込みする。

## ラウンドの切り替え

```sh
cp rounds/round2.json data.json
git commit -am "Start round 2" && git push
```

別リポジトリで運用する場合は、このリポジトリをそのまま複製して `data.json` を差し替える。

## 表示確認用の見本

- `?sample=1` … `sample.json`（宮城県・神奈川県・熊本県が達成）を表示する
- `?done=13,23,40` … 指定したコードを達成として表示する（`data.json` は変更しない）
- `?done=` … 全て未達成として表示する

例: `https://<host>/<repo>/?sample=1`

## GoatCounter の設定

`index.html` 内の `GOATCOUNTER_CODE` にサイトコードを入れると、閲覧数と閲覧時刻を記録する。
空文字にすると外部リクエストは発生しない。

ダッシュボードの Settings → Site settings → "Data collection" で、
Sessions / Location / Language / Screen size など不要な項目のチェックを外す。
`count.js` は Cookie を使わない。ページ側は `no_events` と `referrer: ""` を指定し、
参照元も送らない。

## 動作確認

```sh
python3 -m http.server 8000
# → http://localhost:8000/?sample=1
```

## 地図の再生成（通常は不要）

```sh
cd scripts && npm install && node generate-map.mjs
```

`index.html` の `<!-- MAP:START -->` 〜 `<!-- MAP:END -->` の間に 47 都道府県の SVG を書き込む。
地形データ: [dataofjapan/land](https://github.com/dataofjapan/land)（`japan.topojson`）。
