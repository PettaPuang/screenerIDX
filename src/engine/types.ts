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
}

export interface WeeklyCandidate {
  ticker: string;
  price: number;
  score: number;
  adv20: number;
  atrPct: number;
  sma20: number;
  sma50: number;
  nearestSupport: number;
  distanceToSupportPct: number;
  confluence: number;
  reasons: string[];
}
