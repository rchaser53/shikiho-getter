import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface Config {
  companyIds: string[];
  requestInterval?: number;
}

export interface NewsItem {
  id: string;
  date: string;
  time: string;
  summary: string;
  url: string | null;
}

export interface CompanyNews {
  companyId: string;
  news: NewsItem[];
  error?: string;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.join(scriptDir, '..', '..');
const configPath = path.join(projectDir, 'config.json');
const outputDir = path.join(projectDir, 'output', 'kabutan-news');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Config;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function makeId(companyId: string, date: string, time: string, summary: string, url: string | null): string {
  return [companyId, date, time, summary, url ?? ''].join('|');
}

function parseDateTime(value: string): { date: string; time: string } | null {
  // Kabutan displays entries such as "26/09/01 19:50". Also accept the
  // older "09/01 19:50" form and Japanese date separators.
  const match = value.match(/(\d{2}\/\d{2}\/\d{2}|\d{1,4}[年\/-]\d{1,2}[月\/-]\d{1,2}日?|\d{1,2}\/\d{1,2}|\d{1,2}月\d{1,2}日?)\s*(\d{1,2}:\d{2})/);
  if (match) {
    return { date: match[1], time: match[2] };
  }

  const timeOnly = value.match(/\b(\d{1,2}:\d{2})\b/);
  return timeOnly ? { date: '', time: timeOnly[1] } : null;
}

function parseNews(html: string, companyId: string): NewsItem[] {
  const $ = cheerio.load(html);
  const items: NewsItem[] = [];
  const seen = new Set<string>();

  // Keep the selectors narrow enough to avoid picking up unrelated tables,
  // while supporting the class names used by different Kabutan page versions.
  // The news table has used several class names over time. Selecting all
  // rows/items is safe here because a candidate is accepted only when it
  // contains a Kabutan-style date and time.
  const rows = $('tr, li');

  rows.each((_, element) => {
    const cells = $(element).find('td, th');
    const parts: string[] = [];
    cells.each((__, cell) => {
      parts.push(cleanText($(cell).text()));
    });

    const rowText = cleanText($(element).text());
    const dateTime = parseDateTime(parts[0] ?? rowText) ?? parseDateTime(rowText);
    if (!dateTime) return;

    const summaryCell = cells.length > 1 ? cells.eq(cells.length - 1) : $(element);
    // Use the whole cell instead of only the anchor: the category (for
    // example, "市況") is plain text and is part of the requested summary.
    const summary = cleanText(summaryCell.text())
      .replace(/^\s*(\d{2}\/\d{2}\/\d{2}|\d{1,4}[年\/-]\d{1,2}[月\/-]\d{1,2}日?|\d{1,2}\/\d{1,2}|\d{1,2}月\d{1,2}日?)?\s*\d{1,2}:\d{2}\s*/, '');
    if (!summary) return;

    const href = summaryCell.find('a').first().attr('href');
    const newsUrl = href ? new URL(href, 'https://kabutan.jp').toString() : null;
    const item: NewsItem = {
      id: makeId(companyId, dateTime.date, dateTime.time, summary, newsUrl),
      date: dateTime.date,
      time: dateTime.time,
      summary,
      url: newsUrl,
    };

    if (!seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  });

  return items;
}

async function fetchCompanyNews(companyId: string): Promise<CompanyNews> {
  const url = `https://kabutan.jp/stock/news?code=${encodeURIComponent(companyId)}`;

  try {
    const response = await axios.get<string>(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    return { companyId, news: parseNews(response.data, companyId) };
  } catch (error) {
    return {
      companyId,
      news: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function loadPreviousResults(): CompanyNews[] | null {
  const latestPath = path.join(outputDir, 'latest.json');
  try {
    return JSON.parse(fs.readFileSync(latestPath, 'utf8')) as CompanyNews[];
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  if (!Array.isArray(config.companyIds)) {
    throw new Error('config.json の companyIds は配列で指定してください。');
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const previous = loadPreviousResults();
  const previousIds = new Set((previous ?? []).flatMap((company) => company.news.map((item) => item.id)));
  const results: CompanyNews[] = [];
  const interval = config.requestInterval ?? 500;

  for (const companyId of config.companyIds) {
    const result = await fetchCompanyNews(String(companyId));
    results.push(result);
    console.log(`${result.companyId}: ${result.news.length}件${result.error ? ` (エラー: ${result.error})` : ''}`);
    if (interval > 0) await sleep(interval);
  }

  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(outputDir, `${today}.json`), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(outputDir, 'latest.json'), JSON.stringify(results, null, 2));

  const newItems = results.flatMap((company) =>
    company.news
      .filter((item) => !previousIds.has(item.id))
      .map((item) => ({ companyId: company.companyId, ...item })),
  );

  console.log(`\n保存完了: ${path.join(outputDir, 'latest.json')}`);
  if (!previous) {
    console.log('初回実行のため、新着ニュースの比較は行っていません。');
  } else if (newItems.length === 0) {
    console.log('新しいニュースはありません。');
  } else {
    console.log(`新しいニュース: ${newItems.length}件`);
    for (const item of newItems) {
      console.log(`- ${item.companyId} ${item.date} ${item.time} ${item.summary}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
