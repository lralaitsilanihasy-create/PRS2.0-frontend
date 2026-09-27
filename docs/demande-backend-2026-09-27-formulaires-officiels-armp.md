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
- **Chaîne ARMP (27/09, second temps)** — les modèles ne sont plus écrits à la main mais **décrits** depuis le texte du
  document type, comme les décalques du 2463 : `extraire-armp.mjs` (Word convertit le `.doc` en `.docx`, `LireDocx` le
  relit dans l'ordre du document → `source-armp.txt`), `decrire-armp.mjs` (structure et jetons, texte jamais retapé →
  `modeles-armp/<sigle>.txt` + `.json`), `verifier-armp.mjs` (**deux sens** : rien ne manque du gabarit, rien n'est
  inventé dans le rendu — accepte `--docx=` et `--dossier=` comme `verifier.mjs`). `LireDocx` lit désormais les runs
  (trait d'union insécable, notes de bas de page, petites majuscules) ; `classpath.mjs` ajoute `commons-lang3`, que les
  `.docx` écrits par Word exigent. Détail dans `scripts/modeles-candidat/README.md`, § « Chaîne ARMP ».
- **C1 corrigé, C2, A2, A4 livrés** (27/09, `modeles-armp/`, rendus `docs/modeles-candidat/armp/`), les quatre
  « conformes au document type » dans les deux sens :
  - **C1** : les trois conditions sont, dans le gabarit, une liste Word numérotée **« (a) (b) (c) »** (le dernier
    paragraphe les cite « aux paragraphes a), b) et c) ci-dessus ») — le label est maintenant écrit dans le texte ;
    apostrophes et guillemets typographiques du gabarit. **À recopier** (le texte des paragraphes est inchangé).
  - **C2** : trois paragraphes distincts (« Nous soussignés… », « déclarons… », « ladite caution… »), cas
    **« a) b) c) »**, deux tirets. Cinq jetons : `{{B04-LR-03}}`, `{{DERIVE.fin-validite-offre}}`, `{{B02-OB-03}} —
    {{B02-OB-01}}`, `{{B01-AC-01}}, {{B01-AC-02}}`, `{{B05-GS-03}} ({{B05-GS-03.lettres}})` (le gabarit dit « en chiffres
    et en lettres » : `{{CODE}}` porte l'unité, c'est voulu ici). Le « trentième (30ème) jour » est fixe : plus de
    `{{DERIVE.delai-garantie.doublet}}` ni de `{{B05-GS-04.doublet}}` — le gabarit ne donne pas la date en clair.
  - **A2** : aucun jeton (rien du dossier n'y figure) ; le tableau a **cinq** lignes vides, comme le document type.
  - **A4** : aucun jeton. Le titre porte un **appel de note** (« Etablir une fiche par marché… Joindre une copie des
    certificat de réception. ») : Decalque n'a pas de notes, il est rendu **« (1) »** dans le titre et un paragraphe
    « (1) … » sous le tableau. Le tableau du gabarit a deux colonnes dont quatre lignes fusionnées : elles vont dans la
    première colonne, la seconde vide (comme le 2463) ; les paragraphes vides des cellules sont ceux du gabarit.
- **A1, A3 suivent** (tableaux à cellules fusionnées d'A1-c, A3-a, A3-b) sur la même chaîne. Les questions
  structurantes du 26/09 restent : A1-b conditionné au cadrage `groupement` (`{{SI:A1B}}`), A3-b natures
  (`{{SI:A3B-NATURES}}`), durées des antécédents `B03-CQ-09` / `B03-CQ-10` — à re-vérifier sur le texte ARMP.

## B1 — Le moteur rend les modèles ARMP

- Remplacer, dans `modeles/candidat/*.txt` du backend, les six fichiers 2463 par ceux de `modeles-armp/` **au fur et à
  mesure de leur livraison** (C1 d'abord), sans autre changement du moteur : mêmes commandes, mêmes jetons.
- Un jeton **absent** du contrat des jetons (V47) serait un refus à nous signaler nommément, pas un rendu partiel.

> ⚠️ **Livré le 2026-09-27 (backend) — §B1 pour C1, recopié tel quel, avec un signalement nominatif.** Les six jetons du
> C1 ARMP sont du contrat V47 (`{{CODE}}` résolu aussi sur les valeurs du plan : `B01-AC-01`, `B02-OB-01` ; `.lettres` ;
> `{{B05-GS-04}}` en nombre nu). **Mais** le paragraphe « EN CONSEQUENCE » écrit `({{B05-GS-03}} Ariary)` alors qu'un
> jeton `{{CODE}}` de type MONTANT s'imprime **avec l'unité** (contrat V47 : « 1 600 000 Ariary ») : le rendu donne
> « pour la somme de un million six cent mille ariary (**1 600 000 Ariary Ariary**) ». Le moteur gagne le suffixe
> **`.chiffres`** (le nombre en chiffres sans l'unité, pointillés si absent) : écrivez `({{B05-GS-03.chiffres}} Ariary)`
> et je recopie le fichier dans la foulée. Choix du 27/09 : le fichier du front reste le modèle, recopié sans
> retouche — le rendu porte le double « Ariary » jusqu'à votre correctif.
> ✅ **Correctif reçu le 27/09 (`f05b0c5`, `{{B05-GS-03.chiffres}}`) et recopié tel quel** : le rendu du serveur imprime
> « pour la somme de … ariary (1 600 000 Ariary) ». Plus d'écart sur C1.

- **27/09, second temps — quatre fichiers à recopier** depuis `modeles-armp/` : `C1.txt` (corrigé : labels « (a) (b)
  (c) »), `C2.txt`, `A2.txt`, `A4.txt`. Mêmes commandes qu'avant (`TITRE`, `SOUS_TITRE`, `PARA`, `VIDE`, `TABLE`,
  `LIGNE`, `FIN_TABLE`), aucune nouvelle ; les jetons de C2 sont tous du contrat V47.

## B2 — La preuve

- Comme au 26/09 : les rendus du serveur (docx) passent le comparateur du front (`verifier.mjs --dossier=`), source =
  le texte du document type. Six rendus identiques → le modèle est officiel.

> ⚠️ **Livré le 2026-09-27 (backend) — §B2 pour C1, par comparaison directe des textes.** `verifier.mjs` lit encore
> `modeles/C1.json` (le décalque 2463) : tant que la chaîne ARMP (`source-armp.txt`, comparateur) n'est pas là, la
> preuve est la comparaison paragraphe par paragraphe du rendu brut du serveur (`ModelesCandidatRenduTest` →
> `C:\Users\LANTO\rendus-modeles\C1.docx`, jetons non substitués) avec votre rendu de relecture
> `docs/modeles-candidat/armp/C1.docx` **et** avec `modeles-armp/C1.txt` : **15 paragraphes, identiques** des deux côtés.
> Dès que le comparateur ARMP existe, je rejoue `verifier.mjs C1 --docx=…` comme au 26/09.

- **27/09, second temps — le comparateur ARMP existe** : depuis `scripts/modeles-candidat/`, une fois
  `node classpath.mjs`, `javac …`, `node extraire-armp.mjs` faits (README, § « Chaîne ARMP ») :
  `node verifier-armp.mjs C1 --docx=C:\Users\LANTO\rendus-modeles\C1.docx`, ou les quatre d'un coup avec
  `node verifier-armp.mjs A2 A4 C1 C2 --dossier=C:\Users\LANTO\rendus-modeles`. Il sort en code 1 au premier fragment
  manquant ou inventé, et les nomme.

## B3 — Ce qui change pour la PRMP du 2463

- Les formulaires produits pour le dossier 2463 **ne seront plus ceux de son propre dossier** mais ceux de l'ARMP :
  c'est un point d'**errata** de plus à porter à la PRMP (E8 : « vos formulaires A1-A4/C1/C2 s'écartent du document
  type officiel ; la fiche produit désormais les officiels »).

## Ce que le backend rend

B1 pour C1 dès maintenant, puis les cinq autres à leur livraison ; B2 à chaque fois ; un mot ici si la livraison
s'écarte de la demande (encadré ⚠️ daté, à l'endroit corrigé).
