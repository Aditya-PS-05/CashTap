/**
 * Programmatic Prisma mock.
 * Every model method used by the app is a vi.fn().
 */
import { vi } from "vitest";

function modelMock() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  };
}

export const prismaMock = {
  merchant: modelMock(),
  paymentLink: modelMock(),
  invoice: modelMock(),
  transaction: modelMock(),
  webhook: modelMock(),
  apiKey: modelMock(),
  device: modelMock(),
  cashtokenConfig: modelMock(),
  contractInstance: modelMock(),
  tokenIssuance: { ...modelMock(), groupBy: vi.fn() },
  receiptNFT: modelMock(),
};

export type PrismaMock = typeof prismaMock;

/** Reset every mock fn across all models */
export function resetPrismaMock() {
  for (const model of Object.values(prismaMock)) {
    for (const fn of Object.values(model)) {
      (fn as ReturnType<typeof vi.fn>).mockReset();
    }
  }
}
