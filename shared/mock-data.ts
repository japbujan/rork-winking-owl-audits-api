import { MockAuditBase } from './types';

// Datos base predefinidos para generación mock
export const MOCK_AUDITS_BASE: MockAuditBase[] = [
  { id: 'a1', name: 'Checkout Web', baseSuccessRate: 0.972, baseExecutions: 842, baseFailures: 23 },
  { id: 'a2', name: 'Onboarding App', baseSuccessRate: 0.741, baseExecutions: 590, baseFailures: 153 },
  { id: 'a3', name: 'Payment Flow', baseSuccessRate: 0.988, baseExecutions: 1250, baseFailures: 15 },
  { id: 'a4', name: 'User Profile', baseSuccessRate: 0.956, baseExecutions: 720, baseFailures: 32 },
  { id: 'a5', name: 'Search API', baseSuccessRate: 0.812, baseExecutions: 450, baseFailures: 85 },
  { id: 'a6', name: 'Auth Service', baseSuccessRate: 0.998, baseExecutions: 2100, baseFailures: 4 },
  { id: 'a7', name: 'Notification System', baseSuccessRate: 0.923, baseExecutions: 890, baseFailures: 69 },
  { id: 'a8', name: 'Data Export', baseSuccessRate: 0.654, baseExecutions: 320, baseFailures: 111 },
];

export const BASE_SUCCESS_RATES: Record<string, number> = {
  a1: 0.972,
  a2: 0.741,
  a3: 0.988,
  a4: 0.956,
  a5: 0.812,
  a6: 0.998,
  a7: 0.923,
  a8: 0.654,
};

