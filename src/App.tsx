import { defineComponent, onMounted, ref } from 'vue';
import { useCompanyData } from './composables/useCompanyData';
import FinancialComparisonTable from './components/FinancialComparisonTable';
import PerformanceTable from './components/PerformanceTable';
import SettingsModal from './components/SettingsModal';
import type { CompanyData } from './types';

export default defineComponent({
  name: 'App',
  setup() {
    const {
      successfulCompanies,
      highGrowthCompanies,
      trendChangeCompanies,
      favoriteCompanies,
      displayCompanies,
      loading,
      error,
      dataSource,
      loadCompanyData,
      getAvailableDataFiles,
      formatNumber,
      showHighGrowthOnly,
      showTrendChangeOnly,
      showFavoritesOnly,
      toggleHighGrowthFilter,
      toggleTrendChangeFilter,
      toggleFavoritesFilter,
      loadTrendChangeData,
      updateGrowthSettings,
      consecutiveGrowthYears,
      salesGrowthRatio,
      marketCapLimit,
      favoriteStockCodes,
      toggleFavorite,
      clearFavorites,
      isFavorite,
      loadFavoritesFromLocalStorage
    } = useCompanyData();

    const selectedCompanyIndex = ref(0);
    const viewMode = ref<'comparison' | 'performance' | 'random'>('comparison');

    const randomCompany = ref<CompanyData | null>(null);
    const randomLoading = ref(false);
    const randomError = ref<string | null>(null);
    const randomPickedFrom = ref<string | null>(null);

    const availableFiles = ref<string[]>(['range-companies.json']);
    const showSettingsModal = ref(false);

     // 表示中の銘柄を保存する関数
     const handleSaveSelectedStocks = async () => {
       const stockCodes = displayCompanies.value.map(c => c.stockCode);
       try {
         const response = await fetch('http://localhost:3001/api/save-selected-stocks', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(stockCodes)
         });
         const result = await response.json();
         if (result.success) {
           alert(`✅ ${result.count}銘柄を保存しました！`);
         } else {
           alert('保存に失敗しました');
         }
       } catch (err) {
         alert('保存に失敗しました。APIサーバーが起動しているか確認してください。\n実行コマンド: npm run api-server');
       }
     };
    onMounted(async () => {
      // お気に入り銘柄を読み込み
      loadFavoritesFromLocalStorage();
      
      // 利用可能なデータファイルを取得
      availableFiles.value = await getAvailableDataFiles();
      
      // デフォルトデータを読み込み
      await loadCompanyData();
      
      // トレンド変化データを読み込み
      try {
        const { detectTrendChanges } = await import('./services/trendAnalyzer');
        const changes = await detectTrendChanges(7);
        const stockCodes = changes.map(c => c.stock_code);
        loadTrendChangeData(stockCodes);
      } catch (err) {
        console.warn('トレンドデータの読み込みに失敗しました:', err);
      }
    });

    const togglePerformanceDetail = () => {
      viewMode.value = viewMode.value === 'performance' ? 'comparison' : 'performance';
    };

    const showRandomView = () => {
      viewMode.value = 'random';
    };

    const backToComparison = () => {
      viewMode.value = 'comparison';
      randomError.value = null;
    };

    const fetchRandomCompany = async () => {
      randomLoading.value = true;
      randomError.value = null;
      randomPickedFrom.value = null;
      showRandomView();

      try {
        const fileName = dataSource.value || 'range-companies.json';
        const response = await fetch(
          `http://localhost:3001/api/random-company?file=${encodeURIComponent(fileName)}`
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'ランダム企業の取得に失敗しました');
        }
        randomCompany.value = data.company || null;
        randomPickedFrom.value = data.pickedFrom || null;
      } catch (err) {
        randomCompany.value = null;
        randomError.value =
          (err as Error).message ||
          'ランダム企業の取得に失敗しました。APIサーバーが起動しているか確認してください。';
      } finally {
        randomLoading.value = false;
      }
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
                    ({displayCompanies.value.length}社を表示 / 全{successfulCompanies.value.length}社
                    {showFavoritesOnly.value && ` | ⭐お気に入り: ${favoriteCompanies.value.length}社でフィルタ中`}
                    {showHighGrowthOnly.value && ` | 高成長: ${highGrowthCompanies.value.length}社`}
                    {showTrendChangeOnly.value && ` | 200日線プラス: ${trendChangeCompanies.value.length}社`})
                  </small>
                </div>
              )}
              
              {/* 表示切り替えボタン */}
              <button 
                class={`toggle-button ${viewMode.value === 'performance' ? 'active' : ''}`}
                onClick={togglePerformanceDetail}
              >
                {viewMode.value === 'performance' ? '📊 比較表示に戻る' : '📈 業績詳細を表示'}
              </button>

              {/* ランダム1社取得 */}
              <button
                class={`random-button ${viewMode.value === 'random' ? 'active' : ''}`}
                onClick={fetchRandomCompany}
                title="出力済みの企業一覧からランダムに1社選び、四季報APIから最新情報を取得して表示"
              >
                {viewMode.value === 'random' ? '🎲 次の1社' : '🎲 ランダム1社'}
              </button>

              {viewMode.value === 'random' && (
                <button class="back-button" onClick={backToComparison}>
                  ↩️ 比較表示へ
                </button>
              )}
              
              {/* 高成長企業フィルタ */}
              <button 
                class={`filter-button ${showHighGrowthOnly.value ? 'active' : ''}`}
                onClick={toggleHighGrowthFilter}
                title={`${consecutiveGrowthYears.value}年連続増収かつ売上高${salesGrowthRatio.value}倍以上${marketCapLimit.value ? `かつ時価総額${marketCapLimit.value}億円以下` : ''}。他の有効なフィルタとも組み合わせて表示`}
              >
                {showHighGrowthOnly.value ? '🚀 高成長企業のみ' : `🔍 高成長企業フィルタ (${consecutiveGrowthYears.value}年/${salesGrowthRatio.value}倍${marketCapLimit.value ? `/${marketCapLimit.value}億円以下` : ''})`}
              </button>
              
              {/* 200日線プラスフィルタ */}
              <button 
                class={`filter-button ${showTrendChangeOnly.value ? 'active' : ''}`}
                onClick={toggleTrendChangeFilter}
                title="200日移動平均線より株価が上にある企業のみ表示（他の有効なフィルタと組み合わせ可能）"
              >
                {showTrendChangeOnly.value ? '📈 200日線プラス銘柄のみ' : '📊 200日線プラスフィルタ'}
              </button>
              
              {/* お気に入りフィルタ */}
              {favoriteStockCodes.value.size > 0 && (
                <button 
                  class={`filter-button ${showFavoritesOnly.value ? 'active' : ''}`}
                  onClick={toggleFavoritesFilter}
                  title="お気に入りに登録した銘柄のみ表示（他の有効なフィルタと組み合わせ可能）"
                >
                  {showFavoritesOnly.value ? '⭐ お気に入りのみ表示中' : `⭐ お気に入りのみ表示 (${favoriteStockCodes.value.size})`}
                </button>
              )}
              
              {/* 設定ボタン */}
              <button 
                class="settings-button"
                onClick={handleOpenSettings}
                title="高成長企業の判定条件を設定"
              >
                ⚙️ 設定
              </button>
              
              {/* 追加: 表示中の銘柄を保存 */}
              <button 
                class="save-selected-stocks-button"
                onClick={handleSaveSelectedStocks}
                title="表示中の銘柄コードをselected-stocks.jsonに保存"
              >
                💾 表示中の銘柄を保存
              </button>
              
              {/* お気に入りクリアボタン */}
              {favoriteStockCodes.value.size > 0 && (
                <button 
                  class="clear-favorites-button"
                  onClick={() => {
                    if (confirm(`${favoriteStockCodes.value.size}銘柄のお気に入りをクリアしますか？`)) {
                      clearFavorites();
                    }
                  }}
                  title="お気に入り銘柄を全てクリア"
                >
                  🗑️ お気に入りクリア ({favoriteStockCodes.value.size})
                </button>
              )}
              
              {/* 企業選択（業績詳細時のみ） */}
              {viewMode.value === 'performance' && (
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
            {viewMode.value === 'random' ? (
              <div class="random-view">
                {randomLoading.value && (
                  <div class="random-loading">
                    <div class="spinner"></div>
                    <p>ランダム企業を取得中...</p>
                  </div>
                )}

                {randomError.value && (
                  <div class="random-error">
                    <h2>ランダム取得エラー</h2>
                    <p>{randomError.value}</p>
                    <div class="random-error-help">
                      <p>APIサーバー起動: <code>npm run api-server</code></p>
                      <p>その後にもう一度「🎲 ランダム1社」を押してください。</p>
                    </div>
                  </div>
                )}

                {!randomLoading.value && !randomError.value && randomCompany.value && (
                  <div>
                    <div class="random-card">
                      <div class="random-card-header">
                        <div class="random-title">
                          <h2>{randomCompany.value.companyName}</h2>
                          <div class="random-subtitle">
                            <span class="badge">{randomCompany.value.stockCode}</span>
                            {randomCompany.value.sectorName && (
                              <span class="muted">{randomCompany.value.sectorName}</span>
                            )}
                            {randomPickedFrom.value && (
                              <span class="muted">（source: {randomPickedFrom.value}）</span>
                            )}
                          </div>
                        </div>
                        <div class="random-actions">
                          <button class="random-refresh" onClick={fetchRandomCompany}>
                            🎲 次の1社
                          </button>
                        </div>
                      </div>

                      <div class="random-metrics">
                        <div class="metric">
                          <div class="label">現在株価</div>
                          <div class="value">{formatNumber(randomCompany.value.currentPrice, 0)}</div>
                        </div>
                        <div class="metric">
                          <div class="label">PER</div>
                          <div class="value">{formatNumber(randomCompany.value.priceEarningsRatio, 2)}</div>
                        </div>
                        <div class="metric">
                          <div class="label">PBR</div>
                          <div class="value">{formatNumber(randomCompany.value.priceBookValueRatio, 2)}</div>
                        </div>
                        <div class="metric">
                          <div class="label">配当利回り</div>
                          <div class="value">{formatNumber(randomCompany.value.dividendYield, 2)}%</div>
                        </div>
                        <div class="metric">
                          <div class="label">自己資本比率</div>
                          <div class="value">{formatNumber(randomCompany.value.equityRatio, 1)}%</div>
                        </div>
                        <div class="metric">
                          <div class="label">ROE</div>
                          <div class="value">{formatNumber(randomCompany.value.roe, 2)}</div>
                        </div>
                      </div>

                      {randomCompany.value.latestResults && (
                        <div class="random-latest">
                          <h3>最新実績</h3>
                          <div class="latest-grid">
                            <div class="kv">
                              <div class="k">期</div>
                              <div class="v">{randomCompany.value.latestResults.period}</div>
                            </div>
                            <div class="kv">
                              <div class="k">売上高</div>
                              <div class="v">{formatNumber(randomCompany.value.latestResults.netSales, 0)}</div>
                            </div>
                            <div class="kv">
                              <div class="k">営業利益</div>
                              <div class="v">{formatNumber(randomCompany.value.latestResults.operatingIncome, 0)}</div>
                            </div>
                            <div class="kv">
                              <div class="k">純利益</div>
                              <div class="v">{formatNumber(randomCompany.value.latestResults.netIncome, 0)}</div>
                            </div>
                            <div class="kv">
                              <div class="k">EPS</div>
                              <div class="v">{formatNumber(randomCompany.value.latestResults.earningsPerShare, 2)}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <PerformanceTable
                      performanceData={randomCompany.value.performanceData}
                      companyName={randomCompany.value.companyName}
                      stockCode={randomCompany.value.stockCode}
                      formatNumber={formatNumber}
                      latestPeriod={randomCompany.value.latestResults?.period}
                    />
                  </div>
                )}
              </div>
            ) : viewMode.value === 'performance' && selectedCompany() ? (
              <PerformanceTable
                performanceData={selectedCompany()!.performanceData}
                companyName={selectedCompany()!.companyName}
                stockCode={selectedCompany()!.stockCode}
                formatNumber={formatNumber}
                latestPeriod={selectedCompany()!.latestResults?.period}
              />
            ) : (
              <FinancialComparisonTable
                companies={displayCompanies.value}
                formatNumber={formatNumber}
                toggleFavorite={toggleFavorite}
                isFavorite={isFavorite}
              />
            )}
          </div>
        )}

        {!loading.value && !error.value && displayCompanies.value.length === 0 && (
          <div class="no-data">
            <h2>データが見つかりません</h2>
            <p>
              {showFavoritesOnly.value ? 'お気に入りに登録された銘柄がありません。' :
               showTrendChangeOnly.value ? '200日移動平均線より株価が上にある銘柄がありません。履歴データが不足している可能性があります。' :
               showHighGrowthOnly.value ? '高成長企業の条件を満たす企業がありません。' : 
               '企業データを取得してください。'}
            </p>
            <div class="action-buttons">
              {showFavoritesOnly.value ? (
                <button onClick={toggleFavoritesFilter}>全企業を表示</button>
              ) : showTrendChangeOnly.value ? (
                <button onClick={toggleTrendChangeFilter}>全企業を表示</button>
              ) : showHighGrowthOnly.value ? (
                <button onClick={toggleHighGrowthFilter}>全企業を表示</button>
              ) : (
                <button onClick={() => loadCompanyData()}>データを読み込む</button>
              )}
              {!showHighGrowthOnly.value && !showFavoritesOnly.value && (
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
