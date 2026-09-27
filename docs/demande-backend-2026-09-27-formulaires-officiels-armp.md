# Demande backend — 2026-09-27 — Les formulaires du candidat sur les documents types officiels (ARMP)

**Origine** : `docs/audit-2026-09-27-coherence-fiche-a-commande-vs-documents-types.md` et l'arbitrage du pilote du
27/09 : « Ajuster par rapport aux officiels ». Les six modèles A1-A4, C1, C2 livrés en V47 sont décalqués du dossier
réel 2463 (pages 20-34) ; les **documents types officiels** de l'ARMP, déposés le 27/09 dans
`frontendprs2/Documents Types/Fournitures et services/` (`3-Document type d'appel d'offres_Fournitures_Formulaires de
soumission.doc`), montrent que le 2463 en est une **adaptation locale** : nos modèles ne s'y retrouvent qu'à 36 % (C1)
– 79 % (A1). Le gabarit ARMP fait désormais modèle.

## Ce que le front fait

- Les six fichiers de commande sont **récrits depuis le document type** dans `scripts/modeles-candidat/modeles-armp/`
  (même format Decalque : `FICHIER`, `TITRE`, `PARA`, `TABLE`, `LIGNE`… ; mêmes jetons `{{CODE}}`, `.lettres`,
  `.doublet`, `{{DERIVE.…}}`, marqueurs `{{SI:…}}`). Les crochets `[…]` du gabarit qui désignent une saisie **du
  candidat** restent des crochets ; ceux qui désignent une donnée **du dossier** deviennent des jetons de la fiche.
- **C1 est livré** (ce jour, `scripts/modeles-candidat/modeles-armp/C1.txt`, rendu de relecture
  `docs/modeles-candidat/armp/C1.docx`) : 13 paragraphes officiels, tous retrouvés tels quels dans le rendu Decalque.
  Jetons : `{{B02-OB-03}}`, `{{B02-OB-01}}`, `{{B01-AC-01}}`, `{{B05-GS-03.lettres}}`, `{{B05-GS-03}}` et, pour la
  validité, `{{B05-GS-04}}` suivi du « ème jour » du gabarit (« [durée de validité des offres + 30 jours] ème jour ») —
  le nombre nu, pas le doublet. Le « trentième (30ème) jour » y est **fixe** (le gabarit le fixe) : le jeton
  `{{DERIVE.delai-garantie.doublet}}` du modèle 2463 n'y a plus d'objet. Les crochets restants sont ceux du candidat
  (nom, date de l'offre, banque, siège).
- **A1, A2, A3, A4, C2 suivent** sur le même patron, chacun vérifié paragraphe par paragraphe contre le `.doc` (la
  chaîne `scripts/modeles-candidat` gagne une source `source-armp.txt` et un comparateur sur le texte du document type).
  Les questions structurantes du 26/09 restent : A1-b conditionné au cadrage `groupement` (`{{SI:A1B}}`), A3-b
  natures (`{{SI:A3B-NATURES}}`), durées des antécédents `B03-CQ-09` / `B03-CQ-10` — à re-vérifier sur le texte ARMP.

## B1 — Le moteur rend les modèles ARMP

- Remplacer, dans `modeles/candidat/*.txt` du backend, les six fichiers 2463 par ceux de `modeles-armp/` **au fur et à
  mesure de leur livraison** (C1 d'abord), sans autre changement du moteur : mêmes commandes, mêmes jetons.
- Un jeton **absent** du contrat des jetons (V47) serait un refus à nous signaler nommément, pas un rendu partiel.

## B2 — La preuve

- Comme au 26/09 : les rendus du serveur (docx) passent le comparateur du front (`verifier.mjs --dossier=`), source =
  le texte du document type. Six rendus identiques → le modèle est officiel.

## B3 — Ce qui change pour la PRMP du 2463

- Les formulaires produits pour le dossier 2463 **ne seront plus ceux de son propre dossier** mais ceux de l'ARMP :
  c'est un point d'**errata** de plus à porter à la PRMP (E8 : « vos formulaires A1-A4/C1/C2 s'écartent du document
  type officiel ; la fiche produit désormais les officiels »).

## Ce que le backend rend

B1 pour C1 dès maintenant, puis les cinq autres à leur livraison ; B2 à chaque fois ; un mot ici si la livraison
s'écarte de la demande (encadré ⚠️ daté, à l'endroit corrigé).
