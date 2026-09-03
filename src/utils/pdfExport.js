/**
 * Correlatio — PDF Export Utility
 * Converts any DOM element / canvas into a crisp, high-resolution PDF document.
 * Tries jsPDF (via dynamic CDN injection) and falls back to a built-in
 * zero-dependency PDF 1.4 binary generator.
 */

/**
 * Loads jsPDF dynamically from CDN if available.
 */
export async function getJsPdf() {
  if (typeof window !== 'undefined' && window.jspdf?.jsPDF) {
    return window.jspdf.jsPDF;
  }
  return new Promise((resolve) => {
    try {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.async = true;
      script.onload = () => {
        resolve(window.jspdf?.jsPDF || null);
      };
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Pure JavaScript PDF 1.4 Binary Generator.
 * Embeds a JPEG image stream directly into a standard PDF structure.
 * Zero external dependencies. Works 100% offline in all modern browsers.
 *
 * @param {HTMLCanvasElement} canvas - The canvas to convert
 * @param {string} filename - Target filename (.pdf)
 */
export function canvasToPurePdf(canvas, filename = 'Correlatio-Report.pdf') {
  // Convert canvas to high-quality JPEG
  const dataUrl = canvas.toDataURL('image/jpeg', 0.96);
  const base64Data = dataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const imgLen = binaryString.length;

  const imgBytes = new Uint8Array(imgLen);
  for (let i = 0; i < imgLen; i++) {
    imgBytes[i] = binaryString.charCodeAt(i);
  }

  // Dimensions in standard PDF points (72 points per inch)
  const pxWidth = canvas.width;
  const pxHeight = canvas.height;
  const aspectRatio = pxWidth / pxHeight;

  let ptWidth, ptHeight;
  if (aspectRatio >= 1) {
    ptWidth = 842;
    ptHeight = Math.round(ptWidth / aspectRatio);
  } else {
    ptWidth = 595;
    ptHeight = Math.round(ptWidth / aspectRatio);
  }

  const encoder = new TextEncoder();

  const part1 = encoder.encode(
    `%PDF-1.4\n` +
    `%\xE2\xE3\xCF\xD3\n` +
    `1 0 obj\n` +
    `<< /Type /Catalog /Pages 2 0 R >>\n` +
    `endobj\n` +
    `2 0 obj\n` +
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n` +
    `endobj\n` +
    `3 0 obj\n` +
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptWidth} ${ptHeight}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\n` +
    `endobj\n` +
    `4 0 obj\n` +
    `<< /Type /XObject /Subtype /Image /Width ${pxWidth} /Height ${pxHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgLen} >>\n` +
    `stream\n`
  );

  const part2 = encoder.encode(
    `\nendstream\n` +
    `endobj\n` +
    `5 0 obj\n` +
    `<< /Length 44 >>\n` +
    `stream\n` +
    `q ${ptWidth} 0 0 ${ptHeight} 0 0 cm /Im1 Do Q\n` +
    `endstream\n` +
    `endobj\n`
  );

  const headerLen = encoder.encode(`%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`).length;
  const obj1Offset = headerLen;
  const obj2Offset = obj1Offset + encoder.encode(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`).length;
  const obj3Offset = obj2Offset + encoder.encode(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`).length;
  const obj4Offset = obj3Offset + encoder.encode(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptWidth} ${ptHeight}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\n`).length;
  const obj5Offset = obj4Offset + encoder.encode(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pxWidth} /Height ${pxHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgLen} >>\nstream\n`).length + imgLen + encoder.encode(`\nendstream\nendobj\n`).length;

  const xrefOffset = obj5Offset + encoder.encode(`5 0 obj\n<< /Length 44 >>\nstream\nq ${ptWidth} 0 0 ${ptHeight} 0 0 cm /Im1 Do Q\nendstream\nendobj\n`).length;

  const pad = (n) => String(n).padStart(10, '0');

  const xrefAndTrailer = encoder.encode(
    `xref\n` +
    `0 6\n` +
    `0000000000 65535 f \n` +
    `${pad(obj1Offset)} 00000 n \n` +
    `${pad(obj2Offset)} 00000 n \n` +
    `${pad(obj3Offset)} 00000 n \n` +
    `${pad(obj4Offset)} 00000 n \n` +
    `${pad(obj5Offset)} 00000 n \n` +
    `trailer\n` +
    `<< /Size 6 /Root 1 0 R >>\n` +
    `startxref\n` +
    `${xrefOffset}\n` +
    `%%EOF\n`
  );

  const totalLength = part1.length + imgBytes.length + part2.length + xrefAndTrailer.length;
  const pdfBytes = new Uint8Array(totalLength);
  let offset = 0;

  pdfBytes.set(part1, offset); offset += part1.length;
  pdfBytes.set(imgBytes, offset); offset += imgBytes.length;
  pdfBytes.set(part2, offset); offset += part2.length;
  pdfBytes.set(xrefAndTrailer, offset);

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * High-level export function: renders any canvas to a downloaded PDF.
 * Uses jsPDF when loaded, otherwise seamlessly falls back to pure PDF engine.
 */
export async function exportCanvasToPdf(canvas, filename = 'Correlatio-Report.pdf') {
  try {
    const JsPdfClass = await getJsPdf();
    if (JsPdfClass) {
      const isLandscape = canvas.width >= canvas.height;
      const doc = new JsPdfClass({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'pt',
        format: isLandscape ? [842, 595] : [595, 842]
      });

      const pageWidth = isLandscape ? 842 : 595;
      const pageHeight = isLandscape ? 595 : 842;
      const imgData = canvas.toDataURL('image/jpeg', 0.96);

      const margin = 20;
      const availWidth = pageWidth - (margin * 2);
      const availHeight = pageHeight - (margin * 2);
      const scale = Math.min(availWidth / canvas.width, availHeight / canvas.height);
      const renderW = canvas.width * scale;
      const renderH = canvas.height * scale;
      const posX = margin + (availWidth - renderW) / 2;
      const posY = margin + (availHeight - renderH) / 2;

      doc.addImage(imgData, 'JPEG', posX, posY, renderW, renderH);
      doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
      return;
    }
  } catch (e) {
    console.warn('jsPDF export error, falling back to pure PDF generator:', e);
  }

  // Pure JS fallback
  canvasToPurePdf(canvas, filename);
}
