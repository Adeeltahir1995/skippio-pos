import type { Item, Order } from "../../shared/contracts.js";

export function calculateOrderTotal(items: Item[]): bigint {
  return items.reduce(
    (sum, item) => sum + BigInt(item.quantity) * BigInt(item.price),
    0n,
  );
}

export function hasSameOrderData(left: Order, right: Order): boolean {
  return (
    left.id === right.id &&
    left.venueId === right.venueId &&
    left.currency === right.currency &&
    left.total === right.total &&
    left.items.length === right.items.length &&
    left.items.every((item, index) => {
      const other = right.items[index];
      return (
        other !== undefined &&
        item.productId === other.productId &&
        item.quantity === other.quantity &&
        item.price === other.price
      );
    })
  );
}
