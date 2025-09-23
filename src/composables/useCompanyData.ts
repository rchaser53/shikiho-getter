import { ref, computed } from 'vue';
import type { CompanyData } from '../types';

export function useCompanyData() {
  const companies = ref<CompanyData[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const dataSource = ref<string>('companies.json'); // データソースを管理
  
  // 成功した企業データのみをフィルタ
  const successfulCompanies = computed(() => 
    companies.value.filter((company: CompanyData) => !company.error)
  );
  
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
    loading,
    error,
    dataSource,
    loadCompanyData,
    getAvailableDataFiles,
    formatNumber
  };
}