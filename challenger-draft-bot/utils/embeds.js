/**
 * embeds.js — All Discord embed builders and button row factories for v2
 *
 * Key principles:
 * - Every phase has its own embed + button rows
 * - No typing commands ever — pure button interaction
 * - Draft buttons = one button per available pool player (paginated in rows of 5)
 * - Role buttons = 5 role buttons shown to the active captain
 * - Final teams embed sorted by role order
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const COLORS = {
  blue:   0x5865F2,
  green:  0x57F287,
  red:    0xED4245,
  yellow: 0xFEE75C,
  purple: 0x9B59B6,
  orange: 0xE67E22,
  gold:   0xF1C40F,
  teal:   0x1ABC9C,
  dark:   0x2C2F33,
};

const ROLE_EMOJI = {
  Top:     '🛡️',
  Jungle:  '🌿',
  Mid:     '⚡',
  Bot:     '🏹',
  Support: '💊',
};

const RANK_EMOJI = {
  Challenger:  '🏆',
  Grandmaster: '🔱',
  Master:      '👑',
  Diamond:     '💠',
  Emerald:     '🌟',
  Platinum:    '💎',
  Gold:        '🥇',
  Silver:      '🥈',
  Bronze:      '🥉',
  Iron:        '⚙️',
  Unranked:    '❓',
};

const ROLE_ORDER = { Top: 0, Jungle: 1, Mid: 2, Bot: 3, Support: 4 };

// ─── /queue embed ─────────────────────────────────────────────────────────────

function buildQueueEmbed(queue) {
  const count = queue.players.length;

  const playerList = count > 0
    ? queue.players
        .map((p, i) => {
          const roles = p.preferredRoles
            .map(r => `${ROLE_EMOJI[r] || r}`)
            .join('');
          const rankBadge = RANK_EMOJI[p.rank] || '❓';
          const lpStr = p.lp ? ` +${p.lp}LP` : '';
          return `\`${String(i + 1).padStart(2, '0')}\` ${rankBadge} **${p.username}** ${roles}  \`${p.rank}${lpStr}\``;
        })
        .join('\n')
    : '*No players in queue yet — be the first!*';

  const needsMore = count < 2;

  return new EmbedBuilder()
    .setColor(count >= 10 ? COLORS.green : count >= 2 ? COLORS.blue : COLORS.dark)
    .setTitle('🎮  Challenger Draft — Queue')
    .setDescription(playerList)
    .addFields(
      { name: '👥 Players', value: `**${count}**`, inline: true },
      { name: '📋 Min to start', value: `**2**`, inline: true },
      { name: '🏆 Top 2 by LP', value: count >= 2 ? 'Will be Captains' : 'Need ≥2 players', inline: true },
    )
    .setFooter({
      text: needsMore
        ? `Need at least 2 players to start a draft`
        : `✅ Ready! An admin can click Start Draft`,
    })
    .setTimestamp();
}

// ─── Queue action buttons ─────────────────────────────────────────────────────

function buildQueueButtons(canStart = false) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('queue_join')
      .setLabel('Join Queue')
      .setStyle(ButtonStyle.Success)
      .setEmoji('➕'),
    new ButtonBuilder()
      .setCustomId('queue_leave')
      .setLabel('Leave Queue')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('➖'),
    new ButtonBuilder()
      .setCustomId('queue_start')
      .setLabel('Start Draft')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⚔️')
      .setDisabled(!canStart),
  );
  return row;
}

// ─── Draft embed ──────────────────────────────────────────────────────────────

function buildDraftEmbed(lobby) {
  const currentCaptain = lobby.currentPick === lobby.captain1.id
    ? lobby.captain1 : lobby.captain2;

  const formatTeam = (team, captain) =>
    team.length
      ? team.map(p =>
          p.id === captain.id
            ? `👑 <@${p.id}> *(Captain)*`
            : `✅ <@${p.id}>`
        ).join('\n')
      : '—';

  const poolList = lobby.draftPool.length
    ? lobby.draftPool.map((p, i) => {
        const roles = p.preferredRoles.map(r => ROLE_EMOJI[r] || r).join('');
        const rank = `${RANK_EMOJI[p.rank] || '❓'} \`${p.rank}\``;
        return `\`${i + 1}.\` <@${p.id}> ${roles} ${rank}`;
      }).join('\n')
    : '*All players drafted!*';

  // Draft progress
  const t1Needed = 5 - lobby.team1.length;
  const t2Needed = 5 - lobby.team2.length;

  return new EmbedBuilder()
    .setColor(lobby.currentPick === lobby.captain1.id ? COLORS.blue : COLORS.red)
    .setTitle('⚔️  Captain\'s Draft')
    .setDescription(
      `### 👑 <@${currentCaptain.id}>'s turn to pick!\n` +
      `Pick a player using the buttons below.`
    )
    .addFields(
      {
        name: `🔵 Team 1 — <@${lobby.captain1.id}> (${lobby.team1.length}/5)`,
        value: formatTeam(lobby.team1, lobby.captain1),
        inline: true,
      },
      {
        name: `🔴 Team 2 — <@${lobby.captain2.id}> (${lobby.team2.length}/5)`,
        value: formatTeam(lobby.team2, lobby.captain2),
        inline: true,
      },
      {
        name: `🎯 Draft Pool (${lobby.draftPool.length} remaining)`,
        value: poolList,
        inline: false,
      },
    )
    .setFooter({
      text: `Pick #${lobby.pickNumber} • Team 1 needs ${t1Needed} • Team 2 needs ${t2Needed}`,
    })
    .setTimestamp();
}

/**
 * Build draft pick button rows (up to 4 rows of 5 = 20 buttons max).
 * Each button = one pool player.
 */
function buildDraftPickButtons(lobby) {
  const pool = lobby.draftPool;
  if (!pool.length) return [];

  const rows = [];
  // Discord allows max 5 action rows, each with max 5 buttons
  const maxButtons = Math.min(pool.length, 20);

  for (let i = 0; i < maxButtons; i += 5) {
    const row = new ActionRowBuilder();
    const slice = pool.slice(i, i + 5);
    slice.forEach(p => {
      const roleStr = p.preferredRoles.slice(0, 2).join('/');
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`pick_${p.id}`)
          .setLabel(`${p.username.slice(0, 16)} (${roleStr})`)
          .setStyle(
            lobby.currentPick === lobby.captain1.id
              ? ButtonStyle.Primary
              : ButtonStyle.Danger
          )
      );
    });
    rows.push(row);
  }

  return rows;
}

// ─── Role assignment embed ────────────────────────────────────────────────────

function buildRoleAssignEmbed(lobby) {
  const step = lobby.rolePickQueue[lobby.rolePickIndex];
  if (!step) return null;

  const allPlayers = [...lobby.team1, ...lobby.team2];
  const player = allPlayers.find(p => p.id === step.playerId);
  const captain = step.captainId === lobby.captain1.id ? lobby.captain1 : lobby.captain2;
  const teamColor = step.team === 1 ? COLORS.blue : COLORS.red;
  const teamName = step.team === 1 ? '🔵 Team 1' : '🔴 Team 2';
  const team = step.team === 1 ? lobby.team1 : lobby.team2;

  // Show team's current role assignments
  const teamStatus = team.map(p => {
    const assignedRole = lobby.roleAssignments[p.id];
    const isCurrent = p.id === step.playerId;
    const prefix = isCurrent ? '👉' : (assignedRole ? '✅' : '⬜');
    const roleStr = assignedRole
      ? `${ROLE_EMOJI[assignedRole]} \`${assignedRole}\``
      : isCurrent ? '*(pick a role below)*' : '`Pending...`';
    return `${prefix} <@${p.id}> — ${roleStr}`;
  }).join('\n');

  const progress = lobby.rolePickIndex;
  const total = lobby.rolePickQueue.length;

  return new EmbedBuilder()
    .setColor(teamColor)
    .setTitle(`🎯 Role Assignment — ${teamName}`)
    .setDescription(
      `### 👑 <@${captain.id}>, assign a role to <@${player?.id}>!\n` +
      (player?.preferredRoles?.length
        ? `**Preferred:** ${player.preferredRoles.map(r => `${ROLE_EMOJI[r]} ${r}`).join('  ')}\n`
        : '') +
      '\nClick a role button below:'
    )
    .addFields(
      { name: `${teamName} Progress`, value: teamStatus, inline: false },
    )
    .setFooter({ text: `Assignment ${progress + 1} of ${total}` })
    .setTimestamp();
}

/**
 * Build role buttons for the active role assignment step.
 * Available = all 5 roles minus already-assigned ones on this team.
 */
function buildRoleButtons(availableRoles, takenRoles = []) {
  const row = new ActionRowBuilder();
  const { ROLES } = require('./gameManager');

  ROLES.forEach(role => {
    const available = availableRoles.includes(role);
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`role_${role}`)
        .setLabel(`${role}`)
        .setEmoji(ROLE_EMOJI[role])
        .setStyle(available ? ButtonStyle.Secondary : ButtonStyle.Secondary)
        .setDisabled(!available)
    );
  });

  return row;
}

// ─── Final teams embed ────────────────────────────────────────────────────────

function buildFinalTeamsEmbed(lobby) {
  const formatTeam = (team, captain) => {
    return team
      .map(p => ({
        p,
        role: lobby.roleAssignments[p.id] || 'Unassigned',
        order: ROLE_ORDER[lobby.roleAssignments[p.id]] ?? 9,
      }))
      .sort((a, b) => a.order - b.order)
      .map(({ p, role }) => {
        const emoji = ROLE_EMOJI[role] || '❓';
        const isCaptain = p.id === captain.id;
        return `${emoji} \`${role.padEnd(7)}\`  ${isCaptain ? '👑 ' : ''}<@${p.id}>`;
      })
      .join('\n');
  };

  const team1Mentions = lobby.team1.map(p => `<@${p.id}>`).join(' ');
  const team2Mentions = lobby.team2.map(p => `<@${p.id}>`).join(' ');

  return new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle('🏆  Teams Are Set — Game On!')
    .setDescription(
      '> Both captains have drafted and assigned all roles.\n> Good luck, have fun!\n\u200B'
    )
    .addFields(
      {
        name: `🔵 Team 1`,
        value: formatTeam(lobby.team1, lobby.captain1) + `\n\n${team1Mentions}`,
        inline: true,
      },
      {
        name: `🔴 Team 2`,
        value: formatTeam(lobby.team2, lobby.captain2) + `\n\n${team2Mentions}`,
        inline: true,
      },
    )
    .setFooter({ text: 'Use /lobby result to record the winner after the game.' })
    .setTimestamp();
}

// ─── Post-game buttons ────────────────────────────────────────────────────────

function buildResultButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('result_team1')
      .setLabel('🔵 Team 1 Won')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('result_team2')
      .setLabel('🔴 Team 2 Won')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('lobby_cancel_vote')
      .setLabel('Cancel Game')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🚫'),
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  COLORS,
  ROLE_EMOJI,
  RANK_EMOJI,
  ROLE_ORDER,
  buildQueueEmbed,
  buildQueueButtons,
  buildDraftEmbed,
  buildDraftPickButtons,
  buildRoleAssignEmbed,
  buildRoleButtons,
  buildFinalTeamsEmbed,
  buildResultButtons,
};
