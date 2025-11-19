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

async function fetchTrends(stockCode) {
  const url = `https://kabutan.jp/stock/?code=${stockCode}`;
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    
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
    
    return { stockCode, trends };
  } catch (err) {
    return { stockCode, error: err.message };
  }
}

async function main() {
  const results = [];
  for (const code of config.companyIds) {
    const res = await fetchTrends(code);
    results.push(res);
    console.log(res);
    await sleep(config.requestInterval);
  }
  fs.writeFileSync(join(__dirname, '..', config.outputFile), JSON.stringify(results, null, 2));
  console.log('完了: ', config.outputFile);
}

main();
