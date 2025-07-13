import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      import: (await import("eslint-plugin-import")).default,
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      // TypeScript specific rules
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { 
          argsIgnorePattern: "^_", 
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true 
        }
      ],
      // "@typescript-eslint/prefer-const": "error", // This rule doesn't exist, using prefer-const instead
      // "@typescript-eslint/no-unnecessary-type-assertion": "error", // Requires type information
      // "@typescript-eslint/no-non-null-assertion": "warn", // Requires type information
      
      // React specific rules
      "react-hooks/exhaustive-deps": "warn",
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
      
      // Import ordering and organization
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external", 
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type"
          ],
          pathGroups: [
            {
              pattern: "react",
              group: "external",
              position: "before"
            },
            {
              pattern: "next/**",
              group: "external",
              position: "before"
            },
            {
              pattern: "@/**",
              group: "internal",
              position: "before"
            }
          ],
          pathGroupsExcludedImportTypes: ["react", "next"],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true
          }
        }
      ],
      "import/no-duplicates": "error",
      "import/no-unresolved": "error",
      "import/named": "error",
      "import/default": "error",
      
      // General code quality
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-alert": "warn",
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-arrow-callback": "error",
      "prefer-template": "error",
      
      // Formatting (handled by Prettier but good to have as backup)
      "indent": "off", // Handled by Prettier
      "quotes": ["error", "single", { avoidEscape: true }],
      "semi": ["error", "always"],
      "comma-dangle": ["error", "always-multiline"],
      "no-trailing-spaces": "error",
      "eol-last": "error",
      
      // Next.js specific
      "@next/next/no-img-element": "error",
      "@next/next/no-page-custom-font": "error",
    },
  },
];

export default eslintConfig;
