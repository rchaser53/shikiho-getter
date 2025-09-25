import { defineComponent, ref, onMounted, onUnmounted } from 'vue';
import type { CompanyData } from '../types';

interface Props {
  companies: CompanyData[];
  formatNumber: (value: number | null, decimals?: number) => string;
}

export default defineComponent<Props>({
  name: 'FinancialComparisonTable',
  props: {
    companies: {
      type: Array as () => CompanyData[],
      required: true
    },
    formatNumber: {
      type: Function as unknown as () => (value: number | null, decimals?: number) => string,
      required: true
    }
  },
  setup(props) {
    const tableWrapperRef = ref<HTMLElement | null>(null);
    const scrollProgress = ref(0);
    
    // スクロール進捗の更新
    const updateScrollProgress = () => {
      if (!tableWrapperRef.value) return;
      
      const { scrollLeft, scrollWidth, clientWidth } = tableWrapperRef.value;
      const maxScroll = scrollWidth - clientWidth;
      
      if (maxScroll > 0) {
        scrollProgress.value = (scrollLeft / maxScroll) * 100;
      } else {
        scrollProgress.value = 0;
      }
    };
    
    // キーボードスクロール制御
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!tableWrapperRef.value) return;
      
      const scrollAmount = 200; // スクロール量（ピクセル）
      const fastScrollAmount = 400; // 高速スクロール量
      
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          const leftAmount = event.shiftKey ? fastScrollAmount : scrollAmount;
          tableWrapperRef.value.scrollLeft -= leftAmount;
          updateScrollProgress();
          break;
        case 'ArrowRight':
          event.preventDefault();
          const rightAmount = event.shiftKey ? fastScrollAmount : scrollAmount;
          tableWrapperRef.value.scrollLeft += rightAmount;
          updateScrollProgress();
          break;
        case 'Home':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            tableWrapperRef.value.scrollLeft = 0;
            updateScrollProgress();
          }
          break;
        case 'End':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            tableWrapperRef.value.scrollLeft = tableWrapperRef.value.scrollWidth;
            updateScrollProgress();
          }
          break;
        case 'PageLeft':
        case 'PageUp':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            tableWrapperRef.value.scrollLeft -= tableWrapperRef.value.clientWidth * 0.8;
            updateScrollProgress();
          }
          break;
        case 'PageRight':
        case 'PageDown':
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            tableWrapperRef.value.scrollLeft += tableWrapperRef.value.clientWidth * 0.8;
            updateScrollProgress();
          }
          break;
      }
    };
    
    // スクロールイベントリスナー
    const handleScroll = () => {
      updateScrollProgress();
    };
    
    onMounted(() => {
      window.addEventListener('keydown', handleKeyDown);
      if (tableWrapperRef.value) {
        tableWrapperRef.value.addEventListener('scroll', handleScroll);
        updateScrollProgress(); // 初期値設定
      }
    });
    
    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeyDown);
      if (tableWrapperRef.value) {
        tableWrapperRef.value.removeEventListener('scroll', handleScroll);
      }
    });
    const renderSectionHeader = (title: string, icon: string) => (
      <tr>
        <td colspan={props.companies.length + 1} class="section-header">
          {icon} {title}
        </td>
      </tr>
    );

    const renderMetricRow = (
      name: string, 
      getValue: (company: CompanyData) => number | null,
      decimals = 0,
      cssClass = 'number'
    ) => (
      <tr>
        <td class="metric-name">{name}</td>
        {props.companies.map(company => (
          <td key={company.companyId} class={`${cssClass} ${getValue(company) !== null && getValue(company)! < 0 ? 'negative' : ''}`}>
            {props.formatNumber(getValue(company), decimals)}
          </td>
        ))}
      </tr>
    );

    const renderTextRow = (
      name: string,
      getValue: (company: CompanyData) => string | null
    ) => (
      <tr>
        <td class="metric-name">{name}</td>
        {props.companies.map(company => (
          <td key={company.companyId} class="text-cell">
            {getValue(company) || 'N/A'}
          </td>
        ))}
      </tr>
    );

    const renderScoreRow = (
      name: string,
      getScore: (company: CompanyData) => number | null
    ) => (
      <tr>
        <td class="metric-name">{name}</td>
        {props.companies.map(company => (
          <td key={company.companyId} class="number">
            {company.tkScore && getScore(company) !== null ? `${getScore(company)}/5` : 'N/A'}
          </td>
        ))}
      </tr>
    );

    return () => (
      <div class="financial-table-container">
        <h1>📊 企業財務比較テーブル</h1>
        <div class="update-time">
          最終更新: {new Date().toLocaleString('ja-JP')}
          <div class="keyboard-help">
            <small>💡 キーボード操作: ← → スクロール | Shift+← → 高速 | Page↑↓ ページ単位 | Ctrl+Home/End 端まで</small>
          </div>
        </div>
        
        {/* スクロールプログレスインジケータ */}
        <div class="scroll-progress-container">
          <div 
            class="scroll-progress-bar"
            style={{ width: `${scrollProgress.value}%` }}
          ></div>
        </div>
        
        <div 
          class="table-wrapper" 
          ref={tableWrapperRef}
          tabindex="0"
          role="region"
          aria-label="企業財務比較テーブル - 左右矢印キーでスクロール可能"
        >
          <table class="financial-table">
            <thead>
              <tr>
                <th class="company-header">項目</th>
                {props.companies.map(company => (
                  <th key={company.companyId} class="company-header">
                    <a 
                      href={`https://shikiho.toyokeizai.net/stocks/${company.stockCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="company-link"
                      title={`${company.companyName}の四季報ページを新しいタブで開く`}
                    >
                      {company.companyName || company.companyId}
                    </a>
                    <br />
                    <small>({company.stockCode})</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* 株価情報 */}
              {renderSectionHeader('株価情報', '📈')}
              {renderMetricRow('現在株価（円）', c => c.currentPrice, 0, 'number currency')}
              {renderMetricRow('時価総額（百万円）', c => c.marketCap, 1, 'number currency')}
              {renderMetricRow('PER（倍）', c => c.priceEarningsRatio, 2)}
              {renderMetricRow('PBR（倍）', c => c.priceBookValueRatio, 2)}
              {renderMetricRow('配当利回り（%）', c => c.dividendYield, 2, 'number percentage')}

              {/* 業績情報 */}
              {renderSectionHeader('業績情報（最新実績）', '💼')}
              {renderTextRow('決算期', c => c.latestResults?.period || null)}
              {renderMetricRow('売上高（百万円）', c => c.latestResults?.netSales || null, 0, 'number currency')}
              {renderMetricRow('営業利益（百万円）', c => c.latestResults?.operatingIncome || null, 0, 'number currency')}
              {renderMetricRow('純利益（百万円）', c => c.latestResults?.netIncome || null, 0, 'number currency')}
              {renderMetricRow('1株当たり利益（円）', c => c.latestResults?.earningsPerShare || null, 1, 'number currency')}

              {/* 財務指標 */}
              {renderSectionHeader('財務指標', '🏦')}
              {renderMetricRow('自己資本比率（%）', c => c.equityRatio, 1, 'number percentage')}
              {renderMetricRow('ROE（%）', c => c.roe, 1, 'number percentage')}
              {renderMetricRow('営業利益率（%）', c => c.operatingMargin, 1, 'number percentage')}
              {renderMetricRow('純利益率（%）', c => c.netProfitMargin, 1, 'number percentage')}
              {renderMetricRow('BPS（円）', c => c.bookValuePerShare, 0, 'number currency')}

              {/* 推定財務データ */}
              {renderSectionHeader('推定財務データ', '📊')}
              {renderMetricRow('推定総資産（百万円）', c => c.estimatedTotalAssets, 0, 'number currency')}
              {renderMetricRow('推定自己資本（百万円）', c => c.estimatedEquity, 0, 'number currency')}
              {renderMetricRow('推定有利子負債（百万円）', c => c.estimatedInterestBearingDebt, 0, 'number currency')}
              {renderMetricRow('負債自己資本比率（倍）', c => c.debtToEquityRatio, 2)}

              {/* 東洋経済スコア */}
              {renderSectionHeader('東洋経済スコア', '⭐')}
              {renderScoreRow('総合スコア', c => c.tkScore?.total_score || null)}
              {renderScoreRow('収益性', c => c.tkScore?.profitability || null)}
              {renderScoreRow('成長性', c => c.tkScore?.growth_potential || null)}
              {renderScoreRow('安定性', c => c.tkScore?.stability || null)}

              {/* セクター情報 */}
              {renderSectionHeader('セクター情報', '🏢')}
              {renderTextRow('業種', c => c.sectorName)}
            </tbody>
          </table>
        </div>

        <div class="note">
          <strong>注意事項:</strong><br />
          • データは東洋経済オンライン四季報APIから取得<br />
          • 「N/A」は該当データが取得できなかったことを示します<br />
          • 金額は百万円単位で表示（時価総額、売上高、利益等）<br />
          • PER、PBRは予想ベース<br />
          • 東洋経済スコアは5段階評価<br />
          • <strong>推定財務データは計算による概算値</strong>（総資産=自己資本÷自己資本比率、有利子負債=総負債×40%と仮定）
        </div>
      </div>
    );
  }
});