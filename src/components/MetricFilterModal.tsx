import { defineComponent, ref, watch } from 'vue';
import type { MetricFilterKey, MetricFilters } from '../composables/useCompanyData';

interface Props {
  isVisible: boolean;
  filters: MetricFilters;
}

const metricDefinitions: { key: MetricFilterKey; label: string; unit: string }[] = [
  { key: 'priceEarningsRatio', label: 'PER', unit: '倍' },
  { key: 'priceBookValueRatio', label: 'PBR', unit: '倍' },
  { key: 'dividendYield', label: '配当利回り', unit: '%' },
  { key: 'equityRatio', label: '自己資本比率', unit: '%' },
  { key: 'roe', label: 'ROE', unit: '%' },
  { key: 'operatingMargin', label: '営業利益率', unit: '%' },
  { key: 'netProfitMargin', label: '純利益率', unit: '%' },
  { key: 'debtToEquityRatio', label: '負債自己資本比率', unit: '倍' }
];

const cloneFilters = (filters: MetricFilters): MetricFilters =>
  Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, { ...value }])) as MetricFilters;

export default defineComponent({
  name: 'MetricFilterModal',
  props: {
    isVisible: { type: Boolean, required: true },
    filters: { type: Object as () => MetricFilters, required: true }
  },
  emits: ['close', 'save'],
  setup(props: Props, { emit }) {
    const localFilters = ref<MetricFilters>(cloneFilters(props.filters));

    watch(() => props.filters, value => {
      localFilters.value = cloneFilters(value);
    }, { deep: true });

    const clear = () => {
      localFilters.value = cloneFilters({
        priceEarningsRatio: { min: null, max: null },
        priceBookValueRatio: { min: null, max: null },
        dividendYield: { min: null, max: null },
        equityRatio: { min: null, max: null },
        roe: { min: null, max: null },
        operatingMargin: { min: null, max: null },
        netProfitMargin: { min: null, max: null },
        debtToEquityRatio: { min: null, max: null }
      });
    };

    const close = () => {
      localFilters.value = cloneFilters(props.filters);
      emit('close');
    };

    const save = () => {
      for (const { key, label } of metricDefinitions) {
        const filter = localFilters.value[key];
        if ((filter.min !== null && !Number.isFinite(filter.min)) ||
            (filter.max !== null && !Number.isFinite(filter.max)) ||
            (filter.min !== null && filter.max !== null && filter.min > filter.max)) {
          alert(`${label}の最小値と最大値を正しく設定してください`);
          return;
        }
      }
      emit('save', cloneFilters(localFilters.value));
      emit('close');
    };

    return () => {
      if (!props.isVisible) return null;

      return (
        <div class="modal-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div class="modal-content metric-filter-modal">
            <div class="modal-header">
              <h2>🔎 指標フィルタ設定</h2>
              <button class="close-button" onClick={close}>×</button>
            </div>
            <div class="modal-body">
              <p class="metric-filter-help">空欄は条件なし。最小値・最大値を指定すると、既存のフィルタとAND条件で絞り込みます。</p>
              <div class="metric-filter-list">
                {metricDefinitions.map(({ key, label, unit }) => (
                  <div class="metric-filter-row" key={key}>
                    <label>{label}（{unit}）</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="最小"
                      value={localFilters.value[key].min ?? ''}
                      onInput={(e) => {
                        const value = (e.target as HTMLInputElement).value;
                        localFilters.value[key].min = value === '' ? null : Number(value);
                      }}
                    />
                    <span>〜</span>
                    <input
                      type="number"
                      step="any"
                      placeholder="最大"
                      value={localFilters.value[key].max ?? ''}
                      onInput={(e) => {
                        const value = (e.target as HTMLInputElement).value;
                        localFilters.value[key].max = value === '' ? null : Number(value);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div class="modal-footer">
              <button class="reset-button" onClick={clear}>🧹 条件をクリア</button>
              <div class="action-buttons">
                <button class="cancel-button" onClick={close}>キャンセル</button>
                <button class="save-button" onClick={save}>
                  💾 設定を保存
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    };
  }
});
