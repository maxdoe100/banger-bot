Nostr Banger Repost Bot
A simple bot for the Nostr protocol that schedules reposts of "banger" posts at user-specified intervals (hourly, daily, weekly, monthly, or yearly). Mention the bot in a reply with a command like "banger hourly for 3 hours" or "repeat 3 times weekly," and it will schedule up to 3 reposts at exact intervals with varied, user-attributed messages like "This banger was brought to you by @npub...! 🔥". Built with Node.js and nostr-tools, it’s easy to deploy locally or on Render.com.
Features

Flexible Scheduling: Supports hourly, daily, weekly, monthly, yearly intervals with any duration (e.g., "hourly for 3 days" schedules 3 reposts over 72 hours) or literal repetitions (e.g., "3 times weekly").
Exact Timing: Reposts occur at precise intervals (e.g., every hour on the hour, every day at the same time).
Varied Reposts: Randomly selects fun messages, crediting the requester (e.g., "Blame @npub... for this much heat. 🔥").
Task Limits: Only one active schedule per post; new schedules wait until the current one completes.
Scalable Persistence: Stores tasks in tasks.json (capped at 10,000 tasks) for reliable scheduling.
Nostr Integration: Uses nostr-tools to listen for mentions and publish reposts across multiple relays.

Usage on Nostr

Reply to a post you want reposted, tagging the bot’s public key (get the npub from the bot’s profile or logs).
Include a command in your reply, like:
banger hourly for 3 hours (3 reposts, exactly 1h apart)
repeat daily for 2 weeks (3 reposts, exactly 1d apart)
3 times weekly (3 reposts, exactly 1w apart)
banger monthly for 2 years (3 reposts, exactly 1m apart)


The bot replies to confirm (e.g., "Banger detected! Setting up those reposts (3 reposts over 2 weeks).").
If a task is active, it replies: "There's already a task running for this post. Wait until it completes!"
Reposts appear with varied messages, crediting you (e.g., "Shoutout to @your_npub for unearthing this gem! 💎").

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
Reply to a post on Nostr, tag the bot, use a command like "banger daily for 2 days."
Verify confirmation and reposts in your Nostr client.



Deploying on Render.com

Push to GitHub:
Ensure index.js, package.json, .gitignore (ignoring .env, tasks.json), and LICENSE are in your repo.
Push: git add .; git commit -m "Initial commit"; git push.


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
Check logs in Render Dashboard.
Test by mentioning the bot on Nostr.



Contributing

Fork the repo, make changes, submit a pull request.
For issues or feature requests, open a GitHub issue.
Want to add new repost messages or intervals? Update CONFIG.REPOST_MESSAGES or CONFIG.INTERVALS in index.js.

License
MIT License. See LICENSE.
Contact
Ping me on Nostr at the bot’s npub or open a GitHub issue for questions!