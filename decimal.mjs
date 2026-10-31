// Text inputs keep the decimal separator supplied by iPhone keyboards. Parse
// explicitly instead of allowing the browser's number input to discard commas.
function checkPrecision(maxDecimals) {
  if (!Number.isInteger(maxDecimals) || maxDecimals < 0 || maxDecimals > 20) {
    throw new Error('La precisión decimal debe estar entre 0 y 20.');
  }
}

export function parseDecimal(value, { label = 'El valor', maxDecimals = 8 } = {}) {
  checkPrecision(maxDecimals);
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${label} es obligatorio.`);
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${label} debe ser un número, con coma o punto decimal y sin separadores de miles.`);
  }
  const input = String(value).trim().replace(/^−/, '-');
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(input)) {
    throw new Error(`${label} debe ser un número, con coma o punto decimal y sin separadores de miles.`);
  }
  const fraction = (input.split(/[.,]/)[1] ?? '').replace(/0+$/, '');
  if (fraction.length > maxDecimals) {
    throw new Error(`${label} admite como máximo ${maxDecimals} ${maxDecimals === 1 ? 'decimal' : 'decimales'}.`);
  }
  const number = Number(input.replace(',', '.'));
  if (!Number.isFinite(number)) throw new Error(`${label} debe ser un número finito.`);
  return Object.is(number, -0) ? 0 : number;
}

export function formatDecimal(value, { maxDecimals = 8 } = {}) {
  checkPrecision(maxDecimals);
  if (value === null || value === undefined || value === '') return '';
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return new Intl.NumberFormat('es-ES', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(Object.is(value, -0) ? 0 : value);
}
