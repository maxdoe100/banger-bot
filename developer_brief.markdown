Nostr Banger Repost Bot: Developer Brief
This document outlines the technical setup, architecture, and extension points for the Nostr Banger Repost Bot, a Node.js bot that schedules reposts of Nostr posts based on user mentions (e.g., "banger weekly for 3 weeks"). It uses nostr-tools for Nostr protocol interactions and persists tasks in tasks.json.
Architecture

File: index.js (~300 lines, Node.js)
Dependencies:
nostr-tools: Nostr protocol (events, relays, npub/nsec encoding)
ws: WebSocket for relay connections
dotenv: Load PRIVATE_KEY and DATA_PATH from .env


Key Components:
Parsing: parseCommand(content) uses a single regex to match commands (e.g., "banger hourly for 3 days", "3 times weekly"). Supports hourly, daily, weekly, monthly, yearly with any unit (hours, days, weeks, months, years, times). Calculates repetitions (capped at 3).
Scheduling: scheduleTask(taskIndex) uses per-task setTimeout for exact intervals. Large delays (e.g., yearly) are split into 30-day chunks (MAX_SAFE_DELAY) to avoid TimeoutOverflowWarning. Missed tasks (past nextTime) are executed immediately on startup or during scheduling.
Reposting: publishQuoteRepost(original, requesterPubkey) creates kind 6 repost events (NIP-18), embedding the full original event (id, pubkey, content, created_at) with varied messages (e.g., "Blame @npub... for this much heat. 🔥").
Persistence: tasks.json stores tasks (original event, interval, repetitions, nextTime, requesterPubkey). Capped at 10,000 tasks (~10-20MB).
Missed Tasks: processMissedTasks() triggers immediate reposts for tasks with nextTime <= now on startup.
Config: CONFIG holds relays, intervals, messages, and limits.


Error Handling: Logs errors, handles relay failures, prevents duplicates with "wait until completes" message, and ensures graceful shutdown.

Setup

Clone Repo:git clone <your-repo-url>
cd nostr-banger-bot


Install Dependencies:npm install


Ensures nostr-tools@^2.7.2, ws@^8.18.0, dotenv@^16.4.5.


Configure:
Create .env:PRIVATE_KEY=nsec1yourprivatekeyhere
# Optional for local: DATA_PATH=./tasks.json


Generate nsec via Nostr client (e.g., Damus).


Run:npm start


Test:
Check logs for bot’s npub.
On Nostr, reply to a post, tag bot, use command like "banger weekly for 3 weeks."
Verify confirmation, kind 6 reposts (full event quotes) in client, and tasks.json.
Test downtime: Stop bot, wait past a scheduled time, restart, verify immediate repost.



Render Deployment

Prepare Repo:
Ensure package.json:{
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


.gitignore: Ignore .env, tasks.json, node_modules.
Add LICENSE (MIT), README.md, developer_brief.md.
Push to GitHub.


Render Setup:
At render.com, create Background Worker.
Link repo, set:
Runtime: Node
Build: npm install
Start: node index.js
Env Vars: PRIVATE_KEY=nsec1..., DATA_PATH=/data/tasks.json
Disk: Name "data", Path /data, 1GB (~$0.25/mo)
Instance: Starter (~$7/mo, always-on)


Deploy and monitor logs.


Test:
Mention bot on Nostr, verify kind 6 reposts (full event quotes).
Test downtime: Stop service, wait, restart, check immediate repost.
Check /data/tasks.json persists across restarts.



Extending the Bot

New Intervals: Add to CONFIG.INTERVALS and regex in parseCommand.
Repost Messages: Add to CONFIG.REPOST_MESSAGES (use {user} for npub).
Persistence: Replace tasks.json with SQLite (npm install sqlite3). Store tasks in /data/tasks.db. Update saveTasks, loadTasks.
Features:
Cancel Tasks: Add command (e.g., "cancel "), filter tasks by original.id.
List Tasks: Add command (e.g., "list tasks"), reply with scheduled tasks.


Testing: Use Nostr client to send commands, check logs, inspect tasks.json.

Notes

Scalability: tasks.json handles 10,000 tasks (20MB). For more, use SQLite.
Render: Free tier spins down; use paid plan for uptime. Disk ensures persistence.
Nostr Relays: Add reliable relays to CONFIG.RELAYS if needed.
Debugging: Logs in index.js (info/error) include missed task execution. Add console.debug for more.

Next Steps

Test locally, then deploy to Render.
Open issues for bugs/features on GitHub.
Contact via Nostr (bot’s npub) or GitHub.
