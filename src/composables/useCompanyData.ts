import { ref, computed } from 'vue';
import type { CompanyData } from '../types';

export function useCompanyData() {
  const companies = ref<CompanyData[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const dataSource = ref<string>('range-companies.json'); // データソースを管理
  const showHighGrowthOnly = ref(false); // 高成長企業フィルタ
  const showTrendChangeOnly = ref(false); // 200日線プラス銘柄フィルタ
  
  // 高成長企業の判定条件設定
  const consecutiveGrowthYears = ref(4); // 連続増収年数
  const salesGrowthRatio = ref(2.0); // 売上高成長率（倍）
  const marketCapLimit = ref<number | null>(null); // 時価総額上限（億円、nullは制限なし）
  
  // トレンド変化した企業のstockCodeリスト
  const trendChangedStockCodes = ref<string[]>([]);
  
  // お気に入り銘柄リスト
  const favoriteStockCodes = ref<Set<string>>(new Set());
  
  // 成功した企業データのみをフィルタ（お気に入りがあれば、お気に入りのみ）
  const successfulCompanies = computed(() => {
    const filtered = companies.value.filter((company: CompanyData) => !company.error);
    
    // お気に入りが設定されている場合は、お気に入りのみ表示
    if (favoriteStockCodes.value.size > 0) {
      return filtered.filter(company => favoriteStockCodes.value.has(company.stockCode));
    }
    
    return filtered;
  });

  // 高成長企業フィルタ（4年連続増収で売上高2倍以上）
  const highGrowthCompanies = computed(() => {
    return successfulCompanies.value.filter(company => {
      return isHighGrowthCompany(company);
    });
  });

  // 200日線プラス銘柄フィルタ（200日移動平均線より株価が上の銘柄）
  const trendChangeCompanies = computed(() => {
    if (trendChangedStockCodes.value.length === 0) {
      return [];
    }
    const codesSet = new Set(trendChangedStockCodes.value);
    return successfulCompanies.value.filter(company => 
      codesSet.has(company.stockCode)
    );
  });

  // 表示用の企業データ（フィルタ適用後）
  const displayCompanies = computed(() => {
    if (showTrendChangeOnly.value) {
      return trendChangeCompanies.value;
    }
    return showHighGrowthOnly.value ? highGrowthCompanies.value : successfulCompanies.value;
  });
  
  // データ読み込み（ファイル名指定可能）
  async function loadCompanyData(fileName = 'range-companies.json') {
    loading.value = true;
    error.value = null;
    dataSource.value = fileName;
    
    try {
      const response = await fetch(`/output/${fileName}`);
      if (!response.ok) {
        throw new Error(`データの読み込みに失敗しました: ${fileName}`);
      }
      
      const data = await response.json();
      companies.value = data.companies || [];
      console.log(`📊 ${companies.value.length}社のデータを読み込みました (${fileName})`);
    } catch (err) {
      error.value = (err as Error).message;
      console.error('データ読み込みエラー:', err);
    } finally {
      loading.value = false;
    }
  }
  
  // 利用可能なデータファイル一覧を取得
  async function getAvailableDataFiles(): Promise<string[]> {
    try {
      // 一般的なファイル名をチェック
      const possibleFiles = [
        'range-companies.json',
        'companies.json',
        'custom-companies.json'
      ];
      
      const availableFiles: string[] = [];
      
      for (const fileName of possibleFiles) {
        try {
          const response = await fetch(`/output/${fileName}`, { method: 'HEAD' });
          if (response.ok) {
            availableFiles.push(fileName);
          }
        } catch {
          // ファイルが存在しない場合はスキップ
        }
      }
      
      return availableFiles;
    } catch (error) {
      console.error('ファイル一覧取得エラー:', error);
      return ['range-companies.json']; // デフォルト
    }
  }
  
  // 高成長企業判定関数（設定可能な条件）
  function isHighGrowthCompany(company: CompanyData): boolean {
    const minYears = consecutiveGrowthYears.value + 1; // 比較用に+1年分必要
    if (!company.performanceData || company.performanceData.length < minYears) {
      return false; // 最低必要年数分のデータが必要（比較用）
    }
    
    // 時価総額チェック（設定されている場合）
    if (marketCapLimit.value !== null && company.marketCap) {
      // 時価総額が億円単位で設定値を超えている場合は除外
      const marketCapInOku = company.marketCap / 100; // 百万円を億円に変換
      if (marketCapInOku > marketCapLimit.value) {
        return false;
      }
    }
    
    // 実績データのみを抽出してソート（新しい順）
    const actualResults = company.performanceData
      .filter(row => row.isActual && row.netSales !== null && !row.isQuarterly)
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, minYears); // 必要な年数分
    
    if (actualResults.length < minYears) {
      return false;
    }
    
    // 連続増収チェック（設定された年数）
    let consecutiveGrowth = 0;
    for (let i = 0; i < actualResults.length - 1; i++) {
      const currentYear = actualResults[i];
      const previousYear = actualResults[i + 1];
      
      if (currentYear.netSales! > previousYear.netSales!) {
        consecutiveGrowth++;
      } else {
        break; // 連続増収が途切れた
      }
    }
    
    // 設定された連続増収年数チェック
    if (consecutiveGrowth < consecutiveGrowthYears.value) {
      return false;
    }
    
    // 売上高成長率チェック（最新年 vs 設定年数前）
    const latestSales = actualResults[0].netSales!;
    const comparisonYearSales = actualResults[consecutiveGrowthYears.value].netSales!;
    
    if (comparisonYearSales <= 0) {
      return false; // ゼロ除算回避
    }
    
    const growthRatio = latestSales / comparisonYearSales;
    
    const marketCapText = marketCapLimit.value !== null && company.marketCap 
      ? `, 時価総額${(company.marketCap / 100).toFixed(0)}億円` 
      : '';
    console.log(`📈 ${company.companyName}: ${consecutiveGrowth}年連続増収, 成長率${growthRatio.toFixed(2)}倍${marketCapText}`);
    
    return growthRatio >= salesGrowthRatio.value; // 設定された成長率以上
  }
  
  // フィルタ切り替え関数
  function toggleHighGrowthFilter() {
    showHighGrowthOnly.value = !showHighGrowthOnly.value;
    if (showHighGrowthOnly.value) {
      showTrendChangeOnly.value = false; // 他のフィルタをオフ
    }
    console.log(`🔍 高成長企業フィルタ: ${showHighGrowthOnly.value ? 'ON' : 'OFF'}`);
  }
  
  // トレンド変化フィルタ切り替え関数
  function toggleTrendChangeFilter() {
    showTrendChangeOnly.value = !showTrendChangeOnly.value;
    if (showTrendChangeOnly.value) {
      showHighGrowthOnly.value = false; // 他のフィルタをオフ
    }
    console.log(`📈 200日線プラスフィルタ: ${showTrendChangeOnly.value ? 'ON' : 'OFF'}`);
  }
  
  // トレンド変化データをロード
  function loadTrendChangeData(stockCodes: string[]) {
    trendChangedStockCodes.value = stockCodes;
    console.log(`📊 200日線プラス銘柄: ${stockCodes.length}社`);
  }
  
  // 高成長企業の設定を更新
  function updateGrowthSettings(years: number, ratio: number, marketCapLimitValue?: number | null) {
    consecutiveGrowthYears.value = years;
    salesGrowthRatio.value = ratio;
    marketCapLimit.value = marketCapLimitValue ?? null;
    const marketCapText = marketCapLimitValue ? `、時価総額${marketCapLimitValue}億円以下` : '';
    console.log(`📊 高成長企業設定更新: ${years}年連続増収、売上高${ratio}倍以上${marketCapText}`);
  }
  
  // お気に入り銘柄の追加
  function addToFavorites(stockCode: string) {
    favoriteStockCodes.value.add(stockCode);
    saveFavoritesToLocalStorage();
    console.log(`⭐ お気に入りに追加: ${stockCode}`);
  }
  
  // お気に入り銘柄の削除
  function removeFromFavorites(stockCode: string) {
    favoriteStockCodes.value.delete(stockCode);
    saveFavoritesToLocalStorage();
    console.log(`🗑️ お気に入りから削除: ${stockCode}`);
  }
  
  // お気に入りのトグル
  function toggleFavorite(stockCode: string) {
    if (favoriteStockCodes.value.has(stockCode)) {
      removeFromFavorites(stockCode);
    } else {
      addToFavorites(stockCode);
    }
  }
  
  // お気に入り銘柄の全クリア
  function clearFavorites() {
    favoriteStockCodes.value.clear();
    saveFavoritesToLocalStorage();
    console.log('🗑️ お気に入りを全クリアしました');
  }
  
  // お気に入り銘柄をlocalStorageに保存
  function saveFavoritesToLocalStorage() {
    const array = Array.from(favoriteStockCodes.value);
    localStorage.setItem('favoriteStockCodes', JSON.stringify(array));
  }
  
  // お気に入り銘柄をlocalStorageから読み込み
  function loadFavoritesFromLocalStorage() {
    try {
      const stored = localStorage.getItem('favoriteStockCodes');
      if (stored) {
        const array = JSON.parse(stored);
        favoriteStockCodes.value = new Set(array);
        console.log(`⭐ お気に入り銘柄を読み込みました: ${array.length}銘柄`);
      }
    } catch (error) {
      console.error('お気に入り銘柄の読み込みエラー:', error);
    }
  }
  
  // お気に入りかどうかをチェック
  function isFavorite(stockCode: string): boolean {
    return favoriteStockCodes.value.has(stockCode);
  }
  
  // 数値フォーマット関数
  function formatNumber(value: number | null, decimals = 0): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    
    const strValue = String(value);
    if (strValue === 'ー' || strValue === '-' || strValue.trim() === '') {
      return 'N/A';
    }
    
    const num = parseFloat(String(value));
    if (isNaN(num)) {
      return 'N/A';
    }
    
    // 負数の場合の処理
    const isNegative = num < 0;
    const absNum = Math.abs(num);
    
    // 小数点以下の桁数を指定して文字列化
    const fixedNum = absNum.toFixed(decimals);
    
    // 整数部分と小数部分を分離
    const parts = fixedNum.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];
    
    // 整数部分にカンマを挿入（3桁区切り）
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    // 小数部分がある場合は結合
    let result = decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger;
    
    // 負数の場合はマイナス記号を追加
    return isNegative ? `-${result}` : result;
  }
  
  return {
    companies,
    successfulCompanies,
    highGrowthCompanies,
    trendChangeCompanies,
    displayCompanies,
    loading,
    error,
    dataSource,
    loadCompanyData,
    getAvailableDataFiles,
    formatNumber,
    showHighGrowthOnly,
    showTrendChangeOnly,
    toggleHighGrowthFilter,
    toggleTrendChangeFilter,
    loadTrendChangeData,
    updateGrowthSettings,
    consecutiveGrowthYears,
    salesGrowthRatio,
    marketCapLimit,
    // お気に入り関連
    favoriteStockCodes,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    clearFavorites,
    isFavorite,
    loadFavoritesFromLocalStorage
  };
}