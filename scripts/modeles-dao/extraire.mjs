// Lot D — « DAO complet » : extrait le texte d'un DOCUMENT TYPE OFFICIEL de l'ARMP → sources/<cle>.txt, la source de
// `decrire.mjs` et de `verifier.mjs`. Même procédé que la chaîne des formulaires du candidat
// (`../modeles-candidat/extraire-armp.mjs`) : Word, installé sur le poste, convertit le `.doc` en `.docx` par
// automation COM (une fois, dans `armp/`), puis LireDocx le relit dans l'ordre du document. Le `.doc` reste où le
// pilote l'a déposé (`Documents Types/`, non suivi) et n'est jamais modifié (ouvert en lecture seule ; copié d'abord
// dans `armp/`, Word refusant certains chemins — « & » du nom du contrat-cadre).
//
//   node extraire.mjs [contrat-cadre]      # → armp/<cle>.docx (une fois), sources/<cle>.txt
//
// Prérequis : la chaîne des formulaires compilée (`../modeles-candidat/cp.txt` et `../modeles-candidat/out/`).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CP, JAVA } from './commun.mjs';

const DOCUMENTS = {
  'contrat-cadre': 'Documents Types/Fournitures et services/Document type Contrat-cadre-Fournitures & Prestations de services.doc',
};

const cles = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(DOCUMENTS);
fs.mkdirSync('armp', { recursive: true });
fs.mkdirSync('sources', { recursive: true });
for (const cle of cles) {
  const doc = path.resolve('../..', DOCUMENTS[cle] ?? '');
  if (!DOCUMENTS[cle] || !fs.existsSync(doc)) {
    console.error(`document type absent : ${cle} (${doc})`);
    process.exit(2);
  }
  const copie = path.resolve(`armp/${cle}.doc`);
  const docx = path.resolve(`armp/${cle}.docx`);
  if (!fs.existsSync(docx)) {
    fs.copyFileSync(doc, copie);
    // 16 = wdFormatXMLDocument ; Open(nom, ConfirmConversions=false, ReadOnly=true) ; Close(SaveChanges=false).
    const ps1 = (s) => s.replace(/'/g, "''");
    const script = [
      '$word = New-Object -ComObject Word.Application; $word.Visible = $false; $word.DisplayAlerts = 0;',
      `try { $doc = $word.Documents.Open('${ps1(copie)}', $false, $true); $doc.SaveAs2('${ps1(docx)}', 16); $doc.Close($false) }`,
      'finally { $word.Quit() }',
    ].join(' ');
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'inherit' });
    fs.rmSync(copie);
    console.log(`converti par Word : ${docx}`);
  }
  const texte = execFileSync(JAVA, ['-cp', CP(), 'LireDocx', docx], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  fs.writeFileSync(`sources/${cle}.txt`, texte, 'utf8');
  console.log(`sources/${cle}.txt : ${texte.split('\n').length} lignes`);
}
