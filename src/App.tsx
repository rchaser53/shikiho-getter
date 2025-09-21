import { defineComponent, onMounted } from 'vue';
import { useCompanyData } from './composables/useCompanyData';
import FinancialComparisonTable from './components/FinancialComparisonTable';

export default defineComponent({
  name: 'App',
  setup() {
    const {
      successfulCompanies,
      loading,
      error,
      loadCompanyData,
      formatNumber
    } = useCompanyData();

    onMounted(() => {
      loadCompanyData();
    });

    return () => (
      <div class="app">
        {loading.value && (
          <div class="loading">
            <div class="spinner"></div>
            <p>データを読み込み中...</p>
          </div>
        )}

        {error.value && (
          <div class="error">
            <h2>エラー</h2>
            <p>{error.value}</p>
            <button onClick={loadCompanyData}>再試行</button>
          </div>
        )}

        {!loading.value && !error.value && successfulCompanies.value.length > 0 && (
          <FinancialComparisonTable
            companies={successfulCompanies.value}
            formatNumber={formatNumber}
          />
        )}

        {!loading.value && !error.value && successfulCompanies.value.length === 0 && (
          <div class="no-data">
            <h2>データが見つかりません</h2>
            <p>企業データを取得してください。</p>
            <button onClick={loadCompanyData}>データを読み込む</button>
          </div>
        )}
      </div>
    );
  }
});