import { defineComponent, onMounted, ref } from 'vue';
import { useCompanyData } from './composables/useCompanyData';
import FinancialComparisonTable from './components/FinancialComparisonTable';
import PerformanceTable from './components/PerformanceTable';

export default defineComponent({
  name: 'App',
  setup() {
    const {
      companies,
      successfulCompanies,
      loading,
      error,
      loadCompanyData,
      formatNumber
    } = useCompanyData();

    const selectedCompanyIndex = ref(0);
    const showPerformanceDetail = ref(false);

    onMounted(() => {
      loadCompanyData();
    });

    const togglePerformanceDetail = () => {
      showPerformanceDetail.value = !showPerformanceDetail.value;
    };

    const selectedCompany = () => {
      return successfulCompanies.value[selectedCompanyIndex.value] || null;
    };

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
          <div>
            {/* 業績詳細表示の切り替えボタン */}
            <div class="control-panel">
              <button 
                class={`toggle-button ${showPerformanceDetail.value ? 'active' : ''}`}
                onClick={togglePerformanceDetail}
              >
                {showPerformanceDetail.value ? '📊 比較表示に戻る' : '📈 業績詳細を表示'}
              </button>
              
              {showPerformanceDetail.value && (
                <div class="company-selector">
                  <label>企業選択: </label>
                  <select 
                    value={selectedCompanyIndex.value} 
                    onChange={(e) => selectedCompanyIndex.value = parseInt((e.target as HTMLSelectElement).value)}
                  >
                    {successfulCompanies.value.map((company, index) => (
                      <option key={company.companyId} value={index}>
                        {company.companyName} ({company.stockCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* メインコンテンツ */}
            {showPerformanceDetail.value && selectedCompany() ? (
              <PerformanceTable
                performanceData={selectedCompany()!.performanceData}
                companyName={selectedCompany()!.companyName}
                formatNumber={formatNumber}
              />
            ) : (
              <FinancialComparisonTable
                companies={successfulCompanies.value}
                formatNumber={formatNumber}
              />
            )}
          </div>
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