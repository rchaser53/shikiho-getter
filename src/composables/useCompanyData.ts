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
    
    return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\.\d))/g, ',');
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