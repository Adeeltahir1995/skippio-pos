import { useRef, useState, type FormEvent } from "react";
import type { PaymentEvent } from "../../../shared/contracts";
import { money } from "../lib/format";
import {
  createPaymentForm,
  itemTotal,
  toPaymentEvent,
} from "../lib/payment-form";

type Props = {
  busy: boolean;
  submitting: boolean;
  onSubmit: (event: PaymentEvent) => Promise<void>;
};

export default function PaymentForm({ busy, submitting, onSubmit }: Props) {
  const [form, setForm] = useState(() => createPaymentForm());
  const nextKey = useRef(form.items.length);

  function updateItem(
    key: number,
    field: "productId" | "quantity" | "price",
    value: string,
  ) {
    setForm((previous) => {
      const items = previous.items.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      );
      return { ...previous, items, total: itemTotal(items) };
    });
  }

  function removeItem(key: number) {
    setForm((previous) => {
      const items = previous.items.filter((item) => item.key !== key);
      return { ...previous, items, total: itemTotal(items) };
    });
  }

  function addItem() {
    const item = {
      key: nextKey.current++,
      productId: "",
      quantity: "1",
      price: "0",
    };
    setForm((previous) => ({ ...previous, items: [...previous.items, item] }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void onSubmit(toPaymentEvent(form));
  }

  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        <div className="examples">
          <button type="button" onClick={() => setForm(createPaymentForm())}>
            Success example
          </button>
          <button
            type="button"
            onClick={() => setForm(createPaymentForm("failure"))}
          >
            Failure example
          </button>
        </div>

        <div className="field-pair">
          <label>
            Event ID
            <input
              name="eventId"
              required
              value={form.eventId}
              onChange={(event) =>
                setForm({ ...form, eventId: event.target.value })
              }
            />
          </label>
          <label>
            Order ID
            <input
              name="orderId"
              required
              value={form.orderId}
              onChange={(event) =>
                setForm({ ...form, orderId: event.target.value })
              }
            />
          </label>
        </div>
        <label>
          Venue ID
          <input
            name="venueId"
            required
            value={form.venueId}
            onChange={(event) =>
              setForm({ ...form, venueId: event.target.value })
            }
          />
        </label>

        <div className="items">
          <h3>Items</h3>
          <p className="field-help">Enter prices and total in EUR cents.</p>
          {form.items.map((item, index) => (
            <div className="item-row" key={item.key}>
              <label>
                Product
                <input
                  required
                  aria-label={`Item ${index + 1} product ID`}
                  value={item.productId}
                  onChange={(event) =>
                    updateItem(item.key, "productId", event.target.value)
                  }
                />
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  aria-label={`Item ${index + 1} quantity`}
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(item.key, "quantity", event.target.value)
                  }
                />
              </label>
              <label>
                Price
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  aria-label={`Item ${index + 1} unit price in cents`}
                  value={item.price}
                  onChange={(event) =>
                    updateItem(item.key, "price", event.target.value)
                  }
                />
              </label>
              <button
                className="remove-item"
                type="button"
                aria-label={`Remove item ${index + 1}`}
                disabled={form.items.length === 1}
                onClick={() => removeItem(item.key)}
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="text-button" onClick={addItem}>
            Add item
          </button>
        </div>

        <div className="total-row">
          <label>
            Total in cents
            <input
              type="number"
              min="0"
              step="1"
              required
              value={form.total}
              onChange={(event) =>
                setForm({ ...form, total: event.target.value })
              }
            />
          </label>
          <strong>{money(Number(form.total) || 0)}</strong>
        </div>
        <button className="primary" type="submit">
          {submitting ? "Submitting…" : "Submit payment"}
        </button>
      </fieldset>
    </form>
  );
}
