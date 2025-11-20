// kabutan-trend-scraper.js
// 登録した株式コードでKabutanからトレンド情報（目先、短期、中期、長期）を取得するスクリプト

import fs from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const config = JSON.parse(fs.readFileSync(join(__dirname, '..', 'config.json'), 'utf-8'));

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// 会社名を取得する関数
async function fetchCompanyName(stockCode) {
  const url = `https://kabutan.jp/stock/?code=${stockCode}`;
  try {
    const { data } = await axios.get(url);
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

async function fetchTrends(stockCode) {
  const url = `https://kabutan.jp/stock/?code=${stockCode}`;
  try {
    const { data } = await axios.get(url);
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
    
    let trends = null;
    
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
          const directions = [];
          const rates = [];
          
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
    return { stockCode, companyName: stockCode, error: err.message };
  }
}

// 前日のデータを読み込む
function loadPreviousData(trendsDir) {
  try {
    const files = fs.readdirSync(trendsDir)
      .filter(f => f.endsWith('.json') && f !== 'latest.json')
      .sort()
      .reverse();
    
    if (files.length === 0) return null;
    
    const previousFile = join(trendsDir, files[0]);
    const data = JSON.parse(fs.readFileSync(previousFile, 'utf-8'));
    return { data, date: files[0].replace('.json', '') };
  } catch (err) {
    return null;
  }
}

// トレンドの変化を検出
function detectChanges(current, previous) {
  const changes = [];
  
  for (const company of current) {
    if (!company.trends) continue;
    
    const prevCompany = previous.find(p => p.stockCode === company.stockCode);
    if (!prevCompany || !prevCompany.trends) continue;
    
    const trendKeys = ['目先(5日線)', '短期(25日線)', '中期(75日線)', '長期(200日線)'];
    
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
          rate: company.trends[key]?.rate
        });
      }
    }
  }
  
  return changes;
}

async function main() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const trendsDir = join(__dirname, '..', 'output', 'trends');
  
  // ディレクトリが存在しない場合は作成
  if (!fs.existsSync(trendsDir)) {
    fs.mkdirSync(trendsDir, { recursive: true });
  }
  
  const results = [];
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

main();
