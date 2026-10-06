# Demande backend — 2026-10-06 — Remise électronique : les pièces de l'offre se listent une à une

> Décision du pilote (06/10), « A » : en remise électronique, la fiche du DAO doit **lister** les pièces de l'offre (bloc B14) ;
> un texte libre ne suffit plus.

**Le constat.** La règle `PIECES_OFFRE_EXIGEES` (V61, V62 ; `demande-backend-2026-10-03-pieces-offre-*.md`) accepte que la fiche
dise les pièces de l'offre **par la liste** `/pieces` **ou par un texte** :
- `B04-CO-01` aux fournitures ;
- `B04-PI-01` aux travaux.

En remise papier, c'est sans conséquence. En remise électronique, `GET /api/procedures-en-ligne/{idDmc}/pieces` ne sert que la liste
structurée. Avec un texte seul, le candidat ne se voit proposer **que trois emplacements** : l'acte d'engagement, le reçu et la garantie.

Exemple relevé le 06/10 : la fiche 44, « Location véhicule (à commande) 4 ». Ses pièces administratives (attestation fiscale, carte
statistique…) ne sont décrites que dans le texte. Le candidat n'a aucun emplacement pour les joindre, et la séance ne peut pas les
compter parmi les pièces manquantes.

Les noms ci-dessous sont **proposés** : le backend fait autorité, et ce document sera corrigé en place si la livraison s'en écarte.

---

## B1 — Une règle bloquante, propre à la remise électronique

- **Règle proposée : `SE_PIECES_LISTEES`**, bloquante. Elle s'applique quand le cadrage porte `modeRemise = ELECTRONIQUE` et que la
  liste `/pieces` de la version est **vide**, toutes rubriques confondues.
- **Message proposé** : « En remise électronique, listez une à une les pièces de l'offre (bloc B14) : le candidat joint un fichier par
  pièce de la liste. Le texte « Documents et pièces constituant l'offre » ne suffit pas. »
- **`PIECES_OFFRE_EXIGEES` ne change pas** : en remise papier, la liste **ou** le texte suffit toujours.
- **Le texte reste permis** en remise électronique, en plus de la liste : il sert au document imprimé (DPAO). Mais il ne remplace
  plus la liste.

> ⚠️ **2026-10-06 — livré, conforme.** La règle `SE_PIECES_LISTEES` est bloquante, avec le message proposé mot pour mot, `bloc =
> "B14"` et `champs = []`. Elle compte toutes les rubriques de la liste. Elle est **muette** en remise papier, et aussi là où le
> bloc B14 n'est pas servi : contrat-cadre et prestations intellectuelles. ⚠️ Conséquence : une procédure en ligne de ce type n'a
> toujours que les trois pièces de base, car il n'y a pas de liste à exiger.

## B2 — Les fiches existantes

- **Rien n'est migré.** Une version déjà validée garde ses pièces telles qu'elles sont, y compris les procédures en ligne ouvertes
  ou closes (fiches 44, 45…). La règle joue à la **prochaine validation**, c'est-à-dire à la création ou à la révision d'une fiche.
- La règle apparaît dès le **contrôle** (`POST …/controler`), pour que la PRMP la voie avant de valider.

> ⚠️ **2026-10-06 — livré, conforme.** Rien n'est migré. La règle apparaît dans le bilan dès le contrôle et bloque la validation.
> Une version **déjà validée** sans liste la montre dans son bilan en lecture (la 44, par exemple), sans aucun effet sur la
> procédure publiée.

## Hypothèses

- **H1** — Une liste qui ne contient **que** des pièces administratives, ou que des pièces de l'offre, suffit. La règle ne vérifie
  pas la présence de chaque rubrique : la PRMP sait ce que son DAO exige.
- **H2** — Les trois pièces de base (`AE`, `RECU-DAO`, `GARANTIE`) ne comptent **pas** dans la liste : elles sont ajoutées par le
  serveur à toute procédure en ligne, et ne disent rien des pièces propres au DAO.

> ⚠️ **2026-10-06 — H1 et H2 retenues, une précision sur H1.** Pour `SE_PIECES_LISTEES`, une liste faite seulement de pièces
> administratives suffit. Mais `PIECES_OFFRE_EXIGEES`, qui ne change pas, exige toujours une pièce de la rubrique `OFFRE` **ou** le
> texte `B04-CO-01` / `B04-PI-01`. Une liste administrative seule doit donc garder ce texte pour valider. **H2** : `AE`, `RECU-DAO`
> et `GARANTIE` ne sont pas dans la liste `/pieces` et ne comptent pas.

## Ce que le front fera

- **Le message de la règle** s'affiche à l'étape des contrôles de la fiche, comme les autres bloquants, avec un lien vers le bloc B14.
- **Un raccourci** dans l'écran des pièces de la fiche (B14), sans rien demander au serveur : « Proposer la liste à partir du
  texte ». Le front découpe le texte `B04-CO-01` / `B04-PI-01`, une pièce par ligne ou par puce, et pré-remplit la liste. La PRMP
  relit, corrige et enregistre par le `PUT …/pieces` existant.

> ✅ **Front, 2026-10-06 — livré.** Le bloquant `SE_PIECES_LISTEES` s'affiche au bilan des contrôles comme les autres, avec le lien
> « corriger » vers le bloc B14 (`bloc = "B14"`). Dans l'écran des pièces, tant que la liste est vide et que la fiche porte un texte
> (`B04-CO-01` aux fournitures, `B04-PI-01` aux travaux), chaque rubrique propose **« Proposer la liste à partir du texte »** : le
> collage s'ouvre pré-rempli de ce texte, découpé par l'analyseur existant (`lirePieces` : numéro, forme, ancienneté reconnus). La
> PRMP relit, ajoute à la rubrique choisie, corrige et enregistre par le `PUT …/pieces` existant. Rien n'est envoyé avant
> « Enregistrer les pièces ».
