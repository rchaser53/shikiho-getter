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

// 既存データファイルを読み込む
async function loadExistingData(outputFile) {
  try {
    const existingData = await fs.readFile(outputFile, 'utf8');
    const parsed = JSON.parse(existingData);
    
    // 企業IDをキーとするマップを作成
    const existingMap = new Map();
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
function isRecentlyUpdated(updatedAt) {
  if (!updatedAt) return false;
  
  const updateDate = new Date(updatedAt);
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30日前
  
  const isRecent = updateDate > oneMonthAgo;
  
  if (isRecent) {
    const daysDiff = Math.ceil((now - updateDate) / (1000 * 60 * 60 * 24));
    console.log(`  最終更新: ${updateDate.toLocaleString('ja-JP')} (${daysDiff}日前)`);
  }
  
  return isRecent;
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
    let totalAssets = null;
    if (rawData.rivals && Array.isArray(rawData.rivals) && rawData.rivals.length > 0) {
      const selfCompany = rawData.rivals.find(r => r.stock_code === stockCode);
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

// 財務比較テーブルHTMLを生成
function generateFinancialComparisonTable(companies) {
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>企業財務比較テーブル</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        .update-time {
            text-align: center;
            color: #666;
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: right;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
            text-align: center;
        }
        .company-name {
            text-align: left !important;
            font-weight: bold;
            background-color: #f9f9f9;
        }
        .metric-name {
            text-align: left !important;
            font-weight: bold;
            background-color: #f9f9f9;
        }
        .number {
            text-align: right;
        }
        .percentage {
            color: #0066cc;
        }
        .currency {
            color: #006600;
        }
        .negative {
            color: #cc0000;
        }
        .section-header {
            background-color: #e6f3ff !important;
            font-weight: bold;
            text-align: center !important;
        }
        .note {
            font-size: 12px;
            color: #666;
            margin-top: 20px;
            padding: 15px;
            background-color: #f9f9f9;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 企業財務比較テーブル</h1>
        <div class="update-time">最終更新: ${new Date().toLocaleString('ja-JP')}</div>
        
        <table>
            <thead>
                <tr>
                    <th style="text-align: left;">項目</th>
                    ${companies.map(company => `<th>${company.companyName || company.companyId}<br><small>(${company.stockCode})</small></th>`).join('')}
                </tr>
            </thead>
            <tbody>
                <!-- 基本情報 -->
                <tr><td colspan="${companies.length + 1}" class="section-header">📈 株価情報</td></tr>
                <tr>
                    <td class="metric-name">現在株価（円）</td>
                    ${companies.map(company => `<td class="number currency">${formatNumber(company.currentPrice)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">時価総額（百万円）</td>
                    ${companies.map(company => `<td class="number currency">${formatNumber(company.marketCap, 1)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">PER（倍）</td>
                    ${companies.map(company => `<td class="number">${formatNumber(company.priceEarningsRatio, 2)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">PBR（倍）</td>
                    ${companies.map(company => `<td class="number">${formatNumber(company.priceBookValueRatio, 2)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">配当利回り（%）</td>
                    ${companies.map(company => `<td class="number percentage">${formatNumber(company.dividendYield, 2)}</td>`).join('')}
                </tr>
                
                <!-- 業績情報 -->
                <tr><td colspan="${companies.length + 1}" class="section-header">💼 業績情報（最新実績）</td></tr>
                <tr>
                    <td class="metric-name">決算期</td>
                    ${companies.map(company => `<td class="number">${company.latestResults ? company.latestResults.period : 'N/A'}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">売上高（百万円）</td>
                    ${companies.map(company => `<td class="number currency">${formatNumber(company.latestResults ? company.latestResults.netSales : null)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">営業利益（百万円）</td>
                    ${companies.map(company => `<td class="number currency">${formatNumber(company.latestResults ? company.latestResults.operatingIncome : null)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">純利益（百万円）</td>
                    ${companies.map(company => `<td class="number currency">${formatNumber(company.latestResults ? company.latestResults.netIncome : null)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">1株当たり利益（円）</td>
                    ${companies.map(company => `<td class="number currency">${formatNumber(company.latestResults ? company.latestResults.earningsPerShare : null, 1)}</td>`).join('')}
                </tr>
                
                <!-- 財務指標 -->
                <tr><td colspan="${companies.length + 1}" class="section-header">🏦 財務指標</td></tr>
                <tr>
                    <td class="metric-name">自己資本比率（%）</td>
                    ${companies.map(company => `<td class="number percentage">${formatNumber(company.equityRatio, 1)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">ROE（%）</td>
                    ${companies.map(company => `<td class="number percentage">${formatNumber(company.roe, 1)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">営業利益率（%）</td>
                    ${companies.map(company => `<td class="number percentage">${formatNumber(company.operatingMargin, 1)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">純利益率（%）</td>
                    ${companies.map(company => `<td class="number percentage">${formatNumber(company.netProfitMargin, 1)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">BPS（円）</td>
                    ${companies.map(company => `<td class="number currency">${formatNumber(company.bookValuePerShare, 0)}</td>`).join('')}
                </tr>
                
                <!-- 推定財務データ -->
                <tr><td colspan="${companies.length + 1}" class="section-header">📊 推定財務データ</td></tr>
                <tr>
                    <td class="metric-name">推定総資産（百万円）</td>
                    ${companies.map(company => `<td class="number currency">${formatNumber(company.estimatedTotalAssets)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">推定自己資本（百万円）</td>
                    ${companies.map(company => `<td class="number currency">${formatNumber(company.estimatedEquity)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">推定有利子負債（百万円）</td>
                    ${companies.map(company => `<td class="number currency">${formatNumber(company.estimatedInterestBearingDebt)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">負債自己資本比率（倍）</td>
                    ${companies.map(company => `<td class="number">${formatNumber(company.debtToEquityRatio, 2)}</td>`).join('')}
                </tr>
                
                <!-- 東洋経済スコア -->
                <tr><td colspan="${companies.length + 1}" class="section-header">⭐ 東洋経済スコア</td></tr>
                <tr>
                    <td class="metric-name">総合スコア</td>
                    ${companies.map(company => `<td class="number">${company.tkScore ? company.tkScore.total_score + '/5' : 'N/A'}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">収益性</td>
                    ${companies.map(company => `<td class="number">${company.tkScore ? company.tkScore.profitability + '/5' : 'N/A'}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">成長性</td>
                    ${companies.map(company => `<td class="number">${company.tkScore ? company.tkScore.growth_potential + '/5' : 'N/A'}</td>`).join('')}
                </tr>
                <tr>
                    <td class="metric-name">安定性</td>
                    ${companies.map(company => `<td class="number">${company.tkScore ? company.tkScore.stability + '/5' : 'N/A'}</td>`).join('')}
                </tr>
                
                <!-- セクター情報 -->
                <tr><td colspan="${companies.length + 1}" class="section-header">🏢 セクター情報</td></tr>
                <tr>
                    <td class="metric-name">業種</td>
                    ${companies.map(company => `<td style="text-align: left; font-size: 12px;">${company.sectorName || 'N/A'}</td>`).join('')}
                </tr>
            </tbody>
        </table>
        
        <div class="note">
            <strong>注意事項:</strong><br>
            • データは東洋経済オンライン四季報APIから取得<br>
            • 「N/A」は該当データが取得できなかったことを示します<br>
            • 金額は百万円単位で表示（時価総額、売上高、利益等）<br>
            • PER、PBRは予想ベース<br>
            • 東洋経済スコアは5段階評価<br>
            • <strong>推定財務データは計算による概算値</strong>（総資産=自己資本÷自己資本比率、有利子負債=総負債×40%と仮定）
        </div>
    </div>
</body>
</html>
`;

  return html;
}

// 数値フォーマット関数
function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  
  if (typeof value === 'string' && (value === 'ー' || value === '-' || value.trim() === '')) {
    return 'N/A';
  }
  
  const num = parseFloat(value);
  if (isNaN(num)) {
    return 'N/A';
  }
  
  if (num < 0) {
    return `<span class="negative">${num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\.\d))/g, ',')}</span>`;
  }
  
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\.\d))/g, ',');
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
    
    // 既存データを読み込み
    const existingData = await loadExistingData(config.outputFile);
    
    const results = [];
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
    const outputData = {
      timestamp: new Date().toISOString(),
      totalCompanies: results.length,
      companies: results
    };
    
    await fs.writeFile(config.outputFile, JSON.stringify(outputData, null, 2), 'utf8');
    console.log(`\n結果を ${config.outputFile} に保存しました`);
    console.log(`新規取得: ${fetchedCount}社`);
    console.log(`既存データ使用: ${skippedCount}社`);
    console.log(`取得成功: ${results.filter(r => !r.error).length}社`);
    console.log(`取得失敗: ${results.filter(r => r.error).length}社`);
    
    // 財務比較テーブルHTMLを生成
    const successfulCompanies = results.filter(r => !r.error);
    if (successfulCompanies.length > 0) {
      const htmlTable = generateFinancialComparisonTable(successfulCompanies);
      const htmlOutputPath = config.outputFile.replace('.json', '_comparison.html');
      await fs.writeFile(htmlOutputPath, htmlTable, 'utf8');
      console.log(`財務比較テーブルを ${htmlOutputPath} に保存しました`);
      console.log('ブラウザで開いて比較表を確認できます');
    }
    
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
  loadExistingData,
  isRecentlyUpdated,
  fetchCompanyData,
  formatCompanyData,
  main
};