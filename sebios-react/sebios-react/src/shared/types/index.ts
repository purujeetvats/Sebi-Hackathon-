// Core data types
export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  pan: string;
  avatar: string;
  persona: string;
  seed: UserSeed;
  accounts: Account[];
  holdings: Holding[];
}

export interface UserSeed {
  onboarded: boolean;
  riskProfile: RiskProfile | null;
  riskScore: number | null;
  completedLessons: string[];
}

export interface Account {
  id: string;
  broker: string;
  depository: string;
  type: string;
  lastSync: string;
}

export interface Holding {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  sector: string;
  qty: number;
  avgPrice: number;
  ltp: number; // Last Traded Price
  dayChangePct: number;
  schemeCode?: number;
  underlying?: UnderlyingAsset[];
}

export interface UnderlyingAsset {
  symbol: string;
  name: string;
  weight: number;
}

export type AssetClass = 'equity' | 'mf' | 'reit' | 'invit' | 'bond' | 'etf' | 'cash' | 'scam';
export type RiskProfile = 'conservative' | 'balanced' | 'aggressive';
export type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Product {
  id: string;
  name: string;
  category: string;
  assetClass: AssetClass;
  quoteSym?: string;
  schemeCode?: number;
  riskGrade: RiskGrade;
  liquidity: string;
  complexity: number;
  minInvest: number;
  price: number;
  yieldOrReturn?: string;
  issuerRating: string;
  registered: boolean;
  requiredLesson?: string;
  minTier?: RiskProfile;
  blurb: string;
}

export interface Broker {
  id: string;
  name: string;
  platform: string;
  color: string;
  mark: string;
  host: string;
  desc: string;
  supports: AssetClass[];
}

export interface Lesson {
  id: string;
  title: string;
  emoji: string;
  minutes: number;
  sections: Section[];
  quiz: QuizQuestion[];
}

export interface Section {
  h: string;
  p: string;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number; // index of correct answer
}

export interface RiskQuizQuestion {
  q: string;
  options: { t: string; w: number }[];
}

export interface SuitabilityAssessmentQuestion {
  id: string;
  label: string;
  field: 'capacity' | 'tolerance';
  options: { t: string; v: number }[];
}

export interface GlossaryItem {
  term: string;
  def: string;
}

export interface IsinMap {
  [key: string]: {
    symbol: string;
    name: string;
    assetClass: AssetClass;
    sector: string;
  };
}

// State types
export interface AppState {
  onboarded: boolean;
  theme: 'light' | 'dark';
  riskProfile: RiskProfile | null;
  riskScore: number | null;
  completedLessons: string[];
  purchases: Holding[];
  consents: string[];
  auditTrail: AuditEntry[];
  assessment: SuitabilityAssessmentResult | null;
  importedHoldings: Holding[];
  goals: Goal[];
  alertConfig: AlertConfig;
  alertsRead: string[];
  alertLog: AlertEvent[];
}

export interface AuditEntry {
  ts: string;
  kind: string;
  text: string;
}

export interface SuitabilityAssessmentResult {
  capacity: number;
  tolerance: number;
  riskScore: number;
  riskProfile: RiskProfile;
}

export interface AlertConfig {
  dropPct: number;
  concentrationPct: number;
  movePct: number;
}

export interface AlertEvent {
  id: string;
  type: string;
  level: 'serious' | 'warn' | 'info';
  title: string;
}

export interface Goal {
  id: string;
  target: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  monthlySip: number;
  currentAmount: number;
  assetAllocation: AssetAllocation[];
}

export interface AssetAllocation {
  assetClass: AssetClass;
  percentage: number;
}

// UI Component Props
export interface StatTileProps {
  label: string;
  value: number | string;
  prefix?: string;
  deltaText?: string;
  deltaDirection?: 'positive' | 'negative' | 'neutral';
}

export interface HealthFactorProps {
  label: string;
  points: number;
  max: number;
  link?: string;
  note?: string;
}

export interface NavItemProps {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  onClick?: () => void;
}

export interface PanelHeaderProps {
  title: string;
  subtitle?: string;
}

export interface ChartTooltipProps {
  position: { x: number; y: number };
  html: string;
}
