interface HistoryRecord {
  stock_code: string;
  company_name: string;
  ratio_of_price_to_200days_ma: number | null;
  current_price: number | null;
  fetched_at: string;
}

interface TrendChange {
  stock_code: string;
  company_name: string;
  old_ratio: number | null;
  new_ratio: number | null;
  change: number | null;
  trend_direction: 'up' | 'down' | 'neutral';
}

/**
 * 履歴ファイルのリストを取得（ブラウザ版）
 */
async function getHistoryFiles(): Promise<string[]> {
  try {
    console.log('📂 履歴ファイルを検索中...');
    const files: string[] = [];
    const today = new Date();
    
    // 過去30日分をチェック
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const fileName = `${dateStr}.json`;
      
      try {
        // GETリクエストで実際にファイルを取得して存在を確認
        const response = await fetch(`/output/history/${fileName}`);
        if (response.ok) {
          files.push(fileName);
          console.log(`✅ 見つかりました: ${fileName}`);
        }
      } catch (err) {
        // ファイルが存在しない場合はスキップ
      }
    }
    
    console.log(`📊 合計${files.length}個の履歴ファイルを発見`);
    return files.sort();
  } catch (error) {
    console.error('❌ 履歴ファイル一覧取得エラー:', error);
    return [];
  }
}

/**
 * 指定日数前のファイルと最新ファイルを取得
 */
async function getComparisonFiles(daysAgo: number = 7): Promise<{ oldFile: string | null, newFile: string | null }> {
  const files = await getHistoryFiles();
  if (files.length === 0) {
    return { oldFile: null, newFile: null };
  }

  const newFile = files[files.length - 1];
  
  // daysAgo日前に近いファイルを探す
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);
  const targetDateStr = targetDate.toISOString().slice(0, 10);
  
  let oldFile: string | null = null;
  for (let i = files.length - 1; i >= 0; i--) {
    if (files[i] <= `${targetDateStr}.json`) {
      oldFile = files[i];
      break;
    }
  }

  return { oldFile, newFile };
}

/**
 * 最新のデータから200日線比率がプラスの企業を抽出
 */
export async function detectTrendChanges(_daysAgo: number = 7): Promise<TrendChange[]> {
  try {
    console.log(`🔍 200日線比率がプラスの銘柄を抽出中...`);
    
    // 最新の履歴ファイルを取得
    const files = await getHistoryFiles();
    if (files.length === 0) {
      console.warn('⚠️ 履歴データが不足しています。履歴ファイルを生成してください。');
      console.log('実行コマンド: npm run fetch-daily-history-quick');
      return [];
    }

    const latestFile = files[files.length - 1];
    console.log(`📅 対象ファイル: ${latestFile}`);

    const response = await fetch(`/output/history/${latestFile}`);
    if (!response.ok) {
      console.error(`❌ 履歴データの読み込みに失敗: ${latestFile}(${response.status})`);
      return [];
    }

    const data: HistoryRecord[] = await response.json();
    console.log(`📊 データ件数: ${data.length}社`);

    const results: TrendChange[] = [];

    for (const record of data) {
      const ratio = record.ratio_of_price_to_200days_ma;

      // ratio_of_price_to_200days_maがプラス（0より大きい）の銘柄のみ抽出
      if (ratio != null && ratio > 0) {
        results.push({
          stock_code: record.stock_code,
          company_name: record.company_name,
          old_ratio: null,
          new_ratio: ratio,
          change: null,
          trend_direction: 'up'
        });
      }
    }

    console.log(`✅ トレンド変化検出完了: ${results.length}社`);
    if (results.length > 0) {
      console.table(results.slice(0, 5)); // 上位5社を表示
    }
    return results;
  } catch (error) {
    console.error('❌ トレンド変化検出エラー:', error);
    if (error instanceof Error) {
      console.error('エラー詳細:', error.message, error.stack);
    }
    return [];
  }
}

/**
 * トレンド変化した企業のstockCodeリストを返す
 */
export function getTrendChangedStockCodes(_daysAgo: number = 7): string[] {
  // ブラウザ環境では同期関数として呼べないため、空配列を返す
  // 実際のデータ取得は非同期で行う必要がある
  console.warn('getTrendChangedStockCodes is deprecated in browser environment. Use detectTrendChanges instead.');
  return [];
}
