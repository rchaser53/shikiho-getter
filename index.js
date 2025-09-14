const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// 設定ファイルを読み込む
async function loadConfig() {
  try {
    const configData = await fs.readFile(path.join(__dirname, 'config.json'), 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('設定ファイルの読み込みに失敗しました:', error.message);
    throw error;
  }
}

// 企業データを取得
async function fetchCompanyData(companyId) {
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
    console.error(`企業ID ${companyId} のデータ取得に失敗しました:`, error.message);
    return null;
  }
}

// データを整形
function formatCompanyData(rawData, companyId) {
  if (!rawData) {
    return {
      companyId: companyId,
      error: 'データ取得に失敗しました'
    };
  }
  
  try {
    // 基本情報の抽出
    const stockCode = rawData.stock_code || companyId;
    const isExist = rawData.is_exist;
    
    // 会社名の抽出（rivalsデータの最初の要素が自社情報）
    let companyName = 'N/A';
    if (rawData.rivals && Array.isArray(rawData.rivals) && rawData.rivals.length > 0) {
      const selfCompany = rawData.rivals.find(r => r.stock_code === stockCode);
      if (selfCompany) {
        companyName = selfCompany.company_name_j || selfCompany.company_name_j9c || 'N/A';
      }
    }
    
    // 現在の株価情報
    let currentPrice = null;
    if (rawData.rivals && Array.isArray(rawData.rivals) && rawData.rivals.length > 0) {
      const selfCompany = rawData.rivals.find(r => r.stock_code === stockCode);
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
      const actualResult = rawData.modified_forecasts_list_basic.find(item => item.result_flag === true);
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
    
    // BPS（1株純資産）の抽出
    let bookValuePerShare = null;
    if (rawData.shimen_bps && Array.isArray(rawData.shimen_bps) && rawData.shimen_bps.length >= 3) {
      bookValuePerShare = parseNumber(rawData.shimen_bps[2]);
    }
    
    // 自己資本比率の抽出（rivalsから）
    let equityRatio = null;
    let roe = null;
    if (rawData.rivals && Array.isArray(rawData.rivals) && rawData.rivals.length > 0) {
      const selfCompany = rawData.rivals.find(r => r.stock_code === stockCode);
      if (selfCompany) {
        equityRatio = selfCompany.ratio_of_net_worth ? selfCompany.ratio_of_net_worth * 100 : null; // %に変換
        roe = selfCompany.fyp1_roe;
      }
    }
    
    // 東洋経済のスコア
    let tkScore = null;
    if (rawData.rivals && Array.isArray(rawData.rivals) && rawData.rivals.length > 0) {
      const selfCompany = rawData.rivals.find(r => r.stock_code === stockCode);
      if (selfCompany && selfCompany.tk_score) {
        tkScore = selfCompany.tk_score;
      }
    }
    
    // セクター情報
    let sector = null;
    let sectorName = null;
    if (rawData.rivals && Array.isArray(rawData.rivals) && rawData.rivals.length > 0) {
      const selfCompany = rawData.rivals.find(r => r.stock_code === stockCode);
      if (selfCompany) {
        sector = selfCompany.tk_sector;
        sectorName = selfCompany.tk_sector_name;
      }
    }
    
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
      
      // 財務指標
      equityRatio: equityRatio, // 自己資本比率（%）
      roe: roe, // 自己資本利益率
      
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
      seasonName: rawData.season_name,
      
      // 生データ（デバッグ用、必要に応じてコメントアウト）
      // rawData: rawData
    };
  } catch (error) {
    console.error(`企業ID ${companyId} のデータ整形中にエラーが発生しました:`, error.message);
    return {
      companyId: companyId,
      error: `データ整形エラー: ${error.message}`,
      rawData: rawData
    };
  }
}

// 数値を解析するヘルパー関数
function parseNumber(value) {
  if (value === null || value === undefined || value === '' || value === 'ー' || value === '-') {
    return null;
  }
  
  const str = String(value).replace(/,/g, ''); // カンマを削除
  const num = parseFloat(str);
  
  return isNaN(num) ? null : num;
}

// 遅延関数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 出力ディレクトリを作成
async function ensureOutputDirectory(outputPath) {
  const dir = path.dirname(outputPath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error('出力ディレクトリの作成に失敗しました:', error.message);
    throw error;
  }
}

// メイン処理
async function main() {
  try {
    console.log('四季報データ取得スクリプトを開始します...');
    
    // 設定を読み込み
    const config = await loadConfig();
    console.log(`${config.companyIds.length}社のデータを取得します`);
    
    // 出力ディレクトリを確保
    await ensureOutputDirectory(config.outputFile);
    
    const results = [];
    
    // 各企業のデータを順次取得
    for (let i = 0; i < config.companyIds.length; i++) {
      const companyId = config.companyIds[i];
      
      // データを取得
      const rawData = await fetchCompanyData(companyId);
      
      // データを整形
      const formattedData = formatCompanyData(rawData, companyId);
      results.push(formattedData);
      
      console.log(`進捗: ${i + 1}/${config.companyIds.length} 完了`);
      
      // 最後の企業以外は遅延を挿入
      if (i < config.companyIds.length - 1) {
        console.log(`${config.requestInterval}ms 待機中...`);
        await delay(config.requestInterval);
      }
    }
    
    // 結果をJSONファイルに出力
    const outputData = {
      timestamp: new Date().toISOString(),
      totalCompanies: results.length,
      companies: results
    };
    
    await fs.writeFile(config.outputFile, JSON.stringify(outputData, null, 2), 'utf8');
    console.log(`\n結果を ${config.outputFile} に保存しました`);
    console.log(`取得成功: ${results.filter(r => !r.error).length}社`);
    console.log(`取得失敗: ${results.filter(r => r.error).length}社`);
    
  } catch (error) {
    console.error('処理中にエラーが発生しました:', error.message);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main().catch(error => {
    console.error('予期しないエラーが発生しました:', error);
    process.exit(1);
  });
}

module.exports = {
  loadConfig,
  fetchCompanyData,
  formatCompanyData,
  main
};