/**
 * interactionCreate.js — Master handler for ALL interactions
 *
 * Button IDs used:
 *   queue_join          — Join queue from queue embed
 *   queue_leave         — Leave queue from queue embed
 *   queue_start         — Admin/any: start the draft
 *   pick_{userId}       — Captain picks a player
 *   role_{roleName}     — Captain assigns a role to current player
 *   result_team1        — Record Team 1 win
 *   result_team2        — Record Team 2 win
 *   lobby_cancel_vote   — Vote to cancel
 */

const { Events } = require('discord.js');
const gm = require('../utils/gameManager');
const {
  buildQueueEmbed,
  buildQueueButtons,
  buildDraftEmbed,
  buildDraftPickButtons,
  buildRoleAssignEmbed,
  buildRoleButtons,
  buildFinalTeamsEmbed,
  buildResultButtons,
} = require('../utils/embeds');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeReply(interaction, payload) {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp({ ...payload, ephemeral: payload.ephemeral ?? true });
    }
    return await interaction.reply(payload);
  } catch (e) {
    console.error('safeReply error:', e.message);
  }
}

async function refreshQueueMessage(interaction, queue) {
  try {
    const canStart = queue.players.length >= 2;
    const embed = buildQueueEmbed(queue);
    const row = buildQueueButtons(canStart);
    await interaction.message.edit({ embeds: [embed], components: [row] });
  } catch (_) {}
}

// ─── Main handler ─────────────────────────────────────────────────────────────

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction, client) {

    // ── Slash Commands ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`[slash /${interaction.commandName}]`, err);
        const msg = { content: '❌ Something went wrong.', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
        else await interaction.reply(msg);
      }
      return;
    }

    // ── Buttons ─────────────────────────────────────────────────────────────
    if (!interaction.isButton()) return;

    const { customId, guildId, user } = interaction;

    // ════════════════════════════════════════════════════════════════
    //  QUEUE BUTTONS
    // ════════════════════════════════════════════════════════════════

    // ── Join Queue ───────────────────────────────────────────────────────────
    if (customId === 'queue_join') {
      const player = {
        id: user.id,
        username: user.username,
        preferredRoles: ['Fill'],
        rank: 'Unranked',
        lp: 0,
      };
      const result = gm.addToQueue(guildId, player);
      if (!result.ok) {
        const msgs = {
          already_in_queue: '⚠️ You are already in the queue!',
          draft_active: '❌ A draft is currently active.',
        };
        return safeReply(interaction, {
          content: msgs[result.reason] || '❌ Could not join.',
          ephemeral: true,
        });
      }
      const queue = gm.getQueue(guildId);
      await refreshQueueMessage(interaction, queue);
      return safeReply(interaction, {
        content: `✅ **${user.username}** joined the queue! (${queue.players.length} players)\n*Use \`/join\` to specify your roles and rank.*`,
        ephemeral: false,
      });
    }

    // ── Leave Queue ──────────────────────────────────────────────────────────
    if (customId === 'queue_leave') {
      const removed = gm.removeFromQueue(guildId, user.id);
      if (!removed) {
        return safeReply(interaction, { content: '⚠️ You are not in the queue.', ephemeral: true });
      }
      const queue = gm.getQueue(guildId);
      await refreshQueueMessage(interaction, queue);
      return safeReply(interaction, {
        content: `👋 **${user.username}** left the queue. (${queue.players.length} remaining)`,
        ephemeral: false,
      });
    }

    // ── Start Draft ──────────────────────────────────────────────────────────
    if (customId === 'queue_start') {
      // Check for existing active lobby
      if (gm.getLobbyByGuild(guildId)) {
        return safeReply(interaction, {
          content: '❌ A draft is already running!',
          ephemeral: true,
        });
      }

      const queue = gm.getQueue(guildId);
      if (queue.players.length < 2) {
        return safeReply(interaction, {
          content: '❌ Need at least 2 players to start a draft.',
          ephemeral: true,
        });
      }

      // Create lobby — top 2 by LP become captains
      const lobby = gm.createLobby(guildId, queue.players);
      if (!lobby) {
        return safeReply(interaction, { content: '❌ Failed to create lobby.', ephemeral: true });
      }

      gm.clearQueue(guildId);

      // Disable the queue buttons since draft is starting
      try {
        await interaction.message.edit({ components: [] });
      } catch (_) {}

      const draftEmbed = buildDraftEmbed(lobby);
      const pickRows = buildDraftPickButtons(lobby);

      return safeReply(interaction, {
        content: [
          '## ⚔️ Captain\'s Draft Started!',
          `👑 **Captain 1:** <@${lobby.captain1.id}> (${lobby.captain1.rank})`,
          `👑 **Captain 2:** <@${lobby.captain2.id}> (${lobby.captain2.rank})`,
          `\n🎯 <@${lobby.captain1.id}> — **you pick first!** Click a player below.`,
        ].join('\n'),
        embeds: [draftEmbed],
        components: pickRows,
        ephemeral: false,
      });
    }

    // ════════════════════════════════════════════════════════════════
    //  DRAFT PICK BUTTONS  (pick_{userId})
    // ════════════════════════════════════════════════════════════════

    if (customId.startsWith('pick_')) {
      const targetId = customId.slice(5);
      const lobby = gm.getLobbyByGuild(guildId);

      if (!lobby || lobby.status !== 'drafting') {
        return safeReply(interaction, { content: '❌ No active draft.', ephemeral: true });
      }

      // Only the active captain may click
      if (lobby.currentPick !== user.id) {
        const currentCaptain = lobby.currentPick === lobby.captain1.id
          ? lobby.captain1 : lobby.captain2;
        return safeReply(interaction, {
          content: `❌ It's **<@${currentCaptain.id}>'s** turn to pick, not yours!`,
          ephemeral: true,
        });
      }

      const result = gm.draftPlayer(lobby, user.id, targetId);
      if (!result.ok) {
        const msgs = {
          player_not_in_pool: '❌ That player is no longer available.',
          wrong_phase: '❌ Draft is not in picking phase.',
        };
        return safeReply(interaction, { content: msgs[result.reason] || '❌ Invalid pick.', ephemeral: true });
      }

      const pickedPlayer = [...lobby.team1, ...lobby.team2].find(p => p.id === targetId);

      // Draft complete → move to role assignment
      if (result.draftComplete) {
        const step = lobby.rolePickQueue[0];
        const usedRoles = gm.getUsedRolesForCurrentStep(lobby);
        const available = gm.ROLES.filter(r => !usedRoles.includes(r));
        const roleEmbed = buildRoleAssignEmbed(lobby);
        const roleRow = buildRoleButtons(available);

        return safeReply(interaction, {
          content: [
            `✅ <@${user.id}> drafted **${pickedPlayer?.username}**!`,
            '',
            '## 🎯 Draft Complete! Now assigning roles.',
            `👑 <@${step.captainId}> — assign a role to <@${step.playerId}> using the buttons below.`,
          ].join('\n'),
          embeds: [roleEmbed],
          components: [roleRow],
          ephemeral: false,
        });
      }

      // Draft continues
      const draftEmbed = buildDraftEmbed(lobby);
      const pickRows = buildDraftPickButtons(lobby);
      const nextCaptain = lobby.currentPick === lobby.captain1.id ? lobby.captain1 : lobby.captain2;

      return safeReply(interaction, {
        content: `✅ <@${user.id}> drafted **${pickedPlayer?.username}**!\n👉 <@${nextCaptain.id}> — **your pick!**`,
        embeds: [draftEmbed],
        components: pickRows,
        ephemeral: false,
      });
    }

    // ════════════════════════════════════════════════════════════════
    //  ROLE ASSIGNMENT BUTTONS  (role_{roleName})
    // ════════════════════════════════════════════════════════════════

    if (customId.startsWith('role_')) {
      const role = customId.slice(5); // 'role_Top' → 'Top'
      const lobby = gm.getLobbyByGuild(guildId);

      if (!lobby || lobby.status !== 'assigning_roles') {
        return safeReply(interaction, { content: '❌ Not in role assignment phase.', ephemeral: true });
      }

      const step = lobby.rolePickQueue[lobby.rolePickIndex];
      if (!step) {
        return safeReply(interaction, { content: '❌ All roles already assigned.', ephemeral: true });
      }

      // Only the active captain can assign
      if (step.captainId !== user.id) {
        const activeCaptain = step.captainId === lobby.captain1.id ? lobby.captain1 : lobby.captain2;
        return safeReply(interaction, {
          content: `❌ It's **<@${activeCaptain.id}>'s** turn to assign roles, not yours!`,
          ephemeral: true,
        });
      }

      const result = gm.assignRole(lobby, user.id, role);
      if (!result.ok) {
        const msgs = {
          role_taken: `❌ **${role}** is already taken on your team! Pick another.`,
          not_your_turn: '❌ It\'s not your turn!',
          wrong_phase: '❌ Not in role assignment phase.',
        };
        return safeReply(interaction, {
          content: msgs[result.reason] || '❌ Invalid assignment.',
          ephemeral: true,
        });
      }

      const assignedPlayer = step.playerId;

      // All roles assigned → show final teams
      if (result.allAssigned) {
        const finalEmbed = buildFinalTeamsEmbed(lobby);
        const resultRow = buildResultButtons();

        const team1Pings = lobby.team1.map(p => `<@${p.id}>`).join(' ');
        const team2Pings = lobby.team2.map(p => `<@${p.id}>`).join(' ');

        return safeReply(interaction, {
          content: [
            `✅ <@${assignedPlayer}> → **${role}**`,
            '',
            '# 🏆 Teams Are Set!',
            `🔵 ${team1Pings}`,
            `🔴 ${team2Pings}`,
          ].join('\n'),
          embeds: [finalEmbed],
          components: [resultRow],
          ephemeral: false,
        });
      }

      // More assignments to go
      const nextStep = lobby.rolePickQueue[lobby.rolePickIndex];
      const usedRoles = gm.getUsedRolesForCurrentStep(lobby);
      const available = gm.ROLES.filter(r => !usedRoles.includes(r));
      const roleEmbed = buildRoleAssignEmbed(lobby);
      const roleRow = buildRoleButtons(available);

      // If team changed (moving from Team 1 to Team 2)
      const teamChanged = nextStep.team !== step.team;
      const teamChangeMsg = teamChanged
        ? `\n\n🔄 **Team 1 complete!** Now <@${nextStep.captainId}> assigns roles for Team 2.`
        : '';

      return safeReply(interaction, {
        content:
          `✅ <@${assignedPlayer}> → **${role}**\n` +
          `👉 <@${nextStep.captainId}> — assign a role to <@${nextStep.playerId}>` +
          teamChangeMsg,
        embeds: [roleEmbed],
        components: [roleRow],
        ephemeral: false,
      });
    }

    // ════════════════════════════════════════════════════════════════
    //  RESULT / CANCEL BUTTONS
    // ════════════════════════════════════════════════════════════════

    if (customId === 'result_team1' || customId === 'result_team2') {
      const lobby = gm.getLobbyByGuild(guildId);
      if (!lobby || !['ready', 'in_game'].includes(lobby.status)) {
        return safeReply(interaction, { content: '❌ No active game to report.', ephemeral: true });
      }

      const winner = customId === 'result_team1' ? 1 : 2;
      const winTeam = winner === 1 ? lobby.team1 : lobby.team2;
      const loseTeam = winner === 1 ? lobby.team2 : lobby.team1;
      const winLabel = winner === 1 ? '🔵 Team 1' : '🔴 Team 2';
      const winMentions = winTeam.map(p => `<@${p.id}>`).join(' ');

      gm.finishLobby(lobby.id);

      // Disable result buttons on the message
      try { await interaction.message.edit({ components: [] }); } catch (_) {}

      return safeReply(interaction, {
        content: [
          `# 🏆 ${winLabel} Wins! GG!`,
          `${winMentions}`,
          `\n*Reported by <@${user.id}>*`,
        ].join('\n'),
        ephemeral: false,
      });
    }

    if (customId === 'lobby_cancel_vote') {
      const lobby = gm.getLobbyByGuild(guildId);
      if (!lobby) {
        return safeReply(interaction, { content: '❌ No active lobby.', ephemeral: true });
      }

      const allPlayers = [...lobby.team1, ...lobby.team2];
      if (!allPlayers.some(p => p.id === user.id)) {
        return safeReply(interaction, { content: '❌ You are not in this lobby.', ephemeral: true });
      }

      lobby.votes.cancel.add(user.id);
      const needed = Math.ceil(allPlayers.length * 0.6);
      const have = lobby.votes.cancel.size;

      if (have >= needed) {
        gm.finishLobby(lobby.id);
        try { await interaction.message.edit({ components: [] }); } catch (_) {}
        return safeReply(interaction, {
          content: `🚫 **Game cancelled by vote** (${have}/${allPlayers.length} players agreed).`,
          ephemeral: false,
        });
      }

      return safeReply(interaction, {
        content: `🗳️ <@${user.id}> voted to cancel. (${have}/${needed} votes needed)`,
        ephemeral: false,
      });
    }
  },
};
