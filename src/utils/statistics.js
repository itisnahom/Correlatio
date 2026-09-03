/**
 * Correlatio — Statistics Utilities
 * Pearson r, R², quadratic regression, pattern analysis,
 * p-value, lag correlation, outlier detection, rolling average,
 * day-of-week breakdown, and plain-English impact statements.
 */

// ─── CORE ─────────────────────────────────────────────────────────────────────

/**
 * Pearson correlation coefficient between two equal-length arrays.
 */
export function calculatePearsonCorrelation(x, y) {
  if (!x || !y || x.length !== y.length || x.length < 2) return null;
  const n = x.length;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dX = x[i] - meanX, dY = y[i] - meanY;
    num += dX * dY; dx2 += dX * dX; dy2 += dY * dY;
  }
  if (dx2 === 0 || dy2 === 0) return 0;
  return Math.max(-1, Math.min(1, num / Math.sqrt(dx2 * dy2)));
}

/**
 * Human-readable interpretation of a Pearson r value.
 */
export function interpretCorrelation(r) {
  if (r === null || r === undefined) return 'Not enough data';
  const a = Math.abs(r);
  const strength = a >= 0.8 ? 'Strong' : a >= 0.5 ? 'Moderate' : a >= 0.3 ? 'Weak' : 'Very weak or no';
  const dir = r > 0 ? 'positive' : r < 0 ? 'negative' : '';
  return dir ? `${strength} ${dir} correlation` : 'No correlation';
}

// ─── P-VALUE & SIGNIFICANCE ────────────────────────────────────────────────────

/**
 * Two-tailed p-value from Pearson r and sample size n.
 * Uses a t-distribution approximation (accurate for n > 5).
 * Returns a value between 0 and 1.
 */
export function calculatePValue(r, n) {
  if (r === null || r === undefined || n < 3) return null;
  const absR = Math.abs(r);
  if (absR >= 1) return 0;
  const t = absR * Math.sqrt((n - 2) / (1 - absR * absR));
  const df = n - 2;
  // Approximate two-tailed p-value using regularized incomplete beta function
  // Abramowitz & Stegun approximation
  const x = df / (df + t * t);
  const p = incompleteBeta(x, df / 2, 0.5);
  return Math.min(1, Math.max(0, p));
}

/** Regularised incomplete beta I_x(a, b) — used for t-dist CDF. */
function incompleteBeta(x, a, b) {
  if (x < 0 || x > 1) return 0;
  if (x === 0) return 0;
  if (x === 1) return 1;
  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta) / a;
  return front * betaCF(x, a, b);
}

function betaCF(x, a, b) {
  const MAXIT = 100, EPS = 3e-7;
  let c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d; let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    let m2 = 2 * m;
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; c = 1 + aa / c;
    if (Math.abs(d) < 1e-30) d = 1e-30; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; c = 1 + aa / c;
    if (Math.abs(d) < 1e-30) d = 1e-30; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d; const delta = d * c; h *= delta;
    if (Math.abs(delta - 1) < EPS) break;
  }
  return h;
}

function logGamma(z) {
  // Lanczos approximation
  const g = 7;
  const c = [0.99999999999980993,676.5203681218851,-1259.1392167224028,
    771.32342877765313,-176.61502916214059,12.507343278686905,
    -0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Returns a significance label string.
 */
export function significanceLabel(p) {
  if (p === null) return null;
  if (p < 0.001) return 'p < 0.001 ✦✦✦';
  if (p < 0.01)  return `p < 0.01 ✦✦`;
  if (p < 0.05)  return `p < 0.05 ✦`;
  return `p = ${p.toFixed(2)} (not significant)`;
}

/**
 * 95% confidence interval for Pearson r (Fisher z-transform).
 * Returns { lower, upper } or null.
 */
export function correlationCI(r, n) {
  if (r === null || n < 4) return null;
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const zLow = z - 1.96 * se;
  const zHigh = z + 1.96 * se;
  const tanh = (v) => (Math.exp(2 * v) - 1) / (Math.exp(2 * v) + 1);
  return { lower: tanh(zLow), upper: tanh(zHigh) };
}

// ─── LAG CORRELATION ──────────────────────────────────────────────────────────

/**
 * Computes lagged Pearson r for lags 0 to maxLag.
 * Positive lag: y is shifted forward (x today predicts y tomorrow).
 * Returns array of { lag, r } sorted by lag.
 */
export function calculateLaggedCorrelations(x, y, maxLag = 3) {
  const results = [];
  for (let lag = 0; lag <= maxLag; lag++) {
    if (x.length - lag < 3) break;
    const xSlice = x.slice(0, x.length - lag);
    const ySlice = y.slice(lag);
    const r = calculatePearsonCorrelation(xSlice, ySlice);
    results.push({ lag, r });
  }
  return results;
}

/**
 * Returns the lag entry with the strongest absolute correlation.
 */
export function bestLag(lagResults) {
  if (!lagResults || lagResults.length === 0) return null;
  return lagResults.reduce((best, cur) =>
    (cur.r !== null && Math.abs(cur.r) > Math.abs(best.r ?? 0)) ? cur : best,
    lagResults[0]
  );
}

// ─── OUTLIER DETECTION ────────────────────────────────────────────────────────

/**
 * IQR-based outlier detection.
 * Returns an array of indices in the logs that are outliers on X or Y.
 */
export function detectOutliers(x, y) {
  const outlierIndices = new Set();
  [x, y].forEach((arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    arr.forEach((v, i) => { if (v < lower || v > upper) outlierIndices.add(i); });
  });
  return [...outlierIndices];
}

// ─── ROLLING AVERAGE ──────────────────────────────────────────────────────────

/**
 * Computes a rolling (sliding window) average over an array.
 * For points near the start where fewer than `window` values exist,
 * uses the available prefix.
 */
export function rollingAverage(arr, window = 7) {
  return arr.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

// ─── DAY-OF-WEEK BREAKDOWN ────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Given logs (each with a dateString 'YYYY-MM-DD') and a variable index,
 * returns average value per weekday.
 * Returns array of { day, avg, count } ordered Mon–Sun.
 */
export function dayOfWeekBreakdown(logs, varIndex) {
  const buckets = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
  logs.forEach(log => {
    const val = log.values?.[varIndex];
    if (val == null || !log.dateString) return;
    const date = new Date(log.dateString + 'T00:00:00');
    const dow = date.getDay(); // 0=Sun
    buckets[dow].sum += val;
    buckets[dow].count += 1;
  });
  // Return Mon–Sun order
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map(i => ({
    day: DAY_NAMES[i],
    avg: buckets[i].count > 0 ? +(buckets[i].sum / buckets[i].count).toFixed(2) : null,
    count: buckets[i].count,
  }));
}

// ─── ADHERENCE & STREAK ───────────────────────────────────────────────────────

/**
 * Returns adherence stats over the last N days.
 * { adherence (0-1), currentStreak, longestStreak }
 */
export function adherenceStats(logs, days = 30) {
  const today = new Date();
  const dateSet = new Set(logs.map(l => l.dateString));
  let logged = 0, currentStreak = 0, longestStreak = 0, tempStreak = 0;
  let onStreak = true;

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const has = dateSet.has(ds);
    if (has) {
      logged++;
      tempStreak++;
      if (onStreak) currentStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      onStreak = false;
      tempStreak = 0;
    }
  }

  return {
    adherence: logged / days,
    currentStreak,
    longestStreak,
    loggedDays: logged,
    totalDays: days,
  };
}

/**
 * Current streak for boolean (yes/no) variable.
 */
export function booleanStreak(logs, varIndex) {
  const sorted = [...logs].sort((a, b) => (a.dateString > b.dateString ? -1 : 1));
  let streak = 0;
  for (const log of sorted) {
    if (log.values?.[varIndex] === 1) streak++;
    else break;
  }
  return streak;
}

// ─── TREND DIRECTION ─────────────────────────────────────────────────────────

/**
 * Compares average of last 7 logs vs previous 7 logs.
 * Returns 'up', 'down', or 'flat'.
 */
export function trendDirection(vals) {
  if (vals.length < 4) return 'flat';
  const half = Math.min(7, Math.floor(vals.length / 2));
  const recent = vals.slice(-half).reduce((s, v) => s + v, 0) / half;
  const older = vals.slice(-half * 2, -half).reduce((s, v) => s + v, 0) / half;
  const delta = recent - older;
  const threshold = (Math.max(...vals) - Math.min(...vals)) * 0.05;
  if (delta > threshold) return 'up';
  if (delta < -threshold) return 'down';
  return 'flat';
}

// ─── IMPACT STATEMENT ─────────────────────────────────────────────────────────

/**
 * Generates a plain-English impact statement.
 * e.g. "When Sleep > 7h, Mood averages 1.8 pts higher (25%)"
 */
export function computeImpactStatement(x, y, varAName, varBName, varBUnit = '') {
  if (!x || !y || x.length < 6) return null;
  const median = [...x].sort((a, b) => a - b)[Math.floor(x.length / 2)];
  const high = [], low = [];
  x.forEach((v, i) => (v >= median ? high : low).push(y[i]));
  if (high.length < 2 || low.length < 2) return null;
  const avgHigh = high.reduce((s, v) => s + v, 0) / high.length;
  const avgLow = low.reduce((s, v) => s + v, 0) / low.length;
  const diff = avgHigh - avgLow;
  const pct = avgLow !== 0 ? Math.abs((diff / avgLow) * 100) : 0;
  if (Math.abs(diff) < 0.01) return null;
  const dir = diff > 0 ? 'higher' : 'lower';
  const absDiff = Math.abs(diff).toFixed(1);
  const unit = varBUnit && varBUnit !== 'bool' ? ` ${varBUnit}` : '';
  return `When ${varAName} is above average, ${varBName} is ${absDiff}${unit} ${dir} on average (${pct.toFixed(0)}%).`;
}

// ─── QUADRATIC REGRESSION ────────────────────────────────────────────────────

export function calculateQuadraticRegression(x, y) {
  if (!x || !y || x.length !== y.length || x.length < 3) return null;
  const n = x.length;
  let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
  let sumY = 0, sumXY = 0, sumX2Y = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i], yi = y[i], x2 = xi * xi;
    sumX += xi; sumX2 += x2; sumX3 += x2 * xi; sumX4 += x2 * x2;
    sumY += yi; sumXY += xi * yi; sumX2Y += x2 * yi;
  }
  const denom = (sumX4 * (sumX2 * n - sumX * sumX)) -
                (sumX3 * (sumX3 * n - sumX * sumX2)) +
                (sumX2 * (sumX3 * sumX - sumX2 * sumX2));
  if (denom === 0) return null;
  const a = ((sumX2Y * (sumX2 * n - sumX * sumX)) -
             (sumX3 * (sumXY * n - sumY * sumX)) +
             (sumX2 * (sumXY * sumX - sumY * sumX2))) / denom;
  const b = ((sumX4 * (sumXY * n - sumY * sumX)) -
             (sumX2Y * (sumX3 * n - sumX * sumX2)) +
             (sumX2 * (sumX3 * sumY - sumXY * sumX2))) / denom;
  const c = ((sumX4 * (sumX2 * sumY - sumX * sumXY)) -
             (sumX3 * (sumX3 * sumY - sumX2 * sumXY)) +
             (sumX2Y * (sumX3 * sumX - sumX2 * sumX2))) / denom;
  const meanY = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const fi = a * x[i] * x[i] + b * x[i] + c;
    ssTot += (y[i] - meanY) ** 2;
    ssRes += (y[i] - fi) ** 2;
  }
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { a, b, c, rSquared };
}

export function analyzePattern(x, y) {
  const linearR = calculatePearsonCorrelation(x, y);
  const linearR2 = linearR !== null ? linearR * linearR : 0;
  const quad = calculateQuadraticRegression(x, y);
  if (quad && quad.rSquared > linearR2 + 0.15 && Math.abs(quad.a) > 0.00001) {
    if (quad.a > 0) return { type: 'u-shaped', quad, linearR };
    return { type: 'inverted-u', quad, linearR };
  }
  return { type: 'linear', linearR, quad };
}
