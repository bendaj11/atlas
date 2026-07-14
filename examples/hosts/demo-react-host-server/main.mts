import express from "express";
import { atlas } from "@atlas/host-server";

const app = express();
const port = Number(process.env.PORT ?? 8080);

app.disable("x-powered-by");
app.use(atlas({ hostId: "060a7f62-1c95-402c-9993-55749faf36d9" }));

app.listen(port, () => console.info(`Atlas host server listening on port ${port}.`));
