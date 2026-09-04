# Demande backend — Journal du dossier : raconter le traitement JUSQU'AU BOUT

**Date** : 2026-09-04 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : constat pilote
(dossier 00002) — « le journal s'arrête à la réattribution de 05:21, alors que le chronométrage va
jusqu'à la co-signature de 12:13 ».

## Constat

`GET /dossiers/{id}/journal` consigne les actes de la PRMP (création, soumission…) et les gestes de
dispatch (`d24c115` : DISPATCH, REATTRIBUTION, REPRISE, RETRAIT_DISPATCH) — puis plus rien. La
suite du traitement (examen soumis, retours de navette, acceptation CC, visa, signatures, passage
en vérification, transmission SIGMP, archivage) n'apparaît jamais au journal, alors que le
chronométrage, lui, la raconte. Le journal ne tient pas la règle pilote « toutes les étapes que le
dossier a fait ».

## Demande

Compléter le journal avec les événements du traitement, chacun typé et daté, opérateur nommé :

| Type proposé            | Événement                                                | Détail attendu |
|-------------------------|----------------------------------------------------------|----------------|
| `SOUMISSION_EXAMEN`     | le Membre soumet le projet de PV (chaque soumission)     | n° de navette ; commentaire éventuel |
| `RETOUR_RECTIFICATION`  | P/CC retourne le projet                                  | commentaire du retour |
| `TRANSMISSION_PRESIDENT`| deux niveaux : le CC accepte et transmet                 | — |
| `VISA`                  | le viseur clôt la navette                                | avis arrêté ; co-signataires désignés ; « par intérim » le cas échéant |
| `SIGNATURE`             | chaque part posée                                        | rôle de la part (Membre / CC / Président) |
| `PV_SIGNE`              | dernière part → PV définitif                             | référence du PV |
| `DECISION_VERIFICATION` | passage de vérification enregistré                       | levées / maintenues (compte) |
| `TRANSMISSION_SIGMP`    | transmission de la décision                              | — |
| `ARCHIVAGE`             | l'assistant clôt                                         | — |

**Mise en œuvre au choix du backend** : (a) écrire dans `t_action_dossier` à chaque geste (simple,
mais pas rétroactif), ou (b) **fusionner à la lecture** — le journal servi = actions stockées +
événements dérivés des données existantes (`t_pv_navette`, dates de visa/signature du PV,
passages de vérification…). L'option (b) rend les dossiers DÉJÀ traités complets d'office
(00002 compris) et n'ajoute aucune écriture ; elle a notre préférence si son coût reste raisonnable.

Le front est prêt à suivre : libellés et **rangs de visibilité hiérarchique** (règle du
04/09 au soir : chacun voit ses lignes et ses subordonnés) seront ajoutés pour chaque type —
EXAMEN/SIGNATURE-Membre au rang Membre, VISA/TRANSMISSION_PRESIDENT au rang CC, vérification au
rang Vérificateur, etc.

## Tests attendus

1. Cycle deux-niveaux complet → le journal raconte, dans l'ordre : création → soumission →
   réception → dispatch → réattribution → soumission d'examen → (retour → resoumission) →
   transmission au Président → visa (avis + désignés) → signatures (3) → PV signé.
2. Boucle FAVR : décisions de vérification puis transmission SIGMP et archivage au journal.
3. Ordre chronologique strict avec les actions existantes (aucune régression sur les types actuels).
