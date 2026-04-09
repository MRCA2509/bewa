export const getLocalDate = (dateStr) => {
  if (!dateStr || dateStr.includes('0001')) return null;
  let finalDateStr = dateStr;

  if (dateStr.includes('GMT')) {
    const parts = dateStr.split(' ');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = months.indexOf(parts[2]);
    if (monthIdx >= 0 && parts[1] && parts[3]) {
      finalDateStr = `${parts[3]}-${String(monthIdx + 1).padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  }
  return finalDateStr.slice(0, 10);
};

export const isRecentHandling = (dateStr) => {
  if (!dateStr || dateStr.includes('0001') || dateStr === 'null' || dateStr === '') return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oneDayAgo = new Date(today); oneDayAgo.setDate(today.getDate() - 1);
  const twoDaysAgo = new Date(today); twoDaysAgo.setDate(today.getDate() - 2);

  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  // Return true if date is exactly H-1 or H-2
  return d.getTime() === oneDayAgo.getTime() || d.getTime() === twoDaysAgo.getTime();
};

// Helper logic to process active shipments for the Monitoring Report
export const processMonitoringData = (activeShipments, selectedMonth) => {
  if (!activeShipments || !selectedMonth) return null;
  const metrics = {};
  const DROP_POINTS = ['MABA', 'BULI', 'WASILE', 'SOFIFI', 'LABUHA', 'FALAJAWA2', 'SANANA', 'BOBONG'];

  DROP_POINTS.forEach(dp => {
    metrics[dp] = { 'Regis Retur': { total: 0 } };
  });

  activeShipments.forEach(row => {
    const dp = row.drop_point;
    if (!DROP_POINTS.includes(dp)) return;

    // SLA Filtering: Hide if handled in H-1 or H-2 (Normal progress from yesterday)
    const regisReturStr = row.waktu_regis_retur;
    const isHandlingRecent = isRecentHandling(regisReturStr);
    const isScanKirimRecent = row.jenis_scan === 'Scan Kirim' && isRecentHandling(row.waktu_scan);

    if (isHandlingRecent || isScanKirimRecent) return;

    let category = 'Indikasi';
    const hasRegisRetur = regisReturStr && !regisReturStr.includes('0001') && regisReturStr !== 'null' && regisReturStr !== '';
    
    if (hasRegisRetur) {
      category = 'Regis Retur';
    } else if (row.jenis_scan) {
      category = row.jenis_scan;
    }

    const fullDate = getLocalDate(row.waktu_sampai);
    if (fullDate && fullDate.slice(0, 7) === selectedMonth) {
      const dateKey = fullDate;
      if (!metrics[dp][category]) {
        metrics[dp][category] = { total: 0 };
      }
      metrics[dp][category][dateKey] = (metrics[dp][category][dateKey] || 0) + 1;
      metrics[dp][category].total++;
    }
  });

  // Ensure 'Regis Retur' exists even if empty
  DROP_POINTS.forEach(dp => {
    if (!metrics[dp]['Regis Retur']) {
      metrics[dp]['Regis Retur'] = { total: 0 };
    }
  });

  return metrics;
};

// Helper: Get cell class based on value
export const getCellClass = (val) => {
  if (!val || val === 0) return 'cell-val-0'
  if (val < 50) return 'cell-val-low'
  if (val < 200) return 'cell-val-mid'
  return 'cell-val-high'
};
