import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPANIES_PATH = path.resolve(__dirname, '../../output/range-companies.json');
const SELECTED_STOCKS_PATH = path.resolve(__dirname, '../../output/selected-stocks.json');
const HISTORY_DIR = path.resolve(__dirname, '../../output/history');
const API_URL = 'https://api-shikiho.toyokeizai.net/stocks/v1/stocks';

async function fetchCompanyData(stockCode: string) {
  try {
    const res = await axios.get(`${API_URL}/${stockCode}/latest`);
    return res.data;
  } catch (e) {
    return null;
  }
}

async function main() {
  const today = new Date();
  const yyyyMMdd = today.toISOString().slice(0, 10);
  const outPath = path.join(HISTORY_DIR, `${yyyyMMdd}.json`);

  let stockCodes: string[] = [];
  
  // selected-stocks.jsonがあればそちらを優先
  if (fs.existsSync(SELECTED_STOCKS_PATH)) {
    console.log('📌 selected-stocks.jsonから銘柄リストを読み込みます...');
    stockCodes = JSON.parse(fs.readFileSync(SELECTED_STOCKS_PATH, 'utf-8'));
    console.log(`✅ ${stockCodes.length}銘柄を対象にします`);
  } else {
    console.log('📊 range-companies.jsonから全銘柄を読み込みます...');
    const companiesRaw = JSON.parse(fs.readFileSync(COMPANIES_PATH, 'utf-8'));
    const companies = companiesRaw.companies || companiesRaw;
    stockCodes = companies.map((c: any) => c.stockCode || c.stock_code).filter(Boolean);
    console.log(`✅ ${stockCodes.length}銘柄を対象にします`);
  }

  const results: any[] = [];
  for (const code of stockCodes) {
    const data = await fetchCompanyData(code);
    if (data) {
      results.push({
        stock_code: code,
        company_name: data.shikiho_name,
        ratio_of_price_to_200days_ma: data.ratio_of_price_to_200days_ma,
        current_price: data.stock_price,
        fetched_at: yyyyMMdd
      });
    }
    // API rate limit対策: 0.5秒待機
    await new Promise(r => setTimeout(r, 500));
  }

  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Saved ${results.length} companies to ${outPath}`);
}

main();
