# Plan — Refonte ergonomique, lot 5 : la coquille de l'application

**Date** : 2026-09-16 · **Rédacteur** : dev-lead · **Branche** : `chantier/refonte-ergonomique` (à ramener sur
`origin/main` : front `e074646`, back `783a7e3` — la branche en est un ancêtre, simple avance rapide)
· **Origine** : maquettes validées par Mathieu le 14/09 — `Main.tpl.html` (menu groupé),
`GuideAccueil.tpl.html` et `GuideDossier.tpl.html` (rail compact), `data.js` (`D.MENU`).

> **Statut : LIVRÉ.** Les six décisions du §8 ont été tranchées par Mathieu le 16/09 ; le lot est
> passé en recette finale et déclaré publiable le même jour — détail au §10. Neuf commits locaux sur
> `main` (`104e528`..`af94f03`, `git log --oneline e074646..af94f03`) ; **rien n'est poussé** (accès
> distant refusé, propriétaire absent).

---

## 0. En bref

Le L5 ne touche à **aucune donnée de menu**. Tout ce qu'il ajoute — regroupement, libellés courts,
ordre, entrée de pied — vit dans un fichier **neuf**, `core/navigation/groupes-menu.ts`, qui *dérive*
la structure à partir des menus existants. `navigation.ts`, 33 commits du patron depuis le 28/08,
n'est pas modifié d'une ligne. Le reste est du style et deux correctifs courts.

| Ordre | Lot | Agent | Dépend de | Taille | Touche un fichier chaud ? |
|---|---|---|---|---|---|
| 1 | **L5-F1** Table de regroupement dérivée (rien de visible) | frontend-angular | — | M | non — fichiers neufs |
| 1 | **L5-F3** Contrastes de la coquille et état courant | frontend-angular | — | M | `_design-system.scss` (2 commits), `main-layout.scss` (5) |
| 1 | **L5-F5** Marque, icônes restantes, plus aucun emoji | frontend-angular | — | S | `main-layout.html` (7) |
| 1 | **L5-F6** Notification sans écran dédié : plus de clic muet | frontend-angular | — | S | non |
| 2 | **L5-F2** Le menu s'affiche par groupes | frontend-angular | F1 | S | `main-layout.html`, `main-layout.ts` |
| 3 | **L5-Q1** Recette contraste, focus et clavier | qa-test | F3, F5 | M | — |
| 4 | **L5-F4** Rail compact (bascule mémorisée) | frontend-angular | F1, F2, F3 | M | `main-layout.*` |
| 5 | **L5-Q2** Recette des dix menus × trois tailles d'écran | qa-test | F4 | M | — |
| 6 | **L5-D1** Clôture du plan et note de conventions | docs | Q2 | S | — |

**En parallèle dès le premier jour : F1, F3, F5 et F6** — quatre lots qui ne se croisent sur aucun
fichier. F2 est le seul point de rendez-vous. F4 vient après, quand le regroupement est acquis.

---

## 1. Existant, mesuré

### 1.1 Les fichiers chauds (`git log origin/main --since=2026-08-28`)

| Fichier | Commits | Nature des commits du patron |
|---|---|---|
| `core/navigation/navigation.ts` | **33** | **exclusivement des données** : ajouter, retirer, renommer une entrée dans `NAV_BY_ROLE`. Aucune n'a touché à la forme de `NavItem` ni au rendu. |
| `layout/main-layout/main-layout.ts` | 13 | pastilles de compteur (`rafraichirBadges`), recherche de la barre du haut, mode concentration |
| `core/navigation/navigation.spec.ts` | 9 | suit les données |
| `layout/main-layout/main-layout.html` | 7 | dont **4 sont de la refonte** ; les 3 autres datent du 28/08 (délégation repliable) |
| `layout/main-layout/main-layout.scss` | 5 | idem |
| `styles/_design-system.scss` | 2 | `dc12e53` (flou des modales), `8d7c5b3` (bouton du pipeline) — **pas le bloc `.sidebar`** |

**Ce que cela dit** : le risque n'est pas réparti sur la coquille, il est concentré sur **un littéral**,
`NAV_BY_ROLE`. Le gabarit et les styles, eux, sont calmes depuis trois semaines. Toute la stratégie du
lot en découle (§2).

### 1.2 Le menu aujourd'hui

- Dix menus à plat dans `NAV_BY_ROLE`, de 3 entrées (Secrétaire, Chargé de publication) à **14**
  (Administrateur). Aucune notion de groupe : `NavItem` porte `label`, `path`, `queryParams`, `icon`,
  `children`, `delegation`.
- Un seul regroupement existe, et il est déjà **dérivé** : `separerParDelegation()` sépare les entrées
  propres de celles exercées par délégation ascendante, *sur la donnée et non sur l'ordre de
  déclaration*. Le gabarit boucle déjà sur des sections `{ cle, titre, items }`. **C'est le point
  d'appui du lot : la structure d'accueil du regroupement est en place.**
- `Notifications` (`/notifications`) est répété **à l'identique dans les dix menus** : c'est l'entrée
  transverse, pas une entrée de rubrique.
- Trois niveaux d'imbrication sont gérés par le gabarit (`nav-item--sub`, `--sub2`) mais **aucun menu
  n'a d'enfants aujourd'hui** : `children` n'est employé nulle part dans `NAV_BY_ROLE`.
- Styles morts dans `_design-system.scss` : `.sidebar-logo-mark`, `.sidebar-logo-text`,
  `.nav-section-label`, `.nav-sub`, `.nav-sub-item`, `.nav-divider` — le gabarit ne les emploie pas.
  `.sidebar-logo` ne contient que le texte « CNM ».
- `.nav-item` et ses variantes ne sont employés **que** par la coquille (vérifié sur tout `src/app`) :
  les retoucher n'a aucun effet de bord ailleurs.

### 1.3 Contrastes relevés (calcul WCAG sur les valeurs réelles)

Fond de la barre latérale : dégradé `#0c4a6e → #082f49`. Le pire cas est le **haut** du dégradé.

| Élément | Couleur | Mesure | Seuil | Verdict |
|---|---|---|---|---|
| Entrée de menu au repos | blanc 72 % | **5,73:1** | 4,5 | conforme |
| Sous-entrée (`--sub`) | blanc 60 % | **4,52:1** | 4,5 | conforme de justesse |
| Intitulé de rubrique déléguée | blanc 62 % | **4,69:1** | 4,5 | conforme |
| Chevron de groupe | blanc 40 % | **2,85:1** | 3,0 (composant) | **non conforme** |
| Marque de délégation ⤴ | blanc 72 % × opacité 0,65 | **3,37:1** | 3,0 | conforme de justesse |
| **Entrée ACTIVE — PRMP** | `#667eea` sur `#f0f2ff` | **3,29:1** | 4,5 | **non conforme** |
| **Entrée ACTIVE — Membre** | `#d97706` sur `#fef9c3` | **2,97:1** | 4,5 | **non conforme** |
| **Entrée ACTIVE — Secrétaire** | `#0891b2` sur `#cffafe` | **3,29:1** | 4,5 | **non conforme** |
| **Entrée ACTIVE — Assistant / Publication** | `#db2777` sur `#fce7f3` | **3,91:1** | 4,5 | **non conforme** |
| Entrée active — Président / CC / Vérificateur / Admin | — | 4,80 à 9,37:1 | 4,5 | conforme |
| Pastille de compteur, défaut | `#0284c7` sur `#e8ecf4` | **3,46:1** | 4,5 | **non conforme** |
| Pastille `.i` (info) | `#0284c7` sur `#f0f9ff` | **3,84:1** | 4,5 | **non conforme** |
| Pastille `.s` (succès) | `#059669` sur `#ecfdf5` | **3,58:1** | 4,5 | **non conforme** |
| Pastille `.w` / `.d` | — | 4,58 / 5,30:1 | 4,5 | conforme |
| Pastille de profil de la barre du haut | mêmes paires que l'entrée active | idem | 4,5 | **non conforme pour 4 profils** |

Deux constats qui commandent le §4 :

1. **L'état courant est le moins lisible de tous les états.** Le mixin `nav-accent` de
   `main-layout.scss` peint le *texte* de l'entrée active à la couleur du profil sur un fond pâle ;
   pour quatre profils sur neuf, ce texte passe sous le seuil. Une entrée active est donc, aujourd'hui,
   **moins lisible qu'une entrée au repos** (5,73:1).
2. **Aucun `aria-current`** sur la navigation : `routerLinkActive` ne pose qu'une classe. Pour un
   lecteur d'écran, l'état courant n'existe pas.

### 1.4 Géométrie sur les trois écrans visés

| Écran | Largeur | Contenu utile aujourd'hui (barre 215 px + marges 64 px) | Avec le rail (76 px) |
|---|---|---|---|
| 1366×768 à 100 % | 1366 | 1 087 px | **1 226 px** |
| 1536×864 à 125 % | 1536 | 1 257 px | 1 396 px |
| 1229×691 à 125 % | 1229 | 950 px | **1 089 px** |

Le mode concentration (routes `data.concentration` : la page dossier dans les sept espaces, l'examen
et la vérification) rend déjà **toute** la largeur en rangeant la barre en tiroir. Le rail ne s'y
substitue pas (décision 2).

---

## 2. Stratégie de risque — comment on ne se met pas en travers du patron

**Règle du lot : le L5 ne modifie pas `NAV_BY_ROLE`.** Ni pour ajouter un champ `groupe`, ni pour
réordonner, ni pour découper. Le regroupement, les libellés courts et l'ordre des rubriques sont
*dérivés* dans un fichier neuf, comme `separerParDelegation` dérive déjà la séparation des
délégations « sur la donnée, et non par l'ordre de déclaration du menu ».

Conséquences concrètes :

| Question | Réponse |
|---|---|
| Le patron ajoute une entrée pendant le lot | **Aucun conflit git** : il édite `navigation.ts`, nous éditons `groupes-menu.ts`. |
| Mais l'entrée tombe dans quel groupe ? | Dans celui du repli, et **une spec échoue** en le disant (§3.3). Un contributeur ajoute une ligne à la table ; rien à comprendre. |
| Le patron renomme une entrée | Sans effet : la table est indexée sur le **chemin de route**, pas sur le libellé. Les 33 commits montrent qu'il renomme souvent et redirige rarement. |
| Le patron touche `main-layout.html` | Possible mais rare (3 commits en trois semaines, tous du 28/08). F2 et F4 sont chacun **un seul commit court**, sur des blocs différents du gabarit : un rebase se résout hunk par hunk. |
| Ordre de sécurité des commits | Les lots sans fichier chaud (**F1, F6**) d'abord et en entier ; puis les lots de style (**F3, F5**) ; **F2** et **F4**, les seuls à toucher le gabarit, en dernier et séparés. |
| Avant chaque lot | `git fetch`, puis `git log origin/main -1 --format='%h %s' -- <les fichiers du lot>`. Si le patron a poussé sur un fichier du lot : rebaser la branche **avant** d'écrire, jamais après. |
| Jamais | Mélanger dans un commit une donnée de menu et un changement de structure. Si un correctif de données s'impose (défaut constaté en recette), il part dans **son propre commit**, en tête de série. |

---

## 3. Le regroupement du menu

### 3.1 Où il vit

Fichier neuf **`src/app/core/navigation/groupes-menu.ts`** (+ sa spec). Il exporte :

```ts
export type CleGroupe = 'travail' | 'decisions' | 'pilotage' | 'parametrage' | 'donnees' | 'delegation' | 'pied';

export interface SectionMenu { cle: string; titre: string | null; repliable: boolean; items: NavItem[]; }

/** Groupe + libellé court d'une entrée, par SUFFIXE de chemin (l'espace `/president|/cc|…` est retiré). */
export const GROUPES_PAR_CHEMIN: Readonly<Record<string, { groupe: CleGroupe; court: string }>>;

/** Sections affichables du menu d'un profil : groupes propres, puis « Exercé par délégation ». */
export function sectionsMenu(items: NavItem[]): SectionMenu[];

/** Entrées du PIED de la barre (aujourd'hui : « Notifications », commune aux dix menus). */
export function piedMenu(items: NavItem[]): NavItem[];

/** Libellé court pour le rail ; repli sur le premier mot du libellé. */
export function libelleCourt(item: NavItem): string;
```

Règles de dérivation :

1. La clé est le **suffixe** du chemin après le segment d'espace (`/president/retraits` et
   `/cc/retraits` → `retraits`), sauf pour les chemins absolus transverses (`/notifications`), pris
   tels quels. C'est ce qui permet à `menuCommission()` de servir deux espaces sans doubler la table.
2. Deux profils peuvent partager un suffixe avec des libellés différents (`tableau-de-bord` =
   « Suivi des dossiers CNM » côté PRMP, « Tous les dossiers » côté UGPM) : le **groupe** est le même,
   le **libellé court** peut être surchargé par une table d'exceptions `(rôle, suffixe)`.
3. `sectionsMenu` réutilise `separerParDelegation` **sans le modifier** pour la dernière section :
   son repli, son intitulé et le `DelegationsAffichageStore` sont conservés à l'identique.
4. **Un menu qui ne produit qu'un seul groupe n'affiche aucun intitulé** : le Secrétaire, le
   Vérificateur, l'UGPM et le Chargé de publication retrouvent exactement leur menu d'aujourd'hui.
5. L'entrée de pied est **retirée** des groupes et rendue au-dessus de la carte de profil.

### 3.2 La table proposée (à valider — décision 1)

| Profil | Mon travail | Décisions | Autre rubrique | Par délégation | Pied |
|---|---|---|---|---|---|
| **PRMP** | À faire · Suivi des dossiers CNM · Créer dossier · Mettre à jour un PPM | PV et lettres de renvoi · Demandes de retrait | *Planification* : Calendrier | — | Notifications |
| **UGPM** | À faire · Tous les dossiers · Créer dossier · Mes brouillons | — | — | — | Notifications |
| **Président / CC** | À faire · Tous les dossiers | Examen de dossiers · Demandes de retrait | *Pilotage* : Répartition de dispatch · Chaînes de contrôle | Vérifications · Archivage des PV | Notifications |
| **Secrétaire** | À faire · Tous les dossiers | — | — | — | Notifications |
| **Membre** | À faire · Tous les dossiers | PV et lettres de renvoi | — | — | Notifications |
| **Vérificateur** | À faire · À vérifier · Vérifiés / clôturés | — | — | — | Notifications |
| **Assistant** | À faire · Tous les dossiers | — | *Archivage* : Lettres de renvoi reçues · PV reçus | — | Notifications |
| **Chargé de publication** | Publications · Documents publics | — | — | — | Notifications |
| **Administrateur** | *Suivi* : Tableau de bord global · Journal d'audit · Sessions | *Demandes* : Inscriptions en attente · Rattachements en attente | *Organisation* : Chaînes de contrôle · Comptes & hiérarchie — *Paramétrage* : Délais standards · Seuil AGPM (AMI) · Référentiels · Actualités — *Données* : PPM & marchés · Marchés & dates prév. | — | Notifications |

Libellés courts (rail, lot F4), repris de `D.MENU` des maquettes : À faire, Dossiers, Suivi, Créer,
Mise à jour, PV, Retraits, Charge, Chaînes, Vérif., Archives, Calendrier, Alertes.

**Écart assumé** : la maquette porte une entrée « Circuit » qui n'existe dans aucun menu de
l'application. Le L5 ne l'invente pas.

### 3.3 Le garde-fou de dérive

`groupes-menu.spec.ts` contient un test qui parcourt **les dix menus réels** de `NAV_BY_ROLE` et
échoue s'il trouve une entrée sans groupe explicite, avec un message de la forme :

> `« /admin/nouvelle-entree » n'a pas de groupe : ajouter une ligne à GROUPES_PAR_CHEMIN (groupes-menu.ts).`

C'est le seul endroit où l'ajout d'une entrée de menu par le patron nous concerne — et il le dit en
une ligne. À l'exécution, l'entrée non classée tombe dans le premier groupe : le menu reste correct,
seul le test est rouge (décision 5 si Mathieu préfère l'inverse).

---

## 4. Contrastes et état courant

### 4.1 L'entrée active

Aujourd'hui : texte à la couleur du profil sur fond pâle du profil, 2,97 à 3,29:1 pour quatre profils.

Retenu : **l'accent de profil quitte le texte.** On ajoute huit jetons d'encre, teinte et saturation
conservées, luminosité baissée juste assez — exactement la méthode déjà employée pour `--n-400` et
`--n-500` (AUDIT.md A2) :

| Jeton | Aujourd'hui | Proposé | Sur son fond |
|---|---|---|---|
| `--prmp-ink` | `#667eea` | **`#4462e5`** | 4,57:1 |
| `--membre-ink` | `#d97706` | **`#aa5d05`** | 4,57:1 |
| `--sec-ink` | `#0891b2` | **`#077792`** | 4,62:1 |
| `--assist-ink` | `#db2777` | **`#c9226c`** | 4,55:1 |
| `--pres-ink` · `--cc-ink` · `--verif-ink` · `--admin-ink` | inchangés | `#0369a1` · `#0e7c5a` · `#7c3aed` · `#374151` | 5,17 · 4,92 · 4,80 · 9,37:1 |

Le fond pâle du profil est conservé : sur la barre sombre, une pastille claire est un changement de
surface massif — l'état courant se voit **avant** d'être lu. S'y ajoutent le gras (déjà là), une
barre d'accent de 3 px à gauche **à l'intérieur** de la pastille (à la couleur d'encre, donc ≥ 4,5:1
sur ce fond ; posée sur le fond sombre elle tomberait à 1,35:1 pour l'Administrateur), et
`ariaCurrentWhenActive="page"` sur chaque `routerLinkActive`.

Les mêmes jetons d'encre corrigent `.profile-badge` de la barre du haut, qui affiche depuis le 15/09
le libellé français du profil sur ces mêmes paires.

### 4.2 Le reste

| Correction | De | À | Mesure |
|---|---|---|---|
| Entrée au repos | blanc 72 % | blanc 82 % | 5,73 → **6,91:1** |
| Sous-entrée | blanc 60 % | blanc 72 % | 4,52 → **5,73:1** |
| Chevron de groupe | blanc 40 % | blanc 55 % | 2,85 → **4,06:1** |
| Marque de délégation | opacité 0,65 | opacité 1, blanc 82 % | 3,37 → 6,91:1 |
| Pastille de compteur | `#0284c7` sur `#e8ecf4` | `#3b2500` sur `#fbbf24` (ambre des maquettes) | 3,46 → **8,67:1** |
| Pastille d'alerte | `--danger` | inchangée | 5,30:1 |
| Pastille teintée par profil | mixin `nav-accent` | **retirée du mixin** : la pastille ne dépend plus du profil | — |

La règle `--n-400` / `--n-500` reste intacte : aucune couleur de texte du corps de page n'est touchée.

---

## 5. Le rail compact (F4)

Une **bascule** du menu, pas un troisième gabarit : la même barre, la même liste, un état
`.sidebar--rail` à 76 px — icône 20 px au-dessus du libellé court, rubriques réduites à un filet,
état courant marqué par la pastille claire et la barre d'accent, pastille de compteur en haut à
droite de l'icône, infobulle et `aria-label` portant le libellé complet.

- **Commande** : un bouton « Réduire le menu » / « Déplier le menu » dans le pied de la barre, au-dessus
  de la carte de profil. Préférence mémorisée dans un `MenuCompactStore`, **exactement** sur le modèle
  de `DelegationsAffichageStore` : clé `cnm.menu-compact`, un booléen, **aucun matricule** (constat S9
  de l'audit), `try/catch` autour de `localStorage`, repli « déplié ».
- **Le mode concentration n'est pas touché** : sur l'examen, la vérification et la page dossier, la
  barre reste un tiroir à 0 px (décision 4 du plan L4, prise après mesure du plan à 13 colonnes). Le
  rail est l'état des écrans de liste, pas des écrans de travail.
- **Sous 768 px**, rien ne change : la barre est déjà un tiroir (`_responsive.scss`).
- Gain mesuré : +139 px de contenu utile sur les trois écrans visés (§1.4).
- Coût : le menu de l'Administrateur, 13 entrées, défile davantage en rail (≈ 52 px par entrée) qu'en
  étendu (≈ 34 px). C'est le seul profil concerné ; le critère d'acceptation le borne.

---

## 6. Les deux défauts connus repris dans le lot

**(a) Le ⏸ de la bannière de vacance PRMP** (`main-layout.html`) — dernier emoji de la coquille. Il
part en F5 avec l'icône `pause` (déjà dans `shared/ui/icone.ts`), au même titre que le `☰` du bouton
de tiroir (icône `menu`, à ajouter) et les chevrons `›` (icône `chev`). F5 se clôt par une spec de
garde : aucun caractère de la plage emoji dans `layout/` et `core/navigation/`.

**(b) La notification sans écran dédié du Chargé de publication** (défaut ancien, hors refonte).
`notification-center.ouvrir()` : quand `routePourNotification` ne rend rien et que la notification
porte un `idDossier`, on appelle `GET /api/dossiers/{id}` pour ouvrir la modale de consultation. Pour
le Chargé de publication et l'Administrateur, le serveur refuse — et la branche d'erreur est
`error: () => {}`. **Un clic ne fait donc rien, sans un mot.** C'est un cas de « 403 silencieux ».
F6 : pour un profil sans page dossier (`ESPACES_A_FAIRE` ne le connaît pas), on n'appelle pas le
serveur du tout ; la notification reste lisible, n'est pas cliquable, et porte la mention « aucun
écran dédié à votre profil ». Même traitement sur `/notifications`. La forme exacte relève de la
décision 6.

---

## 7. Les lots

Conventions communes : `git fetch` puis contrôle des fichiers chauds avant chaque lot ; un commit par
geste, lisible seul, au format du dépôt (`ux(coquille): …`, `feat(nav): …`, `fix(notifications): …`) ;
commits **locaux** sur `chantier/refonte-ergonomique`, **aucun push** ; `npm test` vert et
`npm run lint` sans erreur avant de clore un lot. Aucune dépendance npm nouvelle.

### L5-F1 — Table de regroupement dérivée (frontend-angular)
- **Fichiers** : `core/navigation/groupes-menu.ts` et `groupes-menu.spec.ts` — **deux fichiers neufs,
  rien d'autre**. Aucun appelant : le lot ne change rien à l'écran.
- **Contenu** : §3.1 et la table du §3.2.
- **Acceptation** :
  - `git diff --stat` ne montre que les deux fichiers neufs ; `navigation.ts` intact (`git diff` vide).
  - Spec : les dix menus de `NAV_BY_ROLE` passent dans `sectionsMenu` ; chaque entrée a un groupe
    explicite ; aucun groupe vide n'est rendu ; le Secrétaire, le Vérificateur, l'UGPM et le Chargé de
    publication produisent **une seule section sans intitulé** (menu inchangé à l'écran).
  - Spec : la section « Exercé par délégation » reste **la dernière**, garde `cle: 'delegation'`, son
    intitulé et son `repliable: true` ; un profil sans délégation active ne la voit pas.
  - Spec : `/president/retraits` et `/cc/retraits` tombent dans le même groupe par le seul suffixe.
  - Spec de dérive : message d'erreur nommant le chemin et le fichier à compléter.

### L5-F2 — Le menu s'affiche par groupes (frontend-angular)
- **Fichiers** : `layout/main-layout/main-layout.ts` (une ligne : `separerParDelegation` →
  `sectionsMenu`, plus `pied = piedMenu(...)`), `main-layout.html` (le bloc d'intitulé de section
  devient `<button>` si `section.repliable`, sinon un simple libellé ; l'entrée de pied est rendue
  au-dessus de la carte de profil), `main-layout.scss` (intitulé fixe, ≈ 22 px de haut).
- **Acceptation** :
  - Le repli des délégations fonctionne comme avant (même store, même infobulle, même
    `aria-expanded`) ; les intitulés de groupe, eux, ne sont **pas** des boutons.
  - À 1366×768, aucun menu ne défile, **sauf** l'Administrateur : au plus 80 px de défilement.
  - Aucun défilement horizontal dans la barre à 1229×691.
  - Spec de la coquille : pour le Président avec délégations actives, l'ordre des sections rendues est
    Mon travail, Décisions, Pilotage, Exercé par délégation ; « Notifications » n'est dans aucune
    section et apparaît une fois dans le pied.
  - Captures avant/après à 1366×768 pour Président, PRMP et Administrateur.

### L5-F3 — Contrastes de la coquille et état courant (frontend-angular)
- **Fichiers** : `styles/_design-system.scss` (huit jetons `--*-ink`, `.profile-badge`, opacités du
  bloc `.sidebar`), `layout/main-layout/main-layout.scss` (mixin `nav-accent`, pastilles, chevron,
  marque de délégation), `main-layout.html` (`ariaCurrentWhenActive="page"` sur les entrées).
- **Hors périmètre** : `--n-300` à `--n-900`, les couleurs sémantiques et toute couleur de corps de
  page. Le bloc `.sidebar` de `_design-system.scss` n'a pas été touché par le patron depuis le 28/08.
- **Acceptation** :
  - Les paires du §4 mesurées et consignées : entrée au repos ≥ 6,9:1, sous-entrée ≥ 5,7:1, chevron
    ≥ 4:1, entrée active ≥ 4,5:1 **pour les neuf profils**, pastille de compteur ≥ 8:1, pastille de
    profil de la barre du haut ≥ 4,5:1 pour les neuf profils.
  - `aria-current="page"` présent sur l'entrée active et sur elle seule (spec).
  - Le repère de focus `[data-focus-repli]` et la directive `appModale` du lot 4 fonctionnent
    inchangés : focus visible sur chaque entrée de menu, contour ≥ 3:1 sur le fond sombre.
  - Aucune régression de couleur hors coquille : `git diff` de `_design-system.scss` limité aux jetons
    de profil, à `.profile-badge` et au bloc `.sidebar`.

### L5-F5 — Marque, icônes restantes, plus aucun emoji (frontend-angular)
- **Fichiers** : `shared/ui/icone.ts` (icône `menu`, même grille 24 / trait 1,8) et sa spec ;
  `main-layout.html` (bouton de tiroir, chevrons, bannière de vacance, bloc de marque) ;
  `main-layout.scss` / `_design-system.scss` (`.sidebar-logo-mark`, `.sidebar-logo-text` : styles
  déjà écrits, jamais employés — on les branche au lieu d'en écrire).
- **Contenu** : la marque devient le bloc des maquettes — pastille « MEF », « PRS 2.0 », « Commission
  nationale des marchés » ; en rail, la pastille seule.
- **Acceptation** :
  - Spec de garde : aucun caractère emoji dans `src/app/layout/` ni `src/app/core/navigation/`
    (balayage par plages Unicode), assortie du motif à suivre pour en ajouter un.
  - Le bouton de tiroir garde son `aria-label` « Ouvrir le menu » et son `aria-expanded`.
  - La bannière de vacance reste **un seul `<span>`** dans le conteneur `.alert` (correctif `e667b1e`
    du 15/09, à ne pas défaire), avec l'icône hors du span de texte.
  - Captures : barre latérale et bannière de vacance avant/après.

### L5-F6 — Notification sans écran dédié (frontend-angular)
- **Fichiers** : `layout/notification-center/notification-center.ts`,
  `features/transverse/notifications-page.ts`, specs correspondantes.
  `core/notifications/notification-route.ts` n'est **pas** modifié : le repli est décidé par
  l'appelant, comme aujourd'hui.
- **Acceptation** :
  - Spec : pour `CHARGE_PUBLICATION` et `ADMINISTRATEUR`, une notification portant un `idDossier` sans
    route dédiée **n'émet aucune requête** (`HttpTestingController.verify()`) et n'est pas un `<button>`
    actionnable.
  - Spec : pour les huit profils du circuit, le repli mène toujours à la page du dossier (comportement
    du lot L4-F6, inchangé).
  - Vérifié en recette avec un compte Chargé de publication sur `PRS_RECETTE`.

### L5-F4 — Rail compact (frontend-angular)
- **Fichiers** : `core/preferences/menu-compact.store.ts` et sa spec (neufs) ; `main-layout.ts`
  (injection + bouton), `main-layout.html` (bouton de bascule, libellé court en rail),
  `main-layout.scss` (bloc `.sidebar--rail`, ≈ 60 lignes).
- **Acceptation** :
  - En rail : largeur 76 px, contenu utile 1 226 px à 1366 et 1 089 px à 1229 ; **aucun défilement
    horizontal** sur les trois tailles, sur un écran de liste dense (« Tous les dossiers »).
  - L'état courant reste identifiable en rail : pastille claire, barre d'accent, `aria-current`.
  - Chaque entrée du rail a un nom accessible complet (`aria-label` = libellé du menu), pas seulement
    le libellé court ; navigation au clavier de bout en bout, focus visible.
  - Le mode concentration reste un tiroir : sur `/<espace>/dossier/:id`, `/examiner/:id` et
    `/verifier/:id`, la barre est absente que la préférence soit à « rail » ou à « étendu » (spec).
  - La préférence survit à un rechargement et ne contient aucun matricule (spec du store).
  - Menu de l'Administrateur en rail à 1229×691 : défilement vertical accepté, tous les items
    atteignables au clavier.

### L5-Q1 — Recette contraste, focus et clavier (qa-test)
- **Portée** : les neuf profils sur `PRS_RECETTE`, à 1366×768.
- **Attendu** :
  - Relevé chiffré des paires du §4 mesurées **dans le navigateur** (couleur calculée, pas la feuille
    de style), et comparaison à la table.
  - Parcours clavier complet de la coquille : lien d'évitement, bouton de tiroir, recherche, chaque
    entrée de menu, repli des délégations, cloche, pied de barre, contenu. Focus visible partout, aucun
    piège, ordre conforme à l'ordre visuel.
  - Un lecteur d'écran annonce l'entrée courante (`aria-current`) et le titre de la page atteinte
    (région live existante).
  - Captures légendées à 1366×768 (préférence de Mathieu), un jeu par profil.

### L5-Q2 — Recette des dix menus × trois tailles (qa-test)
- **Attendu** :
  - Pour chacun des dix profils et chacune des trois tailles (1366×768, 1536×864, 1229×691) : capture
    du menu étendu et du menu en rail ; `document.documentElement.scrollWidth <= clientWidth` vérifié.
  - Le Président et le CC avec délégations actives : la section « Exercé par délégation » est bien la
    dernière et se replie.
  - Aucun libellé tronqué sans infobulle ; aucun libellé court ambigu entre deux entrées d'un même menu.
  - Règle C2 : rien d'interne à la CNM dans la coquille côté PRMP et UGPM — ni nom de contrôleur, ni
    intitulé de rubrique interne ; les compteurs affichés à la PRMP sont ceux qu'elle voit déjà.
  - Non-régression du mode concentration et de la page dossier du lot 4.

### L5-D1 — Clôture (docs)
- **Fichiers** : ce plan (section « Ce qui a été livré », au format du plan L4) ; une note de
  convention dans `frontend/CLAUDE.md` : *où ajouter une entrée de menu et où lui donner son groupe*.
- **Acceptation** : la note tient en cinq lignes et nomme les deux fichiers.

---

## 8. Décisions tranchées par Mathieu (16/09/2026)

1. **Les rubriques et leur contenu (§3.2).** **Adopté** : la table telle quelle, y compris les cinq
   rubriques de l'Administrateur (Suivi, Demandes, Organisation, Paramétrage, Données), qui n'étaient
   dans aucune maquette. *Option écartée, pour mémoire* : revoir ce découpage avant livraison, faute de
   maquette de référence.
2. **Le rail : bascule ou automatique ?** **Adopté** : **bascule par l'utilisateur, mémorisée, menu
   large par défaut**, et le mode concentration reste un tiroir. *Option écartée, pour mémoire* :
   replier automatiquement sous une certaine largeur d'écran — cela retirerait le menu à quelqu'un qui
   ne l'a pas demandé, en conflit avec la décision 4 du plan L4.
3. **L'accent de profil : texte ou barre ?** **Adopté** : l'accent quitte le texte. Le texte actif
   prend l'encre foncée du profil (≥ 4,5:1 partout), l'accent passe dans une barre de 3 px à
   l'intérieur de la pastille. *Option écartée, pour mémoire* : garder l'accent dans le texte et
   l'éclaircir juste assez pour passer le seuil.
4. **Les pastilles de compteur : ambre unique ou teintes par sévérité ?** **Adopté** : ambre unique
   (`#3b2500` sur `#fbbf24`, 8,67:1) pour les compteurs, rouge réservé à l'alerte. *Option écartée,
   pour mémoire* : conserver les quatre teintes de sévérité — elles ne se distinguaient pas dans une
   barre sombre et trois d'entre elles passaient sous le seuil.
5. **La spec de dérive : rouge ou tolérante ?** **Adopté** : rouge, avec un message qui donne la ligne
   exacte à écrire (`groupes-menu.spec.ts`). *Option écartée, pour mémoire* : un test tolérant qui ne
   fait jamais rougir la suite à cause d'un ajout du pilote, le classement se rattrapant en recette.
6. **La notification sans écran dédié (§6b).** **Adopté** : notification non cliquable, mention
   « Aucun écran dédié à votre profil pour ce dossier. », aucun appel au serveur. *Option écartée, pour
   mémoire* : ouvrir `/notifications` avec un message — un aller-retour pour aboutir au même constat.

**Question ouverte, pas une décision** : le Chargé de publication reçoit des notifications de dossiers
qu'il ne peut pas consulter. Le correctif d'écran (livré en F6, §10) les rend honnêtes, il ne règle pas
la cause. Faut-il ouvrir une demande backend pour qu'il cesse d'en recevoir ? C'est un lot séparé, hors
L5.

---

## 9. Ce que le L5 ne fait pas

- Il ne touche à **aucune donnée de menu** : ni ajout, ni retrait, ni renommage d'entrée.
- Il ne crée **aucun écran** et ne déplace aucune route.
- Il ne reprend pas les trois niveaux d'imbrication du gabarit (`children`), inemployés aujourd'hui :
  ils restent en place, intacts, et le regroupement les traverse sans les modifier.
- Il ne retire pas les styles morts de `_design-system.scss` autres que ceux que F5 rebranche
  (`.sidebar-logo-*`) : `.nav-sub`, `.nav-sub-item`, `.nav-section-label` et `.nav-divider` attendent
  un lot de nettoyage séparé, avec les deux écrans orphelins signalés en clôture du L4.
- Il ne remet pas en cause la décision 4 du plan L4 (tiroir en mode concentration).
- Il ne touche à aucun endpoint : **aucune demande backend**, aucune migration.

---

## 10. Ce qui a été livré

État relevé le 16/09/2026, après que la recette finale a déclaré le lot publiable. Neuf commits
locaux sur `main`, non poussés : `104e528` à `af94f03` (`git log --oneline e074646..af94f03`).

- **L5-F1** (table de regroupement dérivée) — livré, `104e528`. `core/navigation/groupes-menu.ts` et
  sa spec, deux fichiers neufs ; `git diff` de `navigation.ts` vide. La table adoptée est conforme au
  §3.2 (décision 1), y compris les cinq rubriques de l'Administrateur.
- **L5-F3** (contrastes de la coquille et état courant) — livré, `436c528`. Huit jetons `--*-ink`,
  accent de profil sorti du texte, `aria-current="page"` posé, pastille de compteur en ambre unique.
  `scripts/contrastes-coquille.mjs` créé dans ce commit : 55 paires mesurées, 13 sous leur seuil avant,
  aucune après.
- **L5-F5** (marque, icônes restantes, plus aucun emoji) — livré, `b154319`. Icônes `pause`, `menu` et
  `chev` remplacent les derniers glyphes détournés ; bloc de marque des maquettes du 14/09 (pastille,
  « PRS 2.0 », « Commission nationale des marchés ») ; spec de garde sur le DOM rendu de `layout/`
  (aucun caractère de la plage emoji, des flèches ou des dingbats).
- **L5-F6** (notification sans écran dédié) — livré, `71788f4`. La règle se lit sur la donnée
  (`routePourNotification` + `ESPACES_A_FAIRE`), pas sur une liste de profils ; zéro appel au serveur
  pour un profil sans page dossier, vérifié sur les huit profils restants. Recette sur une copie de
  `PRS_RECETTE` avec CTRPUB1 et ADMIN01.
- **Correctif de focus** (hors lots nommés du plan, entre F3 et F2) — livré, `51b81ce`. Le repère de
  focus global (`--p-400`, 4,42:1 sur la barre sombre) ne tenait que 2,14:1 sur le blanc de la barre du
  haut ; la coquille seule passe à `--p-700` (5,93:1). Relevé en parcourant la coquille au clavier après
  F3.
- **L5-F2** (le menu s'affiche par groupes) — livré, `eb516b6`. `sectionsMenu` et `piedMenu`
  remplacent la liste plate ; « Notifications » descend au pied de la barre, séparée d'un filet, hors
  des dix menus. Mesuré à 1366×768 : seul le menu de l'Administrateur défilait, de 59 px — repris par
  le correctif de hauteurs ci-dessous.
- **L5-F4** (rail compact) — livré, `6b5c1f2`. `MenuCompactStore` (neuf, calqué trait pour trait sur
  `DelegationsAffichageStore`) et l'état `.layout--rail` ; contenu utile porté à 1 290 px à 1366×768 et
  1 153 px à 1229×691. **Écart au plan** : le bouton de bascule vit dans la barre du haut
  (`.topbar-compact`), pas au pied du menu comme prévu au §5 — une ligne de commande au pied coûtait
  28 px de hauteur, près de la moitié du budget que la reprise de hauteur sert justement à rendre. Au
  passage, `--sidebar-w` (`_design-system.scss`) est devenue la source unique de la largeur de la barre,
  écrite trois fois avant ce commit.
- **Correctif de hauteurs** (hors lots nommés du plan, immédiatement après F4) — livré, `6b6ac39`. F2
  avait porté le défilement du menu de l'Administrateur à 136 px à 1229×691 et 59 px à 1366×768, contre
  un critère de lot à 80 px. Repris sur quatre postes de densité déclarés dans `_design-system.scss`
  (entrée de menu, intitulés de rubrique, bloc de marque, carte de profil) : entrée ramenée à 34 px,
  toujours au-dessus de la cible WCAG 2.2 (2.5.8, 24 px).
- **Correctif de noms accessibles** (hors lots nommés du plan, dernier commit du lot) — livré,
  `af94f03`. WCAG 2.5.3 « Label in Name » : cinq légendes du rail étaient des synonymes de leur libellé
  complet plutôt qu'un fragment (Charge, Alertes, Mise à jour, Archives, Retraits) ;
  `nomAccessibleRail()` préfixe désormais le mot visible au libellé complet pour ces cinq entrées
  seulement. Relevé dans l'arbre d'accessibilité Chromium sur les dix profils : 18 échecs avant, zéro
  après, sur 64 occurrences d'entrée.
- **L5-Q1 / L5-Q2** (recettes contraste, focus, clavier, dix menus × trois tailles) — menées, mais sans
  commit propre : leurs résultats vivent dans les messages de `6b5c1f2` (10 profils × 3 tailles × 2
  modes, 60 paires de contraste, 0 sous le seuil, 24 contrôles de mémorisation / concentration /
  clavier / focus, 586 tests) et de `71788f4`, et dans le relevé Chromium d'`af94f03`. Comme pour le
  lot 4, ces preuves (captures légendées à 1366×768) vivent hors des deux dépôts et n'ont pas été
  retrouvées à la clôture — non confirmées de première main depuis ce lot de documentation.

### Ce qui reste ouvert

- La préférence de rail est **partagée entre comptes d'un même navigateur** (arbitrage assumé, décision
  2 du §8) : sur un poste partagé, le second compte hérite du réglage laissé par le premier — aucun
  matricule n'est en jeu, mais le réglage n'est pas personnel.
- Le repère de focus global (`--p-400`) ne tient pas le contraste sur les fonds clairs **hors
  coquille** : seule la coquille a été corrigée (`51b81ce`, §10). Le même défaut existe sur tous les
  autres écrans de l'application — lot à part entière.
- Environ 320 lignes de glyphes détournés subsistent **ailleurs** dans `src/` : F5 n'a nettoyé que
  `layout/` et `core/navigation/` (c'était son périmètre, §7). Lot de nettoyage à part.
- Le filet du pied de menu (`.sidebar-nav__pied`, bordure blanc à 12 % d'opacité) reste à 1,38:1, et
  `.nav-chevron` n'est pas masqué en rail — sans effet aujourd'hui, puisqu'aucun menu de `NAV_BY_ROLE`
  n'a d'enfants (`children` inemployé, §1.2 et §9).
- `$sidebar-w` (`src/styles/_responsive.scss`), variable Sass morte, annotée comme telle dans le
  fichier depuis F4 : la largeur de la barre est portée par le seul jeton CSS `--sidebar-w`
  (`_design-system.scss`), qui change de valeur à l'exécution — ce qu'une variable Sass ne peut pas
  faire.
- Le Chargé de publication reçoit des notifications de dossiers qu'il ne peut pas consulter : F6 rend
  le clic honnête (§6b, §8), il ne règle pas la cause côté serveur. Question ouverte du §8 : ouvrir une
  demande backend pour qu'il cesse d'en recevoir — un lot séparé, hors L5.
