// Round-trip test for cloud-sync snapshots.
//
// Reproduces the bug where the bankroll never syncs across devices: the
// bankroll schema moved from a single `initialBankroll` to per-bookmaker
// `initialBankrollUnibet` / `initialBankrollWinamax` (+ `defaultBookmaker`),
// but applySnapshot still read the dead `initialBankroll` field.
//
// Run from the `frontend/` dir:  node test/cloudSync.bankroll.test.mjs

import assert from 'node:assert/strict';
import { useBankrollStore, useFavoritesStore, useHistoryStore } from '../src/store/index.js';
import { buildSnapshot, applySnapshot } from '../src/services/cloudSync.js';

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok  - ${name}`);
  } catch (e) {
    failures += 1;
    console.error(`  FAIL - ${name}\n        ${e.message}`);
  }
}

// --- Device A: user sets bankroll + favorites, then we snapshot to "cloud" ---
useBankrollStore.getState().setInitialBankrollUnibet(50);
useBankrollStore.getState().setInitialBankrollWinamax(30);
useBankrollStore.getState().setDefaultBookmaker('winamax');
useBankrollStore.getState().setKellyFraction(0.5);
useBankrollStore.getState().setEdgeMode('aggressive');
useFavoritesStore.setState({ favorites: [111, 222, 333] });
useHistoryStore.setState({ entries: [{ fixtureId: 999, result: 'win', mise: 1 }] });

const cloud = JSON.parse(JSON.stringify(buildSnapshot())); // simulate JSON trip through Supabase

// --- Device B: empty, then pulls the cloud snapshot ---
useBankrollStore.getState().reset();
useFavoritesStore.setState({ favorites: [] });
useHistoryStore.setState({ entries: [] });

applySnapshot(cloud);

const bk = useBankrollStore.getState();
check('bankroll Unibet syncs', () => assert.equal(bk.initialBankrollUnibet, 50));
check('bankroll Winamax syncs', () => assert.equal(bk.initialBankrollWinamax, 30));
check('defaultBookmaker syncs', () => assert.equal(bk.defaultBookmaker, 'winamax'));
check('kellyFraction syncs', () => assert.equal(bk.kellyFraction, 0.5));
check('edgeMode syncs', () => assert.equal(bk.edgeMode, 'aggressive'));
check('favorites sync', () => assert.deepEqual(useFavoritesStore.getState().favorites, [111, 222, 333]));
check('history entries sync', () => assert.equal(useHistoryStore.getState().entries.length, 1));

// --- Legacy cloud blob (old single-field schema) maps onto Unibet ---
useBankrollStore.getState().reset();
applySnapshot({ bankroll: { initialBankroll: 77, kellyFraction: 0.25, edgeMode: 'standard' } });
check('legacy initialBankroll maps to Unibet', () =>
  assert.equal(useBankrollStore.getState().initialBankrollUnibet, 77));

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
