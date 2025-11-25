import { AuditStatus } from './types';

export function calculateStatus(successRate: number): AuditStatus {
  if (successRate >= 0.95) return 'ok';
  if (successRate >= 0.80) return 'fail';
  return 'error';
}

export function roundToDecimals(value: number, decimals: number = 3): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function getCorsHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
  };
}

