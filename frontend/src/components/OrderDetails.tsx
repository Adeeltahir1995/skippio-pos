import type { OrderRecord } from "../../../shared/contracts";
import { money } from "../lib/format";
import { POS_STATUS_LABELS } from "../constants";

type Props = {
  order: OrderRecord;
  busy: boolean;
  retrying: boolean;
  onRetry: () => Promise<void>;
};

export default function OrderDetails({
  order,
  busy,
  retrying,
  onRetry,
}: Props) {
  return (
    <div className="order-details">
      <h3>{order.id}</h3>
      <p className="venue">{order.venueId}</p>

      <dl className="order-status">
        <div>
          <dt>Payment</dt>
          <dd>Paid</dd>
        </div>
        <div>
          <dt>POS sync</dt>
          <dd>{POS_STATUS_LABELS[order.pos.status]}</dd>
        </div>
        <div>
          <dt>Attempts</dt>
          <dd>{order.pos.attempts}</dd>
        </div>
      </dl>

      <div className="table-scroll">
        <table>
          <caption className="sr-only">
            Order items and amounts in euros
          </caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Qty</th>
              <th scope="col">Price</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={index}>
                <td>{item.productId}</td>
                <td>{item.quantity}</td>
                <td>{money(item.price)}</td>
                <td>{money(item.quantity * item.price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>
                Total
              </th>
              <td>{money(order.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <dl className="order-references">
        <div>
          <dt>POS reference</dt>
          <dd>{order.pos.transactionReference ?? "Not available"}</dd>
        </div>
        <div>
          <dt>Refund</dt>
          <dd>
            {order.refund
              ? `${money(order.refund.amount)} refunded · ${order.refund.reference}`
              : "Not refunded"}
          </dd>
        </div>
      </dl>

      {order.pos.status === "failed" && (
        <div className="recovery">
          <p>{order.pos.error ?? "POS sync failed. Payment is recorded."}</p>
          <button
            className="primary"
            type="button"
            disabled={busy}
            onClick={onRetry}
          >
            {retrying ? "Retrying…" : "Retry sync"}
          </button>
        </div>
      )}
      {order.pos.status === "syncing" && (
        <p className="field-help">
          Sync in progress. Look up the order again to refresh.
        </p>
      )}
    </div>
  );
}
