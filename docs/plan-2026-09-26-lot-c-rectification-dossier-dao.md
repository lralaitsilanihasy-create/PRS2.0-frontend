# Plan — lot C : la rectification d'un dossier DAO après le PV (2026-09-26)

**Pour le pilote.** Le lot B a rendu l'examen d'un dossier d'appel d'offres capable de viser une information
précise de la fiche DAO (`idDmc` + `champFiche`), et le PV le dit. Rien ne ramène encore ces observations à la
PRMP pour qu'elle corrige la fiche : c'est la boucle à fermer. Ce plan dit ce qui existe, ce qui manque, comment
je propose de le construire, et ce que vous avez à trancher avant que je code.

## 1. Ce qui existe, et ce qui manque

| | Dossier PPM (aujourd'hui) | Dossier DAO (aujourd'hui) |
|---|---|---|
| Avis **favorable avec réserves** (FAVR) | PV signé → `EN_VERIFICATION` → le Vérificateur statue chaque observation (levée / maintenue) → `EN_ATTENTE_DECISION_PRMP` → la PRMP **ré-importe le PPM rectifié** + pièces corrigées → « Enregistrer et resoumettre » → retour au Vérificateur, jusqu'à toutes levées → SIGMP → archivage | Même circuit jusqu'au Vérificateur (la carte partagée dit déjà l'information de la fiche visée, avec « Ouvrir la fiche »). Puis **rien** : l'écran « Rectifier » ne connaît que le PPM (il ré-importe un plan, ignore `idDmc`), et la resoumission ne sait pas ce qu'est une fiche corrigée |
| Avis **défavorable** (lettre de renvoi) | Lettre signée → `EN_ATTENTE_PIECES` → la PRMP dépose des compléments → `POST /transmettre-complements` → `A_REEXAMINER` → le Membre réexamine (mode reprise) → nouveau projet de PV | Même circuit. Mais le « complément » d'un DAO est une **fiche révisée**, et le réexamen ne sait pas **ce qui a changé** entre la version examinée et la nouvelle |
| Correction de la fiche | — | `POST /api/fiches-marche/{idDmc}/reviser` ouvre la version n+1 (brouillon, copie de la validée) ; l'écran de la fiche a « Ouvrir une nouvelle version » et l'aide « ancienne valeur » (V46) ; la validation produit les documents. **Aucun lien avec le dossier soumis** : la validation ne remplace pas ses pièces, et `POST …/dossier` répond 409 `DOSSIER_EXISTANT` |

## 2. Les principes que je propose

1. **La rectification d'un dossier DAO, c'est une révision validée de la fiche** (piste 2, arbitrée le 26/09) —
   jamais un ré-import, jamais un nouveau dossier. Le dossier garde sa référence (`00001/DAO/CNM/2026`), son
   circuit et son PV ; c'est la fiche qui change de version.
2. **L'observation mène à la cellule.** Depuis « Rectifier », chaque observation ancrée ouvre la révision **sur
   l'information visée**, l'observation affichée en marge de la cellule. C'est le bénéfice du lot B.
3. **Les documents régénérés remplacent les pièces produites** du dossier (les 22 pièces nées de la fiche), la
   version précédente conservée pour la traçabilité — comme les « pièces corrigées » d'un PPM. Les pièces déposées
   à part par la PRMP (CCAG, CCTP, avis, estimation, garantie) se corrigent comme aujourd'hui.
4. **Le réexamen ne regarde que ce qui a changé** : les informations différentes entre la version examinée et la
   version revalidée, servies par le serveur, mises en évidence dans le document de l'examen ; les observations
   du PV précédent restent lisibles à leur cellule.
5. **Rien n'est deviné côté front** : la version examinée, la liste des informations changées, la valeur actuelle
   d'une information observée viennent du serveur (demande jointe).

## 3. Les lots, dans l'ordre

### C1 — « Rectifier un dossier DAO » (PRMP, chemin FAVR) — *le lot qui ferme la boucle*
- `dossiers-a-rectifier` (déjà générique sur `EN_ATTENTE_DECISION_PRMP`) mène, pour un dossier qui porte un
  `idDmc`, à un écran de rectification **propre au DAO** (`prmp/rectifier-dossier-dao`), trois étapes :
  1. **Observations du PV** — les cartes partagées, chacune avec « Corriger dans la fiche » →
     `/prmp/dao/:idDmc?reviser&champ=B05-GS-03%232` ; compteur « n à satisfaire » comme aujourd'hui.
  2. **La fiche révisée** — l'état de la révision : *à ouvrir* (bouton « Ouvrir la révision » = `POST /reviser`),
     *en cours* (« Reprendre », progression), *validée* (version n+1, date, liste des informations changées
     avant → après, documents régénérés). Tant qu'elle n'est pas validée, la resoumission est fermée.
  3. **Pièces déposées à part — versions corrigées** — la section existante, réutilisée.
  - « Décrire et resoumettre le dossier » = `POST /resoumettre { motifRectification }` (geste unique, comme le
    PPM) → retour au Vérificateur.
- Fichiers : `features/prmp/rectifier-dossier-dao.ts` (nouveau), `dossiers-a-rectifier.ts` (aiguillage),
  `prmp.routes.ts`, `services/fiche-marche.services.ts` (versions, documents).

### C2 — La fiche en révision « à l'endroit exact »
- L'écran de la fiche accepte `?champ=<clé>` (défile et met en évidence la cellule) et `?reviser` (ouvre la
  révision si la fiche est figée et qu'aucun brouillon n'est en cours).
- **Les observations du PV en marge** : quand la fiche porte un dossier soumis, l'écran lit
  `GET /api/observations-pv?dossier=` et pose, à côté de chaque cellule visée, l'observation (au lieu de → lire,
  statut levée / maintenue). Le patron est celui de `fiche-dao-doc` (pastilles), en édition.
- Fichiers : `fiche-marche.ts/.html/.scss`, `fiche-marche-modele.ts` (diff de deux versions : réutilise la
  mécanique de `aidesRevision`).

### C3 — Le Vérificateur voit la valeur actuelle
- La carte partagée affiche, sous la valeur **observée** (figée), la valeur **actuelle** de l'information servie
  par le serveur (B4 de la demande) : « observée « 2 170 000 Ariary » → actuelle « 2 000 000 Ariary » ». Il
  statue en connaissance de cause, sans ouvrir la fiche.
- Fichiers : `shared/circuit/observation-pv-card.ts` (+ spec), `verifier-dossier.ts` (rien ou presque).

### C4 — Le réexamen par la Commission (chemin lettre de renvoi)
- `examen-dossier` lit `perimetre.ficheDao` (B5) : le document `fiche-dao-doc` reçoit la liste des informations
  changées et les marque (« modifiée », ancienne valeur au survol) ; les points de la grille DAO sont réévalués,
  les observations du PV précédent lisibles à leur cellule ; « Enregistrer le réexamen » inchangé.
- « Transmettre les compléments » (PRMP, `EN_ATTENTE_PIECES`) : pour un DAO, le complément est la fiche
  révisée et validée (garde B3), plus les pièces déposées.
- Fichiers : `examen-dossier.ts`, `shared/prmp/fiche-dao-doc.ts` (+ specs), écran des compléments côté PRMP.

### C5 — La lettre de renvoi nomme l'information
- La consultation de la lettre (PRMP) et son PDF (backend, B6) disent « Information de la fiche DAO : … — lot n »
  pour chaque observation ancrée. Fichier : `circuit/lettre-renvoi-consultation.ts`.

## 4. La recette prévue (sur la base rejouée aujourd'hui)
PV 41 `00001/DAO/CNM/PV/2026` (FAVR, trois observations ancrées) → visa du Président, signatures →
`EN_VERIFICATION` → VERANT1 **maintient** l'observation 1 (garantie lot 2) et lève 2 et 3 →
`EN_ATTENTE_DECISION_PRMP` → LERAVO : « Rectifier » → « Corriger dans la fiche » → révision v2, `B05-GS-03#2` =
2 000 000 → validation (documents régénérés, pièces remplacées) → « Décrire et resoumettre » → VERANT1 voit
« observée 2 170 000 → actuelle 2 000 000 », lève → `OBSERVATIONS_LEVEES` → SIGMP → archivage. Puis le chemin
lettre de renvoi sur un second dossier (avis DEF) pour C4.

## 5. Ce que vous avez à trancher
- **Q1 — L'ordre.** C1 + C2 + C3 d'abord (le chemin FAVR ferme la boucle avec le Vérificateur existant), C4 + C5
  ensuite. D'accord ?
- **Q2 — Les pièces produites.** À la validation de la révision, les 22 documents régénérés **remplacent**
  automatiquement les pièces produites du dossier (l'ancienne version conservée) — ou la PRMP les redépose une
  à une ? Je recommande le remplacement automatique : ce sont les documents de la fiche, pas des dépôts.
- **Q3 — Réviser pendant l'examen.** La fiche d'un dossier en cours d'examen (dispatché, examiné, PV en navette)
  est-elle **verrouillée** jusqu'au retour à la PRMP ? Je recommande oui : la Commission examine une version
  stable ; la révision s'ouvre à `EN_ATTENTE_DECISION_PRMP` ou `EN_ATTENTE_PIECES`.
- **Q4 — Le périmètre du réexamen (C4).** Tous les points de la grille DAO sont-ils réévalués, ou seulement ceux
  dont une observation visait une information changée ? Je recommande **tous les points, les changements mis en
  évidence** : un point DOSSIER porte un jugement d'ensemble, et douze points se relisent en quelques minutes.

## 6. Dépendances
Tout ce qui vient du serveur est dans `demande-backend-2026-09-26-rectification-dossier-dao.md` (B1 à B6). Le
front ne code rien contre un contrat non servi ; C2 (lien profond, observations en marge) et l'aiguillage de C1
peuvent démarrer sans attendre, le reste suit la livraison.
