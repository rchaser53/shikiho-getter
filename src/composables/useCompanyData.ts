import { ref, computed } from 'vue';
import type { CompanyData } from '../types';

export function useCompanyData() {
  const companies = ref<CompanyData[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  // 成功した企業データのみをフィルタ
  const successfulCompanies = computed(() => 
    companies.value.filter((company: CompanyData) => !company.error)
  );
  
  // データ読み込み
  async function loadCompanyData() {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await fetch('/output/companies.json');
      if (!response.ok) {
        throw new Error('データの読み込みに失敗しました');
      }
      
      const data = await response.json();
      companies.value = data.companies || [];
    } catch (err) {
      error.value = (err as Error).message;
      console.error('データ読み込みエラー:', err);
    } finally {
      loading.value = false;
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
    
    // 小数点以下の桁数を指定して文字列化
    const fixedNum = num.toFixed(decimals);
    
    // 整数部分と小数部分を分離
    const parts = fixedNum.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];
    
    // 整数部分にカンマを挿入（3桁区切り）
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    // 小数部分がある場合は結合
    return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger;
  }
  
  return {
    companies,
    successfulCompanies,
    loading,
    error,
    loadCompanyData,
    formatNumber
  };
}