import { getStockPriceAtDate, getStockPriceSeries } from '../services/historyPrice.js';

function getArgValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return argv[idx + 1];
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

function usageAndExit(message?: string, exitCode: number = 1): never {
  if (message) {
    console.error(`\n❌ ${message}`);
  }

  console.log(`\n使い方:\n  npm run get-history-price -- --code 7080 [--date 2025-10-29]\n  npm run get-history-price -- --code 7080 --points 60 [--end-date 2025-10-29]\n\nオプション:\n  --code        銘柄コード(必須)\n  --date        単発取得の対象日(省略時=実行日)\n  --points      時系列の本数(存在する履歴ファイルN本)\n  --end-date    時系列の終端日(省略時=実行日)\n  --no-backfill 履歴に株価が無い場合も補完しない\n  --json        JSONで出力\n`);
  process.exit(exitCode);
}

async function main() {
  const argv = process.argv.slice(2);

  const stockCode = getArgValue(argv, 'code') ?? getArgValue(argv, 'stock') ?? argv.find(a => !a.startsWith('--'));
  if (!stockCode) usageAndExit('--code が必要です');

  const jsonOutput = hasFlag(argv, 'json');
  const noBackfill = hasFlag(argv, 'no-backfill');

  const pointsRaw = getArgValue(argv, 'points');
  const points = pointsRaw ? Number(pointsRaw) : undefined;

  if (points !== undefined) {
    if (!Number.isFinite(points) || points <= 0) usageAndExit('--points は1以上の数値にしてください');

    const endDate = getArgValue(argv, 'end-date');
    const series = await getStockPriceSeries(stockCode, {
      endDate,
      points,
      backfillMissingPrices: !noBackfill
    });

    if (jsonOutput) {
      console.log(JSON.stringify({ stockCode, endDate: endDate ?? null, points, series }, null, 2));
      return;
    }

    console.log(`📈 ${stockCode} の時系列 (${series.length}本)`);
    for (const p of series) {
      const priceText = p.price == null ? 'null' : String(p.price);
      console.log(`${p.date}\t${priceText}`);
    }
    return;
  }

  const date = getArgValue(argv, 'date');
  const result = await getStockPriceAtDate(stockCode, date, { backfillIfMissing: !noBackfill });

  if (jsonOutput) {
    console.log(JSON.stringify({ stockCode, requestedDate: result.resolved.requestedDate, resolvedDate: result.resolved.resolvedDate, price: result.price }, null, 2));
    return;
  }

  console.log(`📅 要求日: ${result.resolved.requestedDate}`);
  console.log(`✅ 使用日: ${result.resolved.resolvedDate}`);
  console.log(`💴 株価: ${result.price ?? 'null'}`);
}

main().catch(err => {
  console.error('❌ 実行に失敗しました:', err instanceof Error ? err.message : err);
  process.exit(1);
});
