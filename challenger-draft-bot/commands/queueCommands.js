const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const gm = require('../utils/gameManager');
const { buildQueueEmbed, buildQueueButtons } = require('../utils/embeds');

// ─── /leave ───────────────────────────────────────────────────────────────────
const leave = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave the queue'),

  async execute(interaction) {
    const removed = gm.removeFromQueue(interaction.guildId, interaction.user.id);
    if (!removed) {
      return interaction.reply({ content: '⚠️ You are not in the queue.', ephemeral: true });
    }
    const queue = gm.getQueue(interaction.guildId);
    await interaction.reply({
      content: `👋 **${interaction.user.username}** left the queue. (${queue.players.length} remaining)`,
    });
  },
};

// ─── /queue ───────────────────────────────────────────────────────────────────
const queue = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current queue'),

  async execute(interaction) {
    const q = gm.getQueue(interaction.guildId);
    const canStart = q.players.length >= 2;
    const embed = buildQueueEmbed(q);
    const row = buildQueueButtons(canStart);
    await interaction.reply({ embeds: [embed], components: [row] });
  },
};

module.exports = { leave, queue };
