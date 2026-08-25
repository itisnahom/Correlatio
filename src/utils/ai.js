import { analyzePattern, calculatePearsonCorrelation } from "./statistics";

function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}
function fmt(n) { return Number.isInteger(n) ? n : parseFloat(n.toFixed(2)); }
function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p / 100);
  return sorted[Math.min(idx, sorted.length - 1)];
}

export async function generateAiInsight(chain, logs) {
  await new Promise(r => setTimeout(r, 1400));
  if (!logs || logs.length < 3) return "Not enough data yet — log at least **3 days** to unlock personalized AI insights!";
  
  const vars = chain.variables;
  if (!vars || vars.length < 2) return "Insufficient variables.";

  const v1 = vars[0], v2 = vars[1];
  const isBool1 = v1.typeId === 'boolean' || v1.unit === 'bool';
  const isBool2 = v2.typeId === 'boolean' || v2.unit === 'bool';

  const xVals = logs.map(l => l.values[0]).filter(v => v != null);
  const yVals = logs.map(l => l.values[1]).filter(v => v != null);
  const n = Math.min(xVals.length, yVals.length);
  const xs = xVals.slice(0, n);
  const ys = yVals.slice(0, n);

  const pattern = analyzePattern(xs, ys);
  const r = pattern.linearR;
  const absR = Math.abs(r);

  // --- Trend (last 5 vs overall) ---
  const recent = Math.min(5, n);
  const recentXAvg = mean(xs.slice(-recent));
  const recentYAvg = mean(ys.slice(-recent));
  const overallXAvg = mean(xs);
  const overallYAvg = mean(ys);
  const xTrend = recentXAvg > overallXAvg * 1.05 ? 'trending up 📈' : recentXAvg < overallXAvg * 0.95 ? 'trending down 📉' : 'stable →';
  const yTrend = recentYAvg > overallYAvg * 1.05 ? 'trending up 📈' : recentYAvg < overallYAvg * 0.95 ? 'trending down 📉' : 'stable →';

  // --- Boolean-specific grouping ---
  let boolSection = '';
  if (isBool1) {
    const yesDays = ys.filter((_, i) => xs[i] === 1);
    const noDays  = ys.filter((_, i) => xs[i] === 0);
    if (yesDays.length && noDays.length) {
      boolSection = `\n\n**${v1.name} Effect:** On **${yesDays.length} Yes days**, your avg ${v2.name} was **${fmt(mean(yesDays))} ${v2.unit}**. On **${noDays.length} No days**, it was **${fmt(mean(noDays))} ${v2.unit}** — a difference of **${fmt(Math.abs(mean(yesDays) - mean(noDays)))} ${v2.unit}**.`;
    }
  } else if (isBool2) {
    const yesDays = xs.filter((_, i) => ys[i] === 1);
    const noDays  = xs.filter((_, i) => ys[i] === 0);
    if (yesDays.length && noDays.length) {
      boolSection = `\n\n**${v2.name} Effect:** When ${v2.name} is **Yes**, your avg ${v1.name} is **${fmt(mean(yesDays))} ${v1.unit}**. When **No**, it's **${fmt(mean(noDays))} ${v1.unit}** (Δ ${fmt(Math.abs(mean(yesDays) - mean(noDays)))}).`;
    }
  }

  // --- Volatility ---
  const sdX = stdDev(xs), sdY = stdDev(ys);
  const cvX = overallXAvg ? (sdX / overallXAvg) * 100 : 0;
  let volatilityNote = '';
  if (cvX > 40) volatilityNote = `\n\n**Consistency Alert:** Your ${v1.name} is highly variable (std dev ${fmt(sdX)} ${v1.unit}). High day-to-day swings make it harder to see clean correlations — try to be more consistent for 2 weeks to get sharper data.`;

  // --- Top quartile analysis ---
  let quartileNote = '';
  if (!isBool1 && n >= 6) {
    const q75 = percentile(xs, 75);
    const q25 = percentile(xs, 25);
    const highXY = ys.filter((_, i) => xs[i] >= q75);
    const lowXY  = ys.filter((_, i) => xs[i] <= q25);
    if (highXY.length && lowXY.length) {
      quartileNote = `\n\n**Quartile Analysis:** On your **top 25% ${v1.name} days** (≥ ${fmt(q75)} ${v1.unit}), avg ${v2.name} = **${fmt(mean(highXY))} ${v2.unit}**. On your **bottom 25%** (≤ ${fmt(q25)} ${v1.unit}), avg ${v2.name} = **${fmt(mean(lowXY))} ${v2.unit}**.`;
    }
  }

  // --- Multi-variable ---
  let multiNote = '';
  if (vars.length > 2) {
    const v3 = vars[2];
    const zVals = logs.map(l => l.values[2]).filter(v => v != null);
    const rXZ = calculatePearsonCorrelation(xs.slice(0, zVals.length), zVals);
    const rYZ = calculatePearsonCorrelation(ys.slice(0, zVals.length), zVals);
    const strongest = Math.abs(rXZ) > Math.abs(rYZ) ? `${v1.name} → ${v3.name} (r=${fmt(rXZ)})` : `${v2.name} → ${v3.name} (r=${fmt(rYZ)})`;
    multiNote = `\n\n**Multi-Variable:** Strongest pairwise link in this 3-variable system is **${strongest}**. Your avg ${v3.name} = **${fmt(mean(zVals))} ${v3.unit}**.`;
  }

  // --- Core narrative ---
  let core = `**${n}-Day Analysis: ${v1.name} × ${v2.name}**\n\n`;
  core += `Your averages — ${v1.name}: **${fmt(overallXAvg)} ${v1.unit}** (${xTrend}), ${v2.name}: **${fmt(overallYAvg)} ${v2.unit}** (${yTrend}).\n\n`;

  if (pattern.type !== 'linear') {
    const curveType = pattern.type === 'inverted-u' ? 'Inverted-U (Goldilocks)' : 'U-Shaped';
    const vertex = pattern.quad ? fmt(-pattern.quad.b / (2 * pattern.quad.a)) : '?';
    core += `**Curve Pattern (${curveType}):** Your data doesn't follow a straight line — it curves. The optimal ${v1.name} level appears near **${vertex} ${v1.unit}** where ${v2.name} ${pattern.type === 'inverted-u' ? 'peaks' : 'dips'}. R² = ${fmt((pattern.quad?.rSquared || 0) * 100)}% of variance explained by this curve.\n\n`;
    core += pattern.type === 'inverted-u'
      ? `**Advice:** Going above ${vertex} ${v1.unit} for ${v1.name} is actively hurting your ${v2.name}. Stay in range.`
      : `**Advice:** Moderate ${v1.name} levels are your sweet spot for ${v2.name}. Extremes in either direction are beneficial — the middle is your dead zone.`;
  } else if (absR < 0.15) {
    core += `**Pattern:** No meaningful linear relationship (r = ${fmt(r)}). ${v1.name} does not appear to predict ${v2.name} for you at this time.\n\n`;
    core += `**Advice:** These two variables seem independent. Log at least ${Math.max(14, n + 5)} days to be sure — or consider replacing one of them with a variable that might actually interact with ${v2.name}.`;
  } else if (r > 0) {
    if (absR >= 0.7) {
      core += `**Strong Positive Link (r = ${fmt(r)}):** Every ${fmt(sdX)} ${v1.unit} increase in ${v1.name} is associated with ~${fmt(absR * sdY)} ${v2.unit} more ${v2.name}.\n\n`;
      core += `**Advice:** This is a high-confidence lever. Since ${v1.name} is currently ${xTrend}, prioritize locking in a daily minimum around **${fmt(percentile(xs, 40))} ${v1.unit}** to consistently elevate ${v2.name}.`;
    } else {
      core += `**Moderate Positive Trend (r = ${fmt(r)}):** Generally more ${v1.name} → more ${v2.name}, but ${fmt((1 - absR * absR) * 100)}% of the variation in ${v2.name} is still unexplained.\n\n`;
      core += `**Advice:** ${v1.name} is a partial driver of ${v2.name}. Consider adding a third variable to capture what's missing. Strong candidates: stress level, time of day, or diet quality.`;
    }
  } else {
    if (absR >= 0.7) {
      core += `**Strong Negative Link (r = ${fmt(r)}):** ${v1.name} and ${v2.name} move in opposite directions. Each ${fmt(sdX)} ${v1.unit} increase in ${v1.name} is linked to ~${fmt(absR * sdY)} ${v2.unit} less ${v2.name}.\n\n`;
      core += `**Advice:** ${v1.name} is actively suppressing ${v2.name}. Cap your ${v1.name} near **${fmt(percentile(xs, 25))} ${v1.unit}** (your bottom quartile) and watch ${v2.name} improve.`;
    } else {
      core += `**Mild Negative Pull (r = ${fmt(r)}):** Some evidence that higher ${v1.name} slightly reduces ${v2.name}, but the signal is weak.\n\n`;
      core += `**Advice:** The negative pattern is real but noisy. Aim for a 3-week consistent experiment: hold ${v1.name} steady near **${fmt(percentile(xs, 50))} ${v1.unit}** daily and monitor if ${v2.name} stabilizes.`;
    }
  }

  return core + boolSection + quartileNote + volatilityNote + multiNote;
}
