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

/**
 * Representa una auditoría/ruta devuelta por la API web de Winking Owl
 * (GET /route-service/route). En esta primera versión solo usamos id y name,
 * pero definimos la interfaz mínima para poder tipar la integración.
 */
export interface WebRouteAudit {
  id: string;
  name: string;
  isInTracking?: boolean;
  // Campos adicionales de la API web que no usamos todavía
  [key: string]: unknown;
}

/**
 * Datos de un período de tiempo con muestras y fallos
 * Permite calcular successRate = (samples - failures) / samples
 * y failureRate = failures / samples
 */
export interface PeriodData {
  timestamp: string; // ISO 8601 timestamp (UTC), inicio del período
  samples: number;   // Número total de ejecuciones/muestras en el período
  failures: number;  // Número de fallos en el período
}

/**
 * @deprecated Usar PeriodData en su lugar. Mantenido para compatibilidad temporal.
 */
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

