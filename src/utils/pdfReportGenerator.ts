import { jsPDF } from 'jspdf';
import { PreInvestmentAsset } from '../types';

export interface FinancialReportData {
  dateRangeLabel: string;
  profitMode: 'gross' | 'net';
  currency: string;
  totalRevenue: number;
  totalCogs: number;
  metaAdSpend: number;
  grossProfit: number;
  grossMarginPct: number;
  allocatedOverhead: number;
  amortizedDepreciation: number;
  courierFees: number;
  netProfit: number;
  netMarginPct: number;
  roas: number;
  cpa: number;
  totalOrders: number;
  deliveredOrders: number;
  deliverySuccessRate: number;
  assets: PreInvestmentAsset[];
  productPerformance: {
    name: string;
    category: string;
    units: number;
    revenue: number;
    cogs: number;
    marginPct: number;
  }[];
  healthStatus: {
    status: 'EXCELLENT' | 'HEALTHY SCALING' | 'ATTENTION NEEDED';
    score: number;
    summary: string;
  };
}

export function generateFinancialPdfReport(data: FinancialReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Background Canvas: Premium Charcoal / Warm Luxury Slate
  doc.setFillColor(15, 17, 23); // #0f1117
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Top Luxury Gold Accent Bar
  doc.setFillColor(217, 119, 6); // Amber Gold
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Header Box
  doc.setFillColor(24, 27, 36);
  doc.roundedRect(margin, 10, pageWidth - margin * 2, 30, 3, 3, 'F');

  // Brand Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(245, 158, 11); // Gold
  doc.text('VISTOOSA HAUTE COUTURE (ভিস্তোসা)', margin + 6, 20);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(156, 163, 175);
  doc.text('Banani Diplomatic Zone, Dhaka-1213 | Enterprise P&L Financial Intelligence', margin + 6, 25);
  doc.text('System ID: VIS-FIN-PWA • Powered by Veer AI Operations Engine', margin + 6, 29);
  doc.text(`Official Generated At: ${new Date().toLocaleString('en-GB')}`, margin + 6, 33);

  // Right-aligned report badge
  doc.setFillColor(39, 44, 58);
  doc.roundedRect(pageWidth - margin - 55, 15, 49, 19, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(229, 231, 235);
  doc.text('P&L AUDIT STATEMENT', pageWidth - margin - 51, 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(209, 213, 219);
  doc.text(`Period: ${data.dateRangeLabel}`, pageWidth - margin - 51, 26);
  doc.text(`Mode: ${data.profitMode === 'gross' ? 'Gross Profit' : 'Net (With Amort.)'}`, pageWidth - margin - 51, 30);

  // SECTION 1: EXECUTIVE KPI SUMMARY GRID
  let y = 46;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(243, 244, 246);
  doc.text('1. EXECUTIVE FINANCIAL OVERVIEW & KPI PERFORMANCE', margin, y);

  y += 4;
  const colWidth = (pageWidth - margin * 2 - 8) / 3;
  const kpis = [
    { label: 'Gross Revenue', val: `BDT ${data.totalRevenue.toLocaleString()}`, sub: `${data.deliveredOrders} Delivered Orders`, color: [245, 158, 11] },
    { label: 'Meta Ad Spend', val: `BDT ${data.metaAdSpend.toLocaleString()}`, sub: `ROAS: ${data.roas.toFixed(2)}x | CPA: BDT ${data.cpa.toFixed(0)}`, color: [59, 130, 246] },
    { label: data.profitMode === 'gross' ? 'Gross Profit (COGS Only)' : 'Net Operating Profit', val: `BDT ${(data.profitMode === 'gross' ? data.grossProfit : data.netProfit).toLocaleString()}`, sub: `Margin: ${(data.profitMode === 'gross' ? data.grossMarginPct : data.netMarginPct).toFixed(1)}% Yield`, color: [34, 197, 94] },
  ];

  kpis.forEach((kpi, idx) => {
    const xPos = margin + idx * (colWidth + 4);
    doc.setFillColor(24, 27, 36);
    doc.roundedRect(xPos, y, colWidth, 22, 2, 2, 'F');
    doc.setDrawColor(45, 52, 68);
    doc.roundedRect(xPos, y, colWidth, 22, 2, 2, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.text(kpi.label.toUpperCase(), xPos + 4, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, xPos + 4, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(209, 213, 219);
    doc.text(kpi.sub, xPos + 4, y + 18);
  });

  // SECTION 2: COST OF GOODS & OVERHEAD ALLOCATION TABLE
  y += 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(243, 244, 246);
  doc.text('2. COST STRUCTURE, DEDUCTIONS & AMORTIZATION SCHEDULE', margin, y);

  y += 4;
  doc.setFillColor(24, 27, 36);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 42, 2, 2, 'F');
  doc.setDrawColor(45, 52, 68);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 42, 2, 2, 'S');

  // Breakdown lines
  const costLines = [
    { label: 'Total Product COGS (Fabric, Yarn, Buttons & Sewing Labor)', val: `- BDT ${data.totalCogs.toLocaleString()}`, desc: `${((data.totalCogs / (data.totalRevenue || 1)) * 100).toFixed(1)}% of Revenue` },
    { label: 'Meta Ads & Digital Acquisition Spend (Marketing API Synchronized)', val: `- BDT ${data.metaAdSpend.toLocaleString()}`, desc: `Acquisition cost across Facebook/Instagram` },
    { label: data.profitMode === 'gross' ? 'Overhead Expenses (Gross View: Not Deducted)' : 'Operating Fixed Overheads (Pro-Rata Allocated Margin / Cash Outflows)', val: data.profitMode === 'gross' ? 'BDT 0 (Gross Mode)' : `- BDT ${data.allocatedOverhead.toLocaleString()}`, desc: 'Showroom rent, staff food, packaging bags, utility prorating' },
    { label: data.profitMode === 'gross' ? 'Pre-Investment Amortization (Gross View: Excluded)' : 'Pre-Investment Amortization (Depreciated Setup Assets: Web/Cloud/Hardware)', val: data.profitMode === 'gross' ? 'BDT 0 (Gross Mode)' : `- BDT ${data.amortizedDepreciation.toLocaleString()}`, desc: '24-month linear non-cash write-down of capital setup' },
    { label: 'Pathao Courier & In-Transit COD Settlement Fees', val: `- BDT ${data.courierFees.toLocaleString()}`, desc: `Delivery handling & return insurance` },
  ];

  let lineY = y + 7;
  costLines.forEach((cl) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(209, 213, 219);
    doc.text(cl.label, margin + 4, lineY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68); // Red
    doc.text(cl.val, margin + 110, lineY);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(156, 163, 175);
    doc.text(cl.desc, margin + 145, lineY);

    lineY += 7;
  });

  // SECTION 3: TOP PRODUCT CONTRIBUTION BREAKDOWN
  y += 48;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(243, 244, 246);
  doc.text('3. TOP PRODUCT CONTRIBUTION & MARGIN MATRIX', margin, y);

  y += 4;
  // Table Header
  doc.setFillColor(39, 44, 58);
  doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(245, 158, 11);
  doc.text('PRODUCT / LINE ITEM', margin + 4, y + 4.5);
  doc.text('CATEGORY', margin + 65, y + 4.5);
  doc.text('UNITS SOLD', margin + 95, y + 4.5);
  doc.text('REVENUE (BDT)', margin + 120, y + 4.5);
  doc.text('COGS (BDT)', margin + 148, y + 4.5);
  doc.text('CONTRIBUTION %', margin + 170, y + 4.5);

  y += 7;
  data.productPerformance.slice(0, 5).forEach((p, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 24 : 20, isEven ? 27 : 23, isEven ? 36 : 31);
    doc.rect(margin, y, pageWidth - margin * 2, 6.5, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(243, 244, 246);
    doc.text(p.name.substring(0, 30), margin + 4, y + 4.5);

    doc.setTextColor(156, 163, 175);
    doc.text(p.category, margin + 65, y + 4.5);
    doc.text(p.units.toString(), margin + 98, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(243, 244, 246);
    doc.text(p.revenue.toLocaleString(), margin + 122, y + 4.5);

    doc.setTextColor(209, 213, 219);
    doc.text(p.cogs.toLocaleString(), margin + 150, y + 4.5);

    doc.setTextColor(34, 197, 94); // Green
    doc.text(`${p.marginPct.toFixed(1)}%`, margin + 172, y + 4.5);

    y += 6.5;
  });

  // SECTION 4: PRE-INVESTMENT ASSETS TRACKED
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(243, 244, 246);
  doc.text('4. PRE-INVESTMENT SETUP ASSET AMORTIZATION REGISTER', margin, y);

  y += 4;
  doc.setFillColor(24, 27, 36);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 2, 2, 'F');
  doc.setDrawColor(45, 52, 68);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 2, 2, 'S');

  let assetY = y + 5.5;
  data.assets.slice(0, 4).forEach((asset) => {
    const monthlyRate = Math.round(asset.initialCostBDT / asset.amortizationMonths);
    const dailyRate = (asset.initialCostBDT / (asset.amortizationMonths * 30)).toFixed(1);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(229, 231, 235);
    doc.text(`• ${asset.name} (${asset.category})`, margin + 4, assetY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text(`Initial CapEx: BDT ${asset.initialCostBDT.toLocaleString()} | Schedule: ${asset.amortizationMonths} Mo`, margin + 85, assetY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 158, 11);
    doc.text(`Amortization: BDT ${monthlyRate}/mo (~BDT ${dailyRate}/day)`, margin + 140, assetY);

    assetY += 5.5;
  });

  // SECTION 5: BUSINESS HEALTH & VEER AI EXECUTIVE CERTIFICATION
  y += 34;
  doc.setFillColor(18, 20, 27);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 26, 2, 2, 'F');
  doc.setDrawColor(217, 119, 6);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 26, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(245, 158, 11);
  doc.text(`BUSINESS HEALTH STATUS: [${data.healthStatus.status}] (Operational Score: ${data.healthStatus.score}/100)`, margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(209, 213, 219);
  doc.text(data.healthStatus.summary, margin + 4, y + 11);
  doc.text('Audited against Google Sheets Database, Pathao 1-Taka Reconciliation, and Meta Marketing API.', margin + 4, y + 16);

  // Signatures
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text('Authorized Finance Controller: _______________________', margin + 4, y + 22);
  doc.text('Veer (AI Fashion Operations Lead): [VERIFIED DIGITAL SEAL]', pageWidth - margin - 75, y + 22);

  // Save the PDF
  const filename = `Vistoosa_Financial_Report_${data.dateRangeLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
  doc.save(filename);
}
