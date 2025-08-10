Nostr Banger Repost Bot
A Node.js bot for the Nostr protocol that schedules reposts of "banger" posts at user-specified intervals (hourly, daily, weekly, monthly, or yearly). Mention the bot in a reply with a command like "banger weekly for 3 weeks" or "repeat 3 times daily," and it will schedule up to 3 reposts, quoting the full original event with varied, user-attributed messages like "This banger was brought to you by @npub...! 🔥". Built with nostr-tools, it’s deployable locally or on Render.com.
Features

Flexible Scheduling: Supports hourly, daily, weekly, monthly, yearly intervals with any duration (e.g., "hourly for 3 days" schedules 3 reposts over 72 hours) or literal repetitions (e.g., "3 times weekly").
Exact Timing: Reposts occur at precise intervals (e.g., every week at the same time). Missed tasks (due to downtime) are executed immediately on restart.
Proper Quoting: Uses kind 6 repost events (NIP-18) to quote the full original post, including metadata (author, timestamp, etc.), displayed correctly in Nostr clients.
Varied Reposts: Randomly selects fun messages, crediting the requester (e.g., "Shoutout to @npub... for unearthing this gem! 💎").
Task Limits: Only one active schedule per post; new schedules wait with a reply: "There's already a task running for this post. Wait until it completes!"
Scalable Persistence: Stores tasks in tasks.json (capped at 10,000 tasks) for reliable scheduling across restarts.
Nostr Integration: Uses nostr-tools to listen for mentions and publish reposts across multiple reliable relays.
Downtime Handling: Executes missed reposts immediately on startup, then continues the schedule.

Usage on Nostr

Reply to a post you want reposted, tagging the bot’s public key (get the npub from the bot’s profile or logs).
Include a command in your reply, like:
banger hourly for 3 hours (3 reposts, exactly 1h apart)
repeat daily for 2 weeks (3 reposts, exactly 1d apart)
3 times weekly (3 reposts, exactly 1w apart)
banger yearly for 2 years (3 reposts, exactly 1y apart)


The bot replies to confirm (e.g., "Banger detected! Setting up those reposts (3 reposts over 2 weeks).").
If a task is active, it replies: "There's already a task running for this post. Wait until it completes!"
Reposts appear as kind 6 events, quoting the full original post with metadata and a message like "This banger was brought to you by @your_npub! 🔥".
If the bot was offline, missed reposts are posted immediately on restart, then continue on schedule.

Local Setup

Prerequisites:
Node.js (v16+)
Git
A Nostr private key (nsec format)


Clone and Install:git clone <your-repo-url>
cd nostr-banger-bot
npm install


Configure:
Create .env with:PRIVATE_KEY=nsec1yourprivatekeyhere


Get an nsec from a Nostr client (e.g., Damus, Amethyst).


Run:npm start


Test:
Check logs for bot’s public key (npub...).
Reply to a post on Nostr, tag the bot, use a command like "banger weekly for 3 weeks."
Verify confirmation and kind 6 reposts (full event quotes) in your Nostr client.
Test downtime: Stop bot, wait past a scheduled time, restart, and check for immediate repost.



Deploying on Render.com

Push to GitHub:
Ensure index.js, package.json, .gitignore (ignoring .env, tasks.json), LICENSE, README.md, and developer_brief.md are in your repo.
Push: git add .; git commit -m "Update to kind 6 reposts"; git push.


Create Render Service:
Sign up at render.com.
New > Background Worker, link your GitHub repo.
Set:
Runtime: Node
Build Command: npm install
Start Command: node index.js
Region: e.g., Oregon (US)
Instance: Starter (~$7/mo for always-on)


Advanced:
Env Vars:
PRIVATE_KEY=nsec1yourprivatekeyhere
DATA_PATH=/data/tasks.json


Disk: Name "data", Mount Path /data, Size 1GB (~$0.25/mo)




Deploy:
Click "Create". Auto-deploys on Git pushes.
Check logs in Render Dashboard for reposts and missed task handling.
Test by mentioning the bot on Nostr and verifying full event quotes.



Contributing

Fork the repo, make changes, submit a pull request.
For issues or feature requests (e.g., cancel command), open a GitHub issue.
Want to add new repost messages or intervals? Update CONFIG.REPOST_MESSAGES or CONFIG.INTERVALS in index.js.

License
MIT License. See LICENSE.
Contact
Ping me on Nostr at the bot’s npub or open a GitHub issue for questions!