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
  npm run fetch-range -- --allow-duplicates 1000-2000  # 重複許可
  tsx src/scripts/fetch-range.ts 1000-2000  # 直接実行

📝 重複回避機能:
  - 既存のrange-companies.jsonがある場合、重複する企業IDは自動的にスキップされます
  - 新しい企業データのみが追加され、既存データは保持されます
  - 最終的な出力は企業コード順でソートされます

⚙️  オプション:
  --allow-duplicates  重複を許可し、既存データを上書きします
`);
    process.exit(1);
  }
  
  const companyIds: string[] = [];
  let allowDuplicates = false;
  
  for (const arg of args) {
    // オプションチェック
    if (arg === '--allow-duplicates') {
      allowDuplicates = true;
      continue;
    }
    
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
        
        if (end - start > 10000) {
          console.error(`範囲が大きすぎます (最大10000): ${trimmed}`);
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
  
  return { 
    companyIds: [...new Set(companyIds)], // 重複除去
    allowDuplicates 
  };
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
async function fetchRangeData(
  companyIds: string[], 
  outputFile: string = 'output/range-companies.json',
  allowDuplicates: boolean = false
) {
  console.log(`📊 ${companyIds.length}社のデータを取得開始...`);
  console.log(`📝 出力先: ${outputFile}`);
  if (allowDuplicates) {
    console.log(`⚙️  モード: 重複許可 (既存データを上書き)`);
  }
  
  // 出力ディレクトリを確保
  await ensureOutputDirectory(outputFile);
  
  // 既存データの読み込み
  let existingData: CompaniesData | null = null;
  let existingCompanyIds = new Set<string>();
  
  const outputPath = path.resolve(__dirname, '../../', outputFile);
  
  try {
    const existingContent = await fs.readFile(outputPath, 'utf8');
    existingData = JSON.parse(existingContent);
    
    if (existingData && existingData.companies) {
      // 既存企業IDのセットを作成（stockCode と companyId の両方をチェック）
      // ただしプレースホルダ的なデータ (companyName === 'N/A' や isExist === '0' や error を含む) は対象外とする
      const validExisting = existingData.companies.filter(c => c && c.companyName && c.companyName !== 'N/A' && c.isExist !== '0' && !c.error);
      validExisting.forEach(company => {
        existingCompanyIds.add(company.stockCode);
        existingCompanyIds.add(company.companyId);
      });
      console.log(`📋 既存データ: ${validExisting.length}社 (重複チェック対象、プレースホルダは除外)`);
    }
  } catch (error) {
    // ファイルが存在しない場合は新規作成
    console.log('📄 新規ファイルを作成します');
  }
  
  // 重複除去: 既に存在する企業IDを取得対象から除外
  let filteredCompanyIds: string[];
  let duplicateCount = 0;
  
  if (allowDuplicates) {
    // 重複許可モード: 全て取得
    filteredCompanyIds = companyIds;
    console.log(`🔄 重複許可モード: 全${companyIds.length}社を取得します`);
  } else {
    // 重複除去モード: 既存データをスキップ
    filteredCompanyIds = companyIds.filter(id => !existingCompanyIds.has(id));
    duplicateCount = companyIds.length - filteredCompanyIds.length;
    
    if (duplicateCount > 0) {
      console.log(`🔄 重複除外: ${duplicateCount}社（既に取得済み）`);
    }
    
    if (filteredCompanyIds.length === 0) {
      console.log('✅ 指定された全企業は既に取得済みです。');
      return existingData;
    }
  }
  
  console.log(`🆕 新規取得対象: ${filteredCompanyIds.length}社`);
  
  const results = existingData ? [...existingData.companies] : [];
  const errors = [];
  let successCount = 0;
  let skipCount = 0;
  
  const requestInterval = 500; // 500ms間隔（API負荷軽減）
  
  for (let i = 0; i < filteredCompanyIds.length; i++) {
    const companyId = filteredCompanyIds[i];
    
    try {
      showProgress(i + 1, filteredCompanyIds.length, companyId, '取得中...');
      
      // データを取得
      const rawData = await fetchCompanyData(companyId);
      
      if (rawData && rawData.is_exist === '1') {
        // データを整形
        const formattedData = formatCompanyData(rawData, companyId);
        // フォールバックやプレースホルダを除外して保存
        if (formattedData && formattedData.companyName && formattedData.companyName !== 'N/A' && formattedData.isExist !== '0' && !formattedData.error) {
          results.push(formattedData);
          successCount++;
          showProgress(i + 1, filteredCompanyIds.length, companyId, `✅ 成功 (${formattedData.companyName})`);
        } else {
          skipCount++;
          showProgress(i + 1, filteredCompanyIds.length, companyId, '⏭️ スキップ (プレースホルダ/不完全データ)');
        }
      } else {
        skipCount++;
        showProgress(i + 1, filteredCompanyIds.length, companyId, '⏭️ スキップ (存在しない)');
      }
      
    } catch (error) {
      const errorMsg = (error as Error).message;
      errors.push({ companyId, error: errorMsg });
      showProgress(i + 1, filteredCompanyIds.length, companyId, `❌ エラー: ${errorMsg}`);
    }
    
    // API負荷軽減のため待機（最後以外）
    if (i < filteredCompanyIds.length - 1) {
      await delay(requestInterval);
    }
  }
  
  // 結果をJSONファイルに出力（既存データとマージ）
  let finalResults = results;
  
  if (allowDuplicates) {
    // 重複許可モード: 新しく取得したデータで既存データを上書き
    const newStockCodes = new Set(results.slice(-successCount).map(c => c.stockCode));
    // 既存データから、今回取得した銘柄を削除
    const existingWithoutDuplicates = existingData?.companies.filter(c => !newStockCodes.has(c.stockCode)) || [];
    finalResults = [...existingWithoutDuplicates, ...results.slice(-successCount)];
    console.log(`🔄 重複データを上書き: ${newStockCodes.size}社`);
  }
  
  const filteredResults = finalResults.filter(r => r && r.companyName && r.companyName !== 'N/A' && r.isExist !== '0' && !r.error);
  const outputData: CompaniesData = {
    timestamp: new Date().toISOString(),
    totalCompanies: filteredResults.length,
    companies: filteredResults.sort((a, b) => parseInt(a.stockCode) - parseInt(b.stockCode)) // 企業コード順でソート
  };
  
  await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
  
  // public/output/ディレクトリに自動コピー
  try {
    const publicOutputDir = path.resolve(__dirname, '../../public/output');
    await fs.mkdir(publicOutputDir, { recursive: true });
    const publicOutputPath = path.join(publicOutputDir, path.basename(outputFile));
    await fs.copyFile(outputPath, publicOutputPath);
    console.log(`📁 public/output/ に自動コピー完了: ${path.basename(outputFile)}`);
  } catch (copyError) {
    console.warn('⚠️  public/output/へのコピーに失敗:', (copyError as Error).message);
  }
  
  // サマリー表示
  console.log('\n' + '='.repeat(60));
  console.log('📊 取得結果サマリー');
  console.log('='.repeat(60));
  console.log(`✅ 新規取得成功: ${successCount}社`);
  console.log(`⏭️  スキップ: ${skipCount}社 (存在しないまたはプレースホルダ)`);
  console.log(`❌ エラー: ${errors.length}社`);
  if (duplicateCount > 0) {
    console.log(`🔄 重複除外: ${duplicateCount}社 (既に取得済み)`);
  }
  console.log(`📄 出力ファイル: ${outputFile}`);
  console.log(`📈 総企業数: ${outputData.totalCompanies}社 (既存 + 新規)`);
  
  if (errors.length > 0) {
    console.log('\n❌ エラー詳細:');
    errors.forEach(({ companyId, error }) => {
      console.log(`  - ID:${companyId} ${error}`);
    });
  }
  
  if (successCount > 0) {
    console.log('\n🎉 新規取得成功した企業:');
    const newCompanies = results.slice(-successCount);
    newCompanies.slice(0, 10).forEach(company => {
      console.log(`  - ${company.stockCode}: ${company.companyName} (${company.sectorName || 'N/A'})`);
    });
    
    if (newCompanies.length > 10) {
      console.log(`  ... 他${newCompanies.length - 10}社`);
    }
  }
  
  console.log('\n💡 Webアプリ用データの準備完了！');
  console.log(`   📄 出力ファイル: ${outputFile}`);
  console.log(`   📁 Webアプリ用: public/output/${path.basename(outputFile)}`);
  console.log(`   🌐 ブラウザでアクセス: npm run dev`);
  
  return outputData;
}

// スクリプト実行部分
async function main() {
  try {
    console.log('🚀 四季報データ範囲取得スクリプト');
    console.log('='.repeat(40));
    
    const { companyIds, allowDuplicates } = parseArgs();
    
    console.log(`📋 取得対象: ${companyIds.length}社`);
    console.log(`🆔 範囲: ${Math.min(...companyIds.map(Number))} - ${Math.max(...companyIds.map(Number))}`);
    if (allowDuplicates) {
      console.log(`⚙️  モード: 重複許可`);
    }
    
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
    
    await fetchRangeData(companyIds, undefined, allowDuplicates);
    
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