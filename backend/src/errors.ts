import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { JSON_BODY_LIMIT } from "./constants.js";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Invalid payment event",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  } else if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
  } else if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: "Invalid JSON body" });
  } else if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.too.large"
  ) {
    res.status(413).json({ error: `Request body exceeds ${JSON_BODY_LIMIT}` });
  } else {
    console.error(error);
    res.status(500).json({ error: "Unexpected server error" });
  }
};
