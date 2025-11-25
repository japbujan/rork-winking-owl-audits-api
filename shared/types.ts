export type AuditStatus = 'ok' | 'fail' | 'error';
export type TimeRange = '1H' | '1D' | '1W' | '1M' | '3M' | '1Y';

export interface Audit {
  id: string;
  name: string;
  status: AuditStatus;
  successRate: number;
  executions: number;
  failures: number;
  lastUpdate: string;
}

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  failures: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp?: string;
}

export interface MockAuditBase {
  id: string;
  name: string;
  baseSuccessRate: number;
  baseExecutions: number;
  baseFailures: number;
}

