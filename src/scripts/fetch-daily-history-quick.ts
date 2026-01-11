import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HISTORY_DIR = path.resolve(__dirname, '../../output/history');
const PUBLIC_HISTORY_DIR = path.resolve(__dirname, '../../public/output/history');
const SELECTED_STOCKS_PATH = path.resolve(__dirname, '../../output/selected-stocks.json');
const API_URL = 'https://api-shikiho.toyokeizai.net/stocks/v1/stocks';

// テスト用に上位50銘柄のみ（selected-stocks.jsonがない場合のデフォルト）
const DEFAULT_TEST_STOCK_CODES = [
  '1301', '1332', '1333', '1605', '1721', '1801', '1802', '1803', '1808', '1812',
  '1925', '1928', '1963', '2002', '2053', '2112', '2153', '2170', '2181', '2201',
  '2269', '2282', '2371', '2432', '2453', '2502', '2503', '2531', '2579', '2801',
  '2802', '2871', '2914', '3003', '3048', '3099', '3101', '3105', '3116', '3254',
  '3360', '3401', '3402', '3407', '3626', '3659', '3861', '3863', '3865', '4004'
];

async function fetchCompanyData(stockCode: string) {
  try {
    const res = await axios.get(`${API_URL}/${stockCode}/latest`);
    return res.data;
  } catch (e) {
    return null;
  }
}

async function createHistoryFile(daysAgo: number = 0) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);
  const yyyyMMdd = targetDate.toISOString().slice(0, 10);
  
  const outPath = path.join(HISTORY_DIR, `${yyyyMMdd}.json`);
  const publicOutPath = path.join(PUBLIC_HISTORY_DIR, `${yyyyMMdd}.json`);

  // selected-stocks.jsonがあればそちらを優先
  let stockCodes: string[] = [];
  if (fs.existsSync(SELECTED_STOCKS_PATH)) {
    stockCodes = JSON.parse(fs.readFileSync(SELECTED_STOCKS_PATH, 'utf-8'));
    console.log(`📌 選択された${stockCodes.length}銘柄を対象にします`);
  } else {
    stockCodes = DEFAULT_TEST_STOCK_CODES;
    console.log(`📋 デフォルト${stockCodes.length}銘柄を対象にします`);
  }

  const results: any[] = [];
  console.log(`\n📅 ${yyyyMMdd} のデータを取得中...`);
  
  for (let i = 0; i < stockCodes.length; i++) {
    const code = stockCodes[i];
    const data = await fetchCompanyData(code);
    
    if (data) {
      const self = Array.isArray(data.rivals)
        ? data.rivals.find((r: any) => String(r.stock_code) === String(code))
        : null;
      // ランダムな変動をシミュレート（テスト用）
      const baseRatio = data.ratio_of_price_to_200days_ma || 0;
      const variation = daysAgo > 0 ? (Math.random() - 0.5) * 0.1 : 0; // ±5%の変動
      
      results.push({
        stock_code: code,
        company_name: self?.company_name_j ?? self?.company_name_j9c,
        ratio_of_price_to_200days_ma: baseRatio + variation,
        current_price: self?.current_price ?? data.stock_price ?? null,
        fetched_at: yyyyMMdd,
        snapshotted_at: new Date().toISOString()
      });
    }
    
    process.stdout.write(`\r進捗: ${i + 1}/${stockCodes.length} (${((i + 1) / stockCodes.length * 100).toFixed(1)}%)`);
    
    // API rate limit対策: 0.3秒待機
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log(`\n保存中: ${outPath}`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  
  // publicディレクトリにもコピー
  if (!fs.existsSync(PUBLIC_HISTORY_DIR)) {
    fs.mkdirSync(PUBLIC_HISTORY_DIR, { recursive: true });
  }
  fs.writeFileSync(publicOutPath, JSON.stringify(results, null, 2), 'utf-8');
  
  console.log(`✅ 保存完了: ${results.length}社`);
}

async function main() {
  console.log('📊 テスト用履歴データ作成開始...');
  
  // 今日と7日前のデータを作成
  await createHistoryFile(0);  // 今日
  await createHistoryFile(7);  // 7日前
  
  console.log('\n🎉 完了しました！');
}

main();
