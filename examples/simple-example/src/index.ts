import { generateOpenAPI } from "@ts-api-kit/compiler";
import { serve } from "@ts-api-kit/core";

serve({
	compile: generateOpenAPI,
});
