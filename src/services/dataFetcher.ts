import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { CompanyData, Config, CompaniesData, PerformanceRow } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 設定ファイルを読み込む
export async function loadConfig(): Promise<Config> {
  try {
    const configPath = path.resolve(__dirname, '../../config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('設定ファイルの読み込みに失敗しました:', (error as Error).message);
    throw error;
  }
}

// 既存データファイルを読み込む
export async function loadExistingData(outputFile: string): Promise<Map<string, CompanyData>> {
  try {
    const outputPath = path.resolve(__dirname, '../../', outputFile);
    const existingData = await fs.readFile(outputPath, 'utf8');
    const parsed: CompaniesData = JSON.parse(existingData);
    
    // 企業IDをキーとするマップを作成
    const existingMap = new Map<string, CompanyData>();
    if (parsed.companies && Array.isArray(parsed.companies)) {
      parsed.companies.forEach(company => {
        if (company.companyId) {
          existingMap.set(company.companyId, company);
        }
      });
    }
    
    console.log(`既存データから ${existingMap.size} 社のデータを読み込みました`);
    return existingMap;
  } catch (error) {
    console.log('既存データファイルが見つからないか、読み込めませんでした。全データを取得します。');
    return new Map();
  }
}

// データが1ヶ月以内に更新されているかチェック
export function isRecentlyUpdated(updatedAt: string): boolean {
  if (!updatedAt) return false;
  
  const updateDate = new Date(updatedAt);
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30日前
  
  const isRecent = updateDate > oneMonthAgo;
  
  if (isRecent) {
    const daysDiff = Math.ceil((now.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`  最終更新: ${updateDate.toLocaleString('ja-JP')} (${daysDiff}日前)`);
  }
  
  return isRecent;
}

// 企業データを取得
export async function fetchCompanyData(companyId: string): Promise<any> {
  const url = `https://api-shikiho.toyokeizai.net/stocks/v1/stocks/${companyId}/latest`;
  
  try {
    console.log(`企業ID ${companyId} のデータを取得中...`);
    const response = await axios.get(url, {
      timeout: 10000, // 10秒のタイムアウト
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`企業ID ${companyId} のデータ取得に失敗しました:`, (error as Error).message);
    return null;
  }
}

// 数値を解析するヘルパー関数
function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '' || value === 'ー' || value === '-') {
    return null;
  }
  
  const str = String(value).replace(/,/g, ''); // カンマを削除
  const num = parseFloat(str);
  
  return isNaN(num) ? null : num;
}

// shimen_resultsから業績データを解析
function parsePerformanceData(shimenResults: any[][]): PerformanceRow[] {
  if (!Array.isArray(shimenResults) || shimenResults.length <= 1) {
    return [];
  }

  const performanceData: PerformanceRow[] = [];
  
  // ヘッダー行をスキップして、データ行を解析
  for (let i = 1; i < shimenResults.length; i++) {
    const row = shimenResults[i];
    if (!Array.isArray(row) || row.length < 7) continue;

    const period = String(row[0] || '');
    if (!period) continue;

    // 期間の種類を判定
    const isForecast = period.includes('予');
    const isQuarterly = period.includes('〜') || period.includes('四半期') || /\d+\.\d+〜\d+/.test(period);
    const isActual = !isForecast;

    const performanceRow: PerformanceRow = {
      period: period,
      netSales: parseNumber(row[1]),
      operatingIncome: parseNumber(row[2]),
      preTaxIncome: parseNumber(row[3]),
      netIncome: parseNumber(row[4]),
      earningsPerShare: parseNumber(row[5]),
      dividendPerShare: parseNumber(row[6]),
      isActual: isActual,
      isForecast: isForecast,
      isQuarterly: isQuarterly
    };

    performanceData.push(performanceRow);
  }

  return performanceData;
}

// データを整形
export function formatCompanyData(rawData: any, companyId: string): CompanyData {
  if (!rawData) {
    return {
      companyId: companyId,
      companyName: 'N/A',
      stockCode: companyId,
      isExist: '0',
      error: 'データ取得に失敗しました',
      currentPrice: null,
      marketCap: null,
      minimumPurchaseAmount: null,
      tradingUnit: null,
      priceEarningsRatio: null,
      priceBookValueRatio: null,
      dividendYield: null,
      bookValuePerShare: null,
      yearHigh: null,
      yearLow: null,
      yearHighDate: null,
      yearLowDate: null,
      latestResults: null,
      performanceData: [], // 空の業績データ配列
      equityRatio: null,
      roe: null,
      operatingMargin: null,
      netProfitMargin: null,
      estimatedTotalAssets: null,
      estimatedEquity: null,
      estimatedInterestBearingDebt: null,
      debtToEquityRatio: null,
      sector: null,
      sectorName: null,
      tkScore: null,
      tradingValue: null,
      turnover: null,
      treasuryStockRatio: null,
      updatedAt: new Date().toISOString()
    };
  }
  
  try {
    // 基本情報の抽出
    const stockCode = rawData.stock_code || companyId;
    const isExist = rawData.is_exist;
    
    // 会社名の抽出（rivalsデータの最初の要素が自社情報）
    let companyName = 'N/A';
    if (rawData.rivals && Array.isArray(rawData.rivals) && rawData.rivals.length > 0) {
      const selfCompany = rawData.rivals.find((r: any) => r.stock_code === stockCode);
      if (selfCompany) {
        companyName = selfCompany.company_name_j || selfCompany.company_name_j9c || 'N/A';
      }
    }
    
    // 現在の株価情報
    let currentPrice = null;
    if (rawData.rivals && Array.isArray(rawData.rivals) && rawData.rivals.length > 0) {
      const selfCompany = rawData.rivals.find((r: any) => r.stock_code === stockCode);
      if (selfCompany) {
        currentPrice = selfCompany.current_price;
      }
    }
    
    // 時価総額
    const marketCap = rawData.market_capitalization;
    
    // 株価指標
    const per = rawData.fyp1_per;
    const pbr = rawData.pbr;
    const dividendYield = rawData.fyp1_dividend_yield;
    
    // 年高値・安値
    const yearHigh = rawData.year_high;
    const yearLow = rawData.year_low;
    const yearHighDate = rawData.year_high_date;
    const yearLowDate = rawData.year_low_date;
    
    // 最新業績データの抽出（modified_forecasts_list_basicから）
    let latestResults = null;
    let netSales = null;
    let operatingIncome = null;
    let ordinaryIncome = null;
    let netIncome = null;
    let earningsPerShare = null;
    
    if (rawData.modified_forecasts_list_basic && Array.isArray(rawData.modified_forecasts_list_basic)) {
      // 実績データ（result_flag: true）を探す
      const actualResult = rawData.modified_forecasts_list_basic.reduce((acc: any, item: any) => {
        if (item.result_flag === true) {
          acc = item;
        }
        return acc;
      }, null);
      if (actualResult) {
        netSales = parseNumber(actualResult.net_sales);
        operatingIncome = parseNumber(actualResult.ope_income);
        ordinaryIncome = parseNumber(actualResult.ord_income);
        netIncome = parseNumber(actualResult.net_income);
        earningsPerShare = parseNumber(actualResult.eps);
        latestResults = {
          period: actualResult.fiscal_year_end,
          consolidatedType: actualResult.consolidated_type,
          accountingStandards: actualResult.accounting_standards,
          netSales: netSales,
          operatingIncome: operatingIncome,
          ordinaryIncome: ordinaryIncome,
          netIncome: netIncome,
          earningsPerShare: earningsPerShare,
          pubDate: actualResult.pub_date
        };
      }
    }
    
    // もしmodified_forecasts_list_basicから取得できない場合、shimen_resultsから抽出
    if (!latestResults && rawData.shimen_results && Array.isArray(rawData.shimen_results)) {
      for (let i = 1; i < rawData.shimen_results.length; i++) {
        const row = rawData.shimen_results[i];
        if (Array.isArray(row) && row.length >= 6) {
          const period = row[0];
          // "予"が含まれていない実績データを取得
          if (period && !period.includes('予')) {
            netSales = parseNumber(row[1]);
            operatingIncome = parseNumber(row[2]);
            // shimen_resultsは税前利益が3番目
            const preTaxIncome = parseNumber(row[3]);
            netIncome = parseNumber(row[4]);
            earningsPerShare = parseNumber(row[5]);
            latestResults = {
              period: period,
              netSales: netSales,
              operatingIncome: operatingIncome,
              preTaxIncome: preTaxIncome,
              netIncome: netIncome,
              earningsPerShare: earningsPerShare
            };
            break;
          }
        }
      }
    }
    
    // BPS（1株純資産）と総資産の計算
    let bookValuePerShare = null;
    let estimatedTotalAssets = null;
    let estimatedEquity = null;
    
    if (rawData.shimen_bps && Array.isArray(rawData.shimen_bps) && rawData.shimen_bps.length >= 3) {
      bookValuePerShare = parseNumber(rawData.shimen_bps[2]);
    }
    
    // 自己資本比率の抽出（rivalsから）
    let equityRatio = null;
    let roe = null;
    let operatingMargin = null;
    let netProfitMargin = null;
    if (rawData.rivals && Array.isArray(rawData.rivals) && rawData.rivals.length > 0) {
      const selfCompany = rawData.rivals.find((r: any) => r.stock_code === stockCode);
      if (selfCompany) {
        equityRatio = selfCompany.ratio_of_net_worth ? selfCompany.ratio_of_net_worth * 100 : null; // %に変換
        roe = selfCompany.fyp1_roe;
        operatingMargin = selfCompany.ratio_of_ope_income_to_net_sales ? selfCompany.ratio_of_ope_income_to_net_sales * 100 : null; // %に変換
        netProfitMargin = selfCompany.ratio_of_net_income_to_net_sales ? selfCompany.ratio_of_net_income_to_net_sales * 100 : null; // %に変換
      }
    }
    
    // 総資産と自己資本の推定計算
    if (bookValuePerShare && marketCap && currentPrice && equityRatio && equityRatio > 0) {
      const estimatedShares = marketCap / currentPrice * 1000; // 発行済み株数の推定（千株）
      estimatedEquity = bookValuePerShare * estimatedShares / 1000; // 自己資本の推定（百万円）
      estimatedTotalAssets = estimatedEquity / (equityRatio / 100); // 総資産の推定（百万円）
    }
    
    // 有利子負債の推定（総負債から概算）
    let estimatedInterestBearingDebt = null;
    let debtToEquityRatio = null;
    
    if (estimatedTotalAssets && estimatedEquity) {
      const estimatedTotalLiabilities = estimatedTotalAssets - estimatedEquity;
      // 有利子負債を総負債の約30-60%と仮定（業界により異なる）
      estimatedInterestBearingDebt = estimatedTotalLiabilities * 0.4; // 概算値
      
      // 負債自己資本比率の計算
      debtToEquityRatio = estimatedTotalLiabilities / estimatedEquity;
    }
    
    // 東洋経済のスコア
    let tkScore = null;
    if (rawData.rivals && Array.isArray(rawData.rivals) && rawData.rivals.length > 0) {
      const selfCompany = rawData.rivals.find((r: any) => r.stock_code === stockCode);
      if (selfCompany && selfCompany.tk_score) {
        tkScore = selfCompany.tk_score;
      }
    }
    
    // セクター情報
    let sector = null;
    let sectorName = null;
    if (rawData.rivals && Array.isArray(rawData.rivals) && rawData.rivals.length > 0) {
      const selfCompany = rawData.rivals.find((r: any) => r.stock_code === stockCode);
      if (selfCompany) {
        sector = selfCompany.tk_sector;
        sectorName = selfCompany.tk_sector_name;
      }
    }
    
    // 業績データの解析
    const performanceData = parsePerformanceData(rawData.shimen_results || []);
    
    return {
      companyId: companyId,
      companyName: companyName,
      stockCode: stockCode,
      isExist: isExist,
      
      // 株価情報
      currentPrice: currentPrice,
      marketCap: marketCap,
      minimumPurchaseAmount: rawData.minimum_purchase_amount,
      tradingUnit: rawData.trading_unit,
      
      // 株価指標
      priceEarningsRatio: per,
      priceBookValueRatio: pbr,
      dividendYield: dividendYield,
      bookValuePerShare: bookValuePerShare,
      
      // 年高値・安値
      yearHigh: yearHigh,
      yearLow: yearLow,
      yearHighDate: yearHighDate,
      yearLowDate: yearLowDate,
      
      // 業績情報（最新実績）
      latestResults: latestResults,
      performanceData: performanceData, // 業績データ配列を追加
      
      // 財務指標
      equityRatio: equityRatio, // 自己資本比率（%）
      roe: roe, // 自己資本利益率
      operatingMargin: operatingMargin, // 営業利益率（%）
      netProfitMargin: netProfitMargin, // 純利益率（%）
      estimatedTotalAssets: estimatedTotalAssets, // 推定総資産（百万円）
      estimatedEquity: estimatedEquity, // 推定自己資本（百万円）
      estimatedInterestBearingDebt: estimatedInterestBearingDebt, // 推定有利子負債（百万円）
      debtToEquityRatio: debtToEquityRatio, // 負債自己資本比率
      
      // セクター情報
      sector: sector,
      sectorName: sectorName,
      
      // 東洋経済スコア
      tkScore: tkScore,
      
      // その他
      tradingValue: rawData.trading_value, // 売買代金
      turnover: rawData.turnover, // 出来高
      treasuryStockRatio: rawData.ratio_of_treasury_stocks, // 自己株式比率
      
      // メタ情報
      updatedAt: new Date().toISOString(),
      shimenPubDate: rawData.shimen_pub_date,
      maxModifiedDate: rawData.max_modified_date_tk,
      year: rawData.year,
      season: rawData.season,
      seasonName: rawData.season_name
    };
  } catch (error) {
    console.error(`企業ID ${companyId} のデータ整形中にエラーが発生しました:`, (error as Error).message);
    return {
      companyId: companyId,
      companyName: 'N/A',
      stockCode: companyId,
      isExist: '0',
      error: `データ整形エラー: ${(error as Error).message}`,
      currentPrice: null,
      marketCap: null,
      minimumPurchaseAmount: null,
      tradingUnit: null,
      priceEarningsRatio: null,
      priceBookValueRatio: null,
      dividendYield: null,
      bookValuePerShare: null,
      yearHigh: null,
      yearLow: null,
      yearHighDate: null,
      yearLowDate: null,
      latestResults: null,
      performanceData: [], // 空の業績データ配列
      equityRatio: null,
      roe: null,
      operatingMargin: null,
      netProfitMargin: null,
      estimatedTotalAssets: null,
      estimatedEquity: null,
      estimatedInterestBearingDebt: null,
      debtToEquityRatio: null,
      sector: null,
      sectorName: null,
      tkScore: null,
      tradingValue: null,
      turnover: null,
      treasuryStockRatio: null,
      updatedAt: new Date().toISOString()
    };
  }
}

// 遅延関数
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 出力ディレクトリを作成
export async function ensureOutputDirectory(outputPath: string): Promise<void> {
  const dir = path.dirname(path.resolve(__dirname, '../../', outputPath));
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error('出力ディレクトリの作成に失敗しました:', (error as Error).message);
    throw error;
  }
}

// メイン処理（データ取得専用）
export async function fetchAllCompanyData(): Promise<CompaniesData> {
  console.log('四季報データ取得スクリプトを開始します...');
  
  // 設定を読み込み
  const config = await loadConfig();
  console.log(`${config.companyIds.length}社のデータを取得します`);
  
  // 出力ディレクトリを確保
  await ensureOutputDirectory(config.outputFile);
  
  // 既存データを読み込み
  const existingData = await loadExistingData(config.outputFile);
  
  const results: CompanyData[] = [];
  let skippedCount = 0;
  let fetchedCount = 0;
  
  // 各企業のデータを順次取得
  for (let i = 0; i < config.companyIds.length; i++) {
    const companyId = config.companyIds[i];
    
    // 既存データをチェック
    const existingCompany = existingData.get(companyId);
    if (existingCompany && isRecentlyUpdated(existingCompany.updatedAt)) {
      console.log(`企業ID ${companyId} は1ヶ月以内に更新済みです。スキップします。`);
      results.push(existingCompany);
      skippedCount++;
    } else {
      // データを取得
      const rawData = await fetchCompanyData(companyId);
      
      // データを整形
      const formattedData = formatCompanyData(rawData, companyId);
      results.push(formattedData);
      fetchedCount++;
      
      // 最後の企業以外は遅延を挿入
      if (i < config.companyIds.length - 1) {
        console.log(`${config.requestInterval}ms 待機中...`);
        await delay(config.requestInterval);
      }
    }
    
    console.log(`進捗: ${i + 1}/${config.companyIds.length} 完了`);
  }
  
  // 結果をJSONファイルに出力
  const outputData: CompaniesData = {
    timestamp: new Date().toISOString(),
    // フォールバックやプレースホルダ（companyName === 'N/A'）や存在フラグが0のものは出力しない
    totalCompanies: results.filter(r => r && r.companyName && r.companyName !== 'N/A' && r.isExist !== '0' && !r.error).length,
    companies: results.filter(r => r && r.companyName && r.companyName !== 'N/A' && r.isExist !== '0' && !r.error)
  };
  
  const outputPath = path.resolve(__dirname, '../../', config.outputFile);
  await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
  
  // public/output/ディレクトリに自動コピー
  try {
    const publicOutputDir = path.resolve(__dirname, '../../public/output');
    await fs.mkdir(publicOutputDir, { recursive: true });
    const publicOutputPath = path.join(publicOutputDir, path.basename(config.outputFile));
    await fs.copyFile(outputPath, publicOutputPath);
    console.log(`📁 public/output/ に自動コピー完了: ${path.basename(config.outputFile)}`);
  } catch (copyError) {
    console.warn('⚠️  public/output/へのコピーに失敗:', (copyError as Error).message);
  }
  
  console.log(`\n結果を ${config.outputFile} に保存しました`);
  console.log(`新規取得: ${fetchedCount}社`);
  console.log(`既存データ使用: ${skippedCount}社`);
  console.log(`取得成功: ${results.filter(r => !r.error).length}社`);
  console.log(`取得失敗: ${results.filter(r => r.error).length}社`);
  
  return outputData;
}

// スクリプトとして直接実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAllCompanyData().catch(error => {
    console.error('予期しないエラーが発生しました:', error);
    process.exit(1);
  });
}