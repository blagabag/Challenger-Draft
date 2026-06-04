/**
 * Run this script ONCE (or after changing commands) to register
 * slash commands with Discord.
 *
 * Usage:
 *   GUILD_ID=your_server_id node deploy-commands.js    ← instant (dev)
 *   node deploy-commands.js                            ← global (up to 1hr)
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const mod = require(path.join(commandsPath, file));

  // Handle both single exports and named exports (e.g. queueCommands.js)
  if (mod.data) {
    commands.push(mod.data.toJSON());
  } else {
    for (const [, cmd] of Object.entries(mod)) {
      if (cmd?.data) commands.push(cmd.data.toJSON());
    }
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const guildId = process.env.GUILD_ID;

    if (guildId) {
      console.log(`Registering ${commands.length} commands to guild ${guildId}…`);
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
        { body: commands },
      );
      console.log('✅ Guild commands registered instantly!');
    } else {
      console.log(`Registering ${commands.length} global commands (may take up to 1 hour)…`);
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log('✅ Global commands registered!');
    }

    console.log('\nRegistered commands:');
    commands.forEach(c => console.log(`  /${c.name}`));
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
})();
