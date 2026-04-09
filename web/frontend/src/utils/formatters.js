// Formatting Helper: Date
export const formatDateTime = (dateStr) => {
  if (!dateStr || dateStr === 'null') return '-';
  try {
    // Flask defaults to sending naive dates as 'GMT'. Strip it to avoid JS timezone shifts.
    const cleanDateStr = typeof dateStr === 'string' && dateStr.endsWith(' GMT') ? dateStr.replace(' GMT', '') : dateStr;
    const date = new Date(cleanDateStr);
    // Filter out placeholder dates (e.g., 0001-01-01 or early years used as defaults)
    if (isNaN(date.getTime()) || date.getFullYear() < 2010) return '-';
    return date.toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return '-';
  }
};

// Formatting Helper: Currency/Numbers
export const formatCurrency = (amount) => {
  if (amount === undefined || amount === null || amount === 0) return '0';
  return Number(amount).toLocaleString('id-ID');
};
