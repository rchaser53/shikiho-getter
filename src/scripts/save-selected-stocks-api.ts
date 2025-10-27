import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

const SELECTED_STOCKS_PATH = path.resolve(__dirname, '../../output/selected-stocks.json');

app.use(cors());
app.use(express.json());

// 選択銘柄を保存
app.post('/api/save-selected-stocks', (req, res) => {
  try {
    const stockCodes = req.body;
    
    if (!Array.isArray(stockCodes)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    fs.writeFileSync(SELECTED_STOCKS_PATH, JSON.stringify(stockCodes, null, 2), 'utf-8');
    console.log(`✅ ${stockCodes.length}銘柄を保存しました: ${SELECTED_STOCKS_PATH}`);
    
    res.json({ success: true, count: stockCodes.length });
  } catch (error) {
    console.error('保存エラー:', error);
    res.status(500).json({ error: 'Failed to save' });
  }
});

// 選択銘柄を取得
app.get('/api/selected-stocks', (req, res) => {
  try {
    if (!fs.existsSync(SELECTED_STOCKS_PATH)) {
      return res.json([]);
    }
    
    const data = JSON.parse(fs.readFileSync(SELECTED_STOCKS_PATH, 'utf-8'));
    res.json(data);
  } catch (error) {
    console.error('読み込みエラー:', error);
    res.status(500).json({ error: 'Failed to load' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 選択銘柄保存APIサーバー起動: http://localhost:${PORT}`);
});
