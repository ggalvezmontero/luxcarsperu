import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Pruebas unitarias de las funciones puras (motor de precios, cotizador de
 * envíos). Sin DOM ni servidor: `npm test`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Los renderizadores de documentos llevan `import "server-only"`, que
      // lanza fuera de un bundle de servidor. En las pruebas se reemplaza por
      // un módulo vacío.
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
