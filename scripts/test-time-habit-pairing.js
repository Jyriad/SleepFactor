#!/usr/bin/env node
/**
 * Test script for time-habit pairing logic (no app or Supabase needed).
 * Run: node scripts/test-time-habit-pairing.js
 *
 * Sleep is stored by wake-up date: "sleep from 14→15" has date 2025-03-15.
 * For "Last meal" logged on date D (evening of D), we pair with sleep date D+1.
 */

// Same logic as dateHelpers.addCalendarDay (timezone-safe)
function logDateToSleepDataDate(logDateStr) {
  if (!logDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(logDateStr)) return logDateStr;
  const [y, m, d] = logDateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  const y2 = next.getFullYear();
  const m2 = String(next.getMonth() + 1).padStart(2, '0');
  const d2 = String(next.getDate()).padStart(2, '0');
  return `${y2}-${m2}-${d2}`;
}

function runTest(logDates, sleepDates) {
  console.log('--- Time habit pairing test ---');
  console.log('Log dates (habit logged on):', logDates.join(', '));
  console.log('Sleep dates in DB (wake dates):', sleepDates.join(', '));
  console.log('');

  const sleepSet = new Set(sleepDates);
  let paired = 0;

  logDates.forEach((logDate) => {
    const sleepDataDate = logDateToSleepDataDate(logDate);
    const found = sleepSet.has(sleepDataDate);
    if (found) paired++;
    console.log(`  log ${logDate} → sleepDataDate ${sleepDataDate} ${found ? '✓ PAIRED' : '✗ no sleep row'}`);
  });

  console.log('');
  console.log('Expected paired count:', paired, '/', logDates.length);
  return paired;
}

// Your example: logged 14th and 15th; sleep from 14-15 and 15-16 (stored as 15th and 16th)
const logDates = ['2025-03-14', '2025-03-15'];
const sleepDates = ['2025-03-15', '2025-03-16'];

const paired = runTest(logDates, sleepDates);

if (paired === 2) {
  console.log('\n✓ Logic is correct: both logs should pair (2/2).');
  console.log('  If the app still shows 0/10, check Metro/console for [Insights Time] logs when you open the Insights tab.');
} else {
  console.log('\n✗ Unexpected result. Check date logic.');
}

process.exit(paired === 2 ? 0 : 1);
