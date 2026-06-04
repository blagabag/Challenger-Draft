const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const gm = require('../utils/gameManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure the Challenger Draft bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('setchannel')
        .setDescription('Restrict queue to a channel')
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Queue channel').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('show')
        .setDescription('Show current config')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'setchannel') {
      const channel = interaction.options.getChannel('channel');
      gm.setConfig(guildId, 'queueChannelId', channel.id);
      return interaction.reply({
        content: `✅ Queue channel set to <#${channel.id}>.`,
        ephemeral: true,
      });
    }

    if (sub === 'show') {
      const cfg = gm.getConfig(guildId);
      return interaction.reply({
        content: [
          '⚙️ **Challenger Draft — Config**',
          `Queue Channel: ${cfg.queueChannelId ? `<#${cfg.queueChannelId}>` : 'Any channel'}`,
        ].join('\n'),
        ephemeral: true,
      });
    }
  },
};
