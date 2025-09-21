import process from "node:process";
import { serve } from "@ts-api-kit/core";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

serve({
  openapi: {
    info: {
      title: "Simple Example API",
      version: "1.0.0",
      description: "Exemplo simples construído com TS API Kit",
      termsOfService: "https://example.com/terms",
      contact: {
        name: "TS API Kit Team",
        url: "https://github.com/ts-api-kit/ts-api-kit",
        email: "contact@devzolo.com",
      },
      license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
    },
    servers: [
      { url: `http://localhost:${PORT}`, description: "Local development" },
      { url: `https://example.com`, description: "Production" },
    ],
    tags: [
      { name: "health", description: "Healthcheck e diagnósticos" },
      { name: "users", description: "Operações de usuário (exemplo)" },
    ],
    externalDocs: {
      url: "https://github.com/ts-api-kit/ts-api-kit",
      description: "Repositório e documentação do projeto",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    extensions: {
      "x-logo": {
        url: "https://www.valuehost.com.br/blog/wp-content/uploads/2024/07/api.jpeg.webp",
        altText: "TS API Kit",
      },
    },
  },
  openapiOutput: "memory",
});
