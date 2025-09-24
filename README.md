# 四季報データ取得 & Web表示ツール

オンライン四季報のAPIから企業情報を取得し、Vue.js + TSXで構築されたWebアプリケーションで表示するプロジェクトです。

## 🚀 機能

### データ取得機能
- 設定ファイル（config.json）から企業IDのリストを読み込み
- **範囲指定による一括取得機能**（例: 1000-2000番台を一度に取得）
- **重複回避機能**: 既存のrange-companies.jsonがある場合、重複する企業IDは自動的にスキップ
- 四季報APIから詳細な企業情報を取得：
  - 株価情報（現在価格、PER、PBR、配当利回りなど）
  - 業績情報（売上高、営業利益、純利益など）
  - 財務指標（自己資本比率、ROE、営業利益率、純利益率など）
  - 推定財務データ（総資産、自己資本、有利子負債）
  - 東洋経済スコア（収益性、成長性、安定性）
- 1ヶ月以内の既存データは再取得をスキップして効率化
- エラーハンドリングと詳細ログ出力

### Webアプリケーション
- **Vue 3 + TypeScript + TSX** で構築
- レスポンシブデザイン対応
- リアルタイムデータ表示
- 直感的な財務比較テーブル
- ダークモード対応
- モダンなUI/UX

## 📋 技術スタック

- **フロントエンド**: Vue 3, TypeScript, TSX
- **ビルドツール**: Vite
- **スタイリング**: CSS3 (レスポンシブ, ダークモード)
- **バックエンド**: Node.js, TypeScript
- **API**: 東洋経済オンライン四季報API
- **HTTP Client**: Axios

## 🛠️ セットアップ

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

### 3. データ取得

#### デフォルト企業データ取得
```bash
# config.jsonで指定した企業のデータを取得
npm run fetch-data
```

#### 範囲指定データ取得（新機能！）
```bash
# 範囲指定で取得（例：7000番台）
npm run fetch-range -- 7000-7100

# 個別指定で取得
npm run fetch-range -- 7372,8411,9984

# 範囲と個別の組み合わせ
npm run fetch-range -- 7000-7050,8411,9984

# 複数範囲の指定
npm run fetch-range -- 1000-1100,7000-7100
```

**範囲取得の特徴：**
- 📊 プログレスバー表示で進捗確認
- ⚡ 最大1000社まで一度に取得可能
- 🔄 **自動重複回避**: 既存のrange-companies.jsonがある場合、重複する企業IDは自動的にスキップ
- 🚀 **段階的データ拡充**: 少しずつ企業データを追加していくことが可能
- 📈 企業コード順で自動ソート
- ⏰ API負荷軽減のため500ms間隔で取得
- 🚫 存在しない銘柄は自動スキップ
- 💾 `range-companies.json`として保存
- 🎯 GUI で自動的に選択可能

### 4. Webアプリケーション起動

```bash
# 開発サーバー起動
npm run dev

# ブラウザで http://localhost:3000 を開く
```

### 5. 本番ビルド

```bash
# 本番用ビルド
npm run build

# ビルド済みアプリのプレビュー
npm run preview
```

## 📊 出力データ例

### JSON出力
```json
{
  "timestamp": "2025-09-19T10:30:00.000Z",
  "totalCompanies": 12,
  "companies": [
    {
      "companyId": "7203",
      "companyName": "トヨタ自動車",
      "currentPrice": 2935,
      "marketCap": 46350390.70137,
      "equityRatio": 38.38,
      "roe": 7.79,
      "operatingMargin": 10.0,
      "netProfitMargin": 9.9,
      "estimatedTotalAssets": 113295572,
      "estimatedEquity": 43483600,
      "tkScore": {
        "total_score": 4,
        "profitability": 5,
        "growth_potential": 5,
        "stability": 2
      }
    }
  ]
}
```

### Web表示機能
- 📈 株価情報（現在株価、時価総額、PER、PBR、配当利回り）
- � 業績情報（売上高、営業利益、純利益、1株益）
- 🏦 財務指標（自己資本比率、ROE、営業利益率、純利益率、BPS）
- 📊 推定財務データ（総資産、自己資本、有利子負債、負債自己資本比率）
- ⭐ 東洋経済スコア（総合、収益性、成長性、安定性）
- 🏢 セクター情報

## 📁 プロジェクト構造

```
shikiho-getter/
├── src/
│   ├── components/          # Vue TSXコンポーネント
│   │   └── FinancialComparisonTable.tsx
│   ├── composables/         # Vue Composition API
│   │   └── useCompanyData.ts
│   ├── services/           # データ取得サービス
│   │   └── dataFetcher.ts
│   ├── scripts/           # ユーティリティスクリプト
│   │   └── fetch-data.ts
│   ├── types/             # TypeScript型定義
│   │   └── index.ts
│   ├── App.tsx            # メインアプリコンポーネント
│   ├── main.ts           # アプリエントリーポイント
│   └── style.css         # グローバルスタイル
├── output/               # 取得データ保存先
│   ├── companies.json    # JSON形式の企業データ
│   └── companies_comparison.html  # 静的HTML比較表
├── config.json          # 設定ファイル
├── index.html           # HTMLエントリーポイント
├── vite.config.ts       # Vite設定
├── tsconfig.json        # TypeScript設定
└── package.json         # プロジェクト設定
```

## 🎯 主な改善点

### パフォーマンス
- 既存データの1ヶ月キャッシュでAPI呼び出しを大幅削減
- Vue 3のReactivity Systemによる効率的な再描画
- Viteによる高速な開発・ビルド環境

### 開発体験
- TypeScriptによる型安全性
- TSXによる宣言的なUI構築
- Composition APIによる再利用可能なロジック
- ESModulesとモダンJavaScript機能

### ユーザビリティ
- レスポンシブデザイン対応
- ダークモード対応
- 直感的なデータ可視化
- エラー状態とローディング状態の適切な表示

## ⚠️ 注意事項

- データは東洋経済オンライン四季報APIから取得
- 推定財務データは計算による概算値です
- APIの利用規約を遵守してください
- 過度なリクエストを避けるため、適切な間隔を設定しています

## 📄 ライセンス

ISC