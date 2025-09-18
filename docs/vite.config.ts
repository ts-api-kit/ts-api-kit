import devtoolsJson from "vite-plugin-devtools-json";
import { defaultTheme } from "@sveltepress/theme-default";
import { sveltepress } from "@sveltepress/vite";
import { defineConfig } from "vite";

const config = defineConfig({
  plugins: [
    sveltepress({
      theme: defaultTheme({
        navbar: [
          {
            title: "Home",
            to: "/",
          },
          {
            title: "Packages",
            to: "/packages/ts-api-kit",
          },
          {
            title: "Examples",
            to: "/examples",
          },
          {
            title: "GitHub",
            to: "https://github.com/devzolo/ts-api-kit",
          },
        ],
        sidebar: {
          "/": [
            {
              title: "Getting Started",
              items: [
                {
                  title: "Introduction",
                  to: "/",
                },
                {
                  title: "Installation",
                  to: "/getting-started/installation",
                },
                {
                  title: "Quick Start",
                  to: "/getting-started/quick-start",
                },
              ],
            },
            {
              title: "Packages",
              items: [
                {
                  title: "ts-api-core",
                  to: "/packages/ts-api-core",
                },
                {
                  title: "ts-api-compiler",
                  to: "/packages/ts-api-compiler",
                },
                {
                  title: "openapi-to-remote",
                  to: "/packages/openapi-to-remote",
                },
              ],
            },
            {
              title: "Guides",
              items: [
                {
                  title: "File-based Routing",
                  to: "/guides/file-based-routing",
                },
                {
                  title: "Schema Validation",
                  to: "/guides/schema-validation",
                },
                {
                  title: "OpenAPI Generation",
                  to: "/guides/openapi-generation",
                },
                {
                  title: "Middleware",
                  to: "/guides/middleware",
                },
              ],
            },
            {
              title: "Examples",
              items: [
                {
                  title: "Simple Example",
                  to: "/examples/simple-example",
                },
                {
                  title: "Frontend Example",
                  to: "/examples/frontend-example",
                },
              ],
            },
          ],
        },
        github: "https://github.com/devzolo/ts-api-core",
        logo: "/sveltepress.svg",
        preBuildIconifyIcons: {
          carbon: ["ruler-alt", "roadmap", "tree-view-alt", "import-export"],
          ri: ["svelte-line", "ruler-line"],
          nonicons: ["typescript-16"],
          emojione: ["artist-palette"],
          "vscode-icons": [
            "file-type-svelte",
            "arrow-both",
            "file-type-markdown",
            "file-type-vite",
          ],
          logos: ["typescript-icon", "svelte-kit"],
          ph: ["smiley", "layout-duotone"],
          noto: ["package"],
          solar: ["chat-square-code-outline", "reorder-outline"],
          ic: ["sharp-rocket-launch"],
          tabler: ["icons"],
          mdi: ["theme-light-dark"],
          bi: ["list-nested"],
        },
      }),
      siteConfig: {
        title: "TS API Core",
        description:
          "Um framework TypeScript moderno para APIs baseado no Hono com roteamento por arquivos e validação de schemas usando Valibot.",
      },
    }),
    devtoolsJson(),
  ],
});

export default config;
