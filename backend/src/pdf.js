// Génération PDF du CRV (pdfkit, serveur). Zéro dépendance native.
import PDFDocument from 'pdfkit';

const RESULTATS = { accord: 'Accord', reserve: 'Réservé', refus: 'Refus', absent: 'Absent', '': '—' };

const M = 48; // marge
const GREEN = '#0f766e';
const INK = '#111';
const MUT = '#6b7280';

/** Tableau simple : header + lignes, cellules mono-ligne. */
function table(doc, headers, rows, W) {
  const colW = W / headers.length;
  const drawRow = (cells, isHeader) => {
    if (isHeader) {
      doc.rect(M, doc.y, W, 18).fill(GREEN);
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);
    } else {
      doc.rect(M, doc.y, W, 18).fill('#f3f4f6');
      doc.fillColor(INK).font('Helvetica').fontSize(8.5);
    }
    cells.forEach((c, i) => {
      doc.text(String(c ?? ''), M + i * colW + 5, doc.y + 5.5, { width: colW - 10, lineBreak: false });
    });
    doc.moveDown(0.62);
  };
  drawRow(headers, true);
  for (const r of rows) drawRow(r, false);
}

function field(doc, label, value, W) {
  doc.rect(M, doc.y, W, 22).fill('#f8fafc');
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(MUT).text(label, M + 6, doc.y + 3.5);
  doc.font('Helvetica').fontSize(10).fillColor(INK).text(String(value ?? '—'), M + 6, doc.y + 12, { width: W - 12 });
  doc.moveDown(0.8);
}

/**
 * Génère le PDF d'un CRV.
 * @param {object} args
 * @param {object} args.visite  ligne visite complète (colonnes nommées incluses)
 * @param {Array}  args.produits [{nom, dci, qty}]
 * @param {object} args.labo    {nom, agrement_arp}
 * @returns {Promise<{buffer: Buffer, filename: string}>}
 */
export async function crvPdf({ visite, produits, labo }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: M });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), filename: `CRV-${visite.id}-${visite.date}.pdf` }));
    doc.on('error', reject);

    const W = doc.page.width - M * 2;

    // En-tête
    doc.font('Helvetica-Bold').fontSize(15).fillColor(GREEN).text('DelegPharma', { continued: true });
    doc.font('Helvetica').fontSize(10).fillColor(MUT).text(`   ${labo?.nom || ''}`, { align: 'left' });
    doc.moveDown(0.1);
    doc.font('Helvetica').fontSize(8.5).fillColor(MUT)
      .text(`N° d'agrément ARP : ${labo?.agrement_arp || '—'}`, { align: 'right' });
    doc.moveDown(1.2);

    doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text('Compte rendu de visite (CRV)');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor(MUT)
      .text(`CRV n° ${visite.id}   ·   Date : ${visite.date}   ·   Auteur : ${visite.auteur || '—'}`)
      .text(`Statut : ${visite.statut}`);
    doc.moveDown(0.9);

    // Professionnel
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('Professionnel de santé');
    doc.moveDown(0.3);
    field(doc, 'Nom', visite.professionnel, W);
    field(doc, 'Spécialité', visite.specialite, W);
    field(doc, 'Potentiel', visite.potentiel, W);
    field(doc, 'Structure', visite.structure, W);
    field(doc, 'Localisation', `${visite.region || ''} — ${visite.district || ''}`, W);
    doc.moveDown(0.4);

    // Produits
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('Produits présentés');
    doc.moveDown(0.3);
    table(doc, ['Produit', 'DCI', 'Qté'], produits.map((p) => [p.nom, p.dci, String(p.qty ?? '')]), W);
    doc.moveDown(0.6);

    // Résultat + compte rendu
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('Résultat');
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(11).fillColor(GREEN).text(RESULTATS[visite.resultat] || '—');
    if (visite.compte_rendu) {
      doc.moveDown(0.4);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('Compte rendu');
      doc.moveDown(0.25);
      doc.font('Helvetica').fontSize(10).fillColor(INK).text(visite.compte_rendu, { width: W });
    }
    if (visite.prochaine_visite) {
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10).fillColor(INK).text(`Prochaine visite : ${visite.prochaine_visite}`);
    }
    if (visite.motif_refus) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#b91c1c').text(`Motif de refus : ${visite.motif_refus}`);
    }

    // Signature
    doc.moveDown(3);
    doc.font('Helvetica').fontSize(9).fillColor(MUT).text('Signature du délégué médical : _______________________________', M, doc.y);

    doc.end();
  });
}
