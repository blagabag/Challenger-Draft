const { Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`\n🏆 Challenger Draft Bot is online!`);
    console.log(`   Logged in as: ${client.user.tag}`);
    console.log(`   Serving ${client.guilds.cache.size} guild(s)\n`);
    client.user.setPresence({
      activities: [{ name: '/join to queue up!', type: 2 }], // LISTENING
      status: 'online',
    });
  },
};
