import type {
  OrderRecord,
  Refund,
  PaymentEventResult,
} from "../../shared/contracts.js";
import { HttpError } from "./errors.js";
import { paymentEventSchema } from "./validation.js";
import { hasSameOrderData } from "./order-utils.js";
import { toPosPayload, type PosAdapter } from "./pos.js";

export class OrderService {
  private readonly orders = new Map<string, OrderRecord>();
  private readonly eventOrders = new Map<string, string>();
  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly refunds = new Map<string, Refund>();

  constructor(private readonly pos: PosAdapter) {}

  async receivePayment(input: unknown): Promise<PaymentEventResult> {
    const event = paymentEventSchema.parse(input);
    const previousOrderId = this.eventOrders.get(event.eventId);
    if (previousOrderId !== undefined && previousOrderId !== event.order.id) {
      throw new HttpError(409, "Event ID already belongs to another order");
    }

    const existing = this.orders.get(event.order.id);
    if (existing) {
      if (!hasSameOrderData(existing, event.order)) {
        throw new HttpError(409, "Order ID already exists with different data");
      }
      this.eventOrders.set(event.eventId, event.order.id);
      await this.inFlight.get(existing.id);
      return { duplicate: true, order: this.get(existing.id) };
    }

    this.eventOrders.set(event.eventId, event.order.id);
    this.orders.set(event.order.id, {
      ...event.order,
      paymentStatus: "paid",
      pos: { status: "syncing", attempts: 0 },
      refund: null,
    });
    await this.sync(event.order.id);
    return { duplicate: false, order: this.get(event.order.id) };
  }

  get(orderId: string): OrderRecord {
    return structuredClone(this.requireOrder(orderId));
  }

  async sync(orderId: string): Promise<OrderRecord> {
    const order = this.requireOrder(orderId);
    if (order.pos.status === "synced") return this.get(orderId);

    const active = this.inFlight.get(orderId);
    if (active) {
      await active;
      return this.get(orderId);
    }

    order.pos = { status: "syncing", attempts: order.pos.attempts + 1 };
    const attempt = Promise.resolve().then(async () => {
      try {
        const transactionReference = await this.pos.register(
          toPosPayload(order),
        );
        order.pos = {
          status: "synced",
          attempts: order.pos.attempts,
          transactionReference,
        };
      } catch (error) {
        order.pos = {
          status: "failed",
          attempts: order.pos.attempts,
          error:
            error instanceof Error
              ? error.message
              : "POS synchronisation failed",
        };
      }
    });
    this.inFlight.set(orderId, attempt);
    try {
      await attempt;
    } finally {
      this.inFlight.delete(orderId);
    }
    return this.get(orderId);
  }

  refund(orderId: string): OrderRecord {
    const order = this.requireOrder(orderId);
    if (order.refund) return this.get(orderId);
    if (order.pos.status !== "synced") {
      throw new HttpError(
        409,
        "Only a paid order synchronised with the POS can be refunded",
      );
    }
    const refund: Refund = {
      status: "refunded",
      amount: order.total,
      reference: `refund_${this.refunds.size + 1}`,
    };
    this.refunds.set(orderId, refund);
    order.refund = refund;
    return this.get(orderId);
  }

  listRefunds(): Refund[] {
    return structuredClone([...this.refunds.values()]);
  }

  private requireOrder(orderId: string): OrderRecord {
    const order = this.orders.get(orderId);
    if (!order) throw new HttpError(404, "Order not found");
    return order;
  }
}
