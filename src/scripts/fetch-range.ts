#!/usr/bin/env tsx
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchCompanyData, formatCompanyData, ensureOutputDirectory } from '../services/dataFetcher.js';
import type { CompaniesData } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// コマンドライン引数を解析
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
使用方法:
  npm run fetch-range -- 1000-2000          # 1000から2000まで
  npm run fetch-range -- 7372,8411,9984     # 個別指定
  npm run fetch-range -- 7000-7100,8000     # 範囲と個別の組み合わせ
  tsx src/scripts/fetch-range.ts 1000-2000  # 直接実行
`);
    process.exit(1);
  }
  
  const companyIds: string[] = [];
  
  for (const arg of args) {
    // カンマで分割
    const parts = arg.split(',');
    
    for (const part of parts) {
      const trimmed = part.trim();
      
      if (trimmed.includes('-')) {
        // 範囲指定 (例: 1000-2000)
        const [start, end] = trimmed.split('-').map(s => parseInt(s.trim()));
        
        if (isNaN(start) || isNaN(end) || start > end) {
          console.error(`無効な範囲: ${trimmed}`);
          process.exit(1);
        }
        
        if (end - start > 1000) {
          console.error(`範囲が大きすぎます (最大1000): ${trimmed}`);
          process.exit(1);
        }
        
        for (let i = start; i <= end; i++) {
          companyIds.push(i.toString());
        }
      } else {
        // 個別指定
        const id = parseInt(trimmed);
        if (isNaN(id)) {
          console.error(`無効な企業ID: ${trimmed}`);
          process.exit(1);
        }
        companyIds.push(id.toString());
      }
    }
  }
  
  return [...new Set(companyIds)]; // 重複除去
}

// 遅延関数
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// プログレスバー表示
function showProgress(current: number, total: number, companyId: string, status: string) {
  const percentage = Math.round((current / total) * 100);
  const progressBar = '█'.repeat(Math.floor(percentage / 2)) + '░'.repeat(50 - Math.floor(percentage / 2));
  
  process.stdout.write(`\r[${progressBar}] ${percentage}% (${current}/${total}) ID:${companyId} - ${status}`);
  
  if (current === total) {
    console.log(); // 改行
  }
}

// バッチ処理でデータ取得
async function fetchRangeData(companyIds: string[], outputFile: string = 'output/range-companies.json') {
  console.log(`📊 ${companyIds.length}社のデータを取得開始...`);
  console.log(`📝 出力先: ${outputFile}`);
  
  // 出力ディレクトリを確保
  await ensureOutputDirectory(outputFile);
  
  const results = [];
  const errors = [];
  let successCount = 0;
  let skipCount = 0;
  
  const requestInterval = 500; // 500ms間隔（API負荷軽減）
  
  for (let i = 0; i < companyIds.length; i++) {
    const companyId = companyIds[i];
    
    try {
      showProgress(i + 1, companyIds.length, companyId, '取得中...');
      
      // データを取得
      const rawData = await fetchCompanyData(companyId);
      
      if (rawData && rawData.is_exist === '1') {
        // データを整形
        const formattedData = formatCompanyData(rawData, companyId);
        results.push(formattedData);
        successCount++;
        showProgress(i + 1, companyIds.length, companyId, `✅ 成功 (${formattedData.companyName})`);
      } else {
        skipCount++;
        showProgress(i + 1, companyIds.length, companyId, '⏭️ スキップ (存在しない)');
      }
      
    } catch (error) {
      const errorMsg = (error as Error).message;
      errors.push({ companyId, error: errorMsg });
      showProgress(i + 1, companyIds.length, companyId, `❌ エラー: ${errorMsg}`);
    }
    
    // API負荷軽減のため待機（最後以外）
    if (i < companyIds.length - 1) {
      await delay(requestInterval);
    }
  }
  
  // 結果をJSONファイルに出力
  const outputData: CompaniesData = {
    timestamp: new Date().toISOString(),
    totalCompanies: results.length,
    companies: results
  };
  
  const outputPath = path.resolve(__dirname, '../../', outputFile);
  await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
  
  // サマリー表示
  console.log('\n' + '='.repeat(60));
  console.log('📊 取得結果サマリー');
  console.log('='.repeat(60));
  console.log(`✅ 成功: ${successCount}社`);
  console.log(`⏭️  スキップ: ${skipCount}社 (存在しない銘柄)`);
  console.log(`❌ エラー: ${errors.length}社`);
  console.log(`📄 出力ファイル: ${outputFile}`);
  
  if (errors.length > 0) {
    console.log('\n❌ エラー詳細:');
    errors.forEach(({ companyId, error }) => {
      console.log(`  - ID:${companyId} ${error}`);
    });
  }
  
  if (successCount > 0) {
    console.log('\n🎉 取得成功した企業:');
    results.slice(0, 10).forEach(company => {
      console.log(`  - ${company.stockCode}: ${company.companyName} (${company.sectorName || 'N/A'})`);
    });
    
    if (results.length > 10) {
      console.log(`  ... 他${results.length - 10}社`);
    }
  }
  
  console.log('\n💡 GUI表示用データの準備完了！');
  console.log(`   cp -r ${path.dirname(outputFile)} public/ でWebアプリに反映`);
  
  return outputData;
}

// スクリプト実行部分
async function main() {
  try {
    console.log('🚀 四季報データ範囲取得スクリプト');
    console.log('='.repeat(40));
    
    const companyIds = parseArgs();
    
    console.log(`📋 取得対象: ${companyIds.length}社`);
    console.log(`🆔 範囲: ${Math.min(...companyIds.map(Number))} - ${Math.max(...companyIds.map(Number))}`);
    
    // 確認プロンプト（大量取得時）
    if (companyIds.length > 100) {
      console.log(`⚠️  ${companyIds.length}社の取得には約${Math.ceil(companyIds.length * 0.5 / 60)}分かかります。`);
      
      // Node.jsの場合の確認プロンプト
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise<string>((resolve) => {
        rl.question('続行しますか？ (y/N): ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('キャンセルしました。');
        process.exit(0);
      }
    }
    
    await fetchRangeData(companyIds);
    
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', (error as Error).message);
    process.exit(1);
  }
}

// 直接実行時
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('予期しないエラー:', error);
    process.exit(1);
  });
}