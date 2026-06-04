const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const gm = require('../utils/gameManager');
const {
  buildDraftEmbed,
  buildDraftPickButtons,
  buildFinalTeamsEmbed,
  buildResultButtons,
  buildRoleAssignEmbed,
  buildRoleButtons,
  ROLES,
} = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lobby')
    .setDescription('Lobby management commands')
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Show the current lobby status'))
    .addSubcommand(sub =>
      sub.setName('forcecancel')
        .setDescription('Admin: Force-cancel the current lobby')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild))
    .addSubcommand(sub =>
      sub.setName('clearqueue')
        .setDescription('Admin: Clear the queue')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ── /lobby status ─────────────────────────────────────────────────────────
    if (sub === 'status') {
      const lobby = gm.getLobbyByGuild(guildId);
      if (!lobby) {
        return interaction.reply({ content: '📭 No active lobby right now.', ephemeral: true });
      }

      if (lobby.status === 'drafting') {
        const embed = buildDraftEmbed(lobby);
        const rows = buildDraftPickButtons(lobby);
        return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
      }

      if (lobby.status === 'assigning_roles') {
        const embed = buildRoleAssignEmbed(lobby);
        const usedRoles = gm.getUsedRolesForCurrentStep(lobby);
        const available = gm.ROLES.filter(r => !usedRoles.includes(r));
        const row = buildRoleButtons(available);
        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      if (lobby.status === 'ready') {
        const embed = buildFinalTeamsEmbed(lobby);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      return interaction.reply({ content: `Lobby status: \`${lobby.status}\``, ephemeral: true });
    }

    // ── /lobby forcecancel ────────────────────────────────────────────────────
    if (sub === 'forcecancel') {
      const lobby = gm.getLobbyByGuild(guildId);
      if (!lobby) return interaction.reply({ content: '❌ No active lobby.', ephemeral: true });
      gm.finishLobby(lobby.id);
      return interaction.reply({ content: '🚫 **Lobby force-cancelled.**' });
    }

    // ── /lobby clearqueue ─────────────────────────────────────────────────────
    if (sub === 'clearqueue') {
      gm.clearQueue(guildId);
      return interaction.reply({ content: '🗑️ Queue cleared.', ephemeral: true });
    }
  },
};
