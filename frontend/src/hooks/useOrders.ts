import { useState } from "react";
import type { OrderRecord, PaymentEvent } from "../../../shared/contracts";
import { ACTION_ERRORS, PAYMENT_EXAMPLES } from "../constants";
import { getOrder, submitPayment, syncOrder } from "../lib/api";

type Action = keyof typeof ACTION_ERRORS;
type Notice = { kind: "success" | "error"; text: string };

export function useOrders() {
  const [lookupId, setLookupId] = useState(PAYMENT_EXAMPLES.success.orderId);
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function runAction(action: Action, operation: () => Promise<void>) {
    setBusy(action);
    setNotice(null);
    try {
      await operation();
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : ACTION_ERRORS[action],
      });
    } finally {
      setBusy(null);
    }
  }

  function submit(event: PaymentEvent) {
    return runAction("submit", async () => {
      const result = await submitPayment(event);
      setOrder(result.order);
      setLookupId(result.order.id);
      setNotice({
        kind: "success",
        text: result.duplicate
          ? "Duplicate event. The existing order has been returned."
          : result.order.pos.status === "failed"
            ? "Payment recorded. POS sync failed. You can retry it below."
            : "Payment recorded and synced with the POS.",
      });
    });
  }

  function lookup() {
    return runAction("lookup", async () => {
      setOrder(null);
      setOrder(await getOrder(lookupId));
    });
  }

  function retry() {
    if (!order) return Promise.resolve();
    return runAction("retry", async () => {
      const result = await syncOrder(order.id);
      setOrder(result);
      setNotice(
        result.pos.status === "failed"
          ? { kind: "error", text: result.pos.error ?? "POS sync failed." }
          : { kind: "success", text: "Order synced with the POS." },
      );
    });
  }

  return { lookupId, setLookupId, order, busy, notice, submit, lookup, retry };
}
