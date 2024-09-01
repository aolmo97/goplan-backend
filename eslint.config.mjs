import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  {
    languageOptions: {
      globals: {
        ...globals.node, // Añade los globales de Node.js, incluyendo `process`
        ...globals.browser, // Si también necesitas globales del navegador
        ...globals.jest, // Globales de Jest como `describe`, `test`, `expect`
      },
    },
  },
  pluginJs.configs.recommended,
];
