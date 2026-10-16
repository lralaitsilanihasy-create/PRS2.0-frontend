import java.awt.geom.Point2D;
import java.io.File;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.contentstream.PDFGraphicsStreamEngine;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.graphics.image.PDImage;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;

/**
 * Prototype (16/10) : les MOTS d'un PDF avec leur position, et les FILETS des tableaux (traits et rectangles minces), pour
 * reconstituer les cellules d'un tableau quadrillé. Sortie TSV :
 *   M  page  x0  y  x1  texte        (y = ligne de base, origine en haut)
 *   H  page  y  x0  x1               (filet horizontal)
 *   V  page  x  y0  y1               (filet vertical)
 * Le filigrane incliné est écarté comme dans PdfLignes.
 */
public final class PdfGrille {

    public static void main(String[] args) throws IOException {
        PrintStream out = new PrintStream(System.out, true, StandardCharsets.UTF_8);
        try (PDDocument doc = Loader.loadPDF(new File(args[0]))) {
            PDFTextStripper s = new PDFTextStripper() {
                @Override
                protected void writeString(String texte, List<TextPosition> positions) {
                    float l = getCurrentPage().getMediaBox().getWidth(), h = getCurrentPage().getMediaBox().getHeight();
                    List<TextPosition> mot = new ArrayList<>();
                    TextPosition prec = null;
                    for (TextPosition p : positions) {
                        float x = p.getXDirAdj(), y = p.getYDirAdj();
                        boolean incline = Math.abs(p.getTextMatrix().getShearY()) > 0.01f || Math.abs(p.getTextMatrix().getShearX()) > 0.01f;
                        if (p.getDir() != 0f || incline || x < 0 || x > l || y < 0 || y > h) continue;
                        boolean coupe = p.getUnicode().isBlank()
                                || (prec != null && p.getXDirAdj() - (prec.getXDirAdj() + prec.getWidthDirAdj()) > Math.max(prec.getWidthOfSpace(), 1f) * 0.3f);
                        if (coupe) { sortir(mot, getCurrentPageNo(), out); mot.clear(); }
                        if (!p.getUnicode().isBlank()) mot.add(p);
                        prec = p;
                    }
                    sortir(mot, getCurrentPageNo(), out);
                }
            };
            s.setSortByPosition(true);
            s.getText(doc);
            int n = 0;
            for (PDPage page : doc.getPages()) {
                n++;
                new Filets(page, n, out).processPage(page);
            }
        }
    }

    private static void sortir(List<TextPosition> mot, int page, PrintStream out) {
        if (mot.isEmpty()) return;
        StringBuilder sb = new StringBuilder();
        for (TextPosition p : mot) sb.append(p.getUnicode());
        TextPosition d = mot.get(0), f = mot.get(mot.size() - 1);
        out.println(String.format(Locale.ROOT, "M\t%d\t%.1f\t%.1f\t%.1f\t%s", page, d.getXDirAdj(), d.getYDirAdj(),
                f.getXDirAdj() + f.getWidthDirAdj(), sb.toString().replace('\t', ' ')));
    }

    /** Les traits et rectangles minces d'une page, en coordonnées « origine en haut » comme le texte. */
    static final class Filets extends PDFGraphicsStreamEngine {
        private final int page;
        private final PrintStream out;
        private final float hauteur;
        private final List<float[]> chemin = new ArrayList<>();
        private Point2D courant;

        Filets(PDPage p, int page, PrintStream out) {
            super(p);
            this.page = page;
            this.out = out;
            this.hauteur = p.getMediaBox().getHeight();
        }

        private void segment(Point2D a, Point2D b) {
            chemin.add(new float[] { (float) a.getX(), hauteur - (float) a.getY(), (float) b.getX(), hauteur - (float) b.getY() });
        }

        @Override public void appendRectangle(Point2D p0, Point2D p1, Point2D p2, Point2D p3) {
            float x0 = (float) Math.min(p0.getX(), p2.getX()), x1 = (float) Math.max(p0.getX(), p2.getX());
            float y0 = hauteur - (float) Math.max(p0.getY(), p2.getY()), y1 = hauteur - (float) Math.min(p0.getY(), p2.getY());
            // Un rectangle mince est un filet ; un grand rectangle donne ses quatre côtés.
            if (y1 - y0 < 2.5f) chemin.add(new float[] { x0, (y0 + y1) / 2, x1, (y0 + y1) / 2 });
            else if (x1 - x0 < 2.5f) chemin.add(new float[] { (x0 + x1) / 2, y0, (x0 + x1) / 2, y1 });
            else {
                chemin.add(new float[] { x0, y0, x1, y0, 1 }); chemin.add(new float[] { x0, y1, x1, y1, 1 });
                chemin.add(new float[] { x0, y0, x0, y1, 1 }); chemin.add(new float[] { x1, y0, x1, y1, 1 });
            }
        }
        @Override public void moveTo(float x, float y) { courant = new Point2D.Float(x, y); }
        @Override public void lineTo(float x, float y) { Point2D p = new Point2D.Float(x, y); if (courant != null) segment(courant, p); courant = p; }
        @Override public void curveTo(float x1, float y1, float x2, float y2, float x3, float y3) { courant = new Point2D.Float(x3, y3); }
        @Override public Point2D getCurrentPoint() { return courant; }
        @Override public void closePath() { }
        @Override public void endPath() { chemin.clear(); }
        @Override public void strokePath() { vider(true); }
        @Override public void fillPath(int windingRule) { vider(false); }
        @Override public void fillAndStrokePath(int windingRule) { vider(true); }
        @Override public void clip(int windingRule) { }
        @Override public void drawImage(PDImage pdImage) { }
        @Override public void shadingFill(COSName shadingName) { }

        private void vider(boolean trace) {
            for (float[] s : chemin) {
                if (!trace && s.length > 4) continue; // un fond rempli (ombrage d'en-tête) n'est pas un filet
                if (Math.abs(s[1] - s[3]) < 1.5f && Math.abs(s[0] - s[2]) > 3f) {
                    out.println(String.format(Locale.ROOT, "H\t%d\t%.1f\t%.1f\t%.1f", page, (s[1] + s[3]) / 2, Math.min(s[0], s[2]), Math.max(s[0], s[2])));
                } else if (Math.abs(s[0] - s[2]) < 1.5f && Math.abs(s[1] - s[3]) > 3f) {
                    out.println(String.format(Locale.ROOT, "V\t%d\t%.1f\t%.1f\t%.1f", page, (s[0] + s[2]) / 2, Math.min(s[1], s[3]), Math.max(s[1], s[3])));
                }
            }
            chemin.clear();
        }
    }
}
