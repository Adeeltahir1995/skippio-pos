import type { Order } from "../../shared/contracts.js";
import { FAILURE_VENUE_ID, POS_DELAY_MS } from "./constants.js";

export type PosPayload = {
  venue: string;
  orderReference: string;
  currency: Order["currency"];
  lines: { productReference: string; quantity: number; unitPrice: number }[];
  total: number;
};
export type PosTransaction = PosPayload & { transactionReference: string };

export function toPosPayload(order: Order): PosPayload {
  return {
    venue: order.venueId,
    orderReference: order.id,
    currency: order.currency,
    lines: order.items.map((item) => ({
      productReference: item.productId,
      quantity: item.quantity,
      unitPrice: item.price,
    })),
    total: order.total,
  };
}

export interface PosAdapter {
  register(payload: PosPayload): Promise<string>;
  listTransactions(): PosTransaction[];
}

export class SimulatedPos implements PosAdapter {
  private readonly transactions = new Map<string, PosTransaction>();
  private readonly attempted = new Set<string>();

  constructor(private readonly delayMs = POS_DELAY_MS) {}

  async register(payload: PosPayload): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    const existing = this.transactions.get(payload.orderReference);
    if (existing) return existing.transactionReference;

    const firstAttempt = !this.attempted.has(payload.orderReference);
    this.attempted.add(payload.orderReference);
    if (payload.venue === FAILURE_VENUE_ID && firstAttempt) {
      throw new Error(
        "Simulated POS unavailable. No transaction accepted. Retry synchronisation.",
      );
    }

    const transactionReference = `pos_${this.transactions.size + 1}`;
    this.transactions.set(
      payload.orderReference,
      structuredClone({ ...payload, transactionReference }),
    );
    return transactionReference;
  }

  listTransactions(): PosTransaction[] {
    return structuredClone([...this.transactions.values()]);
  }
}
