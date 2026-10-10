import { calibrationChars, checkContent, type CalibrationSet, type StrokeReport, type Verified } from '../src/content/check';
import { contentPath, loadCurricula, loadExtras, readJson } from './lib/sources';

const report = readJson<StrokeReport>(contentPath('strokes/report.json'));
const verified = readJson<Verified>(contentPath('strokes/verified.json'));
const requireCalibration = process.argv.includes('--require-verified=calibration');
const requireVerified = requireCalibration ? calibrationChars(readJson<CalibrationSet>(contentPath('calibration.json'))) : [];

const problems = checkContent({ curricula: loadCurricula(), extras: loadExtras(), report, verified, requireVerified });
const unverified = report.chars.filter(c => !verified[c.char]).length;
console.log(`stroke order verified against MOE: ${report.chars.length - unverified} of ${report.chars.length}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n` + problems.join('\n'));
  process.exit(1);
}
console.log('content check passed');
