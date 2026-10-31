# Demande backend — 2026-10-31 — Historique complet d'un dossier : sa filiation, ses PV, ses lettres, tout ce qui s'y rattache

## Contexte

Demande du pilote du 31/10, à partir de la zone « Aller à un dossier » de l'en-tête :

> « Pour une référence de dossier, est-il possible d'avoir tous les numéros de dossiers qui s'y attachent, c'est-à-dire son
> historique ? » — puis : « je veux aussi les PV et lettres de renvoi de chaque dossier, et tout ce qui touche au dossier ».

Un même marché traverse aujourd'hui **plusieurs dossiers**, chacun avec sa propre référence, et chaque dossier porte ses propres
objets (PV, lettres, réceptions…). Exemple de recette :

```
Plan de passation 00001/PPM-AGPM/CNM/2026 → mise à jour 00003/… → mise à jour 00006/…
   └─ ligne 303337 « articles de bureau »
        └─ DAO        00002/DAOO-CC/CNM/2026   PV 00002/DAOO-CC/CNM/PV/2026 · lettre de renvoi …
             └─ Marché lot 1   00009/MAOO-CC/CNM/2026   PV … 
                  ├─ marchés subséquents / bons de commande …
                  └─ dossiers de modification (DDM) …
```

Le front ne sait reconstituer qu'**un seul** maillon : la chaîne des versions d'un plan (`GET /api/dossiers/{id}/versions`). Le
reste exigerait plusieurs appels par dossier (PV, lettres, examen…) et des liens qui ne sont pas exposés (ligne du plan → dossier de
mise en concurrence → dossiers de marché → suites). D'où une route unique, servie en une fois.

## B1 — La filiation : tous les dossiers qui s'attachent à un dossier

`GET /api/dossiers/{idDossier}/filiation` — quel que soit le point d'entrée (une version du plan, le DAO, un marché, un
subséquent…), l'**arbre complet** auquel il appartient, la racine en tête, et le nœud demandé marqué (identifiants
illustratifs) :

```json
{
  "idDossierDemande": 100381,
  "racine": {
    "idDossier": 100301, "refeDossier": "00001/PPM-AGPM/CNM/2026", "idTypeDossier": "DDP", "idSousType": "PPM-AGPM",
    "statut": "CLOTURE", "dateRef": "2026-10-28", "lien": "RACINE",
    "enfants": [
      { "idDossier": 100340, "refeDossier": "00003/PPM-AGPM/CNM/2026", "lien": "VERSION_SUIVANTE", "enfants": [ … ] },
      { "idDossier": 100381, "refeDossier": "00002/DAOO-CC/CNM/2026", "lien": "MISE_EN_CONCURRENCE",
        "ligne": { "idDetail": 303337, "objet": "articles de bureau" },
        "enfants": [
          { "idDossier": 100399, "refeDossier": "00009/MAOO-CC/CNM/2026", "lien": "MARCHE", "lot": 1, "enfants": [ … ] }
        ] }
    ]
  }
}
```

Nature des liens (`lien`) — ce que le front sait nommer ; le serveur décide des liens réellement présents :

| `lien` | Sens | Piste côté données (à confirmer par le backend) |
|---|---|---|
| `VERSION_SUIVANTE` | mise à jour d'un plan (nouveau numéro) | `Dossier.ID_DOSSIER_PARENT` (déjà servi par `/versions`) |
| `MISE_EN_CONCURRENCE` | dossier DMC né d'une ligne du plan | `Dossier.ID_DMC` → `FicheMarche` → ligne (`Marche`) → son plan |
| `MARCHE` | dossier de marché né d'une attribution, par lot | `DossierMec`, `Attribution` |
| `SUBSEQUENT` | marché subséquent / bon de commande d'un contrat-cadre | `ContratVigueur`, `BonCommande` |
| `MODIFICATION` | dossier de modification (DDM) d'un marché en vigueur | à confirmer |
| `REEXAMEN` | nouveau dossier ouvert après lettre de renvoi, s'il y en a un | à confirmer (le réexamen `A_REEXAMINER` garde-t-il le même numéro ?) |

Chaque nœud : `idDossier`, `refeDossier`, `idTypeDossier`, `idSousType`, `statut`, `dateRef`, `lien`, et `lot` / `ligne` quand ils
ont un sens. **Périmètre** : celui de la liste des dossiers du connecté. Un nœud hors périmètre est rendu **sans détail**
(`{ "masque": true, "lien": … }`) plutôt qu'omis, pour que l'arbre ne mente pas sur sa forme — ou omis, si le backend juge que sa seule
existence est une information à ne pas donner : à trancher, le front sait afficher les deux.

## B2 — Tout ce qui touche à un dossier, en une fois

`GET /api/dossiers/{idDossier}/historique` — pour UN dossier, la liste de ses objets rattachés, triés par date, chacun avec sa
référence propre quand il en a une :

```json
[
  { "type": "RECEPTION",      "date": "2026-10-28T09:12", "reference": null,                          "acteur": "SECANT1", "id": 51 },
  { "type": "DISPATCH",       "date": "2026-10-28T09:40", "acteur": "PRES001", "detail": "attribué à MEMANT1" },
  { "type": "EXAMEN",         "date": "2026-10-28T10:05", "id": 77, "statut": "TERMINE" },
  { "type": "PV",             "date": "2026-10-28T11:20", "reference": "00002/DAOO-CC/CNM/PV/2026", "id": 12, "statut": "DEFINITIF", "avis": "FAVR" },
  { "type": "LETTRE_RENVOI",  "date": "2026-10-28T11:30", "reference": "…", "id": 4, "statut": "SIGNE" },
  { "type": "TRANSMISSION_SIGMP", "date": "…" },
  { "type": "PUBLICATION_AVIS",   "date": "…", "reference": "…" },
  { "type": "ATTRIBUTION",    "date": "…", "lot": 1 },
  { "type": "CONTRAT",        "date": "…", "reference": "…" },
  { "type": "RETRAIT",        "date": "…", "statut": "REFUSEE" },
  { "type": "SUSPENSION",     "date": "…", "detail": "pièces demandées" },
  { "type": "ACTE_GESTION",   "date": "…", "detail": "…" },
  { "type": "VERSION_ARCHIVEE", "date": "…", "numero": 2 }
]
```

Types attendus (le serveur n'envoie que ceux qui existent pour le dossier ; un type inconnu du front s'affiche avec son code) :
réception et vérification des pièces au dépôt, dispatch, examen, **PV** (projet et définitif, avec référence, avis et signataires),
**lettres de renvoi** (référence, statut, date d'archivage), navettes du PV, transmission SIGMP, archivage, versions archivées
(rectifications), demandes de retrait, suspensions, actes de gestion, publications (AGPM, avis spécifique), séances et évaluation
pour un dossier de mise en concurrence, attribution, contrat en vigueur, bons de commande et réceptions de commande.

Le journal des actions (`ActionDossier`, déjà fusionné à la lecture) peut servir de base ; ce qui est demandé en plus, c'est que
chaque entrée porte **l'identifiant et la référence de l'objet** (PV, lettre…), pour que le front en fasse un lien.

Mêmes règles de visibilité que les écrans d'aujourd'hui : la PRMP ne voit d'un PV que sa version définitive signée (règle du
02/08), et pas les vues internes CNM (journal, chronométrage — audit du 14/09).

**Pas de N+1** : B1 et B2 en requêtes groupées ; `?avecHistorique=true` sur B1 pourrait joindre B2 à chaque nœud si le coût le
permet — sinon le front appelle B2 au clic sur un nœud.

## B3 — La recherche par référence d'un PV ou d'une lettre

`GET /api/dossiers/recherche?q=` ne connaît que les références de **dossier** : le pilote a saisi `00002/DAOO-CC/CNM/PV/2026` et
obtenu « aucun dossier ». Demandé : que `q` résolve aussi une référence de **PV** ou de **lettre de renvoi** vers son dossier
(réponse inchangée : la liste allégée des dossiers). En attendant, le front retire le segment `/PV/` avant d'appeler — un pis-aller
qui ne couvre pas les lettres.

## Ce que fera le front

- Sur la page du dossier et dans le volet de droite des listes : un bloc **« Historique du dossier »** — l'arbre de B1 (le dossier
  courant en évidence, chaque numéro cliquable), et sous chaque dossier la frise de B2 (PV et lettres cliquables).
- La zone « Aller à un dossier » ouvre le dossier puis cet historique.
- En attendant B1-B2 : la chaîne des **versions** des plans de passation, déjà servie par `/versions`.

> ⚠️ **2026-10-31 — B1, B2, B3 livrés (PRS20, sans migration). Écarts et précisions :**
> - **B1** — `GET /api/dossiers/{id}/filiation` comme demandé (`racine`, `idDossierDemande`, nœuds `{ idDossier, refeDossier,
>   idTypeDossier, idSousType, statut, dateRef, lien, lot, ligne, masque, enfants }`). **Liens servis** : `RACINE`, `VERSION_SUIVANTE`,
>   `MISE_EN_CONCURRENCE`, `MARCHE`, `MODIFICATION`. **`MODIFICATION`** = dossier d'**acte de gestion** (famille **DGC**, avenant…),
>   pas un DDM. **Pas de `SUBSEQUENT` ni de `REEXAMEN`** : marchés subséquents et bons de commande n'ont pas de numéro de dossier, et
>   un réexamen garde le numéro du dossier ; ils sont dans l'historique (B2). **Hors périmètre** : nœud **masqué** (`masque: true`,
>   `lien` et `enfants` seuls) — décision du 31/10 ; 403 si le dossier demandé lui-même est hors périmètre. `?avecHistorique` **non
>   servi** : B2 au clic.
> - **B2** — `GET /api/dossiers/{id}/historique` → `[{ type, date, id, reference, statut, avis, acteur, detail, lot, numero }]` triés par
>   date. Types : `RECEPTION`, `DISPATCH`, `EXAMEN`, `PV` (statut `DEFINITIF` une fois signé), `LETTRE_RENVOI`, `TRANSMISSION_SIGMP`,
>   `SUSPENSION`, `RETRAIT`, `VERSION_ARCHIVEE`, `ACTE_GESTION`, `PUBLICATION_AGPM`, `PUBLICATION_AVIS`, `SEANCE`, `EVALUATION`,
>   `ATTRIBUTION`, `CONTRAT`, `BON_COMMANDE`, `RECEPTION_COMMANDE`. Pas de `ARCHIVAGE` séparé (la date d'archivage est dans `detail` de
>   la lettre) ni de navettes une à une (leur nombre est dans `detail` du PV) : à demander si l'écran en a besoin. **PRMP/UGPM** : ni
>   dispatch ni examen, PV et lettre signés seulement, `acteur` nul. `id` désigne l'objet de chaque type (PV, lettre, dossier de marché
>   pour `ATTRIBUTION`, dossier DGC pour `ACTE_GESTION`…) ; la séance et l'évaluation n'ont pas d'`id` (leur clé est la procédure).
> - **B3** — `q` résout aussi la référence d'un PV (`refePv` ou `referencePv`) ou d'une lettre de renvoi (`refLettre`) ; la PRMP ne
>   résout que le PV signé. Le pis-aller du front (retirer `/PV/`) n'est plus utile.
