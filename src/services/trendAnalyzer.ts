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
 * 1週間前と最新のデータを比較し、200日線比率が変化した企業を抽出
 */
export async function detectTrendChanges(daysAgo: number = 7): Promise<TrendChange[]> {
  try {
    console.log(`🔍 ${daysAgo}日前とのトレンド変化を検出中...`);
    const { oldFile, newFile } = await getComparisonFiles(daysAgo);

    if (!oldFile || !newFile) {
      console.warn('⚠️ 履歴データが不足しています。履歴ファイルを生成してください。');
      console.log('実行コマンド: npm run fetch-daily-history-quick');
      return [];
    }

    console.log(`📅 比較対象: ${oldFile} vs ${newFile}`);

    const [oldResponse, newResponse] = await Promise.all([
      fetch(`/output/history/${oldFile}`),
      fetch(`/output/history/${newFile}`)
    ]);

    if (!oldResponse.ok || !newResponse.ok) {
      console.error(`❌ 履歴データの読み込みに失敗: ${oldFile}(${oldResponse.status}), ${newFile}(${newResponse.status})`);
      return [];
    }

    const oldData: HistoryRecord[] = await oldResponse.json();
    const newData: HistoryRecord[] = await newResponse.json();
    
    console.log(`📊 データ件数: 過去=${oldData.length}社, 最新=${newData.length}社`);

    // stock_codeでマップ化
    const oldMap = new Map<string, HistoryRecord>();
    oldData.forEach(r => oldMap.set(r.stock_code, r));

    const changes: TrendChange[] = [];

    for (const newRecord of newData) {
      const oldRecord = oldMap.get(newRecord.stock_code);
      if (!oldRecord) continue;

      const oldRatio = oldRecord.ratio_of_price_to_200days_ma;
      const newRatio = newRecord.ratio_of_price_to_200days_ma;

      // 両方ともnullの場合はスキップ
      if (oldRatio == null && newRatio == null) continue;

      const change = (newRatio != null && oldRatio != null) 
        ? newRatio - oldRatio 
        : null;

      let trend_direction: 'up' | 'down' | 'neutral' = 'neutral';
      if (change != null) {
        if (change > 0.02) trend_direction = 'up';      // 2%以上上昇
        else if (change < -0.02) trend_direction = 'down'; // 2%以上下降
      }

      // 変化があった企業のみ抽出
      if (trend_direction !== 'neutral') {
        changes.push({
          stock_code: newRecord.stock_code,
          company_name: newRecord.company_name,
          old_ratio: oldRatio,
          new_ratio: newRatio,
          change,
          trend_direction
        });
      }
    }

    console.log(`✅ トレンド変化検出完了: ${changes.length}社`);
    if (changes.length > 0) {
      console.table(changes.slice(0, 5)); // 上位5社を表示
    }
    return changes;
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
