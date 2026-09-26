import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;

/**
 * Relit un {@code .docx} et écrit son texte dans l'ORDRE DU DOCUMENT — paragraphes et tableaux
 * entrelacés comme ils se lisent — matière du comparateur de fidélité. Une cellule s'écrit
 * paragraphe par paragraphe, une ligne de tableau par ligne de sortie, cellules séparées par
 * une tabulation.
 */
public final class LireDocx {

    public static void main(String[] args) throws Exception {
        PrintStream out = new PrintStream(System.out, true, StandardCharsets.UTF_8);
        try (XWPFDocument doc = new XWPFDocument(Files.newInputStream(Path.of(args[0])))) {
            for (IBodyElement e : doc.getBodyElements()) {
                if (e instanceof XWPFParagraph p) {
                    out.println(p.getText());
                } else if (e instanceof XWPFTable t) {
                    for (XWPFTableRow r : t.getRows()) {
                        StringBuilder sb = new StringBuilder();
                        for (XWPFTableCell c : r.getTableCells()) {
                            if (sb.length() > 0) {
                                sb.append('\t');
                            }
                            StringBuilder cellule = new StringBuilder();
                            for (XWPFParagraph p : c.getParagraphs()) {
                                if (cellule.length() > 0) {
                                    cellule.append(' ');
                                }
                                cellule.append(p.getText());
                            }
                            sb.append(cellule);
                        }
                        out.println(sb);
                    }
                }
            }
        }
    }
}
