# Demande backend — 2026-09-28 — Contrat-cadre : dix informations obligatoires qu'aucun document n'imprime

**Origine** : lot D (`docs/plan-2026-09-28-lot-d-dao-complet.md`, §4 et Q2). Le DPAC et l'AE du contrat-cadre sont
désormais rendus depuis le document type officiel. En le décrivant, on a relevé les informations de la fiche qui ne
remplissent **aucun trou** du modèle : dix d'entre elles sont **obligatoires**, alors que le modèle écrit la chose en
dur. La PRMP les saisit, la validation les exige, et rien ne les imprime. Décision du pilote le 28/09 (« suivre votre
recommandation ») : **les rendre facultatives**, et désactiver le doublon.

**Portée** : contrat-cadre, fournitures et services. Les dix champs sont propres à cette forme (`typesMarche =
CONTRAT_CADRE` seul, vérifié sur le référentiel servi le 28/09) : rien ne change pour la quantité fixe ni le marché à
commande. Référentiel seulement — ni route, ni moteur, ni modèle de document.

## B1 — Neuf champs deviennent facultatifs (`obligatoire = false`)

| code | libellé | ce que le modèle écrit à la place |
|---|---|---|
| `B04-DS-02` | Langue du dossier de consultation et des offres | DPAC art. 8 : « en langue française », fixe |
| `B04-DS-03` | Modalités d'acquisition du dossier de consultation | DPAC art. 3.3 : texte fixe (adresse `B04-DS-04` et montant `B04-DS-05` imprimés) |
| `B06-SC-01` | Modalités d'ouverture des plis | DPAC art. 6.1.1 : texte fixe |
| `B06-SO-04` | Comparaison des offres pour la sélection de l'offre économiquement la plus avantageuse | DPAC art. 6.2 §4 : titre fixe ; le contenu est `B06-SO-05`, imprimé |
| `B07-DU-01` | Entrée en vigueur du contrat-cadre | AE art. 7.1 : « à compter de sa notification », fixe |
| `B07-MA-03` | Attribution des marchés subséquents après remise en concurrence (non alloti) | AE art. 4, choix 2.1 : texte fixe |
| `B07-PI-01` | Pièces contractuelles du contrat-cadre et des marchés subséquents | AE art. 6 : liste fixe |
| `B08-FP-03` | Délai de paiement (jours) | AE art. 15.3 : « 75 jours », fixe — **le contrôle `DELAI_PAIEMENT_75` reste** (il ne s'évalue que si la valeur est saisie) |
| `B10-RS-01` | Résiliation sans faute du contrat-cadre | AE art. 18.1 : texte fixe ; préavis et fautes sont `B10-RS-02` / `B10-RS-03` (lot D) |

Les champs restent au référentiel, actifs, saisissables : une valeur déjà saisie est gardée, et un contrôle peut
encore s'en servir.

## B2 — Un doublon désactivé (`actif = false`, jamais de DELETE)

- `B07-DU-06` « Durée totale du contrat-cadre, reconduit ou non (mois) » : même information que `B02-DC-01` « Durée
  maximale du contrat-cadre (mois) » (« maximum reconductions comprises », DPAC art. 2), qui, elle, est imprimée.
  Deux saisies de la même durée peuvent se contredire.

## B3 — Tests

- Référentiel du contrat-cadre : les neuf champs servis avec `obligatoire = false` ; `B07-DU-06` absent ; nombre de
  champs servis 176 → 175.
- Une fiche de contrat-cadre se valide sans aucune des dix informations.
- `DELAI_PAIEMENT_75` refuse toujours un délai de paiement saisi au-delà de 75 jours.
- Quantité fixe et à commande : inchangés.

## Ce que le backend rend

B1 à B3 (CSV du contrat-cadre et sa copie de test, script `docs/referentiel/…sql` idempotent pour DBPRS20),
`docs/regles-gestion.md` si une règle y cite ces champs comme obligatoires, et un encadré ⚠️ daté ici pour tout écart.
