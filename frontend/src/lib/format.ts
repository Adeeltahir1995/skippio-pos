import { CENTS_PER_UNIT, CURRENCY, CURRENCY_LOCALE } from "../constants";

const currencyFormat = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: "currency",
  currency: CURRENCY,
});

export function money(amount: number): string {
  return currencyFormat.format(amount / CENTS_PER_UNIT);
}
