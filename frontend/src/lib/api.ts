import type {
  ApiError,
  OrderRecord,
  PaymentEvent,
  PaymentEventResult,
} from "../../../shared/contracts";
import { API_BASE_PATH } from "../constants";

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_PATH}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = result as ApiError | null;
    const details = error?.issues
      ?.map((issue) => `${issue.path}: ${issue.message}`)
      .join("; ");
    throw new Error(
      details ||
        error?.error ||
        (response.status >= 500
          ? "The API is unavailable. Check that the backend is running."
          : `Request failed (${response.status})`),
    );
  }
  if (result === null) throw new Error("The API returned an invalid response.");
  return result as T;
}

function orderPath(orderId: string): string {
  return `/orders/${encodeURIComponent(orderId)}`;
}

export function submitPayment(
  event: PaymentEvent,
): Promise<PaymentEventResult> {
  return request<PaymentEventResult>("/payment-events", event);
}

export function getOrder(orderId: string): Promise<OrderRecord> {
  return request<OrderRecord>(orderPath(orderId));
}

export function syncOrder(orderId: string): Promise<OrderRecord> {
  return request<OrderRecord>(`${orderPath(orderId)}/sync`, {});
}
