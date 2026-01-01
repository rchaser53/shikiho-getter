/**
 * Kabutan Trend Scraper
 * 
 * 登録した株式コードでKabutanからトレンド情報（目先、短期、中期、長期）を取得するスクリプト
 * 
 * @module kabutan-trend-scraper
 * @description
 * このスクリプトは、config.jsonに登録された株式コードに対して、
 * Kabutan（株探）のウェブサイトから株価トレンド情報をスクレイピングします。
 * 取得したデータは日付ごとにファイルに保存され、前回実行時との差分を検出します。
 * 
 * @features
 * - 4つの期間別トレンド取得（目先/短期/中期/長期）
 * - トレンド方向（上昇/下降）と乖離率の取得
 * - 前回データとの比較による変化検出
 * - 日付ごとのデータ保存とlatest.jsonの更新
 * 
 * @usage
 * ```bash
 * tsx scripts/kabutan-trend-scraper.ts
 * # または
 * node scripts/kabutan-trend-scraper.js
 * ```
 */

import fs from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ESモジュールでの__dirnameのエミュレート
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 設定ファイルの型定義
 */
interface Config {
  /** 取得する株式コードの配列 */
  companyIds: string[];
  /** 出力ファイルのパス */
  outputFile: string;
  /** リクエスト間の待機時間（ミリ秒） */
  requestInterval: number;
}

/**
 * トレンド情報の型定義
 */
interface TrendInfo {
  /** トレンドの方向（上昇/下降） */
  direction: string;
  /** 移動平均線からの乖離率 */
  rate: string;
}

/**
 * 期間別トレンドの型定義
 */
interface Trends {
  /** 目先（5日線）のトレンド */
  '目先(5日線)': TrendInfo;
  /** 短期（25日線）のトレンド */
  '短期(25日線)': TrendInfo;
  /** 中期（75日線）のトレンド */
  '中期(75日線)': TrendInfo;
  /** 長期（200日線）のトレンド */
  '長期(200日線)': TrendInfo;
}

/**
 * 株式データの型定義
 */
interface StockData {
  /** 株式コード */
  stockCode: string;
  /** 会社名 */
  companyName: string;
  /** トレンド情報（取得失敗時はnull） */
  trends: Trends | null;
  /** エラーメッセージ（エラー発生時のみ） */
  error?: string;
}

/**
 * トレンド変化情報の型定義
 */
interface TrendChange {
  /** 株式コード */
  stockCode: string;
  /** 会社名 */
  companyName: string;
  /** 変化した期間 */
  period: string;
  /** 変化前のトレンド方向 */
  from: string;
  /** 変化後のトレンド方向 */
  to: string;
  /** 現在の乖離率 */
  rate: string;
}

/**
 * 前回データの型定義
 */
interface PreviousData {
  /** 前回のデータ */
  data: StockData[];
  /** 前回のデータの日付 */
  date: string;
}

// 設定ファイルの読み込み
const config: Config = JSON.parse(
  fs.readFileSync(join(__dirname, '..', 'config.json'), 'utf-8')
);

/**
 * 指定されたミリ秒だけ処理を待機する
 * 
 * @param ms - 待機時間（ミリ秒）
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * await sleep(1000); // 1秒待機
 * ```
 */
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Kabutanから会社名を取得する
 * 
 * @param stockCode - 株式コード（4桁の数字）
 * @returns Promise<string> - 会社名（取得失敗時は株式コードを返す）
 * 
 * @example
 * ```typescript
 * const companyName = await fetchCompanyName('9984');
 * console.log(companyName); // "ソフトバンクグループ"
 * ```
 */
async function fetchCompanyName(stockCode: string): Promise<string> {
  const url = `https://kabutan.jp/stock/?code=${stockCode}`;
  try {
    const { data } = await axios.get<string>(url);
    const $ = cheerio.load(data);
    
    // タイトルから会社名を取得（例: "ソフトバンクグループ(9984)"）
    const title = $('title').text();
    const match = title.match(/^(.+?)\(/);
    if (match) {
      return match[1].trim();
    }
    
    // または、h2タグから取得
    const h2Text = $('h2').first().text();
    const h2Match = h2Text.match(/^\d+\s+(.+)$/);
    if (h2Match) {
      return h2Match[1].trim();
    }
    
    return stockCode; // フォールバック
  } catch (err) {
    return stockCode;
  }
}

/**
 * Kabutanから株式のトレンド情報を取得する
 * 
 * @param stockCode - 株式コード（4桁の数字）
 * @returns Promise<StockData> - 株式データ（会社名、トレンド情報を含む）
 * 
 * @description
 * Kabutanのページをスクレイピングして、以下の情報を取得します：
 * - 会社名
 * - 4つの期間別トレンド（目先/短期/中期/長期）
 * - 各トレンドの方向（上昇/下降）
 * - 各トレンドの乖離率
 * 
 * @example
 * ```typescript
 * const data = await fetchTrends('9984');
 * console.log(data.companyName); // "ソフトバンクグループ"
 * console.log(data.trends?.['目先(5日線)']); // { direction: "上昇", rate: "+2.5%" }
 * ```
 */
async function fetchTrends(stockCode: string): Promise<StockData> {
  const url = `https://kabutan.jp/stock/?code=${stockCode}`;
  try {
    const { data } = await axios.get<string>(url);
    const $ = cheerio.load(data);
    
    // 会社名を取得 - h2タグから取得（例: "9984　ソフトバンクグループ"）
    let companyName = stockCode;
    const h2Text = $('h2').first().text().trim();
    // 4桁の数字 + 全角または半角スペース + 会社名
    const h2Match = h2Text.match(/^\d{4}\s*[　\s]+(.+)$/);
    if (h2Match) {
      companyName = h2Match[1].trim();
    } else {
      // タイトルからも試す（例: "ソフトバンクグループ（ＳＢＧ）【9984】"）
      const title = $('title').text();
      const titleMatch = title.match(/^(.+?)[（(【]/);
      if (titleMatch) {
        companyName = titleMatch[1].trim();
      }
    }
    
    // 株価トレンドの画像を探す
    const trendImg = $('img[src*="kabuka_trend"]');
    
    let trends: Trends | null = null;
    
    if (trendImg.length > 0) {
      // 画像の親要素（h2）の次の要素がテーブル
      const table = trendImg.parent().next('table');
      
      if (table.length > 0) {
        const rows = table.find('tr');
        
        // テーブル構造:
        // 行0: [目先, 短期, 中期, 長期]
        // 行1: [画像(下降), 画像(下降), 画像(上昇), 画像(上昇)] - 方向
        // 行2: [5日線, 25日線, 75日線, 200日線]
        // 行3: [-4.86％, -18.85％, -0.20％, +51.41％]
        
        if (rows.length >= 4) {
          const directions: string[] = [];
          const rates: string[] = [];
          
          // 行1から方向を取得（画像のalt属性）
          rows.eq(1).find('td, th').each((i, el) => {
            const img = $(el).find('img');
            if (img.length > 0) {
              const alt = img.attr('alt') || 'N/A';
              directions.push(alt);
            } else {
              directions.push('N/A');
            }
          });
          
          // 行3から乖離率を取得
          rows.eq(3).find('td, th').each((i, el) => {
            rates.push($(el).text().trim());
          });
          
          trends = {
            '目先(5日線)': {
              direction: directions[0] || 'N/A',
              rate: rates[0] || 'N/A'
            },
            '短期(25日線)': {
              direction: directions[1] || 'N/A',
              rate: rates[1] || 'N/A'
            },
            '中期(75日線)': {
              direction: directions[2] || 'N/A',
              rate: rates[2] || 'N/A'
            },
            '長期(200日線)': {
              direction: directions[3] || 'N/A',
              rate: rates[3] || 'N/A'
            }
          };
        }
      }
    }
    
    return { stockCode, companyName, trends };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { 
      stockCode, 
      companyName: stockCode, 
      trends: null,
      error: errorMessage 
    };
  }
}

/**
 * 前日のトレンドデータを読み込む
 * 
 * @param trendsDir - トレンドデータが保存されているディレクトリのパス
 * @returns PreviousData | null - 前日のデータ（存在しない場合はnull）
 * 
 * @description
 * trendsディレクトリから最新のデータファイル（latest.json以外）を読み込みます。
 * ファイル名は日付順にソートされ、最新のものが選択されます。
 * 
 * @example
 * ```typescript
 * const previousData = loadPreviousData('/path/to/output/trends');
 * if (previousData) {
 *   console.log(`前回データ: ${previousData.date}`);
 * }
 * ```
 */
function loadPreviousData(trendsDir: string): PreviousData | null {
  try {
    const files = fs.readdirSync(trendsDir)
      .filter(f => f.endsWith('.json') && f !== 'latest.json')
      .sort()
      .reverse();
    
    if (files.length === 0) return null;
    
    const previousFile = join(trendsDir, files[0]);
    const data: StockData[] = JSON.parse(fs.readFileSync(previousFile, 'utf-8'));
    return { data, date: files[0].replace('.json', '') };
  } catch (err) {
    return null;
  }
}

/**
 * トレンドの変化を検出する
 * 
 * @param current - 現在のトレンドデータ
 * @param previous - 前回のトレンドデータ
 * @returns TrendChange[] - 検出されたトレンド変化の配列
 * 
 * @description
 * 現在のデータと前回のデータを比較し、トレンド方向が変化した銘柄を抽出します。
 * 各期間（目先/短期/中期/長期）について、上昇↔下降の変化を検出します。
 * 
 * @example
 * ```typescript
 * const changes = detectChanges(currentData, previousData);
 * changes.forEach(change => {
 *   console.log(`${change.companyName}: ${change.from} → ${change.to}`);
 * });
 * ```
 */
function detectChanges(current: StockData[], previous: StockData[]): TrendChange[] {
  const changes: TrendChange[] = [];
  
  for (const company of current) {
    if (!company.trends) continue;
    
    const prevCompany = previous.find(p => p.stockCode === company.stockCode);
    if (!prevCompany || !prevCompany.trends) continue;
    
    const trendKeys: Array<keyof Trends> = [
      '目先(5日線)', 
      '短期(25日線)', 
      '中期(75日線)', 
      '長期(200日線)'
    ];
    
    for (const key of trendKeys) {
      const currDirection = company.trends[key]?.direction;
      const prevDirection = prevCompany.trends[key]?.direction;
      
      if (currDirection && prevDirection && currDirection !== prevDirection) {
        changes.push({
          stockCode: company.stockCode,
          companyName: company.companyName,
          period: key,
          from: prevDirection,
          to: currDirection,
          rate: company.trends[key]?.rate || 'N/A'
        });
      }
    }
  }
  
  return changes;
}

/**
 * メイン処理
 * 
 * @description
 * 以下の処理を実行します：
 * 1. config.jsonから株式コードを読み込み
 * 2. 各銘柄のトレンド情報を取得
 * 3. 取得したデータを日付ごとのファイルとlatest.jsonに保存
 * 4. 前回データとの差分を検出し、変化があれば表示
 * 
 * @throws {Error} ファイルの読み書きやネットワークエラーが発生した場合
 */
async function main(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const trendsDir = join(__dirname, '..', 'output', 'trends');
  
  // ディレクトリが存在しない場合は作成
  if (!fs.existsSync(trendsDir)) {
    fs.mkdirSync(trendsDir, { recursive: true });
  }
  
  const results: StockData[] = [];
  for (const code of config.companyIds) {
    const res = await fetchTrends(code);
    results.push(res);
    console.log(`${res.companyName} (${res.stockCode}):`, res.trends ? 'OK' : 'NG');
    await sleep(config.requestInterval);
  }
  
  // 今日のファイルに保存
  const todayFile = join(trendsDir, `${today}.json`);
  fs.writeFileSync(todayFile, JSON.stringify(results, null, 2));
  
  // latest.jsonも更新
  const latestFile = join(trendsDir, 'latest.json');
  fs.writeFileSync(latestFile, JSON.stringify(results, null, 2));
  
  console.log(`\n保存完了: ${todayFile}`);
  
  // 前日のデータと比較
  const previousData = loadPreviousData(trendsDir);
  
  if (previousData) {
    console.log(`\n前回データ: ${previousData.date}`);
    const changes = detectChanges(results, previousData.data);
    
    if (changes.length > 0) {
      console.log(`\n🔔 トレンド変化を検出しました (${changes.length}件):\n`);
      for (const change of changes) {
        console.log(`📊 ${change.companyName} (${change.stockCode})`);
        console.log(`   ${change.period}: ${change.from} → ${change.to} (乖離率: ${change.rate})`);
      }
    } else {
      console.log('\n✅ トレンドに変化はありません');
    }
  } else {
    console.log('\n初回実行のため、比較データがありません');
  }
}

// スクリプトとして直接実行された場合のみmainを実行
main();
