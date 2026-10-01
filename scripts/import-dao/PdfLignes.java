import java.io.File;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;

/**
 * Import du DAO — lecture du PDF (plan du 28/09, Q1 : le PDF « texte » après le Word). Écrit, ligne de texte par
 * ligne de texte, sa PAGE, sa POSITION (x de début, y de la ligne de base, x de fin, hauteur) et son texte, en TSV :
 * c'est ce qui permet de refaire les paragraphes et de séparer les colonnes d'un tableau, que l'extraction à plat mélange
 * (constat du 28/09 sur le dossier 2463 : les clauses d'une page d'abord, puis toutes les valeurs).
 *
 * <p>Le texte PIVOTÉ est écarté : le filigrane nominatif en diagonale du 2463 s'intercale sinon lettre à lettre dans
 * chaque ligne. Une « ligne » est ce que PDFBox rend comme telle ({@code setSortByPosition(true)}) ; un changement de
 * colonne sur la même ligne de base se voit à un saut d'abscisse, coupé ici en deux lignes (seuil : trois espaces).</p>
 *
 * <pre>java -cp "pdfbox;fontbox;pdfbox-io;commons-logging" PdfLignes.java dao.pdf &gt; lignes.tsv</pre>
 */
public final class PdfLignes {

    public static void main(String[] args) throws IOException {
        PrintStream out = new PrintStream(System.out, true, StandardCharsets.UTF_8);
        try (PDDocument doc = Loader.loadPDF(new File(args[0]))) {
            PDFTextStripper s = new PDFTextStripper() {
                @Override
                protected void writeString(String texte, List<TextPosition> positions) {
                    // Le filigrane du 2463 n'est pas « pivoté » pour PDFBox : il est posé par une matrice qui envoie ses
                    // lettres HORS de la page (x ≈ 2 000, y < 0). On ne garde que le texte horizontal et dans le cadre.
                    float l = getCurrentPage().getMediaBox().getWidth(), h = getCurrentPage().getMediaBox().getHeight();
                    List<TextPosition> droites = new ArrayList<>();
                    for (TextPosition p : positions) {
                        float x = p.getXDirAdj(), y = p.getYDirAdj();
                        // … et les lettres du filigrane qui tombent DANS la page se trahissent par leur matrice inclinée.
                        boolean incline = Math.abs(p.getTextMatrix().getShearY()) > 0.01f || Math.abs(p.getTextMatrix().getShearX()) > 0.01f;
                        if (p.getDir() == 0f && !incline && x >= 0 && x <= l && y >= 0 && y <= h) {
                            droites.add(p);
                        }
                    }
                    ecrire(droites, getCurrentPageNo(), out);
                }
            };
            s.setSortByPosition(true);
            s.getText(doc);
        }
    }

    /** Écrit une ligne, coupée là où l'abscisse saute de plus de trois espaces (deux colonnes sur la même ligne). */
    private static void ecrire(List<TextPosition> ps, int page, PrintStream out) {
        if (ps.isEmpty()) {
            return;
        }
        StringBuilder sb = new StringBuilder();
        TextPosition debut = ps.get(0);
        TextPosition prec = null;
        // La fin d'un morceau est celle de sa dernière lettre : une espace finale (retirée du texte) la reculait, et le
        // morceau suivant, posé juste après l'espace, semblait collé (« soumissiondoit », DAO travaux du MEN, 01/10).
        TextPosition dernier = null;
        for (TextPosition p : ps) {
            if (prec != null) {
                float espace = p.getXDirAdj() - (prec.getXDirAdj() + prec.getWidthDirAdj());
                float largeurEspace = Math.max(prec.getWidthOfSpace(), 1f);
                // OpenPDF (nos propres PDF) pose une espace AU MÊME ENDROIT que la première lettre de la ligne : triée
                // par position, elle tombe juste après cette lettre (« M ARCHE DE », constat backend du 29/09). Une espace
                // qui commence à l'intérieur de la lettre précédente ne sépare rien : elle est ignorée.
                if (p.getUnicode().isBlank() && espace < -1f) {
                    continue;
                }
                if (espace > 3 * largeurEspace && espace > 12f) {
                    sortir(sb, debut, dernier != null ? dernier : prec, page, out);
                    sb.setLength(0);
                    debut = p;
                    dernier = null;
                } else if (espace > largeurEspace * 0.3f && !sb.isEmpty() && sb.charAt(sb.length() - 1) != ' ') {
                    sb.append(' ');
                }
            }
            sb.append(p.getUnicode());
            prec = p;
            if (!p.getUnicode().isBlank()) {
                dernier = p;
            }
        }
        sortir(sb, debut, dernier != null ? dernier : prec, page, out);
    }

    private static void sortir(StringBuilder sb, TextPosition debut, TextPosition fin, int page, PrintStream out) {
        String t = sb.toString().replace('\t', ' ').strip();
        if (t.isEmpty()) {
            return;
        }
        out.println(String.format(Locale.ROOT, "%d\t%.1f\t%.1f\t%.1f\t%.1f\t%s", page, debut.getXDirAdj(), debut.getYDirAdj(),
                fin.getXDirAdj() + fin.getWidthDirAdj(), debut.getHeightDir(), t));
    }
}
