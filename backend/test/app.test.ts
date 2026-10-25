import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { PaymentEvent, Order } from "../../shared/contracts.js";
import { SimulatedPos, type PosPayload } from "../src/pos.js";

type UncheckedPaymentEvent = Omit<PaymentEvent, "type" | "order"> & {
  type: string;
  order: Omit<Order, "currency"> & { currency: string };
};

function event(overrides: Partial<PaymentEvent> = {}): PaymentEvent {
  return {
    eventId: "evt_001",
    type: "payment.succeeded",
    order: {
      id: "ord_001",
      venueId: "venue_001",
      currency: "EUR",
      items: [
        { productId: "burger", quantity: 2, price: 1200 },
        { productId: "water", quantity: 1, price: 250 },
      ],
      total: 2650,
    },
    ...overrides,
  };
}

function setup() {
  return createApp(new SimulatedPos(0));
}

class GatedPos extends SimulatedPos {
  calls = 0;
  private releaseGate!: () => void;
  private readonly gate = new Promise<void>((resolve) => {
    this.releaseGate = resolve;
  });
  override async register(payload: PosPayload) {
    this.calls += 1;
    await this.gate;
    return super.register(payload);
  }
  release() {
    this.releaseGate();
  }
}

describe("payment → order → POS HTTP flow", () => {
  it("records payment, maps all POS fields and creates one independent transaction", async () => {
    const { app } = setup();
    const result = await request(app)
      .post("/payment-events")
      .send(event())
      .expect(201);
    expect(result.body).toMatchObject({
      duplicate: false,
      order: {
        ...event().order,
        paymentStatus: "paid",
        refund: null,
        pos: { status: "synced", attempts: 1, transactionReference: "pos_1" },
      },
    });
    const ledger = await request(app).get("/pos-transactions").expect(200);
    expect(ledger.body).toEqual([
      {
        venue: "venue_001",
        orderReference: "ord_001",
        currency: "EUR",
        total: 2650,
        lines: [
          { productReference: "burger", quantity: 2, unitPrice: 1200 },
          { productReference: "water", quantity: 1, unitPrice: 250 },
        ],
        transactionReference: "pos_1",
      },
    ]);
    expect(
      (await request(app).get("/orders/ord_001").expect(200)).body,
    ).toEqual(result.body.order);
  });

  it("deduplicates both the same event and different event IDs for one order", async () => {
    const { app, pos } = setup();
    const initial = await request(app)
      .post("/payment-events")
      .send(event())
      .expect(201);
    for (const eventId of ["evt_001", "evt_002", "evt_003"]) {
      const duplicate = await request(app)
        .post("/payment-events")
        .send(event({ eventId }))
        .expect(200);
      expect(duplicate.body).toEqual({
        duplicate: true,
        order: initial.body.order,
      });
    }
    expect(pos.listTransactions()).toHaveLength(1);
  });

  it("coalesces overlapping payment and sync requests while the fake POS call is pending", async () => {
    const pos = new GatedPos(0);
    const { app, orders } = createApp(pos);
    const receive = vi.spyOn(orders, "receivePayment");
    const sync = vi.spyOn(orders, "sync");
    const first = request(app)
      .post("/payment-events")
      .send(event())
      .then((result) => result);
    await vi.waitFor(() => expect(pos.calls).toBe(1));
    const duplicate = request(app)
      .post("/payment-events")
      .send(event({ eventId: "evt_other" }))
      .then((result) => result);
    const sameEvent = request(app)
      .post("/payment-events")
      .send(event())
      .then((result) => result);
    const retry = request(app)
      .post("/orders/ord_001/sync")
      .then((result) => result);
    try {
      await vi.waitFor(() => {
        expect(receive).toHaveBeenCalledTimes(3);
        expect(sync).toHaveBeenCalledTimes(2);
      });
      const pending = await request(app).get("/orders/ord_001").expect(200);
      expect(pending.body.pos).toEqual({ status: "syncing", attempts: 1 });
      expect(pos.calls).toBe(1);
      expect(pos.listTransactions()).toHaveLength(0);
      await request(app).post("/orders/ord_001/refund").expect(409);
    } finally {
      pos.release();
    }
    const responses = await Promise.all([first, duplicate, sameEvent, retry]);
    expect(responses.map((response) => response.status)).toEqual([
      201, 200, 200, 200,
    ]);
    for (const response of responses) {
      expect((response.body.order ?? response.body).pos).toEqual({
        status: "synced",
        attempts: 1,
        transactionReference: "pos_1",
      });
    }
    expect(pos.calls).toBe(1);
    expect(pos.listTransactions()).toHaveLength(1);
  });

  it("preserves payment on deterministic failure, retries once and ignores later sync requests", async () => {
    const { app, pos } = setup();
    const input = event();
    input.order.venueId = "venue_fail_once";
    const failed = await request(app)
      .post("/payment-events")
      .send(input)
      .expect(201);
    expect(failed.body.order).toMatchObject({
      paymentStatus: "paid",
      pos: { status: "failed", attempts: 1 },
    });
    expect(pos.listTransactions()).toEqual([]);
    const duplicate = await request(app)
      .post("/payment-events")
      .send({ ...input, eventId: "evt_duplicate" })
      .expect(200);
    expect(duplicate.body.order).toEqual(failed.body.order);
    await request(app).post("/orders/ord_001/refund").expect(409);
    const recovered = await request(app)
      .post("/orders/ord_001/sync")
      .expect(200);
    expect(recovered.body).toMatchObject({
      paymentStatus: "paid",
      pos: { status: "synced", attempts: 2, transactionReference: "pos_1" },
    });
    const again = await request(app).post("/orders/ord_001/sync").expect(200);
    expect(again.body).toEqual(recovered.body);
    expect(pos.listTransactions()).toHaveLength(1);
  });

  it("coalesces concurrent retries after failure into one additional POS attempt", async () => {
    const pos = new SimulatedPos(10);
    const { app } = createApp(pos);
    const input = event();
    input.order.venueId = "venue_fail_once";
    await request(app).post("/payment-events").send(input).expect(201);
    const register = vi.spyOn(pos, "register");
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(app).post("/orders/ord_001/sync"),
      ),
    );
    expect(
      results.every(
        (result) => result.status === 200 && result.body.pos.attempts === 2,
      ),
    ).toBe(true);
    expect(register).toHaveBeenCalledTimes(1);
    expect(pos.listTransactions()).toHaveLength(1);
  });

  it("rejects conflicting data and reused event IDs without changing either ledger", async () => {
    const { app, pos } = setup();
    const original = (
      await request(app).post("/payment-events").send(event()).expect(201)
    ).body.order;
    const transactions = pos.listTransactions();
    const conflicts = [
      { ...event().order, venueId: "another_venue" },
      { ...event().order, items: [...event().order.items].reverse() },
      {
        ...event().order,
        items: [{ productId: "pizza", quantity: 1, price: 2650 }],
      },
    ];
    for (const order of conflicts) {
      await request(app)
        .post("/payment-events")
        .send(event({ eventId: "evt_new", order }))
        .expect(409);
      expect((await request(app).get("/orders/ord_001")).body).toEqual(
        original,
      );
      expect(pos.listTransactions()).toEqual(transactions);
    }
    await request(app)
      .post("/payment-events")
      .send(event({ order: { ...event().order, id: "ord_other" } }))
      .expect(409);
    await request(app).get("/orders/ord_other").expect(404);
    await request(app)
      .post("/payment-events")
      .send(
        event({
          eventId: "evt_new",
          order: { ...event().order, id: "ord_allowed" },
        }),
      )
      .expect(201);
  });

  it.each([
    [
      "bad total",
      (value: UncheckedPaymentEvent) => {
        value.order.total = 1;
      },
    ],
    [
      "empty event ID",
      (value: UncheckedPaymentEvent) => {
        value.eventId = "";
      },
    ],
    [
      "blank order ID",
      (value: UncheckedPaymentEvent) => {
        value.order.id = "  ";
      },
    ],
    [
      "blank venue",
      (value: UncheckedPaymentEvent) => {
        value.order.venueId = "";
      },
    ],
    [
      "blank product",
      (value: UncheckedPaymentEvent) => {
        value.order.items[0]!.productId = " ";
      },
    ],
    [
      "empty items",
      (value: UncheckedPaymentEvent) => {
        value.order.items = [];
      },
    ],
    [
      "zero quantity",
      (value: UncheckedPaymentEvent) => {
        value.order.items[0]!.quantity = 0;
      },
    ],
    [
      "fractional quantity",
      (value: UncheckedPaymentEvent) => {
        value.order.items[0]!.quantity = 1.5;
      },
    ],
    [
      "negative amount",
      (value: UncheckedPaymentEvent) => {
        value.order.items[0]!.price = -1;
      },
    ],
    [
      "fractional amount",
      (value: UncheckedPaymentEvent) => {
        value.order.total = 2650.5;
      },
    ],
    [
      "unsafe amount",
      (value: UncheckedPaymentEvent) => {
        value.order.total = Number.MAX_SAFE_INTEGER + 1;
      },
    ],
    [
      "unsupported currency",
      (value: UncheckedPaymentEvent) => {
        value.order.currency = "USD";
      },
    ],
    [
      "unsupported event",
      (value: UncheckedPaymentEvent) => {
        value.type = "payment.failed";
      },
    ],
  ])(
    "rejects %s before recording a payment or calling POS",
    async (_name, mutate) => {
      const { app, pos } = setup();
      const input = event();
      mutate(input);
      await request(app).post("/payment-events").send(input).expect(400);
      expect(pos.listTransactions()).toEqual([]);
      await request(app).get("/orders/ord_001").expect(404);
    },
  );

  it("rejects an invalid total for an existing order without mutation", async () => {
    const { app, pos } = setup();
    const original = (
      await request(app).post("/payment-events").send(event()).expect(201)
    ).body.order;
    const input = event();
    input.order.total += 1;
    await request(app).post("/payment-events").send(input).expect(400);
    expect((await request(app).get("/orders/ord_001")).body).toEqual(original);
    expect(pos.listTransactions()).toHaveLength(1);
  });

  it("accepts zero-value items and orders", async () => {
    const { app } = setup();
    const input = event();
    input.order.items = [{ productId: "complimentary", quantity: 1, price: 0 }];
    input.order.total = 0;
    const result = await request(app)
      .post("/payment-events")
      .send(input)
      .expect(201);
    expect(result.body.order.total).toBe(0);
    expect(
      (await request(app).post("/orders/ord_001/refund").expect(200)).body
        .refund.amount,
    ).toBe(0);
  });

  it("performs one full refund for duplicate/concurrent requests and preserves it on event replay", async () => {
    const { app, orders, pos } = setup();
    await request(app).post("/payment-events").send(event()).expect(201);
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app).post("/orders/ord_001/refund"),
      ),
    );
    const expected = {
      status: "refunded",
      amount: 2650,
      reference: "refund_1",
    };
    for (const result of results) {
      expect(result.status).toBe(200);
      expect(result.body.refund).toEqual(expected);
    }
    expect(orders.listRefunds()).toEqual([expected]);
    for (const eventId of ["evt_001", "evt_after_refund"]) {
      const replay = await request(app)
        .post("/payment-events")
        .send(event({ eventId }))
        .expect(200);
      expect(replay.body.order.refund).toEqual(expected);
    }
    expect((await request(app).get("/orders/ord_001")).body.refund).toEqual(
      expected,
    );
    expect(
      (await request(app).post("/orders/ord_001/sync")).body.refund,
    ).toEqual(expected);
    expect(orders.listRefunds()).toHaveLength(1);
    expect(pos.listTransactions()).toHaveLength(1);
  });

  it.each(["get", "sync", "refund"])(
    "returns 404 for unknown order %s",
    async (action) => {
      const { app } = setup();
      const response =
        action === "get"
          ? await request(app).get("/orders/missing")
          : await request(app).post(`/orders/missing/${action}`);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "Order not found" });
    },
  );

  it("returns a useful JSON error for malformed JSON", async () => {
    const { app } = setup();
    const response = await request(app)
      .post("/payment-events")
      .set("Content-Type", "application/json")
      .send("{broken")
      .expect(400);
    expect(response.body.error).toBe("Invalid JSON body");
  });
});
