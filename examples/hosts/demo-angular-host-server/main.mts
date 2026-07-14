import express from "express";
import { atlas } from "@atlas/host-server";

const app = express();
const port = Number(process.env.PORT ?? 8080);

app.disable("x-powered-by");
app.use(atlas({ hostId: "399e1a5d-f83d-4248-96ed-e4211707ae1b" }));

app.listen(port, () => console.info(`Atlas host server listening on port ${port}.`));
