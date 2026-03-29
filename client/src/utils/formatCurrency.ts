export const formatCurrency = (amount: number, currency = 'LKR') =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency }).format(amount);
