import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import pluginReact from "eslint-plugin-react";

/** @type {import('eslint').Linter.Config} */
const config = {
  files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
  languageOptions: {
    parser: tsParser,
    globals: globals.browser,
  },
  plugins: {
    "@typescript-eslint": tsPlugin,
    react: pluginReact,
  },
  rules: {
    // Base ESLint rules
    "no-unused-vars": "off", // Disable base rule

    // TypeScript-specific rules
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        vars: "all",
        args: "after-used",
        ignoreRestSiblings: true,
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-explicit-any": [
      "off",
      {
        fixToUnknown: false,
        ignoreRestArgs: true,
      },
    ],

    // React-specific rules
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
  },
};

export default config;
