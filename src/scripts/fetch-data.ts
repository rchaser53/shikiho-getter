#!/usr/bin/env tsx
import { fetchAllCompanyData } from '../services/dataFetcher.js';

// スクリプトとして実行
fetchAllCompanyData()
  .then(() => {
    console.log('データ取得完了');
    process.exit(0);
  })
  .catch(error => {
    console.error('データ取得エラー:', error);
    process.exit(1);
  });