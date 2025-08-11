# Nostr Banger Repost Bot: Developer Brief

This document outlines the technical setup, architecture, and extension points for the Nostr Banger Repost Bot, a Node.js bot that schedules reposts of Nostr posts based on user mentions (e.g., "banger weekly for 3 weeks"). It uses `nostr-tools` for Nostr protocol interactions and persists tasks in `tasks.json`. Code snippets demonstrate best practices for key tasks using `nostr-tools`.

## Architecture
- **File**: `index.js` (~300 lines, Node.js)
- **Dependencies**:
  - `nostr-tools`: Nostr protocol (events, relays, NIP-19 encoding with `neventEncode`)
  - `ws`: WebSocket for relay connections
  - `dotenv`: Load `PRIVATE_KEY` and `DATA_PATH` from `.env`
- **Key Components**:
  - **Parsing**: `parseCommand(content)` uses a regex to match flexible commands (e.g., "banger hourly for 3 days", "3 times weekly"). Supports `hourly`, `daily`, `weekly`, `monthly`, `yearly` with units (`hours`, `days`, `weeks`, `months`, `years`, `times`). Caps repetitions at 3.
  - **Scheduling**: `scheduleTask(taskIndex)` uses per-task `setTimeout` for exact intervals. Large delays (e.g., yearly) are split into 30-day chunks (`MAX_SAFE_DELAY`) to avoid `TimeoutOverflowWarning`.
  - **Reposting**: `publishQuoteRepost(original, requesterPubkey)` creates kind 1 events with NIP-21 `nostr:nevent1...` IDs (via `neventEncode`), relay hints in `e` and `p` tags, and `r` tags for relays. Uses varied messages (e.g., "Blame @npub... for this much heat. 🔥").
  - **Persistence**: `tasks.json` stores tasks (original event, interval, repetitions, nextTime, requesterPubkey). Capped at 10,000 tasks (~10-20MB).
  - **Missed Tasks**: `processMissedTasks()` triggers immediate reposts for tasks with `nextTime <= now` on startup.
  - **Config**: `CONFIG` holds relays, intervals, messages, and limits.
- **Error Handling**: Logs errors, handles relay failures, prevents duplicates with "wait until completes" message, and ensures graceful shutdown.

## Code Snippets for Key Tasks

### 1. Parsing Commands
Parses user commands (e.g., "banger weekly for 3 weeks") to extract interval, repetitions, and duration. Uses a single regex for flexibility, supporting interval-first or count-first formats.<grok:render type="render_inline_citation"><argument name="citation_id">16</argument></grok:render>

```javascript
function parseCommand(content) {
  const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
  const match = normalized.match(
    /(?:banger|(?:that'?s|this is|it'?s)?\s*(?:a|an)?\s*banger\s*)?(?:repeat\s*)?((hourly|daily|weekly|monthly|yearly)(?:\s*for)?\s*(\d+)\s*(hours?|days?|weeks?|months?|years?|times?)?|(\d+)\s*(hours?|days?|weeks?|months?|years?|times?)\s*(hourly|daily|weekly|monthly|yearly))/i
  );
  if (!match) return null;

  let interval, countStr, unit;
  if (match[2]) {
    interval = match[2];
    countStr = match[3];
    unit = match[4] || 'times';
  } else {
    countStr = match[4];
    unit = match[5] || 'times';
    interval = match[6];
  }

  const count = parseInt(countStr);
  if (isNaN(count) || count < 1) return null;

  let repetitions = unit === 'time' || unit === 'times'
    ? count
    : Math.ceil((count * CONFIG.UNIT_TO_MS[unit]) / CONFIG.INTERVALS[interval]);
  if (repetitions < 1) return null;

  repetitions = Math.min(repetitions, CONFIG.MAX_REPETITIONS);
  return { interval, repetitions, duration: { count, unit } };
}
```

**Best Practice**: Normalizes input to handle variations (e.g., "banger", "repeat"). Caps repetitions to prevent abuse. Supports `times` for literal counts.<grok:render type="render_inline_citation"><argument name="citation_id">16</argument></grok:render>

### 2. Publishing Reposts
Creates kind 1 reposts with NIP-21 `nostr:nevent1...` IDs, relay hints, and `r` tags for compatibility with Nostr clients. Uses `nostr-tools`’s `neventEncode` and `finalizeEvent`.<grok:render type="render_inline_citation"><argument name="citation_id">15</argument></grok:render><grok:render type="render_inline_citation"><argument name="citation_id">13</argument></grok:render>

```javascript
async function publishQuoteRepost(original, requesterPubkey) {
  const message = requesterPubkey
    ? CONFIG.REPOST_MESSAGES[Math.floor(Math.random() * CONFIG.REPOST_MESSAGES.length)].replace('{user}', `nostr:${npubEncode(requesterPubkey)}`)
    : 'Banger alert! Reposting this gem.';
  const nevent = neventEncode({
    id: original.id,
    relays: CONFIG.RELAYS,
  });
  const repost = {
    kind: 1,
    content: `${message}\n\nnostr:${nevent}`,
    tags: [
      ['e', original.id, CONFIG.RELAYS[0], 'mention'],
      ['p', original.pubkey, CONFIG.RELAYS[0], 'mention'],
      ...(requesterPubkey ? [['p', requesterPubkey, CONFIG.RELAYS[0], 'mention']] : []),
      ...CONFIG.RELAYS.map(relay => ['r', relay]),
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
```

**Best Practice**: Uses kind 1 with NIP-21 `nevent` for client-friendly quotes. Includes relay hints (`e`, `p` tags) and `r` tags per NIP-01/NIP-18. Publishes to multiple relays for redundancy.<grok:render type="render_inline_citation"><argument name="citation_id">13</argument></grok:render>

### 3. Scheduling Tasks
Schedules reposts with exact timing using `setTimeout`. Handles large delays (e.g., yearly) with iterative timeouts to avoid Node.js `TimeoutOverflowWarning`.<grok:render type="render_inline_citation"><argument name="citation_id">2</argument></grok:render>

```javascript
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

  if (delay > CONFIG.MAX_SAFE_DELAY) {
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
```

**Best Practice**: Uses iterative `setTimeout` for exact scheduling, caps delays at 30 days, and handles missed tasks immediately. Persists state after each update.<grok:render type="render_inline_citation"><argument name="citation_id">2</argument></grok:render>

### 4. Handling Missed Tasks
Executes overdue tasks on startup to ensure reliability after downtime.<grok:render type="render_inline_citation"><argument name="citation_id">16</argument></grok:render>

```javascript
function processMissedTasks() {
  const now = Date.now();
  tasks.forEach((task, index) => {
    if (task.repetitions > 0 && task.nextTime <= now) {
      log.info(`Processing missed task for ${task.original.id}, nextTime: ${new Date(task.nextTime).toISOString()}`);
      scheduleTask(index);
    }
  });
}
```

**Best Practice**: Checks `nextTime` against current time to trigger immediate reposts, preserving schedule integrity.<grok:render type="render_inline_citation"><argument name="citation_id">16</argument></grok:render>

### 5. Persisting Tasks
Stores tasks in `tasks.json` to survive restarts, with a cap to prevent runaway growth.<grok:render type="render_inline_citation"><argument name="citation_id">0</argument></grok:render>

```javascript
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
```

**Best Practice**: Serializes tasks to JSON, uses try-catch for robustness, and caps at 10,000 tasks to manage memory (~10-20MB).<grok:render type="render_inline_citation"><argument name="citation_id">11</argument></grok:render>

## Setup
1. **Clone Repo**:
   ```bash
   git clone <your-repo-url>
   cd nostr-banger-bot
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
   - Ensures `nostr-tools@^2.7.2`, `ws@^8.18.0`, `dotenv@^16.4.5`.
3. **Configure**:
   - Create `.env`:
     ```
     PRIVATE_KEY=nsec1yourprivatekeyhere
     DATA_PATH=./tasks.json
     ```
   - Generate nsec via Nostr client (e.g., Damus).
4. **Run**:
   ```bash
   npm start
   ```
5. **Test**:
   - Check logs for bot’s `npub`.
   - On Nostr, reply to a post, tag bot, use command like "banger weekly for 3 weeks."
   - Verify confirmation, kind 1 reposts with `nostr:nevent1...` (full event quotes) in client, and `tasks.json`.
   - Test downtime: Stop bot, wait past a scheduled time, restart, verify immediate repost.

## Render Deployment
1. **Prepare Repo**:
   - Ensure `package.json`:
     ```json
     {
       "name": "nostr-banger-bot",
       "version": "1.0.0",
       "main": "index.js",
       "scripts": { "start": "node index.js" },
       "dependencies": {
         "nostr-tools": "^2.7.2",
         "ws": "^8.18.0",
         "dotenv": "^16.4.5"
       }
     }
     ```
   - `.gitignore`: Ignore `.env`, `tasks.json`, `node_modules`.
   - Add `LICENSE` (MIT), `README.md`, `developer_brief.md`.
   - Push to GitHub:
     ```bash
     git add .
     git commit -m "Fix neventEncode and update docs"
     git push
     ```
2. **Render Setup**:
   - At [render.com](https://render.com), create Background Worker.
   - Link repo, set:
     - **Runtime**: Node
     - **Build**: `npm install`
     - **Start**: `node index.js`
     - **Env Vars**: `PRIVATE_KEY=nsec1...`, `DATA_PATH=/data/tasks.json`
     - **Disk**: Name "data", Path `/data`, 1GB (~$0.25/mo)
     - **Instance**: Starter (~$7/mo, always-on)
   - Deploy and monitor logs.
3. **Test**:
   - Mention bot on Nostr, verify kind 1 reposts with `nostr:nevent1...` and relay tags.
   - Test downtime: Stop service, wait, restart, check immediate repost in logs and client.
   - Check `/data/tasks.json` persists across restarts.

## Extending the Bot
- **New Intervals**: Add to `CONFIG.INTERVALS` and regex in `parseCommand`.
- **Repost Messages**: Add to `CONFIG.REPOST_MESSAGES` (use `{user}` for `nostr:npub...`).
- **Persistence**: Replace `tasks.json` with SQLite (`npm install sqlite3`). Store tasks in `/data/tasks.db`. Update `saveTasks`, `loadTasks`.
  ```javascript
  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database('/data/tasks.db');
  db.run('CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, original TEXT, interval TEXT, intervalMs INTEGER, repetitions INTEGER, nextTime INTEGER, requesterPubkey TEXT)');
  ```
- **Features**:
  - **Cancel Tasks**: Add command (e.g., "cancel <event_id>"), filter tasks by `original.id`.
    ```javascript
    if (content.startsWith('cancel')) {
      const eventId = content.split(' ')[1];
      const index = tasks.findIndex(t => t.original.id === eventId);
      if (index !== -1) {
        clearTimeout(tasks[index].timer);
        tasks.splice(index, 1);
        saveTasks();
      }
    }
    ```
  - **List Tasks**: Add command (e.g., "list tasks"), reply with scheduled tasks.
    ```javascript
    if (content === 'list tasks') {
      const taskList = tasks.map(t => `${t.original.id}: ${t.interval}, ${t.repetitions} left`);
      const reply = { kind: 1, content: taskList.join('\n') || 'No tasks', tags: [['e', event.id, '', 'reply'], ['p', event.pubkey]], created_at: Math.floor(Date.now() / 1000) };
      await Promise.any(pool.publish(CONFIG.RELAYS, finalizeEvent(reply, privateKey)));
    }
    ```

## Notes
- **Scalability**: `tasks.json` handles ~10,000 tasks (~20MB). For more, use SQLite.<grok:render type="render_inline_citation"><argument name="citation_id">11</argument></grok:render>
- **Render**: Free tier spins down; use paid plan for uptime. Disk ensures persistence.
- **Nostr Relays**: Add reliable relays to `CONFIG.RELAYS` if needed (e.g., `wss://relay.damus.io`).
- **Debugging**: Logs in `index.js` (info/error) include missed task execution. Add `console.debug` for more.
- **Error Handling**: Ensure `nostr-tools@^2.7.2` for `neventEncode`. Check `tasks.json` for valid JSON.

## Next Steps
- Test locally with `npm start`, then deploy to Render.
- Verify `neventEncode` works for missed tasks.
- Open issues for bugs/features (e.g., cancel command) on GitHub.
- Contact via Nostr (bot’s npub) or GitHub.