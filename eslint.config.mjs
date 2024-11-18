import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import pluginReact from "eslint-plugin-react";

/** ESLint configuration */
export default [
  {
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
        },
      ],
      "@typescript-eslint/no-explicit-any": [
        "off", // Change "error" to "warn" to reduce severity
        {
          fixToUnknown: false, // Do not automatically fix to `unknown`
          ignoreRestArgs: true, // Allow `any` in rest arguments
        },
      ],

      // React-specific rules
      "react/prop-types": "off", // Recommended to turn off if using TypeScript
      "react/react-in-jsx-scope": "off", // For Next.js or if React 17+ is used
    },
  },
];
