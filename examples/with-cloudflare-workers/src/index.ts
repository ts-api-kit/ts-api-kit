import { Hono } from "hono";
import { registerRoutes } from "./routes.generated";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => { 
	c.env.TEST_DB.prepare("SELECT * FROM users").bind({}).all();
	return c.json({ hello: "world" });
});

export default registerRoutes(app);
