import type { PaymentEvent } from "../../../shared/contracts";
import {
  CURRENCY,
  DEFAULT_ITEMS,
  PAYMENT_EVENT_TYPE,
  PAYMENT_EXAMPLES,
} from "../constants";

export type FormItem = {
  key: number;
  productId: string;
  quantity: string;
  price: string;
};
export type FormValues = {
  eventId: string;
  orderId: string;
  venueId: string;
  items: FormItem[];
  total: string;
};

export function itemTotal(items: FormItem[]): string {
  return String(
    items.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.price),
      0,
    ),
  );
}

export function createPaymentForm(
  scenario: keyof typeof PAYMENT_EXAMPLES = "success",
): FormValues {
  const items = DEFAULT_ITEMS.map((item, key) => ({
    key,
    productId: item.productId,
    quantity: String(item.quantity),
    price: String(item.price),
  }));
  return { ...PAYMENT_EXAMPLES[scenario], items, total: itemTotal(items) };
}

export function toPaymentEvent(form: FormValues): PaymentEvent {
  return {
    eventId: form.eventId,
    type: PAYMENT_EVENT_TYPE,
    order: {
      id: form.orderId,
      venueId: form.venueId,
      currency: CURRENCY,
      items: form.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        price: Number(item.price),
      })),
      total: Number(form.total),
    },
  };
}
