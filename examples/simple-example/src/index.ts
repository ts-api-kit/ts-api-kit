import { generateOpenAPI } from "@ts-api-kit/compiler";
import ApiServer from "@ts-api-kit/core/server";

const port = 3000;
const routesDir = `${import.meta.dirname}/routes`;
const openapiFile = `./openapi.json`;

const server = new ApiServer();
await server.configureRoutes(routesDir);
generateOpenAPI(routesDir, openapiFile);
server.start(port);
