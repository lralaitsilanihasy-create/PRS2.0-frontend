import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.IRunElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFFootnote;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.w3c.dom.NamedNodeMap;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

/**
 * Relit un {@code .docx} et écrit son texte dans l'ORDRE DU DOCUMENT — paragraphes et tableaux
 * entrelacés comme ils se lisent — matière du comparateur de fidélité. Une cellule s'écrit
 * paragraphe par paragraphe, une ligne de tableau par ligne de sortie, cellules séparées par
 * une tabulation.
 *
 * <p>Le texte d'un paragraphe est relu run par run (27/09) : {@code XWPFParagraph.getText()} laisse
 * tomber le trait d'union insécable de Word ({@code w:noBreakHyphen}, « ci‑après » du document type
 * ARMP devenait « ciaprès ») et colle le texte d'une note de bas de page dans le paragraphe. Ici le
 * trait d'union est rendu par U+2011, l'appel de note par {@code [note:n]} et la note elle-même sur
 * la ligne suivante, {@code [note n] texte} — la structure reste lisible ligne à ligne.
 */
public final class LireDocx {

    /** Les notes de bas de page rencontrées dans la ligne en cours, imprimées à sa suite. */
    private static final List<String> NOTES = new ArrayList<>();

    public static void main(String[] args) throws Exception {
        PrintStream out = new PrintStream(System.out, true, StandardCharsets.UTF_8);
        try (XWPFDocument doc = new XWPFDocument(Files.newInputStream(Path.of(args[0])))) {
            for (IBodyElement e : doc.getBodyElements()) {
                if (e instanceof XWPFParagraph p) {
                    out.println(texte(doc, p));
                    notes(out);
                } else if (e instanceof XWPFTable t) {
                    for (XWPFTableRow r : t.getRows()) {
                        StringBuilder sb = new StringBuilder();
                        int rang = 0;
                        for (XWPFTableCell c : r.getTableCells()) {
                            // une tabulation entre DEUX cellules, vides ou non : une ligne vide à quatre cellules
                            // s'écrit « \t\t\t » et reste comptable (lignes laissées au candidat, A2)
                            if (rang++ > 0) {
                                sb.append('\t');
                            }
                            StringBuilder cellule = new StringBuilder();
                            for (XWPFParagraph p : c.getParagraphs()) {
                                if (cellule.length() > 0) {
                                    cellule.append(' ');
                                }
                                cellule.append(texte(doc, p));
                            }
                            sb.append(cellule);
                        }
                        out.println(sb);
                        notes(out);
                    }
                }
            }
        }
    }

    private static void notes(PrintStream out) {
        for (String n : NOTES) {
            out.println(n);
        }
        NOTES.clear();
    }

    /** Le texte d'un paragraphe, run par run — voir l'en-tête de la classe. */
    private static String texte(XWPFDocument doc, XWPFParagraph p) {
        StringBuilder sb = new StringBuilder();
        for (IRunElement element : p.getIRuns()) {
            if (!(element instanceof XWPFRun r)) {
                continue;
            }
            // Un run en « majuscules » (w:caps) ou en « petites majuscules » (w:smallCaps) s'AFFICHE en capitales quel
            // que soit le texte saisi : les sous-titres du document type sont saisis en minuscules et lus tels qu'ils
            // se lisent (c'est aussi ce que fait XWPFRun.text()).
            boolean capitales = r.isCapitalized() || r.isSmallCaps();
            NodeList enfants = r.getCTR().getDomNode().getChildNodes();
            for (int i = 0; i < enfants.getLength(); i++) {
                Node n = enfants.item(i);
                String nom = n.getLocalName() == null ? "" : n.getLocalName();
                switch (nom) {
                    case "t" -> sb.append(capitales ? texteDe(n).toUpperCase(Locale.FRENCH) : texteDe(n));
                    case "tab" -> sb.append('\t');
                    case "br", "cr" -> sb.append('\n');
                    case "noBreakHyphen" -> sb.append('‑');
                    case "footnoteReference" -> {
                        String id = attribut(n, "id");
                        sb.append("[note:").append(id).append(']');
                        XWPFFootnote note = doc.getFootnoteByID(Integer.parseInt(id));
                        if (note != null) {
                            StringBuilder t = new StringBuilder();
                            for (XWPFParagraph q : note.getParagraphs()) {
                                if (t.length() > 0) {
                                    t.append(' ');
                                }
                                t.append(texte(doc, q));
                            }
                            NOTES.add("[note " + id + "] " + t.toString().trim());
                        }
                    }
                    default -> {
                        // rPr, lastRenderedPageBreak, footnoteRef (le numéro dans la note), softHyphen… : rien à écrire
                    }
                }
            }
        }
        return sb.toString();
    }

    /** Le texte d'un {@code w:t} : ses nœuds texte (le DOM d'XMLBeans n'a pas {@code getTextContent}, niveau 3). */
    private static String texteDe(Node n) {
        StringBuilder sb = new StringBuilder();
        NodeList enfants = n.getChildNodes();
        for (int i = 0; i < enfants.getLength(); i++) {
            Node e = enfants.item(i);
            if (e.getNodeType() == Node.TEXT_NODE || e.getNodeType() == Node.CDATA_SECTION_NODE) {
                sb.append(e.getNodeValue());
            }
        }
        return sb.toString();
    }

    private static String attribut(Node n, String local) {
        NamedNodeMap attributs = n.getAttributes();
        for (int i = 0; attributs != null && i < attributs.getLength(); i++) {
            Node a = attributs.item(i);
            if (local.equals(a.getLocalName())) {
                return a.getNodeValue();
            }
        }
        return "";
    }
}
