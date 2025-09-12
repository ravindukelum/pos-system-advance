// Currency utility functions for dynamic currency symbol management

/**
 * Currency symbol mapping
 */
const CURRENCY_SYMBOLS = {
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'JPY': '¥',
  'CAD': 'C$',
  'AUD': 'A$',
  'LKR': '₨',
  'INR': '₹',
  'CNY': '¥',
  'KRW': '₩',
  'SGD': 'S$',
  'THB': '฿',
  'MYR': 'RM',
  'PHP': '₱',
  'VND': '₫',
  'IDR': 'Rp',
  'BDT': '৳',
  'PKR': '₨',
  'NPR': '₨'
};

/**
 * Get currency symbol from currency code
 * @param {string} currencyCode - The currency code (e.g., 'USD', 'EUR')
 * @returns {string} The currency symbol
 */
export const getCurrencySymbol = (currencyCode) => {
  if (!currencyCode) return '$'; // Default fallback
  return CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || currencyCode;
};

/**
 * Format currency value with symbol
 * @param {number|string} amount - The amount to format
 * @param {string} currencyCode - The currency code
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currencyCode, decimals = 2) => {
  const symbol = getCurrencySymbol(currencyCode);
  const numAmount = parseFloat(amount) || 0;
  return `${symbol} ${numAmount.toFixed(decimals)}`;
};

/**
 * Format currency value with symbol (no decimals for whole numbers)
 * @param {number|string} amount - The amount to format
 * @param {string} currencyCode - The currency code
 * @returns {string} Formatted currency string
 */
export const formatCurrencyCompact = (amount, currencyCode) => {
  const symbol = getCurrencySymbol(currencyCode);
  const numAmount = parseFloat(amount) || 0;
  const decimals = numAmount % 1 === 0 ? 0 : 2;
  return `${symbol} ${numAmount.toFixed(decimals)}`;
};

/**
 * Get all available currencies
 * @returns {Array} Array of currency objects with code and symbol
 */
export const getAvailableCurrencies = () => {
  return Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => ({
    code,
    symbol,
    label: `${code} (${symbol})`
  }));
};

/**
 * Check if currency code is supported
 * @param {string} currencyCode - The currency code to check
 * @returns {boolean} True if supported
 */
export const isSupportedCurrency = (currencyCode) => {
  return currencyCode && CURRENCY_SYMBOLS.hasOwnProperty(currencyCode.toUpperCase());
};