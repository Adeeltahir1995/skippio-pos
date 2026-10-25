export type Currency = "EUR";
export type Item = { productId: string; quantity: number; price: number };
export type Order = {
  id: string;
  venueId: string;
  currency: Currency;
  items: Item[];
  total: number;
};
export type PaymentEvent = {
  eventId: string;
  type: "payment.succeeded";
  order: Order;
};
export type PosStatus = "syncing" | "failed" | "synced";
export type Refund = { status: "refunded"; amount: number; reference: string };
export type OrderRecord = Order & {
  paymentStatus: "paid";
  pos: {
    status: PosStatus;
    attempts: number;
    transactionReference?: string;
    error?: string;
  };
  refund: Refund | null;
};
export type PaymentEventResult = { duplicate: boolean; order: OrderRecord };
export type ApiError = {
  error: string;
  issues?: { path: string; message: string }[];
};
