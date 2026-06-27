export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  t: number;
}

export interface Pivots {
  R3: number;
  R2: number;
  R1: number;
  PP: number;
  S1: number;
  S2: number;
  S3: number;
}

export interface Signal {
  ticker: string;
  price: number;
  entry: number;
  stop: number;
  target: number;
  rr: number;
  riskPct: number;
  targetPct: number;
  lots: number;
  rsi: number;
  divergence: boolean;
  confluence: number;
  score: number;
  nearestSupport: number;
  nearestResistance: number;
  biasHTF: string;
  triggers: string[];
  cmf: number;
  volRatio: number;
  pivots: Pivots | null;
}

export interface TickerScan {
  ticker: string;
  price: number;
  rsi: number | null;
  sma20: number | null;
  sma50: number | null;
  nearestSupport: number | null;
  nearestResistance: number | null;
  distToSupportPct: number | null;
  distToResistancePct: number | null;
  swingSupports: number[];
  swingResistances: number[];
  pivots: Pivots | null;
  rejectReason: string | null;
  hasSignal: boolean;
}

export interface WeeklyCandidate {
  ticker: string;
  name?: string | null;
  price: number;
  score: number;
  adv20: number;
  atrPct: number;
  sma20: number;
  sma50: number;
  nearestSupport: number;
  distanceToSupportPct: number;
  confluence: number;
  swingSupports: number[];
  swingResistances: number[];
  reasons: string[];
}
