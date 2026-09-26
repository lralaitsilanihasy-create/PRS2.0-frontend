import java.io.FileOutputStream;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTblWidth;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STTblWidth;

/**
 * Écrit un modèle {@code .docx} à partir d'un fichier de commande produit par {@code modeles-desc.mjs}.
 *
 * ⚠️ Le {@code .docx} est écrit par <b>POI</b>, jamais par un zip maison : c'est le piège n° 2 de
 * {@code PRS20/docs/derivation-modeles-docx.md}. L'attribut {@code xml:space="preserve"} (piège n° 1)
 * est posé par POI lui-même puisque chaque run est créé, jamais réécrit.
 *
 * Le texte vient de l'extraction sans perte du dossier : ce programme ne le retape pas, il le pose.
 *
 * Format de commande, un enregistrement par ligne, tabulation entre le type et le texte :
 * <pre>
 *   FICHIER      nom du fichier
 *   TITRE        centré, gras            SOUS_TITRE   gras, à gauche
 *   PARA         justifié                CENTRE       centré
 *   DROITE       aligné à droite         VIDE         paragraphe vide
 *   TABLE n      ouvre un tableau à n colonnes ; LIGNE c1 US c2 … (US = 0x1F) ; RS (0x1E) = saut de
 *                paragraphe dans une cellule ; FIN_TABLE le referme
 * </pre>
 */
public final class Decalque {

    private static final char US = '\u001F';
    private static final String RS = "\u001E";

    public static void main(String[] args) throws Exception {
        Path commande = Path.of(args[0]);
        Path dossier = Path.of(args[1]);
        Files.createDirectories(dossier);

        List<String> lignes = Files.readAllLines(commande, StandardCharsets.UTF_8);
        String fichier = null;
        XWPFTable table = null;
        int colonnes = 0;

        try (XWPFDocument doc = new XWPFDocument()) {
            for (String ligne : lignes) {
                if (ligne.isBlank()) {
                    continue;
                }
                int sep = ligne.indexOf('\t');
                String type = sep < 0 ? ligne : ligne.substring(0, sep);
                String texte = sep < 0 ? "" : ligne.substring(sep + 1);

                switch (type) {
                    case "FICHIER" -> fichier = texte;
                    case "TITRE" -> paragraphe(doc, texte, ParagraphAlignment.CENTER, true, 13, 240);
                    case "SOUS_TITRE" -> paragraphe(doc, texte, ParagraphAlignment.LEFT, true, 11, 160);
                    case "PARA" -> paragraphe(doc, texte, ParagraphAlignment.BOTH, false, 11, 120);
                    case "CENTRE" -> paragraphe(doc, texte, ParagraphAlignment.CENTER, false, 11, 120);
                    case "DROITE" -> paragraphe(doc, texte, ParagraphAlignment.RIGHT, false, 11, 60);
                    case "VIDE" -> doc.createParagraph();
                    case "TABLE" -> {
                        colonnes = Integer.parseInt(texte.trim());
                        table = doc.createTable();
                        table.setWidth("100%");
                        table.removeRow(0);   // POI crée une première ligne : on la retire, LIGNE les pose toutes
                    }
                    case "LIGNE" -> {
                        if (table == null) {
                            throw new IllegalStateException("LIGNE hors d'un TABLE");
                        }
                        String[] cellules = texte.split(String.valueOf(US), -1);
                        if (cellules.length != colonnes) {
                            throw new IllegalStateException("ligne à " + cellules.length + " cellule(s), tableau à " + colonnes + " : " + texte);
                        }
                        XWPFTableRow rang = table.createRow();
                        for (int c = 0; c < colonnes; c++) {
                            XWPFTableCell cellule = rang.getCell(c) != null ? rang.getCell(c) : rang.addNewTableCell();
                            // Une cellule naît avec un paragraphe vide : on le remplit, puis on ajoute les suivants.
                            String[] paras = cellules[c].split(RS, -1);
                            for (int k = 0; k < paras.length; k++) {
                                XWPFParagraph p = k == 0 ? cellule.getParagraphs().get(0) : cellule.addParagraph();
                                XWPFRun r = p.createRun();
                                r.setFontSize(10);
                                r.setText(paras[k]);
                            }
                            CTTblWidth w = cellule.getCTTc().addNewTcPr().addNewTcW();
                            w.setType(STTblWidth.PCT);
                            w.setW(BigInteger.valueOf(5000L / colonnes));
                        }
                    }
                    case "FIN_TABLE" -> {
                        table = null;
                        doc.createParagraph();   // un souffle après le tableau, comme dans la source
                    }
                    default -> throw new IllegalStateException("type inconnu : " + type);
                }
            }
            if (fichier == null) {
                throw new IllegalStateException("le fichier de commande ne dit pas quel fichier écrire");
            }
            Path cible = dossier.resolve(fichier);
            try (FileOutputStream out = new FileOutputStream(cible.toFile())) {
                doc.write(out);
            }
            System.out.println("écrit : " + cible + " (" + Files.size(cible) + " octets)");
        }
    }

    private static void paragraphe(XWPFDocument doc, String texte, ParagraphAlignment al, boolean gras, int taille, int apres) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(al);
        p.setSpacingAfter(apres);
        XWPFRun r = p.createRun();
        r.setBold(gras);
        r.setFontSize(taille);
        r.setText(texte);
    }
}
