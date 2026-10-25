import PaymentForm from "./components/PaymentForm";
import OrderDetails from "./components/OrderDetails";
import { useOrders } from "./hooks/useOrders";

export default function App() {
  const { lookupId, setLookupId, order, busy, notice, submit, lookup, retry } =
    useOrders();

  return (
    <main className="app">
      <header className="page-header">
        <h1>Payments</h1>
        <p>Submit a payment event or look up an order.</p>
      </header>

      {notice && (
        <p
          className="notice"
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {notice.kind === "error" && <strong>Error: </strong>}
          {notice.text}
        </p>
      )}

      <div className="workspace">
        <section aria-labelledby="payment-heading">
          <h2 id="payment-heading">New payment</h2>
          <PaymentForm
            busy={busy !== null}
            submitting={busy === "submit"}
            onSubmit={submit}
          />
        </section>

        <section
          className="order-section"
          aria-labelledby="order-heading"
          aria-busy={busy === "lookup" || busy === "retry"}
        >
          <h2 id="order-heading">Order</h2>
          <form
            className="lookup-form"
            onSubmit={(event) => {
              event.preventDefault();
              void lookup();
            }}
          >
            <label htmlFor="lookup-order">Order ID</label>
            <div className="lookup-controls">
              <input
                id="lookup-order"
                required
                value={lookupId}
                disabled={busy !== null}
                onChange={(event) => setLookupId(event.target.value)}
              />
              <button type="submit" disabled={busy !== null}>
                {busy === "lookup" ? "Loading…" : "Look up"}
              </button>
            </div>
          </form>
          {order ? (
            <OrderDetails
              order={order}
              busy={busy !== null}
              retrying={busy === "retry"}
              onRetry={retry}
            />
          ) : (
            <p className="empty-state">
              {busy === "lookup" ? "Loading order…" : "No order selected."}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
