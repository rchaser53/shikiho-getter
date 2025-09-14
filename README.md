# 四季報データ取得スクリプト

オンライン四季報のAPIから企業情報を取得してJSONファイルに出力するNode.jsスクリプトです。

## 機能

- 設定ファイル（config.json）から企業IDのリストを読み込み
- 四季報APIから以下の情報を取得：
  - 会社名
  - 時価総額
  - 自己資本比率
  - 株価
  - PER（株価収益率）
  - PBR（株価純資産倍率）
  - 配当利回り
  - 総資産
  - 売上高
  - 営業利益
  - 純利益
  - ROE（自己資本利益率）
  - ROA（総資産利益率）
- リクエスト間隔の制御（デフォルト0.5秒）
- エラーハンドリング
- 取得結果をJSON形式で出力

## 使用方法

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 設定ファイルの編集

`config.json`ファイルで取得したい企業IDを設定：

```json
{
  "companyIds": [
    "1301",
    "1332",
    "4063",
    "6178",
    "6501",
    "6502",
    "6758",
    "7203",
    "7267",
    "7751",
    "8031",
    "8411",
    "9984"
  ],
  "outputFile": "output/companies.json",
  "requestInterval": 500
}
```

- `companyIds`: 取得したい企業の証券コードリスト
- `outputFile`: 出力先ファイルのパス
- `requestInterval`: リクエスト間隔（ミリ秒）

### 3. スクリプトの実行

```bash
npm start
# または
npm run fetch
# または
node index.js
```

### 出力例

```json
{
  "timestamp": "2025-09-14T10:30:00.000Z",
  "totalCompanies": 13,
  "companies": [
    {
      "companyId": "7203",
      "companyName": "トヨタ自動車",
      "marketCap": 35000000000000,
      "equityRatio": 45.2,
      "stockPrice": 2500,
      "priceEarningsRatio": 12.5,
      "priceBookValueRatio": 1.2,
      "dividendYield": 2.8,
      "totalAssets": 50000000000000,
      "netSales": 30000000000000,
      "operatingIncome": 2500000000000,
      "netIncome": 2000000000000,
      "roe": 8.5,
      "roa": 4.2,
      "updatedAt": "2025-09-14T10:30:15.123Z"
    }
  ]
}
```

## 注意事項

- APIの利用規約を遵守してください
- 過度なリクエストを避けるため、適切な間隔（デフォルト0.5秒）を設定しています
- ネットワークエラーやAPIエラーが発生した場合、該当企業のデータはエラー情報が記録されます
- デバッグ用として生データ（rawData）も保存されます

## ファイル構成

```
shikiho-getter/
├── config.json      # 設定ファイル
├── index.js         # メインスクリプト
├── package.json     # プロジェクト設定
├── output/          # 出力ディレクトリ
│   └── companies.json
└── README.md        # このファイル
```

## ライセンス

ISC