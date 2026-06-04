const { SlashCommandBuilder } = require('discord.js');
const gm = require('../utils/gameManager');
const { buildQueueEmbed, buildQueueButtons } = require('../utils/embeds');

const RANKS = Object.keys(gm.LP_TABLE);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join the Challenger Draft queue')
    .addStringOption(opt =>
      opt.setName('roles')
        .setDescription('Preferred roles e.g: Top,Mid,Support')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('rank')
        .setDescription('Your current rank')
        .setRequired(false)
        .addChoices(...RANKS.map(r => ({ name: r, value: r }))))
    .addIntegerOption(opt =>
      opt.setName('lp')
        .setDescription('Your current LP (0-99)')
        .setMinValue(0)
        .setMaxValue(99)
        .setRequired(false)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const cfg = gm.getConfig(guildId);

    if (cfg.queueChannelId && interaction.channelId !== cfg.queueChannelId) {
      return interaction.reply({
        content: `❌ Queue is restricted to <#${cfg.queueChannelId}>.`,
        ephemeral: true,
      });
    }

    const rawRoles = (interaction.options.getString('roles') || '')
      .split(',')
      .map(r => r.trim())
      .filter(r => ['Top', 'Jungle', 'Mid', 'Bot', 'Support'].includes(r));

    const player = {
      id: interaction.user.id,
      username: interaction.user.username,
      preferredRoles: rawRoles.length ? rawRoles : ['Fill'],
      rank: interaction.options.getString('rank') || 'Unranked',
      lp: interaction.options.getInteger('lp') || 0,
    };

    const result = gm.addToQueue(guildId, player);
    if (!result.ok) {
      const msgs = {
        already_in_queue: '⚠️ You are already in the queue!',
        draft_active: '❌ A draft is currently active. Wait for it to finish.',
      };
      return interaction.reply({ content: msgs[result.reason] || '❌ Could not join.', ephemeral: true });
    }

    const queue = gm.getQueue(guildId);
    const canStart = queue.players.length >= 2;
    const embed = buildQueueEmbed(queue);
    const row = buildQueueButtons(canStart);

    await interaction.reply({
      content: `✅ **${player.username}** joined the queue! (${queue.players.length} players)`,
      embeds: [embed],
      components: [row],
    });
  },
};
