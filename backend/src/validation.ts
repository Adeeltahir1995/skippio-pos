import { z } from "zod";
import type { PaymentEvent } from "../../shared/contracts.js";
import { PAYMENT_EVENT_TYPE, SUPPORTED_CURRENCY } from "./constants.js";
import { calculateOrderTotal } from "./order-utils.js";

const identifier = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, "Identifier cannot be blank");
const amount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

const orderSchema = z
  .object({
    id: identifier,
    venueId: identifier,
    currency: z.literal(SUPPORTED_CURRENCY),
    items: z
      .array(
        z
          .object({
            productId: identifier,
            quantity: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
            price: amount,
          })
          .strict(),
      )
      .min(1),
    total: amount,
  })
  .strict()
  .superRefine((order, ctx) => {
    const calculated = calculateOrderTotal(order.items);
    if (calculated !== BigInt(order.total)) {
      ctx.addIssue({
        code: "custom",
        path: ["total"],
        message: "Total must equal the sum of quantity × price for all items",
      });
    }
  });

export const paymentEventSchema = z
  .object({
    eventId: identifier,
    type: z.literal(PAYMENT_EVENT_TYPE),
    order: orderSchema,
  })
  .strict() satisfies z.ZodType<PaymentEvent>;
