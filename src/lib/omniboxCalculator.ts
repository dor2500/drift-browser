/**
 * Omnibox Smart Calculator, Unit Converter & Instant Direct Answers
 * Evaluates math, unit conversions, currency exchange, and color inspection
 * without using eval(), strictly sandboxed and safe.
 */

export interface OmniboxAnswer {
  category: 'math' | 'unit' | 'currency' | 'color' | 'encode';
  icon: 'calculator' | 'coins' | 'ruler' | 'palette' | 'bolt';
  title: string;
  result: string;
  subtitle: string;
}

// Built-in currency FX exchange rates (Base: USD)
const FX_RATES_USD: Record<string, number> = {
  usd: 1.0,
  ils: 3.68,
  eur: 0.92,
  gbp: 0.78,
  cad: 1.36,
  aud: 1.52,
  jpy: 154.2,
  cny: 7.24,
  chf: 0.90,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  ils: '₪',
  usd: '$',
  eur: '€',
  gbp: '£',
  jpy: '¥',
  cad: 'C$',
  aud: 'A$',
  cny: '¥',
  chf: 'CHF',
};

// Safe Math Evaluator using Recursive Descent Parsing (no eval / no Function)
function safeEvalMath(expr: string): number | null {
  // Clean tokens: allow only digits, operators, parentheses, decimal dots, and math functions
  const clean = expr
    .replace(/\s+/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\^/g, '**');

  // Verify only permitted math characters
  if (!/^[0-9+\-*/().,eE]|sqrt|abs|sin|cos|tan|pi|PI|\*\*/.test(clean)) {
    return null;
  }

  // Handle percentages like "15% of 300"
  const percentMatch = expr.match(/^(\d+(?:\.\d+)?)\s*%\s*(?:of|מתוך|\*)\s*(\d+(?:\.\d+)?)$/i);
  if (percentMatch) {
    const p = parseFloat(percentMatch[1]);
    const total = parseFloat(percentMatch[2]);
    return (p / 100) * total;
  }

  // Tokenize
  let pos = 0;
  const str = clean.replace(/pi/gi, String(Math.PI)).replace(/e(?![0-9])/gi, String(Math.E));

  function peek(): string {
    return str[pos] || '';
  }

  function get(): string {
    return str[pos++] || '';
  }

  function parseNumber(): number {
    let numStr = '';
    while (/[0-9.]/.test(peek())) {
      numStr += get();
    }
    const val = parseFloat(numStr);
    if (isNaN(val)) throw new Error('Invalid number');
    return val;
  }

  function parseFactor(): number {
    if (peek() === '+') {
      get();
      return parseFactor();
    }
    if (peek() === '-') {
      get();
      return -parseFactor();
    }
    if (peek() === '(') {
      get();
      const val = parseExpr();
      if (get() !== ')') throw new Error('Mismatched parenthesis');
      return val;
    }
    if (str.startsWith('sqrt(', pos)) {
      pos += 5;
      const v = parseExpr();
      if (get() !== ')') throw new Error('Mismatched parenthesis');
      return Math.sqrt(v);
    }
    if (str.startsWith('abs(', pos)) {
      pos += 4;
      const v = parseExpr();
      if (get() !== ')') throw new Error('Mismatched parenthesis');
      return Math.abs(v);
    }
    if (str.startsWith('sin(', pos)) {
      pos += 4;
      const v = parseExpr();
      if (get() !== ')') throw new Error('Mismatched parenthesis');
      return Math.sin(v);
    }
    if (str.startsWith('cos(', pos)) {
      pos += 4;
      const v = parseExpr();
      if (get() !== ')') throw new Error('Mismatched parenthesis');
      return Math.cos(v);
    }
    if (str.startsWith('tan(', pos)) {
      pos += 4;
      const v = parseExpr();
      if (get() !== ')') throw new Error('Mismatched parenthesis');
      return Math.tan(v);
    }
    return parseNumber();
  }

  function parsePower(): number {
    let left = parseFactor();
    while (str.startsWith('**', pos)) {
      pos += 2;
      const right = parseFactor();
      left = Math.pow(left, right);
    }
    return left;
  }

  function parseTerm(): number {
    let left = parsePower();
    while (peek() === '*' || peek() === '/') {
      const op = get();
      const right = parsePower();
      if (op === '*') left *= right;
      else if (op === '/') {
        if (right === 0) return Infinity;
        left /= right;
      }
    }
    return left;
  }

  function parseExpr(): number {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = get();
      const right = parseTerm();
      if (op === '+') left += right;
      else if (op === '-') left -= right;
    }
    return left;
  }

  try {
    const res = parseExpr();
    if (pos < str.length) return null; // Unconsumed input
    if (typeof res !== 'number' || isNaN(res)) return null;
    return res;
  } catch {
    return null;
  }
}

/**
 * Main evaluation function for Omnibox queries
 */
export function evaluateOmniboxQuery(raw: string): OmniboxAnswer | null {
  const query = raw.trim();
  if (!query || query.length < 2) return null;

  // 1. Color Hex / RGB inspection (e.g. #38bdf8, rgb(56, 189, 248))
  const hexMatch = query.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return {
      category: 'color',
      icon: 'palette',
      title: `#${hex.toUpperCase()}`,
      result: `rgb(${r}, ${g}, ${b})`,
      subtitle: `לחץ להעתקת קוד הצבע ללוח המערכת`,
    };
  }

  // 2. Base64 utility (e.g. "b64 hello" or "base64 test")
  const b64Match = query.match(/^(?:b64|base64)\s+(.+)$/i);
  if (b64Match) {
    try {
      const encoded = btoa(unescape(encodeURIComponent(b64Match[1])));
      return {
        category: 'encode',
        icon: 'bolt',
        title: `Base64 Encode: "${b64Match[1]}"`,
        result: encoded,
        subtitle: `לחץ להעתקת מחרוזת ה-Base64`,
      };
    } catch {
      // Ignore
    }
  }

  // 3. Currency conversion (e.g. "100 usd to ils", "50 eur in usd", "250 שקל בדולר")
  const currMatch = query.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]{3}|שקל|דולר|אירו|יורו)\s*(?:to|in|ל|ב|-)\s*([a-zA-Z]{3}|שקל|דולר|אירו|יורו)$/i);
  if (currMatch) {
    const amount = parseFloat(currMatch[1]);
    const normalizeCurr = (c: string): string => {
      const low = c.toLowerCase();
      if (low === 'שקל' || low === 'ils' || low === 'nis') return 'ils';
      if (low === 'דולר' || low === 'usd') return 'usd';
      if (low === 'אירו' || low === 'יורו' || low === 'eur') return 'eur';
      if (low === 'פאונד' || low === 'gbp') return 'gbp';
      if (low === 'יין' || low === 'jpy') return 'jpy';
      return low;
    };

    const fromCurr = normalizeCurr(currMatch[2]);
    const toCurr = normalizeCurr(currMatch[3]);

    if (FX_RATES_USD[fromCurr] && FX_RATES_USD[toCurr]) {
      const fromRate = FX_RATES_USD[fromCurr];
      const toRate = FX_RATES_USD[toCurr];
      // Convert to USD then to target
      const converted = (amount / fromRate) * toRate;
      const sym = CURRENCY_SYMBOLS[toCurr] || toCurr.toUpperCase();
      const fromSym = CURRENCY_SYMBOLS[fromCurr] || fromCurr.toUpperCase();
      const rounded = converted.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      return {
        category: 'currency',
        icon: 'coins',
        title: `${amount} ${fromSym} = ${sym}${rounded}`,
        result: `${sym}${rounded}`,
        subtitle: `שער משוער: 1 ${fromCurr.toUpperCase()} ≈ ${(toRate / fromRate).toFixed(3)} ${toCurr.toUpperCase()} · לחץ להעתקה`,
      };
    }
  }

  // 4. Unit Conversions (e.g. "50 km to miles", "10 gb in mb", "100 c to f")
  const unitMatch = query.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z°]+)\s*(?:to|in|ל|ב)\s*([a-zA-Z°]+)$/i);
  if (unitMatch) {
    const val = parseFloat(unitMatch[1]);
    const fromUnit = unitMatch[2].toLowerCase();
    const toUnit = unitMatch[3].toLowerCase();

    // Length
    if ((fromUnit === 'km' || fromUnit === 'קמ') && (toUnit === 'miles' || toUnit === 'mi')) {
      const res = (val * 0.621371).toFixed(2);
      return { category: 'unit', icon: 'ruler', title: `${val} ק"מ = ${res} מייל`, result: `${res} miles`, subtitle: 'המרת מרחק ומרחב' };
    }
    if ((fromUnit === 'miles' || fromUnit === 'mi') && (toUnit === 'km' || toUnit === 'קמ')) {
      const res = (val * 1.60934).toFixed(2);
      return { category: 'unit', icon: 'ruler', title: `${val} מייל = ${res} ק"מ`, result: `${res} km`, subtitle: 'המרת מרחק' };
    }
    if (fromUnit === 'm' && (toUnit === 'ft' || toUnit === 'feet')) {
      const res = (val * 3.28084).toFixed(2);
      return { category: 'unit', icon: 'ruler', title: `${val} מטר = ${res} רגל (feet)`, result: `${res} ft`, subtitle: 'המרת אורך' };
    }
    if (fromUnit === 'cm' && (toUnit === 'in' || toUnit === 'inch' || toUnit === 'inches')) {
      const res = (val * 0.393701).toFixed(2);
      return { category: 'unit', icon: 'ruler', title: `${val} ס"מ = ${res} אינץ'`, result: `${res} in`, subtitle: 'המרת אורך' };
    }

    // Weight
    if (fromUnit === 'kg' && (toUnit === 'lbs' || toUnit === 'pounds')) {
      const res = (val * 2.20462).toFixed(2);
      return { category: 'unit', icon: 'ruler', title: `${val} ק"ג = ${res} ליברות (lbs)`, result: `${res} lbs`, subtitle: 'המרת משקל' };
    }
    if (fromUnit === 'lbs' && (toUnit === 'kg')) {
      const res = (val * 0.453592).toFixed(2);
      return { category: 'unit', icon: 'ruler', title: `${val} ליברות = ${res} ק"ג`, result: `${res} kg`, subtitle: 'המרת משקל' };
    }

    // Temperature
    if ((fromUnit === 'c' || fromUnit === '°c') && (toUnit === 'f' || toUnit === '°f')) {
      const res = ((val * 9) / 5 + 32).toFixed(1);
      return { category: 'unit', icon: 'ruler', title: `${val}°C = ${res}°F`, result: `${res}°F`, subtitle: 'המרת טמפרטורה (צלזיוס לפרנהייט)' };
    }
    if ((fromUnit === 'f' || fromUnit === '°f') && (toUnit === 'c' || toUnit === '°c')) {
      const res = (((val - 32) * 5) / 9).toFixed(1);
      return { category: 'unit', icon: 'ruler', title: `${val}°F = ${res}°C`, result: `${res}°C`, subtitle: 'המרת טמפרטורה (פרנהייט לצלזיוס)' };
    }

    // Digital Storage
    if (fromUnit === 'gb' && toUnit === 'mb') {
      const res = (val * 1024).toLocaleString();
      return { category: 'unit', icon: 'ruler', title: `${val} GB = ${res} MB`, result: `${res} MB`, subtitle: 'המרת נפח אחסון דיגיטלי' };
    }
    if (fromUnit === 'mb' && toUnit === 'gb') {
      const res = (val / 1024).toFixed(2);
      return { category: 'unit', icon: 'ruler', title: `${val} MB = ${res} GB`, result: `${res} GB`, subtitle: 'המרת נפח אחסון דיגיטלי' };
    }
    if (fromUnit === 'tb' && toUnit === 'gb') {
      const res = (val * 1024).toLocaleString();
      return { category: 'unit', icon: 'ruler', title: `${val} TB = ${res} GB`, result: `${res} GB`, subtitle: 'המרת נפח אחסון דיגיטלי' };
    }

    // Time
    if (fromUnit === 'hours' && toUnit === 'days') {
      const res = (val / 24).toFixed(2);
      return { category: 'unit', icon: 'ruler', title: `${val} שעות = ${res} ימים`, result: `${res} days`, subtitle: 'המרת זמן' };
    }
    if (fromUnit === 'days' && toUnit === 'hours') {
      const res = (val * 24).toLocaleString();
      return { category: 'unit', icon: 'ruler', title: `${val} ימים = ${res} שעות`, result: `${res} hours`, subtitle: 'המרת זמן' };
    }
  }

  // 5. Math calculation check:
  // Must contain at least one math operator or math keyword, and numbers
  if (
    /[0-9]/.test(query) &&
    (/[\+\-\*\/\^%]/.test(query) || /sqrt|abs|sin|cos|tan/i.test(query)) &&
    !/^https?:\/\//i.test(query)
  ) {
    const mathVal = safeEvalMath(query);
    if (mathVal !== null && isFinite(mathVal)) {
      // Format number nicely
      const formatted = Number.isInteger(mathVal)
        ? mathVal.toLocaleString('en-US')
        : Math.abs(mathVal) < 0.0001
        ? mathVal.toExponential(4)
        : mathVal.toLocaleString('en-US', { maximumFractionDigits: 6 });

      return {
        category: 'math',
        icon: 'calculator',
        title: `${query} = ${formatted}`,
        result: formatted,
        subtitle: `לחץ להעתקת התוצאה ${formatted} ללוח המערכת`,
      };
    }
  }

  return null;
}
