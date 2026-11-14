import globals from "globals";

export default [
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,

        // Fonctions globales Chrono
        chronoNow: "readonly",
        chronoFit: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unreachable": "error",
      "valid-typeof": "error",
    },
  },
];
