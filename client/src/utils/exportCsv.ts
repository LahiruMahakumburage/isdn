/**
 * ISDN CSV Export Utility
 * Converts array of objects to a properly formatted CSV file
 * and triggers a browser download.
 */

// Escape a cell value for CSV (wrap in quotes if it contains comma/quote/newline)
function escapeCell(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If the value contains a comma, double-quote, or newline — wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Build CSV string from headers + rows
function buildCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCell).join(',');
  const dataLines  = rows.map(row => row.map(escapeCell).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

// Trigger browser download
function downloadCsv(csvString: string, filename: string): void {
  // Add UTF-8 BOM so Excel opens it correctly with special characters
  const bom  = '\uFEFF';
  const blob = new Blob([bom + csvString], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Public export functions ───────────────────────────────

export function exportSalesReport(data: any, from: string, to: string): void {
  const date = new Date().toISOString().split('T')[0];

  // ── Sheet 1: Daily Revenue ──
  if (data.daily?.length) {
    const headers = ['Date', 'Order Count', 'Revenue (LKR)', 'Avg Order Value (LKR)'];
    const rows    = data.daily.map((r: any) => [
      r.date,
      r.order_count,
      Number(r.revenue        || 0).toFixed(2),
      Number(r.avg_order_value || 0).toFixed(2),
    ]);
    downloadCsv(buildCsv(headers, rows), `ISDN_Sales_Daily_${from}_to_${to}_${date}.csv`);
  }

  // ── Sheet 2: Revenue by RDC ── (slight delay so both files download)
  setTimeout(() => {
    if (data.byRdc?.length) {
      const headers = ['RDC Name', 'Region', 'Order Count', 'Revenue (LKR)'];
      const rows    = data.byRdc.map((r: any) => [
        r.rdc_name,
        r.region,
        r.order_count,
        Number(r.revenue || 0).toFixed(2),
      ]);
      downloadCsv(buildCsv(headers, rows), `ISDN_Sales_ByRDC_${from}_to_${to}_${date}.csv`);
    }
  }, 300);

  // ── Sheet 3: Top Products ──
  setTimeout(() => {
    if (data.topProducts?.length) {
      const headers = ['SKU', 'Product Name', 'Units Sold', 'Total Revenue (LKR)'];
      const rows    = data.topProducts.map((p: any) => [
        p.sku,
        p.name,
        p.total_sold,
        Number(p.total_revenue || 0).toFixed(2),
      ]);
      downloadCsv(buildCsv(headers, rows), `ISDN_Sales_TopProducts_${from}_to_${to}_${date}.csv`);
    }
  }, 600);

  // ── Sheet 4: Top Customers ──
  setTimeout(() => {
    if (data.topCustomers?.length) {
      const headers = ['Customer Name', 'Email', 'Order Count', 'Total Spent (LKR)'];
      const rows    = data.topCustomers.map((c: any) => [
        c.full_name,
        c.email,
        c.order_count,
        Number(c.total_spent || 0).toFixed(2),
      ]);
      downloadCsv(buildCsv(headers, rows), `ISDN_Sales_TopCustomers_${from}_to_${to}_${date}.csv`);
    }
  }, 900);
}

export function exportStockTurnover(items: any[], rdcName: string): void {
  const date    = new Date().toISOString().split('T')[0];
  const rdc     = rdcName || 'AllRDCs';
  const headers = [
    'Product Name', 'SKU', 'RDC', 'Region',
    'On Hand', 'Reserved', 'Available',
    'Reorder Level', 'Units Sold (30d)', 'Revenue (30d) LKR',
    'Days of Stock', 'Status',
  ];
  const getStatus = (days: number | null) => {
    if (!days || days === 0) return 'No Sales';
    if (days <= 7)  return 'Critical';
    if (days <= 30) return 'Low';
    return 'Healthy';
  };
  const rows = items.map((r: any) => [
    r.name,
    r.sku,
    r.rdc_name,
    r.region,
    r.quantity_on_hand,
    r.quantity_reserved,
    Number(r.quantity_on_hand || 0) - Number(r.quantity_reserved || 0),
    r.reorder_level,
    r.sold_30d,
    Number(r.revenue_30d || 0).toFixed(2),
    r.days_of_stock ? `${r.days_of_stock}` : 'N/A',
    getStatus(r.days_of_stock),
  ]);
  downloadCsv(buildCsv(headers, rows), `ISDN_StockTurnover_${rdc}_${date}.csv`);
}

export function exportDeliveryEfficiency(data: any, from: string, to: string): void {
  const date = new Date().toISOString().split('T')[0];

  // ── RDC Performance ──
  if (data.byRdc?.length) {
    const headers = [
      'RDC Name', 'Region', 'Total Deliveries',
      'Delivered', 'Failed', 'Pending',
      'Success Rate (%)', 'Avg Hours to Deliver',
    ];
    const rows = data.byRdc.map((r: any) => [
      r.rdc_name,
      r.region,
      r.total_deliveries,
      r.delivered,
      r.failed,
      r.pending,
      r.success_rate || 0,
      r.avg_hours || 'N/A',
    ]);
    downloadCsv(buildCsv(headers, rows),
      `ISDN_DeliveryEff_ByRDC_${from}_to_${to}_${date}.csv`);
  }

  // ── Driver Performance ──
  setTimeout(() => {
    if (data.byDriver?.length) {
      const headers = [
        'Driver Name', 'Phone', 'Total Deliveries',
        'Delivered', 'Failed', 'Success Rate (%)',
      ];
      const rows = data.byDriver.map((d: any) => [
        d.driver_name,
        d.phone || '',
        d.total,
        d.delivered,
        d.failed,
        d.success_rate || 0,
      ]);
      downloadCsv(buildCsv(headers, rows),
        `ISDN_DeliveryEff_ByDriver_${from}_to_${to}_${date}.csv`);
    }
  }, 400);
}
