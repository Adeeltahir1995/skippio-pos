import express from "express";
import { JSON_BODY_LIMIT } from "./constants.js";
import { errorHandler } from "./errors.js";
import { OrderService } from "./orders.js";
import { SimulatedPos, type PosAdapter } from "./pos.js";

export function createApp(pos: PosAdapter = new SimulatedPos()) {
  const app = express();
  const orders = new OrderService(pos);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.post("/payment-events", async (req, res) => {
    const result = await orders.receivePayment(req.body);
    res.status(result.duplicate ? 200 : 201).json(result);
  });
  app.get("/orders/:orderId", (req, res) => {
    res.json(orders.get(req.params.orderId));
  });
  app.post("/orders/:orderId/sync", async (req, res) => {
    res.json(await orders.sync(req.params.orderId));
  });
  app.post("/orders/:orderId/refund", (req, res) => {
    res.json(orders.refund(req.params.orderId));
  });
  app.get("/pos-transactions", (_req, res) => {
    res.json(pos.listTransactions());
  });
  app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
  });

  app.use(errorHandler);
  return { app, orders, pos };
}
