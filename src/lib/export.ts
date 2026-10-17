import type { SimulationConfig, SimulationResult } from '../types';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

const dec = (v: number) => v.toFixed(2).replace('.', ',');

export function downloadCsv(_cfg: SimulationConfig, result: SimulationResult) {
  const header = [
    'Jahr',
    'Alter',
    'Monate',
    'Einzahlung',
    'Eingezahlt gesamt',
    'Depotwert',
    'Depotwert Kaufkraft',
    'Dividende brutto',
    'Dividende netto',
    'Dividende netto Kaufkraft',
    'Ø Dividende netto pro Monat',
    'Vorabpauschale',
    'Steuern',
    'Kosten',
  ];
  const lines = result.rows.map((r) =>
    [
      r.year,
      r.age,
      r.months,
      dec(r.contributions),
      dec(r.investedTotal),
      dec(r.valueEnd),
      dec(r.realValueEnd),
      dec(r.dividendsGross),
      dec(r.dividendsNet),
      dec(r.realDividendsNet),
      dec(r.monthlyDividendNet),
      dec(r.advanceLumpSum),
      dec(r.taxes),
      dec(r.costs),
    ].join(';'),
  );
  // BOM + semicolons so German Excel opens it correctly
  const csv = '﻿' + [header.join(';'), ...lines].join('\r\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `vermoegens-simulation-${stamp()}.csv`);
}

/** Renders an element to PNG or a paginated A4 PDF. Libraries load on demand. */
export async function exportElement(el: HTMLElement, type: 'png' | 'pdf') {
  const { toPng } = await import('html-to-image');
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff';
  const width = Math.max(el.scrollWidth, 1100);
  const dataUrl = await toPng(el, {
    pixelRatio: 2,
    backgroundColor: bg,
    width,
    style: { width: `${width}px`, padding: '24px', boxSizing: 'border-box' },
    filter: (node) => !(node instanceof HTMLElement && node.dataset.exportIgnore !== undefined),
  });

  if (type === 'png') {
    const blob = await (await fetch(dataUrl)).blob();
    download(blob, `vermoegens-simulation-${stamp()}.png`);
    return;
  }

  const { jsPDF } = await import('jspdf');
  const img = new Image();
  img.src = dataUrl;
  await img.decode();

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgH = (img.height * pageW) / img.width;

  // Fill the page background so the dark theme exports cleanly
  const paint = () => {
    pdf.setFillColor(bg);
    pdf.rect(0, 0, pageW, pageH, 'F');
  };
  let offset = 0;
  paint();
  pdf.addImage(dataUrl, 'PNG', 0, 0, pageW, imgH);
  while (imgH - offset > pageH) {
    offset += pageH;
    pdf.addPage();
    paint();
    pdf.addImage(dataUrl, 'PNG', 0, -offset, pageW, imgH);
  }
  pdf.save(`vermoegens-simulation-${stamp()}.pdf`);
}
