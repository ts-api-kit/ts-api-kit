import { generateOpenAPI } from "@ts-api-kit/compiler";
import ApiServer from "@ts-api-kit/core/server";

const server = new ApiServer(3000);
await server.configureRoutes(`${import.meta.dirname}/routes`);
generateOpenAPI(`${import.meta.dirname}/routes`, "./openapi.json");
server.start();
