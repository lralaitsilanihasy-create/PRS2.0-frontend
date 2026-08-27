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
      // Acquis de l'audit sécurité : une URL `blob:` hérite de l'origine de l'application, si bien
      // qu'un HTML ou un SVG téléversé, restitué tel quel dans un `window.open` ou une `<iframe>`,
      // y exécuterait son script. Le seul endroit du dépôt qui a le droit d'appeler
      // `URL.createObjectURL` est donc `core/securite/fichiers-surs` (override ci-dessous), qui force
      // un type MIME inerte au passage. Sans cette règle, la protection se perd au premier
      // copier-coller — elle avait déjà été recopiée douze fois avant d'être recentralisée.
      "no-restricted-properties": [
        "error",
        {
          object: "URL",
          property: "createObjectURL",
          message:
            "Passer par urlBlobSure() / telechargerBlob() / ouvrirBlobSur() (core/securite/fichiers-surs) : une URL blob: brute rend exécutable un fichier téléversé dans l'origine de l'application.",
        },
      ],
    },
  },
  {
    // Le module des fichiers sûrs EST l'implémentation de la garde : il lui faut l'appel brut.
    files: ["src/app/core/securite/fichiers-surs.ts"],
    rules: { "no-restricted-properties": "off" },
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
      // `click-events-have-key-events`, `interactive-supports-focus` et
      // `label-has-associated-control` ont été tolérées en avertissement le temps du chantier
      // a11y (124 occurrences). Celui-ci est soldé (2026-08-27) : elles reprennent la sévérité
      // « error » de `templateAccessibility`, seul moyen d'empêcher le motif de revenir.
      //
      // Si l'une d'elles se déclenche sur un voile de modale, le correctif n'est **jamais**
      // d'ajouter tabindex/role/keydown au voile — ce serait une tabulation sans nom accessible
      // dans un piège de focus. C'est `appModaleClicExterieur` (cf. shared/a11y) qu'il faut
      // poser sur le dialogue, Échap étant l'équivalent clavier du clic sur le voile.
    },
  }
);
