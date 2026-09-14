// Read-only connectivity check. NOT part of `npm test`.
// Subscribes to one public relay for 5 seconds and counts kind 1 notes.
// It never publishes an event and never touches a wallet.
// Usage: npm run build && node scripts/live-smoke.mjs [wss://relay.url]
import { RelayPool } from '../dist/index.js';

if (typeof WebSocket === 'undefined') {
  console.error('No global WebSocket. Use Node 22+, or pass webSocketImplementation from the ws package.');
  process.exit(2);
}

const relay = process.argv[2] ?? 'wss://relay.damus.io';
const pool = new RelayPool({ relays: [relay], connectTimeoutMs: 5000 });

const [status] = await pool.connect();
if (!status?.connected) {
  console.error(`could not connect to ${relay}: ${status?.error}`);
  pool.close();
  process.exit(1);
}
console.log(`connected to ${relay}`);

let count = 0;
let eose = false;
const sub = pool.subscribe(
  { kinds: [1], limit: 5 },
  {
    onEvent: () => {
      count += 1;
    },
    onEose: () => {
      eose = true;
    },
  },
);

await new Promise((resolve) => setTimeout(resolve, 5000));
sub.close();
pool.close();
console.log(`received ${count} kind 1 notes in 5 s (EOSE: ${eose ? 'yes' : 'no'})`);
process.exit(count > 0 ? 0 : 1);
