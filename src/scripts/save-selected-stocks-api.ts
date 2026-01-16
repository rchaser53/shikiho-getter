import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import type { CompanyData, CompaniesData } from '../types/index.js';
import { fetchCompanyData, formatCompanyData } from '../services/dataFetcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

const SELECTED_STOCKS_PATH = path.resolve(__dirname, '../../output/selected-stocks.json');
const DEFAULT_COMPANY_SOURCE_PATH = path.resolve(__dirname, '../../output/range-companies.json');

app.use(cors());
app.use(express.json());

function readCompaniesFile(filePath: string): CompaniesData | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as CompaniesData;
  } catch (error) {
    console.error('企業データファイルの読み込みに失敗:', error);
    return null;
  }
}

function pickRandomCompanyId(companiesData: CompaniesData): string | null {
  if (!companiesData?.companies?.length) return null;
  const idx = Math.floor(Math.random() * companiesData.companies.length);
  const picked = companiesData.companies[idx];
  return picked?.companyId || picked?.stockCode || null;
}

// 任意の企業IDの最新データを取得（四季報APIをサーバー側でプロキシ）
app.get('/api/company/:companyId', async (req, res) => {
  const companyId = String(req.params.companyId || '').trim();
  if (!companyId) {
    return res.status(400).json({ error: 'companyId is required' });
  }

  try {
    const raw = await fetchCompanyData(companyId);
    const formatted: CompanyData = formatCompanyData(raw, companyId);

    if (formatted.error) {
      return res.status(502).json({ error: formatted.error, companyId });
    }

    return res.json({ company: formatted });
  } catch (error) {
    console.error('企業データ取得エラー:', error);
    return res.status(500).json({ error: 'Failed to fetch company data', companyId });
  }
});

// 出力済みの企業一覧からランダムに1社選び、その最新データを取得
app.get('/api/random-company', async (req, res) => {
  const fileQuery = String(req.query.file || '').trim();
  const sourcePath = fileQuery
    ? path.resolve(__dirname, '../../output', fileQuery)
    : DEFAULT_COMPANY_SOURCE_PATH;

  const companiesData = readCompaniesFile(sourcePath);
  if (!companiesData) {
    return res.status(404).json({
      error: 'Company source file not found',
      source: sourcePath
    });
  }

  const companyId = pickRandomCompanyId(companiesData);
  if (!companyId) {
    return res.status(404).json({
      error: 'No companies available in source file',
      source: sourcePath
    });
  }

  try {
    const raw = await fetchCompanyData(companyId);
    const formatted: CompanyData = formatCompanyData(raw, companyId);

    if (formatted.error) {
      return res.status(502).json({ error: formatted.error, companyId, source: sourcePath });
    }

    return res.json({
      company: formatted,
      pickedFrom: path.basename(sourcePath)
    });
  } catch (error) {
    console.error('ランダム企業データ取得エラー:', error);
    return res.status(500).json({ error: 'Failed to fetch random company', companyId, source: sourcePath });
  }
});

// 選択銘柄を保存
app.post('/api/save-selected-stocks', (req, res) => {
  try {
    const stockCodes = req.body;
    
    if (!Array.isArray(stockCodes)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    fs.writeFileSync(SELECTED_STOCKS_PATH, JSON.stringify(stockCodes, null, 2), 'utf-8');
    console.log(`✅ ${stockCodes.length}銘柄を保存しました: ${SELECTED_STOCKS_PATH}`);
    
    res.json({ success: true, count: stockCodes.length });
  } catch (error) {
    console.error('保存エラー:', error);
    res.status(500).json({ error: 'Failed to save' });
  }
});

// 選択銘柄を取得
app.get('/api/selected-stocks', (_, res) => {
  try {
    if (!fs.existsSync(SELECTED_STOCKS_PATH)) {
      return res.json([]);
    }
    
    const data = JSON.parse(fs.readFileSync(SELECTED_STOCKS_PATH, 'utf-8'));
    res.json(data);
  } catch (error) {
    console.error('読み込みエラー:', error);
    res.status(500).json({ error: 'Failed to load' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 選択銘柄保存APIサーバー起動: http://localhost:${PORT}`);
});
