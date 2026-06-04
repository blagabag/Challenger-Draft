const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS, ROLE_EMOJI } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('How to use Challenger Draft Bot'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.purple)
      .setTitle('🏆  Challenger Draft — How It Works')
      .addFields(
        {
          name: '📋 Step 1 — Queue Up',
          value:
            '`/join` with your preferred roles and rank\n' +
            '`/leave` to leave the queue\n' +
            '`/queue` to see who\'s in queue\n' +
            '> Queue is **unlimited** — anyone can join',
        },
        {
          name: '👑 Step 2 — Captains Auto-Selected',
          value:
            'When **Start Draft** is clicked, the **top 2 players by LP** become captains.\n' +
            '> Rank + LP score determines who leads',
        },
        {
          name: '⚔️ Step 3 — Snake Draft (buttons only)',
          value:
            'Captains take turns picking players using buttons.\n' +
            'Each team drafts **4 players** (captain + 4 = 5 total).\n' +
            'Snake order: C1 → C2 → C2 → C1 → C1 → C2 → C2 → C1',
        },
        {
          name: '🎯 Step 4 — Role Assignment (buttons only)',
          value:
            'After the draft, each captain assigns a role to every player on their team.\n' +
            'Roles: ' + Object.entries(ROLE_EMOJI).map(([r, e]) => `${e} ${r}`).join('  '),
        },
        {
          name: '🏆 Step 5 — Game On!',
          value:
            'Final teams are displayed with full role breakdown.\n' +
            'Use `/lobby status` anytime to see the current state.',
        },
        {
          name: '⚙️ Admin Commands',
          value:
            '`/config setchannel` — Lock queue to a channel\n' +
            '`/lobby forcecancel` — Cancel active lobby\n' +
            '`/lobby clearqueue` — Clear the queue',
        },
      )
      .setFooter({ text: 'Challenger Draft Bot — All buttons, no typing needed!' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
