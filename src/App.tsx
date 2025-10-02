import { defineComponent, onMounted, ref } from 'vue';
import { useCompanyData } from './composables/useCompanyData';
import FinancialComparisonTable from './components/FinancialComparisonTable';
import PerformanceTable from './components/PerformanceTable';
import SettingsModal from './components/SettingsModal';

export default defineComponent({
  name: 'App',
  setup() {
    const {
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
      toggleHighGrowthFilter,
      updateGrowthSettings,
      consecutiveGrowthYears,
      salesGrowthRatio,
      marketCapLimit
    } = useCompanyData();

    const selectedCompanyIndex = ref(0);
    const showPerformanceDetail = ref(false);
    const availableFiles = ref<string[]>(['range-companies.json']);
    const showSettingsModal = ref(false);

    onMounted(async () => {
      // 利用可能なデータファイルを取得
      availableFiles.value = await getAvailableDataFiles();
      
      // デフォルトデータを読み込み
      await loadCompanyData();
    });

    const togglePerformanceDetail = () => {
      showPerformanceDetail.value = !showPerformanceDetail.value;
    };

    const handleDataSourceChange = async (fileName: string) => {
      await loadCompanyData(fileName);
      selectedCompanyIndex.value = 0; // 企業選択をリセット
    };

    const selectedCompany = () => {
      return displayCompanies.value[selectedCompanyIndex.value] || null;
    };

    const handleOpenSettings = () => {
      showSettingsModal.value = true;
    };

    const handleCloseSettings = () => {
      showSettingsModal.value = false;
    };

    const handleSaveSettings = (years: number, ratio: number, marketCapLimitValue?: number | null) => {
      updateGrowthSettings(years, ratio, marketCapLimitValue);
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
            <button onClick={() => loadCompanyData()}>再試行</button>
          </div>
        )}

        {!loading.value && !error.value && successfulCompanies.value.length > 0 && (
          <div>
            {/* 上部コントロールパネル */}
            <div class="control-panel">
              {/* データソース選択 */}
              {availableFiles.value.length > 1 && (
                <div class="data-source-selector">
                  <label>📂 データソース: </label>
                  <select 
                    value={dataSource.value} 
                    onChange={(e) => handleDataSourceChange((e.target as HTMLSelectElement).value)}
                  >
                    {availableFiles.value.map(fileName => (
                      <option key={fileName} value={fileName}>
                        {fileName === 'companies.json' ? '🏢 デフォルト企業' :
                         fileName === 'range-companies.json' ? '📊 範囲取得データ' :
                         fileName}
                      </option>
                    ))}
                  </select>
                  <small class="file-info">
                    ({successfulCompanies.value.length}社のデータ
                    {showHighGrowthOnly.value && ` | 高成長: ${highGrowthCompanies.value.length}社`})
                  </small>
                </div>
              )}
              
              {/* 表示切り替えボタン */}
              <button 
                class={`toggle-button ${showPerformanceDetail.value ? 'active' : ''}`}
                onClick={togglePerformanceDetail}
              >
                {showPerformanceDetail.value ? '📊 比較表示に戻る' : '📈 業績詳細を表示'}
              </button>
              
              {/* 高成長企業フィルタ */}
              <button 
                class={`filter-button ${showHighGrowthOnly.value ? 'active' : ''}`}
                onClick={toggleHighGrowthFilter}
                title={`${consecutiveGrowthYears.value}年連続増収かつ売上高${salesGrowthRatio.value}倍以上${marketCapLimit.value ? `かつ時価総額${marketCapLimit.value}億円以下` : ''}の企業のみ表示`}
              >
                {showHighGrowthOnly.value ? '🚀 高成長企業のみ' : `🔍 高成長企業フィルタ (${consecutiveGrowthYears.value}年/${salesGrowthRatio.value}倍${marketCapLimit.value ? `/${marketCapLimit.value}億円以下` : ''})`}
              </button>
              
              {/* 設定ボタン */}
              <button 
                class="settings-button"
                onClick={handleOpenSettings}
                title="高成長企業の判定条件を設定"
              >
                ⚙️ 設定
              </button>
              
              {/* 企業選択（業績詳細時のみ） */}
              {showPerformanceDetail.value && (
                <div class="company-selector">
                  <label>🏢 企業選択: </label>
                  <select 
                    value={selectedCompanyIndex.value} 
                    onChange={(e) => selectedCompanyIndex.value = parseInt((e.target as HTMLSelectElement).value)}
                  >
                    {displayCompanies.value.map((company, index) => (
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
                stockCode={selectedCompany()!.stockCode}
                formatNumber={formatNumber}
              />
            ) : (
              <FinancialComparisonTable
                companies={displayCompanies.value}
                formatNumber={formatNumber}
              />
            )}
          </div>
        )}

        {!loading.value && !error.value && displayCompanies.value.length === 0 && (
          <div class="no-data">
            <h2>データが見つかりません</h2>
            <p>{showHighGrowthOnly.value ? '高成長企業の条件を満たす企業がありません。' : '企業データを取得してください。'}</p>
            <div class="action-buttons">
              {showHighGrowthOnly.value ? (
                <button onClick={toggleHighGrowthFilter}>全企業を表示</button>
              ) : (
                <button onClick={() => loadCompanyData()}>データを読み込む</button>
              )}
              {!showHighGrowthOnly.value && (
                <div class="help-text">
                  <p><strong>データ取得方法:</strong></p>
                  <code>npm run fetch-range -- 7000-7100</code><br/>
                  <small>（7000番台を取得する例）</small>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 設定モーダル */}
        <SettingsModal
          isVisible={showSettingsModal.value}
          consecutiveYears={consecutiveGrowthYears.value}
          growthRatio={salesGrowthRatio.value}
          marketCapLimit={marketCapLimit.value}
          onClose={handleCloseSettings}
          onSave={handleSaveSettings}
        />
      </div>
    );
  }
});