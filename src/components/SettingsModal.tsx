import { defineComponent, ref, watch } from 'vue';

interface Props {
  isVisible: boolean;
  consecutiveYears: number;
  growthRatio: number;
}

interface Emits {
  (e: 'close'): void;
  (e: 'save', years: number, ratio: number): void;
}

export default defineComponent({
  name: 'SettingsModal',
  props: {
    isVisible: {
      type: Boolean,
      required: true
    },
    consecutiveYears: {
      type: Number,
      required: true
    },
    growthRatio: {
      type: Number,
      required: true
    }
  },
  emits: ['close', 'save'],
  setup(props: Props, { emit }: { emit: (event: any, ...args: any[]) => void }) {
    const localYears = ref(props.consecutiveYears);
    const localRatio = ref(props.growthRatio);

    // propsが変更されたときにローカル値を更新
    watch(() => props.consecutiveYears, (newVal) => {
      localYears.value = newVal;
    });
    
    watch(() => props.growthRatio, (newVal) => {
      localRatio.value = newVal;
    });

    const handleSave = () => {
      // バリデーション
      if (localYears.value < 1 || localYears.value > 10) {
        alert('連続増収年数は1年以上10年以下で設定してください');
        return;
      }
      
      if (localRatio.value < 1.1 || localRatio.value > 10) {
        alert('売上高成長率は1.1倍以上10倍以下で設定してください');
        return;
      }

      emit('save', localYears.value, localRatio.value);
      emit('close');
    };

    const handleCancel = () => {
      // 変更を破棄してpropsの値に戻す
      localYears.value = props.consecutiveYears;
      localRatio.value = props.growthRatio;
      emit('close');
    };

    const handleReset = () => {
      localYears.value = 4;
      localRatio.value = 2.0;
    };

    return () => {
      if (!props.isVisible) return null;

      return (
        <div class="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCancel()}>
          <div class="modal-content">
            <div class="modal-header">
              <h2>🔧 高成長企業の判定条件設定</h2>
              <button class="close-button" onClick={handleCancel}>×</button>
            </div>
            
            <div class="modal-body">
              <div class="setting-section">
                <div class="setting-item">
                  <label for="consecutive-years">
                    📈 連続増収年数
                    <span class="setting-description">何年連続で増収している企業を対象とするか</span>
                  </label>
                  <div class="input-group">
                    <input
                      id="consecutive-years"
                      type="number"
                      min="1"
                      max="10"
                      step="1"
                      v-model={localYears.value}
                      class="number-input"
                    />
                    <span class="unit">年</span>
                  </div>
                  <small class="hint">1年〜10年の範囲で設定</small>
                </div>

                <div class="setting-item">
                  <label for="growth-ratio">
                    🚀 売上高成長率
                    <span class="setting-description">設定期間での売上高の成長倍率</span>
                  </label>
                  <div class="input-group">
                    <input
                      id="growth-ratio"
                      type="number"
                      min="1.1"
                      max="10"
                      step="0.1"
                      v-model={localRatio.value}
                      class="number-input"
                    />
                    <span class="unit">倍</span>
                  </div>
                  <small class="hint">1.1倍〜10倍の範囲で設定</small>
                </div>
              </div>

              <div class="preview-section">
                <h3>📊 設定プレビュー</h3>
                <div class="preview-text">
                  <strong>{localYears.value}年連続増収</strong>で<strong>売上高{localRatio.value}倍以上</strong>の企業を高成長企業として判定します
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button class="reset-button" onClick={handleReset}>
                🔄 デフォルトに戻す
              </button>
              <div class="action-buttons">
                <button class="cancel-button" onClick={handleCancel}>
                  キャンセル
                </button>
                <button class="save-button" onClick={handleSave}>
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