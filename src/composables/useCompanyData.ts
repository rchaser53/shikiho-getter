import { ref, computed } from 'vue';
import type { CompanyData } from '../types';

export function useCompanyData() {
  const companies = ref<CompanyData[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const dataSource = ref<string>('companies.json'); // データソースを管理
  const showHighGrowthOnly = ref(false); // 高成長企業フィルタ
  
  // 成功した企業データのみをフィルタ
  const successfulCompanies = computed(() => 
    companies.value.filter((company: CompanyData) => !company.error)
  );

  // 高成長企業フィルタ（4年連続増収で売上高2倍以上）
  const highGrowthCompanies = computed(() => {
    return successfulCompanies.value.filter(company => {
      return isHighGrowthCompany(company);
    });
  });

  // 表示用の企業データ（フィルタ適用後）
  const displayCompanies = computed(() => {
    return showHighGrowthOnly.value ? highGrowthCompanies.value : successfulCompanies.value;
  });
  
  // データ読み込み（ファイル名指定可能）
  async function loadCompanyData(fileName = 'companies.json') {
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
        'companies.json',
        'range-companies.json',
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
      return ['companies.json']; // デフォルト
    }
  }
  
  // 高成長企業判定関数（4年連続増収で売上高2倍以上）
  function isHighGrowthCompany(company: CompanyData): boolean {
    if (!company.performanceData || company.performanceData.length < 5) {
      return false; // 最低5年分のデータが必要（比較用）
    }
    
    // 実績データのみを抽出してソート（新しい順）
    const actualResults = company.performanceData
      .filter(row => row.isActual && row.netSales !== null && !row.isQuarterly)
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, 5); // 最新5年分
    
    if (actualResults.length < 5) {
      return false;
    }
    
    // 4年連続増収チェック（最新年から4年前まで）
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
    
    // 4年連続増収チェック
    if (consecutiveGrowth < 4) {
      return false;
    }
    
    // 売上高2倍以上チェック（最新年 vs 4年前）
    const latestSales = actualResults[0].netSales!;
    const fourYearsAgoSales = actualResults[4].netSales!;
    
    if (fourYearsAgoSales <= 0) {
      return false; // ゼロ除算回避
    }
    
    const growthRatio = latestSales / fourYearsAgoSales;
    
    console.log(`📈 ${company.companyName}: ${consecutiveGrowth}年連続増収, 成長率${growthRatio.toFixed(2)}倍`);
    
    return growthRatio >= 2.0; // 2倍以上
  }
  
  // フィルタ切り替え関数
  function toggleHighGrowthFilter() {
    showHighGrowthOnly.value = !showHighGrowthOnly.value;
    console.log(`🔍 高成長企業フィルタ: ${showHighGrowthOnly.value ? 'ON' : 'OFF'}`);
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
    displayCompanies,
    loading,
    error,
    dataSource,
    loadCompanyData,
    getAvailableDataFiles,
    formatNumber,
    showHighGrowthOnly,
    toggleHighGrowthFilter
  };
}