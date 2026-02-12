import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const A4_WIDTH = 595.28; // pt
const A4_HEIGHT = 841.89; // pt

/**
 * Render an HTML string into a PDF blob using html2canvas + jsPDF.
 * The HTML is injected into a hidden container so it can be captured
 * without disturbing the current UI.
 */
export async function renderHtmlToPdf(html: string): Promise<Blob> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('PDF generation is only available in the browser context.');
  }

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.backgroundColor = 'white';
  container.style.padding = '0';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'pt', 'a4');

    let imgHeight = (canvas.height * A4_WIDTH) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, A4_WIDTH, imgHeight, undefined, 'FAST');
    heightLeft -= A4_HEIGHT;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, A4_WIDTH, imgHeight, undefined, 'FAST');
      heightLeft -= A4_HEIGHT;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}
