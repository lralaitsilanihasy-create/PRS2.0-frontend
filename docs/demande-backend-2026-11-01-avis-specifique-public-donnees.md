# Demande backend — 2026-11-01 — L'avis spécifique publié, en données, dans l'espace candidat

## Contexte

Suite de `demande-backend-2026-11-01-avis-specifique-public.md` (B1-B2 livrés, PRS20 `6b613975`) : le PDF de l'avis publié
s'ouvre maintenant sans compte depuis l'espace candidat. Le pilote demande, le 01/11 :

> « N'est-il pas possible de mettre l'avis spécifique en version données ? » — puis, entre un bloc dans la page de détail de la
> procédure et une fenêtre ouverte par le bouton « Avis » : **« A »** (le bloc dans la page).

La vue en données existe déjà côté Commission (`GET /api/dossiers/{idDossier}/avis-specifique`, `AvisEnDonneesService`), mais
elle ne convient pas au candidat :

- **interne** : garde de lecture du dossier (`controlerVisibilite`) — une entreprise n'y a pas accès ;
- **projet** : lue sur la version de la fiche **jointe au dossier** (`versionFicheSoumise`), pas sur celle de l'avis imprimé ;
- rattachée au **dossier** de la Commission, que l'espace candidat ne connaît pas (il ne connaît que `idDmc`).

## B1 — Les mentions de l'avis publié, en accès public

`GET /api/procedures-en-ligne/{idDmc}/avis-specifique/donnees`

- **Accès** : public (`permitAll`), aux mêmes critères que `GET …/{idDmc}/avis-specifique` (le PDF) : **404** hors critères de
  `GET …/{idDmc}`, pour une consultation restreinte ou tant qu'aucun avis n'est imprimé.
- **Version lue** : celle de la **dernière impression** de l'avis (la même que le PDF servi — arbitrage Q1 de la demande
  précédente), pas la version soumise au dossier ni la dernière validée si elles diffèrent.
- **Contenu** : les mentions du modèle type (`AVIS-F`, `AVIS-T`), dans l'ordre du manuel, avec leur valeur **telle que l'avis
  imprimé l'écrit** — même calcul que `MentionsPublication.verifier(...)`, sur cette version :

```json
{
  "idDmc": 1,
  "versionFiche": 3,
  "gabarit": "AVIS-T",
  "numero": "05-CC/MTP/PRMP/UGPM.2026",
  "autoriteContractante": "MINISTERE DES TRAVAUX PUBLICS",
  "mentions": [
    { "code": "OBJET", "libelle": "Objet du marché", "sansObjet": false, "valeur": "Travaux d'aménagement de la voie rapide …" },
    { "code": "VISITE", "libelle": "Visite des lieux obligatoire (travaux)", "sansObjet": true, "valeur": null }
  ]
}
```

- **`numero`** : le numéro **imprimé à l'avis** — celui de l'espace candidat (`DaoCompletService.numero` : `B02-OE-01` pour un
  contrat-cadre, puis `B02-OB-03`), et non `B02-OB-03` seul comme `AvisEnDonneesDto`. Sur la procédure de recette (idDmc 1,
  contrat-cadre), la fiche ne porte que `B02-OE-01 = 05-CC/MTP/PRMP/UGPM.2026` : lu sur `B02-OB-03`, le numéro serait vide.
- **Champs internes écartés** : ni `presenteAuGabarit`, ni `renseignee`, ni `detail`, ni `documentComplet` — ce sont des contrôles
  de la Commission sur le gabarit, sans objet pour le public. Une mention non renseignée garde `valeur: null` (l'écran écrit « — »).
- **Pas de mentions de publication** (journal, numéro et date du Journal des marchés publics) : arbitrage Q2 de la demande
  précédente. La date de publication reste celle de `ProcedureEnLigneDto.datePublication`.
- **Hors registre et hors frais**, comme le PDF : lire l'avis n'est pas un retrait du DAO.

## Ce que fera le front (une fois B1 livré)

Dans la page de détail d'une procédure (`/candidat/procedures/:idDmc`), sous l'en-tête et avant « Votre parcours » : un bloc
**« Avis spécifique d'appel d'offres »** (numéro, autorité contractante, puis les mentions en deux colonnes libellé / valeur, comme
la vue de la Commission), avec en pied la date de publication et le bouton existant « Lire l'avis spécifique (PDF) » — le PDF
reste la pièce officielle. Bloc affiché seulement si `avisSpecifique` (B2 précédent) est présent ; un 404 le retire sans bruit.

> ⚠️ **2026-11-01 — B1 livré (PRS20, sans migration), sans écart.** `GET /api/procedures-en-ligne/{idDmc}/avis-specifique/donnees`,
> public, mêmes critères et 404 que le PDF. `{ idDmc, versionFiche, gabarit, numero, autoriteContractante, mentions[{ code, libelle,
> sansObjet, valeur }] }` : version de la **dernière impression** (celle du PDF servi), valeurs calculées comme l'avis imprimé
> (`MentionsPublication.verifier`, `valeur` nulle si non renseignée), `numero` = `DaoCompletService.numero` (`B02-OE-01` puis
> `B02-OB-03`), autorité contractante `B01-AC-01` (à défaut le plan). Ni `presenteAuGabarit`, ni `renseignee`, ni `detail`, ni
> `documentComplet` ; pas de mentions de publication ; rien au registre des retraits.