# 🏆 Challenger Draft Bot — v2

A Discord inhouse queue bot with **100% button-driven captain draft**. No typing commands during the draft — everything is a button click.

---

## ✨ What's New in v2

| Feature | Detail |
|---|---|
| 🎯 **Unlimited Queue** | No cap — any number of players can join |
| 👑 **LP-Based Captains** | Top 2 players by Rank + LP are auto-selected as captains |
| 🖱️ **All Buttons** | Draft picks, role assignment, results — zero typing required |
| ⚔️ **5v5 Draft** | Each team = 1 captain + 4 drafted players = 5 total |
| 🗺️ **Role Assignment** | Captains assign Top/Jungle/Mid/Bot/Support per player with buttons |
| 🏆 **Final Teams** | Clean embed sorted by role with result buttons |

---

## 🎮 How the Draft Works

```
1.  Players /join with roles + rank (or click Join Queue button)
2.  When ≥2 players are ready, click ▶ Start Draft
3.  Top 2 players by LP become Captain 1 and Captain 2
4.  Snake draft begins — captains pick 4 players each via buttons
       Pick order: C1 → C2 → C2 → C1 → C1 → C2 → C2 → C1
5.  Role assignment — each captain assigns a role to every team member
       (including themselves) using 5 role buttons
6.  Final teams shown with full role breakdown + Team 1 Won / Team 2 Won buttons
```

### LP Scoring
| Rank | Base LP |
|---|---|
| Challenger | 2800 |
| Grandmaster | 2600 |
| Master | 2400 |
| Diamond | 2000 |
| Emerald | 1600 |
| Platinum | 1200 |
| Gold | 800 |
| Silver | 400 |
| Bronze | 200 |
| Iron | 100 |
| Unranked | 0 |

Your `/join` rank + LP value = your captain priority score.

---

## 🚀 Setup

### 1. Create Bot
1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. **New Application** → Bot → **Add Bot**
3. Enable **Server Members Intent** + **Message Content Intent**
4. Copy **Bot Token** and **Application ID**

### 2. Invite URL
```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=534723950656&scope=bot+applications.commands
```

### 3. Install
```bash
npm install
cp .env.example .env
# fill in DISCORD_TOKEN, CLIENT_ID, and optionally GUILD_ID
```

### 4. Register Commands
```bash
npm run deploy   # instant with GUILD_ID set, or global (1hr) without
```

### 5. Start
```bash
npm start        # production
npm run dev      # dev with auto-restart
```

---

## 📋 Commands

| Command | Description |
|---|---|
| `/join [roles] [rank] [lp]` | Join the queue with preferences |
| `/leave` | Leave the queue |
| `/queue` | Display the current queue |
| `/help` | Show how the bot works |
| `/lobby status` | View current draft/role state |
| `/lobby forcecancel` | Admin: cancel active lobby |
| `/lobby clearqueue` | Admin: clear the queue |
| `/config setchannel #ch` | Admin: restrict queue to a channel |
| `/config show` | Admin: show current config |

---

## 📁 Project Structure

```
challenger-draft-bot/
├── index.js                  # Entry point
├── deploy-commands.js        # Register slash commands
├── package.json
├── .env.example
├── commands/
│   ├── join.js               # /join
│   ├── queueCommands.js      # /leave, /queue
│   ├── lobby.js              # /lobby
│   ├── config.js             # /config
│   └── help.js               # /help
├── events/
│   ├── ready.js              # Bot startup
│   └── interactionCreate.js  # ALL button + slash command routing
└── utils/
    ├── gameManager.js        # Game state, LP logic, draft/role engine
    ├── embeds.js             # All embeds + button row builders
    └── loadCommands.js       # Smart command loader
```
