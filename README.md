# Skippio

TypeScript payment-to-POS demo. Node.js/Express backend; React/Vite frontend.

## Run

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev:backend
```

In a second terminal:

```sh
npm run dev:frontend
```

Open http://127.0.0.1:5173. API port: 3001.

## Checks

```sh
npm run check
```

## Demo

1. Submit **Success example**, then replay with the same/different event IDs. Verify unchanged POS reference and attempts.
2. Look up an existing order and an unknown ID.
3. Submit **Failure example**, then **Retry sync**. Payment stays paid; attempts changes from 1 to 2.
4. Edit items and submit an incorrect total to check validation.

After submitting `ord_001`, test refunds and inspect POS transactions:

```sh
curl -X POST http://127.0.0.1:3001/orders/ord_001/refund
curl -X POST http://127.0.0.1:3001/orders/ord_001/refund
curl http://127.0.0.1:3001/orders/ord_001
curl http://127.0.0.1:3001/pos-transactions
```

Refunds require successful sync. Repeated refunds return the same full amount; payment replays preserve the refund.

## Notes

One in-memory process; restarting clears data. Trusted sender, EUR cents only. `venue_fail_once` fails the first POS attempt for each new order. Overlapping requests await one attempt; successful syncs reuse their transaction. Conflicts return 409, invalid input 400, and unknown orders 404. Accepted payments return 201 or 200 even if POS sync fails; inspect the separate POS status.

Approximate time: 3 hours. See `AI_USAGE.md` for AI assistance.
