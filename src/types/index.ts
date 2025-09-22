export interface TkScore {
  profitability: number;
  growth_potential: number;
  reasonability: number;
  market_size: number;
  total_score: number;
  increase: number;
  stability: number;
}

export interface LatestResults {
  period: string;
  consolidatedType?: string;
  accountingStandards?: string;
  netSales: number | null;
  operatingIncome: number | null;
  ordinaryIncome?: number | null;
  preTaxIncome?: number | null;
  netIncome: number | null;
  earningsPerShare: number | null;
  dividendPerShare?: number | null;
  pubDate?: string;
}

// 業績データ行の型定義
export interface PerformanceRow {
  period: string;
  netSales: number | null;
  operatingIncome: number | null;
  preTaxIncome: number | null;
  netIncome: number | null;
  earningsPerShare: number | null;
  dividendPerShare: number | null;
  isActual: boolean; // 実績か予想か
  isForecast: boolean; // 予想フラグ
  isQuarterly: boolean; // 四半期データか
}

export interface CompanyData {
  companyId: string;
  companyName: string;
  stockCode: string;
  isExist: string;
  error?: string;
  
  // 株価情報
  currentPrice: number | null;
  marketCap: number | null;
  minimumPurchaseAmount: number | null;
  tradingUnit: string | null;
  
  // 株価指標
  priceEarningsRatio: number | null;
  priceBookValueRatio: number | null;
  dividendYield: number | null;
  bookValuePerShare: number | null;
  
  // 年高値・安値
  yearHigh: number | null;
  yearLow: number | null;
  yearHighDate: number | null;
  yearLowDate: number | null;
  
  // 業績情報
  latestResults: LatestResults | null;
  performanceData: PerformanceRow[]; // 業績データ配列を追加
  
  // 財務指標
  equityRatio: number | null; // 自己資本比率（%）
  roe: number | null; // 自己資本利益率
  operatingMargin: number | null; // 営業利益率（%）
  netProfitMargin: number | null; // 純利益率（%）
  estimatedTotalAssets: number | null; // 推定総資産（百万円）
  estimatedEquity: number | null; // 推定自己資本（百万円）
  estimatedInterestBearingDebt: number | null; // 推定有利子負債（百万円）
  debtToEquityRatio: number | null; // 負債自己資本比率
  
  // セクター情報
  sector: string | null;
  sectorName: string | null;
  
  // 東洋経済スコア
  tkScore: TkScore | null;
  
  // その他
  tradingValue: number | null; // 売買代金
  turnover: number | null; // 出来高
  treasuryStockRatio: number | null; // 自己株式比率
  
  // メタ情報
  updatedAt: string;
  shimenPubDate?: string;
  maxModifiedDate?: string;
  year?: string;
  season?: string;
  seasonName?: string;
}

export interface CompaniesData {
  timestamp: string;
  totalCompanies: number;
  companies: CompanyData[];
}

export interface Config {
  companyIds: string[];
  outputFile: string;
  requestInterval: number;
}