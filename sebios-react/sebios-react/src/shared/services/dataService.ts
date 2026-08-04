import { NIVESH_DATA } from '../data/niveshData';

// Types
export type User = typeof NIVESH_DATA.users[0];
export type Holding = typeof NIVESH_DATA.users[0]['holdings'][0];
export type Account = typeof NIVESH_DATA.users[0]['accounts'][0];
export type Product = typeof NIVESH_DATA.products[0];
export type Lesson = typeof NIVESH_DATA.lessons[0];
export type RiskQuizQuestion = typeof NIVESH_DATA.riskQuiz[0];
export type SuitabilityQuestion = typeof NIVESH_DATA.suitabilityAssessment[0];
export type GlossaryItem = typeof NIVESH_DATA.glossary[0];

// Date constants
export const NIVESH_DATES = NIVESH_DATA.NIVESH_DATES;

// Data access functions
export const getUserById = (id: string): User | undefined => {
  return NIVESH_DATA.users.find(user => user.id === id);
};

export const getUsers = (): User[] => {
  return NIVESH_DATA.users;
};

export const getProducts = (): Product[] => {
  return NIVESH_DATA.products;
};

export const getProductsByCategory = (category: string): Product[] => {
  return NIVESH_DATA.products.filter(product => product.category === category);
};

export const getProductById = (id: string): Product | undefined => {
  return NIVESH_DATA.products.find(product => product.id === id);
};

export const getLessons = (): Lesson[] => {
  return NIVESH_DATA.lessons;
};

export const getLessonById = (id: string): Lesson | undefined => {
  return NIVESH_DATA.lessons.find(lesson => lesson.id === id);
};

export const getRiskQuiz = (): RiskQuizQuestion[] => {
  return NIVESH_DATA.riskQuiz;
};

export const getSuitabilityAssessment = (): SuitabilityQuestion[] => {
  return NIVESH_DATA.suitabilityAssessment;
};

export const getGlossary = (): GlossaryItem[] => {
  return NIVESH_DATA.glossary;
};

// Utility functions
export const calculateNetWorth = (holdings: Holding[]): number => {
  return holdings.reduce((total, holding) => {
    const value = (holding.qty || 0) * (holding.ltp || 0);
    return total + value;
  }, 0);
};

export const calculateMarketValue = (holdings: Holding[]): number => {
  return holdings
    .filter(h => h.assetClass !== 'cash')
    .reduce((total, holding) => {
      const value = (holding.qty || 0) * (holding.ltp || 0);
      return total + value;
    }, 0);
};

export const calculateInvestedAmount = (holdings: Holding[]): number => {
  return holdings
    .filter(h => h.assetClass !== 'cash')
    .reduce((total, holding) => {
      const invested = (holding.qty || 0) * (holding.avgPrice || 0);
      return total + invested;
    }, 0);
};

export const calculateDayChange = (holdings: Holding[]): number => {
  return holdings
    .filter(h => h.assetClass !== 'cash')
    .reduce((total, holding) => {
      const value = (holding.qty || 0) * (holding.ltp || 0);
      const change = value * ((holding.dayChangePct || 0) / 100);
      return total + change;
    }, 0);
};

export const calculateAssetAllocation = (holdings: Holding[]) => {
  const assetClasses = ['equity', 'mf', 'reit', 'invit', 'bond', 'etf', 'cash'] as const;
  const totalValue = calculateNetWorth(holdings);
  
  if (totalValue === 0) {
    return assetClasses.map(assetClass => ({
      assetClass,
      value: 0,
      percentage: 0
    }));
  }
  
  return assetClasses.map(assetClass => {
    const value = holdings
      .filter(h => h.assetClass === assetClass)
      .reduce((sum, holding) => sum + (holding.qty || 0) * (holding.ltp || 0), 0);
    
    return {
      assetClass,
      value,
      percentage: (value / totalValue) * 100
    };
  }).filter(item => item.value > 0);
};

export const calculateSectorExposure = (holdings: Holding[]) => {
  const marketValue = calculateMarketValue(holdings);
  
  if (marketValue === 0) return [];
  
  const sectorMap: Record<string, number> = {};
  
  holdings.forEach(holding => {
    if (holding.assetClass !== 'cash') {
      const value = (holding.qty || 0) * (holding.ltp || 0);
      sectorMap[holding.sector || 'Other'] = (sectorMap[holding.sector || 'Other'] || 0) + value;
    }
  });
  
  return Object.entries(sectorMap)
    .map(([sector, value]) => ({
      sector,
      value,
      percentage: (value / marketValue) * 100
    }))
    .sort((a, b) => b.value - a.value);
};

export const calculateFinancialsPercentage = (holdings: Holding[]): number => {
  const marketValue = calculateMarketValue(holdings);
  if (marketValue === 0) return 0;
  
  const financialsValue = holdings
    .filter(h => h.assetClass !== 'cash' && h.sector === 'Financials')
    .reduce((sum, holding) => sum + (holding.qty || 0) * (holding.ltp || 0), 0);
  
  return (financialsValue / marketValue) * 100;
};

export const calculateTopIssuerPercentage = (holdings: Holding[]): { name: string; percentage: number } => {
  const marketValue = calculateMarketValue(holdings);
  if (marketValue === 0) return { name: '—', percentage: 0 };
  
  const issuerMap: Record<string, { name: string; value: number }> = {};
  
  holdings.forEach(holding => {
    if (holding.assetClass !== 'cash') {
      const value = (holding.qty || 0) * (holding.ltp || 0);
      if (!issuerMap[holding.symbol] || value > issuerMap[holding.symbol].value) {
        issuerMap[holding.symbol] = { name: holding.name, value };
      } else {
        issuerMap[holding.symbol].value += value;
      }
    }
  });
  
  const topIssuer = Object.values(issuerMap).reduce((max, current) => 
    current.value > max.value ? current : max, 
    { name: '—', value: 0 }
  );
  
  return {
    name: topIssuer.name,
    percentage: (topIssuer.value / marketValue) * 100
  };
};

export const calculateDaysChangePercentage = (holdings: Holding[]): number => {
  const marketValue = calculateMarketValue(holdings);
  if (marketValue === 0) return 0;
  
  const dayChange = calculateDayChange(holdings);
  return (dayChange / marketValue) * 100;
};

export const calculateThirtyDayChangePercentage = (history: any[]): number => {
  if (history.length < 2) return 0;
  
  const start = history[0].v;
  const end = history[history.length - 1].v;
  
  return ((end - start) / start) * 100;
};

// Risk calculation
export const calculateRiskScoreFromQuiz = (answers: number[]): number => {
  // Sum of weights (1-4) for each question
  const total = answers.reduce((sum, score) => sum + score, 0);
  // Convert from range 6-24 to 0-100
  return Math.round(((total - 6) / (24 - 6)) * 100);
};

export const calculateRiskLevel = (score: number): 'conservative' | 'balanced' | 'aggressive' => {
  if (score <= 33) return 'conservative';
  if (score <= 66) return 'balanced';
  return 'aggressive';
};

export const scoreToGauge = (rawScore: number): number => {
  // riskQuiz raw score range 6..24 → 0..100
  const min = 6;
  const max = 24;
  return Math.round(((rawScore - min) / (max - min)) * 100);
};

// Health score calculation (simplified version)
export const calculateHealthScore = (holdings: Holding[]): number => {
  // This is a simplified version - the original is more complex
  const financialsPct = calculateFinancialsPercentage(holdings);
  const topIssuer = calculateTopIssuerPercentage(holdings);
  
  // Simplified scoring (0-100)
  let score = 100;
  
  // Penalize high financials concentration
  if (financialsPct > 30) score -= 25;
  else if (financialsPct > 20) score -= 15;
  else if (financialsPct > 10) score -= 5;
  
  // Penalize high single issuer concentration
  if (topIssuer.percentage > 25) score -= 20;
  else if (topIssuer.percentage > 15) score -= 10;
  else if (topIssuer.percentage > 10) score -= 5;
  
  return Math.max(0, Math.min(100, score));
};

export const getHealthGrade = (score: number): { label: string; status: 'good' | 'warn' | 'serious' } => {
  if (score >= 80) return { label: 'Strong', status: 'good' };
  if (score >= 60) return { label: 'Fair', status: 'warn' };
  return { label: 'Needs attention', status: 'serious' };
};

// Filter functions
export const getRegisteredProducts = (): Product[] => {
  return NIVESH_DATA.products.filter(product => product.registered);
};

export const getUnregisteredProducts = (): Product[] => {
  return NIVESH_DATA.products.filter(product => !product.registered);
};

export default {
  // Data
  NIVESH_DATA,
  NIVESH_DATES,
  
  // Accessors
  getUserById,
  getUsers,
  getProducts,
  getProductsByCategory,
  getProductById,
  getLessons,
  getLessonById,
  getRiskQuiz,
  getSuitabilityAssessment,
  getGlossary,
  
  // Calculations
  calculateNetWorth,
  calculateMarketValue,
  calculateInvestedAmount,
  calculateDayChange,
  calculateAssetAllocation,
  calculateSectorExposure,
  calculateFinancialsPercentage,
  calculateTopIssuerPercentage,
  calculateDaysChangePercentage,
  calculateThirtyDayChangePercentage,
  calculateRiskScoreFromQuiz,
  calculateRiskLevel,
  scoreToGauge,
  calculateHealthScore,
  getHealthGrade,
  
  // Filters
  getRegisteredProducts,
  getUnregisteredProducts
};
