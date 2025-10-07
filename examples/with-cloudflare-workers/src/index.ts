import { Hono } from "hono";
import { registerRoutes } from "./routes.generated";

export default registerRoutes(new Hono<CloudflareBindings>());
