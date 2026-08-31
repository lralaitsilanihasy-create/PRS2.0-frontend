# Demande au backend `PRS20` — 31 août 2026 — « Visa unique »

> Document destiné à la session backend. Émis depuis le front `frontendprs2` (dernier commit
> `ffd84a8`, poussé). **Réforme du contrat de la navette du PV, arbitrée par le pilote le 31/08** —
> le front suivra une fois le backend livré (rien n'est codé côté front en anticipation).
>
> Les quatre arbitrages rendus :
>
> | | Question | Décision |
> |---|---|---|
> | 1 | Ordre de livraison | **Backend d'abord** — ce document est la spec ; le front s'aligne ensuite |
> | 2 | Forme de la clôture | **Un seul geste « viser »** — l'étape `accepter` disparaît, fusionnée avec la signature P/CC |
> | 3 | Secrétaire de séance | **Inchangé** : posé au visa par le Président/CC (seul l'avis change de main) |
> | 4 | Qui vise | **Contrainte stricte** : seul le P/CC **qui a fait le dispatch** du dossier |

---

## 1. Workflow cible

**Règle métier énoncée par le pilote** : « Le Membre qui fait l'examen du dossier émet son avis à la
fin de l'examen. Cet avis peut être modifié à la fin de la navette, qui finit par le visa du
Président ou du CC qui a fait le dispatch. Le visa consiste à choisir le co-signataire et à faire sa
part de signature. »

Cela **inverse la règle du 01/08** (avis posé par le P/CC à `accepter`, PV créé avec avis NULL) et
**fusionne** `accepter` + `signer(role=PRESIDENT|CC)` en un geste unique.

| Étape | Aujourd'hui (règle 01/08 + co-signature e8b5b2e) | Cible |
|---|---|---|
| Soumission d'examen (Membre) | Synthèse seule, avis NULL | Synthèse **+ avis obligatoire** (pré-rempli par `avisSuggere` côté front) |
| Navette (`retourner` / re-soumettre) | Inchangée | Inchangée — le Membre peut ajuster son avis à chaque re-soumission |
| Clôture (P/CC) | 2 gestes : `accepter` (avis + secrétaire) → PROJET_ACCEPTE, puis `signer(P/CC)` (+ désignation co-signataire) | 1 geste : **`viser`** = avis éventuellement modifié + secrétaire de séance + co-signataire + part de signature du rôle → PROJET_ACCEPTE |
| Part Membre | `signer(role=MEMBRE)` par le désigné seul | Inchangée → SIGNE |

Le cycle d'états du PV ne change pas : `BROUILLON → PROJET_SOUMIS → (EN_RECTIFICATION ⇄) →
PROJET_ACCEPTE → SIGNE`. `PROJET_ACCEPTE` devient l'état « visé, en attente de la co-signature du
Membre désigné » ; `dateAcceptation` = date du visa.

---

## 2. `POST /api/examens/{id}/soumettre` — l'avis redevient obligatoire

- `idAvis` **obligatoire** (400 champ si absent) — inversion de la règle du 01/08. Le PV est créé
  avec l'avis du Membre.
- **Garde de cohérence déplacée** : ≥ 1 observation relevée (points de contrôle non conformes +
  pièces non conformes) → `FAV` refusé (409, comme aujourd'hui à `accepter`). Zéro observation :
  tout avis accepté.
- `idSecretaireSeance` reste **absent** de la soumission (posé au visa — arbitrage 3).
- Chaque **re-soumission** (navette, `A_REEXAMINER`) porte de nouveau l'avis : le Membre peut le
  changer d'un cycle à l'autre.

---

## 3. Nouveau `POST /api/pv-examens/{id}/viser` — la clôture en un geste

Remplace `accepter` **et** `signer(role=PRESIDENT|CC)`. Corps proposé (extension de
l'actuel `PvActionRequest`) :

```jsonc
{
  "imActeur": "…",                 // obligatoire — doit être LE DISPATCHEUR (cf. §4)
  "idAvis": "FAVR",                // OPTIONNEL : absent/null = avis du Membre conservé ;
                                   // fourni = le remplace (garde de cohérence revalidée)
  "idSecretaireSeance": "…",       // obligatoire (400) — règles §3.3 inchangées
  "imMembreCoSignataire": "…"      // obligatoire (400) — règles e8b5b2e inchangées
}
```

Pas de champ `role` : la part signée est **dérivée du profil de l'acteur** (PRESIDENT → part
Président, CHEF_COMMISSION → part CC ; autre profil → 403).

Effets, en une transaction :
1. avis éventuellement remplacé (revalidation : ≥ 1 observation → `FAV` refusé, 409) ;
2. `idSecretaireSeance` posé (gardes existantes : Vérificateur **titulaire de la localité** du
   dossier OU contrôleur couvert par une paire « → Vérificateur » active dans son périmètre ;
   mention « (par délégation) » sur le document conservée) ;
3. `imMembreCoSignataire` posé (gardes existantes : Membre de la localité, ≠ acteur — 409) ;
4. part de signature du rôle posée (verrou « une signature par rôle » conservé) ;
5. `statutPv` → `PROJET_ACCEPTE`, `dateAcceptation` = maintenant ;
6. notification `PV_A_COSIGNER` au Membre désigné (inchangée).

Gardes d'état : 409 si `statutPv` ∉ {`PROJET_SOUMIS`, `PROJET_ACCEPTE` non signé du rôle — cf.
transition §7}.

`accepter` : **supprimé** (ou 410 explicite) — le front ne l'appellera plus.
`signer` : **réduit au rôle MEMBRE** (409/403 inchangés : 409 sans désigné, 403 si l'acteur n'est
pas le désigné). Un `signer(role=PRESIDENT|CC)` devient un 409 orientant vers `viser`.

---

## 4. Contrainte stricte : seul le dispatcheur vise

- **Définition** : le dispatcheur = `imCtrlDispatch` du **dernier dispatch** du dossier.
- Garde sur `viser` : 403 si `imActeur` ≠ dispatcheur (même Président, même paire de délégation
  active — la contrainte est une contrainte d'**identité**, pas de profil, dans la ligne de
  l'invariant du 15/08 : les actes d'identité ne se délèguent pas).
- **`PvExamenDto` expose `imDispatcheur`** (et idéalement `nomDispatcheur` résolu, comme
  `nomMembreCoSignataire`) — le front en a besoin pour masquer/désactiver le bouton « Viser » chez
  un P/CC non dispatcheur **sans appel supplémentaire** (le front ne charge pas le dispatch sur
  l'écran du PV).
- Conséquence assumée : dispatcheur indisponible ⇒ PV non visable ; le déblocage est un
  **re-dispatch** (qui change le dispatcheur). À confirmer que rien ne s'y oppose côté serveur.

---

## 5. Notifications

- `PV_A_VALIDER` (« projet soumis, à traiter ») : cibler **le dispatcheur seul** (aujourd'hui les
  P/CC au sens large) — cohérence avec la garde du §4.
- `PV_A_COSIGNER` : inchangée (déjà livrée le 28/08).

---

## 6. Transition des données au déploiement

- PV en **navette** (`PROJET_SOUMIS`, avis NULL) au moment du flip : le visa fournira l'avis
  (`idAvis` du corps obligatoire de fait quand l'avis du PV est NULL — 409 « avis requis » si le
  corps ne le fournit pas ET que le PV n'en porte pas).
- PV **`PROJET_ACCEPTE` sans part P/CC signée** (acceptés sous l'ancien contrat) : `viser` est
  accepté sur cet état tant que la part du rôle n'est pas posée — il complète désignation +
  signature sans re-exiger ce qui est déjà posé (avis/secrétaire fournis = remplacent, absents =
  conservés).
- PV `PROJET_ACCEPTE` avec part P/CC signée, en attente de co-signature : rien à faire
  (`signer(MEMBRE)` inchangé).
- Examens en cours de saisie (brouillons serveur) : la soumission exigera l'avis — aucun impact de
  données, c'est le front qui fournira le champ.

---

## 7. Questions ouvertes (recommandation du front incluse)

1. **`retourner`** (renvoi au Membre pendant la navette) : reste ouvert au **rôle** P/CC (tâche
   d'instruction, délégable — invariant du 15/08), ou aligné sur la contrainte stricte du
   dispatcheur ? **Recommandation : rôle**, le visa seul est strict — sinon l'absence du
   dispatcheur fige aussi la navette, pas seulement sa clôture.
2. Le backend actuel **ignore-t-il ou refuse-t-il** `idAvis` à la soumission (règle 01/08) ? Selon
   la réponse, le flip est compatible ascendant ou non avec un front non encore livré — dans les
   deux cas le front suivra immédiatement, mais dites-nous l'ordre de déploiement souhaité.

---

## 8. Ce que le front livrera une fois le backend en place

1. **Écran d'examen (Membre)** : champ « Avis global * » dans le volet Synthèse, pré-rempli par
   `avisSuggere` (FAVR si ≥ 1 observation, FAV sinon), modifiable, obligatoire à la soumission ;
   hint réécrit (« votre avis pourra être ajusté par le Président/CC au visa »).
2. **`pv-workflow`** : fusion des panneaux « Clôture de la navette » et « Désignation » en un
   panneau **« Viser »** (avis pré-rempli par celui du PV + secrétaire de séance + co-signataire,
   un seul POST) ; bouton réservé au dispatcheur (`imDispatcheur` du DTO), avec raison écrite pour
   un P/CC non dispatcheur plutôt qu'un 403 subi.
3. Modèles/services : `viser()`, `ExamenSoumissionRequest.idAvis` requis, `PvExamen.imDispatcheur`,
   commentaires de règles mis à jour (01/08 → 31/08).
4. Tests unitaires + e2e Playwright sur le parcours complet (soumission avec avis, visa,
   co-signature).
