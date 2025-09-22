import { defineComponent } from 'vue';
import type { PerformanceRow } from '../types';

interface Props {
  performanceData: PerformanceRow[];
  companyName: string;
  formatNumber: (value: number | null, decimals?: number) => string;
}

export default defineComponent<Props>({
  name: 'PerformanceTable',
  props: {
    performanceData: {
      type: Array as () => PerformanceRow[],
      required: true
    },
    companyName: {
      type: String,
      required: true
    },
    formatNumber: {
      type: Function as unknown as () => (value: number | null, decimals?: number) => string,
      required: true
    }
  },
  setup(props) {
    // データを年度別・四半期別にソート
    const sortedData = props.performanceData.sort((a, b) => {
      // 予想データは下に
      if (a.isForecast !== b.isForecast) {
        return a.isForecast ? 1 : -1;
      }
      
      // 期間順でソート（新しい順）
      return b.period.localeCompare(a.period);
    });

    const renderPeriodCell = (period: string, isActual: boolean, isForecast: boolean) => {
      const className = `period-cell ${isForecast ? 'forecast' : 'actual'}`;
      return (
        <td class={className}>
          {period}
          {isForecast && <small class="forecast-badge">予</small>}
        </td>
      );
    };

    const renderValueCell = (value: number | null, isRevenue = false) => {
      const formattedValue = props.formatNumber(value, 0);
      const className = `value-cell ${isRevenue ? 'revenue' : 'profit'} ${value !== null && value < 0 ? 'negative' : ''}`;
      
      return (
        <td class={className}>
          {formattedValue}
        </td>
      );
    };

    return () => (
      <div class="performance-table-container">
        <h2>📊 {props.companyName} - 業績推移</h2>
        
        <div class="table-wrapper">
          <table class="performance-table">
            <thead>
              <tr>
                <th class="period-header">決算期</th>
                <th class="value-header">売上高</th>
                <th class="value-header">営業利益</th>
                <th class="value-header">税前利益</th>
                <th class="value-header">純利益</th>
                <th class="value-header">1株益<br/><small>(円)</small></th>
                <th class="value-header">1株配<br/><small>(円)</small></th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, index) => (
                <tr key={`${row.period}-${index}`} class={row.isForecast ? 'forecast-row' : 'actual-row'}>
                  {renderPeriodCell(row.period, row.isActual, row.isForecast)}
                  {renderValueCell(row.netSales, true)}
                  {renderValueCell(row.operatingIncome)}
                  {renderValueCell(row.preTaxIncome)}
                  {renderValueCell(row.netIncome)}
                  <td class="value-cell eps">
                    {props.formatNumber(row.earningsPerShare, 1)}
                  </td>
                  <td class="value-cell dividend">
                    {props.formatNumber(row.dividendPerShare, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div class="performance-note">
          <strong>注意:</strong><br/>
          • 売上高・利益は百万円単位<br/>
          • 1株益・1株配は円単位<br/>
          • 「予」マークは予想値を示します<br/>
          • 「N/A」は該当データが取得できなかったことを示します
        </div>
      </div>
    );
  }
});