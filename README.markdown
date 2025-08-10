# Nostr Banger Repost Bot

A fun and flexible bot for the Nostr protocol that schedules reposts of "banger" posts at user-specified intervals (hourly, daily, weekly, monthly, or yearly). Mention the bot in a reply to a post with a command like "banger hourly for 3 hours" or "repeat weekly for 2 months," and it will schedule up to 3 reposts with varied, user-attributed messages like "This banger was brought to you by @npub...! 🔥". Built with Node.js and `nostr-tools`.

## Features
- **Flexible Scheduling**: Supports `hourly`, `daily`, `weekly`, `monthly`, `yearly` intervals with any duration (e.g., "hourly for 3 days" schedules 3 reposts over 72 hours).
- **Varied Reposts**: Randomly selects fun messages, crediting the requester (e.g., "Blame @npub... for this much heat. 🔥").
- **Jitter for Variety**: Adds random time variation (±10min for hourly, ±4h for daily, ±12h for weekly, ±3d for monthly, ±7d for yearly) to avoid repetitive timing.
- **Scalable Persistence**: Stores tasks in `tasks.json` (capped at 10,000 tasks) for reliable scheduling.
- **Nostr Integration**: Uses `nostr-tools` to listen for mentions and publish reposts across multiple relays.

## Usage on Nostr
1. Reply to a post you want reposted, tagging the bot’s public key (get the `npub` from the bot’s profile or logs).
2. Include a command in your reply, like:
   - `banger hourly for 3 hours` (3 reposts, ~1h apart)
   - `repeat daily for 2 weeks` (3 reposts, ~1d apart)
   - `weekly for 3 months` (3 reposts, ~1w apart)
   - `banger monthly for 2 years` (3 reposts, ~1m apart)
3. The bot replies to confirm (e.g., "Banger detected! Setting up those reposts (3 reposts over 2 weeks).").
4. Reposts appear with varied messages, crediting you (e.g., "Shoutout to @your_npub for unearthing this gem! 💎").

## Local Setup
1. **Prerequisites**:
   - Node.js (v16+)
   - Git
   - A Nostr private key (nsec format)
2. **Clone and Install**:
   ```bash
   git clone <your-repo-url>
   cd nostr-banger-bot
   npm install
   ```
3. **Configure**:
   - Create `.env` with:
     ```
     PRIVATE_KEY=nsec1yourprivatekeyhere
     ```
   - Get an nsec from a Nostr client (e.g., Damus, Amethyst).
4. **Run**:
   ```bash
   npm start
   ```
5. **Test**:
   - Check logs for bot’s public key (`npub...`).
   - Reply to a post on Nostr, tag the bot, use a command like "banger daily for 2 days."
   - Verify confirmation and reposts in your Nostr client.

## Deploying on Render.com
1. **Push to GitHub**:
   - Ensure `index.js`, `package.json`, `.gitignore` (ignoring `.env`, `tasks.json`), and `LICENSE` are in your repo.
   - Push: `git add .; git commit -m "Initial commit"; git push`.
2. **Create Render Service**:
   - Sign up at [render.com](https://render.com).
   - New > Background Worker, link your GitHub repo.
   - Set:
     - Runtime: Node
  - Build Command: `npm install`
  - Start Command: `node index.js`
     - Region: e.g., Oregon (US)
     - Instance: Starter (~$7/mo for always-on)
   - Advanced:
     - Env Vars:
       - `PRIVATE_KEY=nsec1yourprivatekeyhere`
       - `DATA_PATH=/data/tasks.json`
      - Disk: Name "data", Mount Path `/data`, Size 1GB (~$0.25/mo)
    - Or use the included `render.yaml` to auto-provision the service.
3. **Deploy**:
   - Click "Create". Auto-deploys on Git pushes.
   - Check logs in Render Dashboard.
   - Test by mentioning the bot on Nostr.

## Contributing
- Fork the repo, make changes, submit a pull request.
- For issues or feature requests, open a GitHub issue.
- Want to add new repost messages or intervals? Update `CONFIG.REPOST_MESSAGES` or `CONFIG.INTERVALS` in `index.js`.

## License
MIT License. See [LICENSE](./LICENSE).

## Contact
Ping me on Nostr at the bot’s npub or open a GitHub issue for questions!