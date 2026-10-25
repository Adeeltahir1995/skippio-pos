import { createApp } from "./app.js";
import { DEFAULT_PORT, SERVER_HOST } from "./constants.js";

const port = Number(process.env.PORT ?? DEFAULT_PORT);
const { app } = createApp();
app.listen(port, SERVER_HOST, () => {
  console.log(`Skippio API listening on http://${SERVER_HOST}:${port}`);
});
