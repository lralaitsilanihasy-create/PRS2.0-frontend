// @ts-check
// Analyse statique (chantier LOT 0, 2026-08-26 — modèle : dépôt Collegue).
// Lancement : `npm run lint` ; branchée en CI (bloquante).
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = tseslint.config(
  {
    ignores: ["dist/**", ".angular/**", "coverage/**"],
  },
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
      // Doit rester en dernier : neutralise les règles stylistiques qui entreraient
      // en conflit avec Prettier (formatage délégué à Prettier, pas à ESLint).
      eslintConfigPrettier,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        { type: "attribute", prefix: "app", style: "camelCase" },
      ],
      "@angular-eslint/component-selector": [
        "error",
        { type: "element", prefix: "app", style: "kebab-case" },
      ],
      // Idiome répété dans le code (RxJS `.subscribe({ error: () => {} })` pour les
      // requêtes en meilleur effort) : n'interdire que les fonctions nommées vides,
      // pas les callbacks volontairement vides.
      "@typescript-eslint/no-empty-function": ["error", { allow: ["arrowFunctions", "methods"] }],
      // Un paramètre préfixé `_` est volontairement ignoré (convention du dépôt).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      // `!= null` couvre null ET undefined en une comparaison — idiome assumé.
      "@angular-eslint/template/eqeqeq": ["error", { allowNullOrUndefined: true }],
      // Passées en avertissement (non bloquantes) plutôt que corrigées en masse ici, pour
      // ne pas mêler le chantier d'outillage à des changements de comportement UI :
      // - click-events-have-key-events / interactive-supports-focus : surtout le clic sur le
      //   fond des modales (fermeture déjà doublée d'Échap par la directive appModale) et des
      //   lignes cliquables à côté de vrais <button>. Le vrai correctif (tabindex/role/keydown)
      //   est un chantier a11y à part — cf. AUDIT.md.
      "@angular-eslint/template/click-events-have-key-events": "warn",
      "@angular-eslint/template/interactive-supports-focus": "warn",
      // - label-has-associated-control : occurrences autour de composants du design system
      //   sans id/for exposé vers leur contrôle natif interne.
      "@angular-eslint/template/label-has-associated-control": "warn",
    },
  }
);
