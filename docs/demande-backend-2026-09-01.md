# Demande au backend `PRS20` — 1ᵉʳ septembre 2026 — Visa par intérim

> Document destiné à la session backend. Émis depuis le front `frontendprs2` (visa unique adopté,
> commit `9e2f2cf`, poussé). **Extension de la contrainte du dispatcheur, arbitrée par le pilote le
> 01/09** — complète la demande du 31/08 (`demande-backend-2026-08-31.md`, livrée).
>
> | | Question | Décision |
> |---|---|---|
> | 1 | Forme de la justification | **Note d'intérim TÉLÉVERSÉE (PDF)**, jointe au visa |
> | 2 | Qui enregistre, quand | **L'intérimaire lui-même, au moment du visa** (auto-déclaration tracée) |
> | 3 | Localité du CC intérimaire | **Garde maintenue** : un CC ne vise par intérim que dans SA localité ; seul le Président supplée partout |
> | 4 | Trace sur le document PV | **RÉVISÉ le 01/09** — dépend de la localité du dossier : **Centrale = aucune mention** (trace interne seulement) ; **toute autre localité = mention « par intérim » NÉCESSAIRE** sur la ligne de signature du P/CC, posée côté serveur |

---

## 1. Règle métier

**Énoncé du pilote** : « Le P/CC non dispatcheur peut effectuer le visa en cas d'absence du
dispatcheur. Cette absence est justifiée par une note d'intérim. »

La contrainte d'identité du 31/08 (seul le dispatcheur vise, 403) reste la règle ; l'intérim en est
l'**exception justifiée** : un autre Président/CC vise en joignant la note d'intérim (PDF) qui
matérialise l'absence. C'est le pendant, à la clôture, de l'`INTERIM_DISPATCH = true` qui existe
déjà au dispatch (CC hors localité en l'absence du Président) — mais avec pièce justificative, et
**sans** levée de la garde de localité (arbitrage 3, contrairement au dispatch).

## 2. Contrat proposé — `viser` en mode intérim

- Le chemin normal (acteur = dispatcheur) est **inchangé**.
- Acteur ≠ dispatcheur, profil P/CC : le visa devient possible **si et seulement si** la requête
  joint la note d'intérim :
  - **Forme recommandée : multipart sur le `viser` existant** (partie JSON = corps actuel, partie
    fichier = la note) — un seul geste atomique, pas de note orpheline sans visa. Si vous préférez
    deux temps (POST de la note → id, puis `viser` avec `idNoteInterim`), dites-le : le front suit.
  - Fichier : **PDF uniquement**, taille plafonnée (mêmes limites que les pièces jointes) ; le
    front revalide en miroir (`validerFichier`).
  - 400 « note d'intérim requise » si acteur ≠ dispatcheur sans fichier ; 403 inchangé pour un
    profil hors P/CC.
  - **Garde localité MAINTENUE** : le 403 « CC hors localité » du 31/08 s'applique aussi à
    l'intérim. Un CC ne supplée que pour un dossier de sa localité ; le Président (sans localité)
    supplée partout.
  - Tout le reste du `viser` est inchangé (avis, secrétaire, co-signataire, part de signature,
    transition, verrous).
- **Trace interne** (toutes localités) : qui a visé par intérim, quand, et le chemin de la note
  (table dédiée ou colonnes sur `t_pv_examen`, à votre main) + entrée au journal d'audit.
- **Mention sur le document PV** (arbitrage 4 RÉVISÉ) : dépend de la **localité du dossier** —
  - **Centrale** : aucune mention, le PV imprime le signataire tel quel ;
  - **toute autre localité** : la ligne de signature du Président/CC porte la mention
    **« par intérim »**, posée côté serveur à la génération (même mécanique que « (par
    délégation) » du Secrétaire de séance).
  - ⚠️ La mention se joue dans les **modèles régionaux** (les variantes centrale/régionale des
    14 `.docx` existent déjà) : vérifier les MODÈLES, pas seulement le Java — et gare aux quatre
    pièges connus de leur dérivation (POI, `xml:space`, `<w:t/>`, ordre des patchs).
- **DTO** : exposer `viseParInterim: boolean` (et de quoi télécharger la note — cf. question 2
  ci-dessous) pour la consultation.
- **Notification `PV_A_VALIDER`** : inchangée (ciblée dispatcheur, repli large existant) —
  l'intérim est l'exception, pas le canal normal.

## 3. Questions ouvertes (recommandation du front incluse)

1. **Multipart vs deux temps** — recommandation : multipart atomique sur `viser`.
2. **Consultation de la note a posteriori** : qui peut la télécharger (P/CC ? Admin ? tout profil
   voyant le PV ?) et par quel endpoint. Recommandation : les profils qui voient le PV, via un
   endpoint de document classique (Content-Type forcé, comme les pièces).
3. Un dispatcheur **présent** peut-il quand même recevoir un visa d'intérim (note fournie alors
   qu'il n'est pas absent) ? Le serveur ne peut pas vérifier l'absence — la note EST la
   justification, sous la responsabilité du signataire. Recommandation : l'accepter (tracé), pas de
   garde impossible à tenir.

## 4. Ce que le front livrera ensuite

- Chez le P/CC non dispatcheur, la raison écrite (« Seul X … peut viser ce PV ») gagne son issue :
  bouton **« Viser par intérim… »** ouvrant le même panneau de visa + zone de téléversement de la
  note (PDF, `validerFichier`), envoi multipart. Pour un CC hors localité : pas de bouton, raison
  écrite adaptée (localité).
- Consultation : indicateur « visé par intérim » + téléchargement de la note selon la réponse à la
  question 2.

Comme toujours : tests (400 sans note, 403 hors P/CC, 403 CC hors localité, chemin normal intact,
**mention « par intérim » présente sur un PV de localité régionale et ABSENTE sur un PV Centrale**),
docs (`api-endpoints`, `regles-gestion`), **commit + push complet, fichiers neufs compris — les
`.docx` modifiés aussi**.
