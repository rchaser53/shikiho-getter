# Kabutan Trend Scraper

株探（Kabutan）から株価トレンド情報を自動取得し、トレンド変化を検出するスクリプトです。

## 📖 概要

このスクリプトは、`config.json`に登録された株式コードに対して、Kabutanのウェブサイトから移動平均線に基づくトレンド情報をスクレイピングします。取得したデータは日付ごとにファイルに保存され、前回実行時との差分を自動検出します。

## ✨ 主な機能

### 1. トレンドデータの取得
4つの期間別トレンドを取得：
- **目先（5日線）**: 短期的な値動き
- **短期（25日線）**: 短期トレンド
- **中期（75日線）**: 中期トレンド  
- **長期（200日線）**: 長期トレンド

各トレンドについて以下の情報を収集：
- **トレンド方向**: 上昇 or 下降
- **乖離率**: 移動平均線からの乖離率（%）

### 2. データ保存
- **日付ごとの保存**: `output/trends/YYYY-MM-DD.json`
- **最新データ**: `output/trends/latest.json`
- **履歴管理**: 過去のデータを保持し、時系列分析が可能

### 3. トレンド変化の自動検出
前回実行時のデータと比較し、トレンド方向が変化した銘柄を自動的に検出して通知します。

### 4. リクエスト制御
`config.json`の`requestInterval`設定により、サーバーへの負荷を軽減します。

## 🚀 使い方

### 基本的な実行方法

#### TypeScript版（推奨）
```bash
tsx scripts/kabutan-trend-scraper.ts
```

#### JavaScript版
```bash
node scripts/kabutan-trend-scraper.js
```

### npm スクリプトとして登録する場合

`package.json`に以下を追加：

```json
{
  "scripts": {
    "trend": "tsx scripts/kabutan-trend-scraper.ts",
    "trend:js": "node scripts/kabutan-trend-scraper.js"
  }
}
```

実行：
```bash
npm run trend
```

## ⚙️ 設定

### config.json

取得する株式コードを設定します：

```json
{
  "companyIds": [
    "7203",  // トヨタ自動車
    "9984",  // ソフトバンクグループ
    "6758"   // ソニーグループ
  ],
  "outputFile": "output/companies.json",
  "requestInterval": 500
}
```

**パラメータ説明：**
- `companyIds`: 取得する株式コードの配列（4桁の数字）
- `requestInterval`: リクエスト間隔（ミリ秒）
  - デフォルト: 500ms
  - サーバー負荷軽減のため、300ms以下は推奨しません

## 📊 出力データ形式

### 保存先
```
output/
└── trends/
    ├── 2026-01-01.json    # 日付ごとのデータ
    ├── 2026-01-02.json
    ├── latest.json         # 最新データ
    └── ...
```

### データ構造

```typescript
interface StockData {
  stockCode: string;      // 株式コード
  companyName: string;    // 会社名
  trends: {
    '目先(5日線)': {
      direction: string;  // "上昇" or "下降"
      rate: string;       // 乖離率（例: "+2.5%" or "-1.2%"）
    },
    '短期(25日線)': {
      direction: string;
      rate: string;
    },
    '中期(75日線)': {
      direction: string;
      rate: string;
    },
    '長期(200日線)': {
      direction: string;
      rate: string;
    }
  } | null;
  error?: string;         // エラー発生時のみ
}
```

### 出力例

```json
[
  {
    "stockCode": "7203",
    "companyName": "トヨタ自動車",
    "trends": {
      "目先(5日線)": {
        "direction": "上昇",
        "rate": "+1.23%"
      },
      "短期(25日線)": {
        "direction": "上昇",
        "rate": "+3.45%"
      },
      "中期(75日線)": {
        "direction": "下降",
        "rate": "-2.10%"
      },
      "長期(200日線)": {
        "direction": "上昇",
        "rate": "+15.67%"
      }
    }
  }
]
```

## 💡 実行例

### 初回実行
```bash
$ tsx scripts/kabutan-trend-scraper.ts

トヨタ自動車 (7203): OK
ソフトバンクグループ (9984): OK
ソニーグループ (6758): OK

保存完了: /Users/.../output/trends/2026-01-01.json

初回実行のため、比較データがありません
```

### 2回目以降（変化あり）
```bash
$ tsx scripts/kabutan-trend-scraper.ts

トヨタ自動車 (7203): OK
ソフトバンクグループ (9984): OK
ソニーグループ (6758): OK

保存完了: /Users/.../output/trends/2026-01-02.json

前回データ: 2026-01-01

🔔 トレンド変化を検出しました (2件):

📊 トヨタ自動車 (7203)
   目先(5日線): 下降 → 上昇 (乖離率: +1.23%)
📊 ソニーグループ (6758)
   中期(75日線): 上昇 → 下降 (乖離率: -2.10%)
```

### 変化なしの場合
```bash
$ tsx scripts/kabutan-trend-scraper.ts

トヨタ自動車 (7203): OK
ソフトバンクグループ (9984): OK
ソニーグループ (6758): OK

保存完了: /Users/.../output/trends/2026-01-02.json

前回データ: 2026-01-01

✅ トレンドに変化はありません
```

## 🔧 定期実行の設定

### cron（Linux/macOS）

毎日10時にトレンドを取得する例：

```bash
# crontabを編集
crontab -e

# 以下を追加
0 10 * * * cd /path/to/shikiho-getter && tsx scripts/kabutan-trend-scraper.ts >> /path/to/logs/trend.log 2>&1
```

### launchd（macOS推奨）

`~/Library/LaunchAgents/com.user.kabutan-trend.plist`を作成：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.kabutan-trend</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/tsx</string>
        <string>/path/to/shikiho-getter/scripts/kabutan-trend-scraper.ts</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>10</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>WorkingDirectory</key>
    <string>/path/to/shikiho-getter</string>
    <key>StandardOutPath</key>
    <string>/path/to/logs/trend.log</string>
    <key>StandardErrorPath</key>
    <string>/path/to/logs/trend-error.log</string>
</dict>
</plist>
```

登録：
```bash
launchctl load ~/Library/LaunchAgents/com.user.kabutan-trend.plist
```

### Windows Task Scheduler

タスクスケジューラでバッチファイルを登録：

`run-trend.bat`:
```batch
@echo off
cd C:\path\to\shikiho-getter
tsx scripts/kabutan-trend-scraper.ts >> logs\trend.log 2>&1
```

## 📈 活用例

### 1. トレンド転換の早期発見
目先（5日線）のトレンド変化を監視することで、短期的な相場転換を早期に察知できます。

### 2. 複数期間のトレンド一致を確認
全ての期間で「上昇」が揃った銘柄は強いトレンドを示唆しており、投資判断の参考になります。

### 3. 乖離率による過熱感の判断
乖離率が大きい銘柄は、調整の可能性を示唆している場合があります。

### 4. 履歴データの分析
日付ごとに保存されたデータを分析することで、トレンドの持続性を評価できます。

## ⚠️ 注意事項

### スクレイピングに関する注意
- **利用規約の遵守**: Kabutanの利用規約を必ず確認してください
- **適切なリクエスト間隔**: サーバーに負荷をかけないよう、500ms以上の間隔を推奨
- **過度な実行を避ける**: 1日1〜2回程度の実行を推奨
- **エラーハンドリング**: ネットワークエラーやサイト構造の変更に注意

### データの制限
- **会社名の取得**: サイト構造が変更された場合、取得に失敗する可能性があります
- **トレンドデータ**: 画像のalt属性に依存しているため、サイト仕様変更の影響を受けます
- **乖離率**: パーセンテージ表記が変更される可能性があります

### 投資判断について
- このツールが提供する情報は参考情報であり、投資助言ではありません
- 投資判断は自己責任で行ってください
- 複数の情報源を組み合わせることを推奨します

## 🐛 トラブルシューティング

### データが取得できない

**原因1: ネットワークエラー**
```bash
# エラー例
Error: connect ECONNREFUSED
```
対処法: インターネット接続を確認してください

**原因2: サイト構造の変更**
```bash
# 症状: trendsがnullになる
トヨタ自動車 (7203): NG
```
対処法: Kabutanのサイト構造が変更された可能性があります。スクリプトの更新が必要です。

**原因3: 無効な株式コード**
```bash
# 症状: 会社名が株式コードのまま
9999 (9999): NG
```
対処法: `config.json`の株式コードが正しいか確認してください

### リクエストが遅い・タイムアウトする

```json
// config.jsonで間隔を長くする
{
  "requestInterval": 1000  // 1秒に変更
}
```

### ディレクトリが作成されない

```bash
# 手動でディレクトリを作成
mkdir -p output/trends
```

## 🔄 関連スクリプト

- **fetch-data.ts**: 四季報データの取得
- **fetch-range.ts**: 範囲指定でのデータ取得
- **fetch-daily-history.ts**: 日次履歴データの取得

## 📚 技術スタック

- **Node.js**: JavaScript/TypeScript実行環境
- **TypeScript**: 型安全なコード
- **Axios**: HTTPクライアント
- **Cheerio**: HTMLパーサー（jQuery風）
- **ES Modules**: モダンなモジュールシステム

## 🤝 貢献

バグ報告や機能追加の提案は、GitHubのIssuesでお願いします。

## 📄 ライセンス

ISC

---

**最終更新**: 2026年1月1日
