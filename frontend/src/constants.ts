import type {
  Currency,
  Item,
  PaymentEvent,
  PosStatus,
} from "../../shared/contracts";

export const API_BASE_PATH = "/api";
export const CURRENCY: Currency = "EUR";
export const CURRENCY_LOCALE = "en-IE";
export const CENTS_PER_UNIT = 100;
export const PAYMENT_EVENT_TYPE: PaymentEvent["type"] = "payment.succeeded";
export const PAYMENT_EXAMPLES = {
  success: { eventId: "evt_001", orderId: "ord_001", venueId: "venue_001" },
  failure: {
    eventId: "evt_retry",
    orderId: "ord_retry",
    venueId: "venue_fail_once",
  },
};
export const DEFAULT_ITEMS: readonly Item[] = [
  { productId: "burger", quantity: 2, price: 1200 },
  { productId: "water", quantity: 1, price: 250 },
];
export const POS_STATUS_LABELS: Record<PosStatus, string> = {
  synced: "Synced",
  failed: "Failed",
  syncing: "Syncing",
};
export const ACTION_ERRORS = {
  submit: "Unable to submit payment.",
  lookup: "Unable to look up order.",
  retry: "Unable to retry sync.",
};
