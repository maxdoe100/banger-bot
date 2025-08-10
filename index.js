require('dotenv').config(); // Load env vars from .env file

const fs = require('fs');
const { finalizeEvent, getPublicKey, encodeEvent } = require('nostr-tools/pure');
const { SimplePool } = require('nostr-tools/pool');
const { useWebSocketImplementation } = require('nostr-tools/pool');
const { decode, npubEncode } = require('nostr-tools/nip19');
const WebSocket = require('ws');

// Logging utility
const log = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, err ? err : ''),
};

useWebSocketImplementation(WebSocket);

// Config constants
const CONFIG = {
  RELAYS: [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.nostr.band',
    'wss://relay.nostrfeed.com',
    'wss://nostr.wine',
    'wss://nostr.sethforprivacy.com',
    'wss://nostr.thank.eu',
    'wss://nostr21.com',
  ],
  MAX_REPETITIONS: 3,
  MAX_TASKS: 10000, // Prevent runaway growth
  MAX_SAFE_DELAY: 30 * 24 * 60 * 60 * 1000, // 30 days, below 2^31 ms
  TASKS_FILE: process.env.DATA_PATH || './tasks.json', // Render: /data/tasks.json
  CONFIRM_MESSAGES: [
    "You are right, that's a banger! Scheduling now.",
    "This will be even better the second time! On it.",
    "Banger detected! Setting up those reposts.",
  ],
  REPOST_MESSAGES: [
    "This banger was brought to you by {user}! 🔥",
    "Blame {user} for this much heat. 🔥",
    "{user} called it—this is a certified banger! 🚀",
    "Shoutout to {user} for unearthing this gem! 💎",
    "Another banger courtesy of {user}! 🎉",
  ],
  INTERVALS: {
    hourly: 60 * 60 * 1000, // 1 hour
    daily: 24 * 60 * 60 * 1000, // 24 hours
    weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
    monthly: 30 * 24 * 60 * 60 * 1000, // 30 days
    yearly: 365 * 24 * 60 * 60 * 1000, // 365 days
  },
  UNIT_TO_MS: {
    hour: 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
    years: 365 * 24 * 60 * 60 * 1000,
    time: 1, // Placeholder for "times"
    times: 1, // Placeholder for "times"
  },
};

// Parse nsec private key
const nsec = process.env.PRIVATE_KEY;
if (!nsec || !nsec.startsWith('nsec')) {
  log.error('PRIVATE_KEY env var must be nsec format!');
  process.exit(1);
}
let privateKey;
try {
  privateKey = decode(nsec).data; // Hex string
} catch (err) {
  log.error('Invalid nsec private key', err);
  process.exit(1);
}
const pubkey = getPublicKey(privateKey);
log.info(`Bot pubkey (hex): ${pubkey}`);

const pool = new SimplePool();
pool.onNotice = (notice, relay) => log.info(`Notice from ${relay}: ${notice}`);

// Parse command from mention text - flexible with mismatched units and order variations
function parseCommand(content) {
  // Normalize: lowercase, collapse spaces
  const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Single regex with alternation for order: interval first or count first
  const match = normalized.match(
    /(?:banger|(?:that'?s|this is|it'?s)?\s*(?:a|an)?\s*banger\s*)?(?:repeat\s*)?((hourly|daily|weekly|monthly|yearly)(?:\s*for)?\s*(\d+)\s*(hours?|days?|weeks?|months?|years?|times?)?|(\d+)\s*(hours?|days?|weeks?|months?|years?|times?)\s*(hourly|daily|weekly|monthly|yearly))/i
  );
  if (!match) return null;

  let interval, countStr, unit;
  if (match[2]) {
    // Interval first
    interval = match[2];
    countStr = match[3];
    unit = match[4] || 'times'; // Default to 'times' if no unit
  } else {
    // Count first
    countStr = match[4];
    unit = match[5] || 'times'; // Default to 'times' if no unit
    interval = match[6];
  }

  const count = parseInt(countStr);
  if (isNaN(count) || count < 1) return null;

  // Calculate repetitions
  let repetitions;
  if (unit === 'time' || unit === 'times') {
    repetitions = count; // Literal repetitions
  } else {
    const durationMs = count * CONFIG.UNIT_TO_MS[unit];
    if (!durationMs) return null; // Unknown unit

    repetitions = Math.ceil(durationMs / CONFIG.INTERVALS[interval]);
    if (repetitions < 1) return null; // Too short
  }

  // Cap repetitions
  repetitions = Math.min(repetitions, CONFIG.MAX_REPETITIONS);

  return { interval, repetitions, duration: { count, unit } };
}

// Load tasks
let tasks = [];
if (fs.existsSync(CONFIG.TASKS_FILE)) {
  try {
    tasks = JSON.parse(fs.readFileSync(CONFIG.TASKS_FILE, 'utf8'));
    log.info(`Loaded ${tasks.length} tasks`);
  } catch (err) {
    log.error('Failed to load tasks.json', err);
    tasks = [];
  }
}

// Process missed tasks immediately on startup
function processMissedTasks() {
  const now = Date.now();
  tasks.forEach((task, index) => {
    if (task.repetitions > 0 && task.nextTime <= now) {
      log.info(`Processing missed task for ${task.original.id}, nextTime: ${new Date(task.nextTime).toISOString()}`);
      scheduleTask(index);
    }
  });
}

function saveTasks() {
  try {
    const serializableTasks = tasks.map(task => ({
      original: task.original,
      interval: task.interval,
      intervalMs: task.intervalMs,
      repetitions: task.repetitions,
      nextTime: task.nextTime,
      requesterPubkey: task.requesterPubkey,
    }));
    fs.writeFileSync(CONFIG.TASKS_FILE, JSON.stringify(serializableTasks, null, 2));
  } catch (err) {
    log.error('Failed to save tasks.json', err);
  }
}

// Publish a quote repost (kind 1 with NIP-21 nevent and relay hints)
async function publishQuoteRepost(original, requesterPubkey) {
  const message = requesterPubkey
    ? CONFIG.REPOST_MESSAGES[Math.floor(Math.random() * CONFIG.REPOST_MESSAGES.length)].replace('{user}', `nostr:${npubEncode(requesterPubkey)}`)
    : 'Banger alert! Reposting this gem.'; // Fallback for old tasks

  // Generate NIP-21 nevent ID with relay hints
  const nevent = encodeEvent(original, CONFIG.RELAYS);

  // Create kind 1 event with relay tags
  const repost = {
    kind: 1,
    content: `${message}\n\n${nevent}`,
    tags: [
      ['e', original.id, CONFIG.RELAYS[0], 'mention'], // Primary relay for event
      ['p', original.pubkey, CONFIG.RELAYS[0], 'mention'], // Primary relay for pubkey
      ...(requesterPubkey ? [['p', requesterPubkey, CONFIG.RELAYS[0], 'mention']] : []),
      ...CONFIG.RELAYS.map(relay => ['r', relay]), // All relays as recommendations
    ],
    created_at: Math.floor(Date.now() / 1000),
  };
  const signed = finalizeEvent(repost, privateKey);
  try {
    await Promise.any(pool.publish(CONFIG.RELAYS, signed));
    log.info(`Quoted reposted: ${original.id}`);
  } catch (err) {
    log.error('Publish repost error', err);
  }
}

// Schedule a task (chained setTimeout with safe delay handling)
function scheduleTask(taskIndex) {
  const task = tasks[taskIndex];
  if (!task || task.repetitions <= 0) {
    if (taskIndex >= 0 && taskIndex < tasks.length) {
      tasks.splice(taskIndex, 1);
      saveTasks();
    }
    return;
  }

  const now = Date.now();
  let delay = task.nextTime - now;

  // Handle large delays
  if (delay > CONFIG.MAX_SAFE_DELAY) {
    // Schedule intermediate timeout
    task.timer = setTimeout(() => scheduleTask(taskIndex), CONFIG.MAX_SAFE_DELAY);
    return;
  }

  if (delay <= 0) {
    log.info(`Executing missed or due task for ${task.original.id}`);
    publishQuoteRepost(task.original, task.requesterPubkey);
    task.repetitions -= 1;
    if (task.repetitions > 0) {
      task.nextTime = now + task.intervalMs;
      saveTasks();
      delay = task.nextTime - now;
      if (delay > CONFIG.MAX_SAFE_DELAY) {
        task.timer = setTimeout(() => scheduleTask(taskIndex), CONFIG.MAX_SAFE_DELAY);
        return;
      }
    } else {
      tasks.splice(taskIndex, 1);
      saveTasks();
      return;
    }
  }

  task.timer = setTimeout(() => {
    log.info(`Executing scheduled task for ${task.original.id}`);
    publishQuoteRepost(task.original, task.requesterPubkey);
    task.repetitions -= 1;
    if (task.repetitions > 0) {
      task.nextTime += task.intervalMs;
      saveTasks();
      scheduleTask(taskIndex);
    } else {
      tasks.splice(taskIndex, 1);
      saveTasks();
    }
  }, delay);
}

// Process missed tasks after loading
processMissedTasks();

// Schedule all loaded tasks
tasks.forEach((_, index) => {
  if (tasks[index].repetitions > 0 && tasks[index].nextTime > Date.now()) {
    scheduleTask(index);
  }
});

// Subscribe to mentions
let sub;
try {
  sub = pool.subscribeMany(
    CONFIG.RELAYS,
    [
      {
        kinds: [1],
        '#p': [pubkey],
        since: Math.floor(Date.now() / 1000),
      },
    ],
    {
      onevent: async (event) => {
        if (event.pubkey === pubkey) return; // Ignore self

        const parsed = parseCommand(event.content);
        if (!parsed) return;

        const { interval, repetitions, duration } = parsed;
        const intervalMs = CONFIG.INTERVALS[interval];
        if (!intervalMs) return;

        // Check task limit
        if (tasks.length >= CONFIG.MAX_TASKS) {
          const error = {
            kind: 1,
            content: "Sorry, task limit reached! Try again later.",
            tags: [['e', event.id, '', 'reply'], ['p', event.pubkey]],
            created_at: Math.floor(Date.now() / 1000),
          };
          const signedError = finalizeEvent(error, privateKey);
          try {
            await Promise.any(pool.publish(CONFIG.RELAYS, signedError));
          } catch (err) {
            log.error('Publish error reply error', err);
          }
          return;
        }

        // Find original ID
        let originalId;
        for (const tag of event.tags) {
          if (tag[0] === 'e' && tag[3] === 'reply') {
            originalId = tag[1];
            break;
          }
        }
        if (!originalId) {
          const eTags = event.tags.filter(t => t[0] === 'e');
          if (eTags.length) originalId = eTags[eTags.length - 1][1];
        }
        if (!originalId) return;

        // Fetch original
        let original;
        try {
          original = await pool.get(CONFIG.RELAYS, { ids: [originalId] });
        } catch (err) {
          log.error('Failed to fetch original event', err);
          return;
        }
        if (!original || original.pubkey === pubkey) return;

        // Check for active task
        if (tasks.some(t => t.original.id === original.id && t.repetitions > 0)) {
          log.info(`Active task exists for ${original.id}, rejecting new schedule`);
          const error = {
            kind: 1,
            content: "There's already a task running for this post. Wait until it completes!",
            tags: [['e', event.id, '', 'reply'], ['p', event.pubkey]],
            created_at: Math.floor(Date.now() / 1000),
          };
          const signedError = finalizeEvent(error, privateKey);
          try {
            await Promise.any(pool.publish(CONFIG.RELAYS, signedError));
          } catch (err) {
            log.error('Publish active task reply error', err);
          }
          return;
        }

        // Add task
        const task = {
          original,
          interval,
          intervalMs,
          repetitions,
          nextTime: Date.now() + intervalMs,
          requesterPubkey: event.pubkey,
          timer: null,
        };
        const taskIndex = tasks.push(task) - 1;
        saveTasks();
        scheduleTask(taskIndex);
        log.info(`Scheduled repost for: ${original.id} every ${interval} for ${repetitions} times`);

        // Send confirmation
        const confirmContent = repetitions < duration.count
          ? `${CONFIG.CONFIRM_MESSAGES[Math.floor(Math.random() * CONFIG.CONFIRM_MESSAGES.length)]} (Capped at ${CONFIG.MAX_REPETITIONS} reposts over ${duration.count} ${duration.unit}.)`
          : `${CONFIG.CONFIRM_MESSAGES[Math.floor(Math.random() * CONFIG.CONFIRM_MESSAGES.length)]} (${repetitions} reposts over ${duration.count} ${duration.unit}.)`;
        const confirm = {
          kind: 1,
          content: confirmContent,
          tags: [
            ['e', event.id, '', 'reply'],
            ['p', event.pubkey],
          ],
          created_at: Math.floor(Date.now() / 1000),
        };
        const signedConfirm = finalizeEvent(confirm, privateKey);
        try {
          await Promise.any(pool.publish(CONFIG.RELAYS, signedConfirm));
        } catch (err) {
          log.error('Publish confirmation error', err);
        }
      },
      onclose: (reason) => log.info(`Subscription closed: ${reason}`),
    }
  );
} catch (err) {
  log.error('Failed to subscribe', err);
}

log.info('Bot running. Listening for mentions...');

// Graceful shutdown
process.on('SIGINT', () => {
  log.info('Shutting down...');
  tasks.forEach(task => clearTimeout(task.timer));
  if (sub) sub.close();
  pool.close();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  log.error('Uncaught exception', err);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled rejection at promise', reason);
});