import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { HistoryRecord, StockPricePoint } from '../types/index.js';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_HISTORY_DIR = path.resolve(__dirname, '../../output/history');
const API_URL = 'https://api-shikiho.toyokeizai.net/stocks/v1/stocks';

function normalizeDateInput(date?: string): string {
  if (!date) {
    return new Date().toISOString().slice(0, 10);
  }

  // Allow YYYY/MM/DD
  const slashMatch = /^\d{4}\/\d{2}\/\d{2}$/.test(date);
  const normalized = slashMatch ? date.replace(/\//g, '-') : date;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`Invalid date format: ${date} (expected YYYY-MM-DD)`);
  }

  return normalized;
}

async function listHistoryFiles(historyDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(historyDir);
    return entries
      .filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
      .sort();
  } catch (error) {
    throw new Error(`History directory not found: ${historyDir}`);
  }
}

async function ensureDirExists(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function fetchLatestStockSnapshot(stockCode: string): Promise<HistoryRecord> {
  const res = await axios.get(`${API_URL}/${stockCode}/latest`);
  const data = res.data;
  const self = Array.isArray(data?.rivals)
    ? data.rivals.find((r: any) => String(r.stock_code) === String(stockCode))
    : undefined;
  const dateStr = new Date().toISOString().slice(0, 10);

  return {
    stock_code: String(stockCode),
    company_name: self?.company_name_j ?? self?.company_name_j9c,
    ratio_of_price_to_200days_ma: data?.ratio_of_price_to_200days_ma ?? null,
    current_price: self?.current_price ?? data?.stock_price ?? null,
    fetched_at: dateStr,
    snapshotted_at: new Date().toISOString()
  };
}

async function readHistoryFile(filePath: string): Promise<HistoryRecord[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryRecord[]) : [];
  } catch {
    return [];
  }
}

async function upsertHistoryRecord(filePath: string, record: HistoryRecord): Promise<void> {
  const records = await readHistoryFile(filePath);
  const idx = records.findIndex(r => String(r.stock_code) === String(record.stock_code));
  if (idx >= 0) {
    records[idx] = { ...records[idx], ...record };
  } else {
    records.push(record);
  }
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

export interface ResolvedHistoryFile {
  requestedDate: string;
  resolvedDate: string;
  filePath: string;
}

/**
 * 指定日付の履歴ファイルを解決する。
 * - YYYY-MM-DD.json が存在すればそれ
 * - なければ、指定日付以前で最新のファイル
 */
export async function resolveHistoryFileForDate(
  date?: string,
  options?: { historyDir?: string }
): Promise<ResolvedHistoryFile> {
  const requestedDate = normalizeDateInput(date);
  const historyDir = options?.historyDir ?? DEFAULT_HISTORY_DIR;

  const fileName = `${requestedDate}.json`;
  const directPath = path.join(historyDir, fileName);

  try {
    await fs.access(directPath);
    return { requestedDate, resolvedDate: requestedDate, filePath: directPath };
  } catch {
    // fallthrough
  }

  const files = await listHistoryFiles(historyDir);
  const candidates = files
    .map(f => f.replace(/\.json$/, ''))
    .filter(d => d <= requestedDate);

  if (candidates.length === 0) {
    throw new Error(`No history file found on or before ${requestedDate} in ${historyDir}`);
  }

  const resolvedDate = candidates[candidates.length - 1];
  return {
    requestedDate,
    resolvedDate,
    filePath: path.join(historyDir, `${resolvedDate}.json`)
  };
}

export async function loadHistoryRecordsForDate(
  date?: string,
  options?: { historyDir?: string }
): Promise<{ resolved: ResolvedHistoryFile; records: HistoryRecord[] }> {
  const resolved = await resolveHistoryFileForDate(date, options);
  const raw = await fs.readFile(resolved.filePath, 'utf-8');
  const records: HistoryRecord[] = JSON.parse(raw);
  return { resolved, records };
}

export async function getStockPriceAtDate(
  stockCode: string,
  date?: string,
  options?: { historyDir?: string; backfillIfMissing?: boolean }
): Promise<{ resolved: ResolvedHistoryFile; price: number | null }> {
  const historyDir = options?.historyDir ?? DEFAULT_HISTORY_DIR;
  const requestedDate = normalizeDateInput(date);

  const requestedFilePath = path.join(historyDir, `${requestedDate}.json`);

  // まずは「指定日付のファイル」を優先
  const requestedRecords = await readHistoryFile(requestedFilePath);
  const requestedRecord = requestedRecords.find(r => String(r.stock_code) === String(stockCode));
  const requestedPrice = requestedRecord?.current_price ?? null;
  if (requestedPrice != null) {
    return {
      resolved: { requestedDate, resolvedDate: requestedDate, filePath: requestedFilePath },
      price: requestedPrice
    };
  }

  // 指定日付のファイルが無い/株価欠損: バックフィルが有効なら、その日付ファイルを生成/更新
  if (options?.backfillIfMissing) {
    await ensureDirExists(historyDir);
    const snapshot = await fetchLatestStockSnapshot(stockCode);
    snapshot.fetched_at = requestedDate;
    await upsertHistoryRecord(requestedFilePath, snapshot);
    return {
      resolved: { requestedDate, resolvedDate: requestedDate, filePath: requestedFilePath },
      price: snapshot.current_price ?? null
    };
  }

  // バックフィルしない場合は、直近(<=)の履歴にフォールバック
  const { resolved, records } = await loadHistoryRecordsForDate(requestedDate, { historyDir });
  const record = records.find(r => String(r.stock_code) === String(stockCode));
  return { resolved, price: record?.current_price ?? null };
}

/**
 * 指定日付(デフォルト=実行日)を終端に、利用可能な履歴ファイルから直近N本の時系列を返す。
 * "N日" はカレンダー日ではなく "存在する履歴ファイルN本"（≒取得できた営業日ベース）です。
 */
export async function getStockPriceSeries(
  stockCode: string,
  options?: {
    endDate?: string;
    points?: number;
    historyDir?: string;
    backfillMissingPrices?: boolean;
  }
): Promise<StockPricePoint[]> {
  const endDate = normalizeDateInput(options?.endDate);
  const points = options?.points ?? 60;
  const historyDir = options?.historyDir ?? DEFAULT_HISTORY_DIR;

  const files = await listHistoryFiles(historyDir);
  const dates = files
    .map(f => f.replace(/\.json$/, ''))
    .filter(d => d <= endDate);

  // 終端日のファイルが無い場合、バックフィルが有効なら追加する
  if (options?.backfillMissingPrices && !dates.includes(endDate)) {
    await ensureDirExists(historyDir);
    const endPath = path.join(historyDir, `${endDate}.json`);
    const snapshot = await fetchLatestStockSnapshot(stockCode);
    snapshot.fetched_at = endDate;
    await upsertHistoryRecord(endPath, snapshot);
    dates.push(endDate);
    dates.sort();
  }

  const selectedDates = dates.slice(-points);

  const series: StockPricePoint[] = [];
  for (const date of selectedDates) {
    const filePath = path.join(historyDir, `${date}.json`);
    const records: HistoryRecord[] = await readHistoryFile(filePath);
    let record = records.find(r => String(r.stock_code) === String(stockCode));

    if ((record?.current_price ?? null) == null && options?.backfillMissingPrices) {
      const snapshot = await fetchLatestStockSnapshot(stockCode);
      snapshot.fetched_at = date;
      await upsertHistoryRecord(filePath, snapshot);
      record = snapshot;
    }

    series.push({
      date,
      price: record?.current_price ?? null,
      ratioOfPriceTo200DaysMA: record?.ratio_of_price_to_200days_ma ?? null
    });
  }

  return series;
}
