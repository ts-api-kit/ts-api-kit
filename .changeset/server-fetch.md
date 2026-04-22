---
"@ts-api-kit/core": minor
---

Add `Server.fetch(req)` for in-process request dispatch.

The default `Server` class now exposes a `fetch(req: Request): Promise<Response>` method that forwards to the internal Hono app without binding to a TCP port. Lets smoke / integration tests exercise the full routing + validation + response pipeline in-process (the pattern Hono itself documents for tests).

```ts
import { Server } from "@ts-api-kit/core";

const server = new Server();
await server.configureRoutes("./src/routes");
const res = await server.fetch(new Request("http://test/users/42"));
```

The existing `start(port)` binding behaviour is unchanged; the method is additive.
