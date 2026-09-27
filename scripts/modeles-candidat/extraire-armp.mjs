// Extrait le texte du DOCUMENT TYPE OFFICIEL de l'ARMP (fournitures, formulaires de soumission) → source-armp.txt,
// la source de `decrire-armp.mjs` et de `verifier-armp.mjs`. Le document est un `.doc` (Word 97), que ni POI-XWPF
// ni node ne lisent : Word, installé sur le poste, le convertit en `.docx` par automation COM (PowerShell), une
// fois, dans `armp/` ; LireDocx relit ensuite le `.docx` dans l'ordre du document. Le `.doc` reste où le pilote l'a
// déposé (`Documents Types/`, non suivi) et n'est jamais modifié (ouvert en lecture seule).
//
//   node extraire-armp.mjs            # → armp/formulaires-fournitures.docx (une fois), source-armp.txt
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CP, JAVA } from './armp-commun.mjs';

const DOC = path.resolve("../../Documents Types/Fournitures et services/3-Document type d'appel d'offres_Fournitures_Formulaires de soumission.doc");
const DOCX = path.resolve('armp/formulaires-fournitures.docx');

if (!fs.existsSync(DOC)) {
  console.error(`document type absent : ${DOC}`);
  process.exit(2);
}
fs.mkdirSync('armp', { recursive: true });
if (!fs.existsSync(DOCX)) {
  // 16 = wdFormatXMLDocument ; Open(nom, ConfirmConversions=false, ReadOnly=true) ; Close(SaveChanges=false).
  const ps1 = (s) => s.replace(/'/g, "''");
  const script = [
    '$word = New-Object -ComObject Word.Application; $word.Visible = $false; $word.DisplayAlerts = 0;',
    `try { $doc = $word.Documents.Open('${ps1(DOC)}', $false, $true); $doc.SaveAs2('${ps1(DOCX)}', 16); $doc.Close($false) }`,
    'finally { $word.Quit() }',
  ].join(' ');
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'inherit' });
  console.log(`converti par Word : ${DOCX}`);
}
const texte = execFileSync(JAVA, ['-cp', CP(), 'LireDocx', DOCX], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
fs.writeFileSync('source-armp.txt', texte, 'utf8');
console.log(`source-armp.txt : ${texte.split('\n').length} lignes`);
