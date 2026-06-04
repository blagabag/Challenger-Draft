/**
 * GameManager — core state for Challenger Draft Bot
 *
 * Key design changes v2:
 * - Queue is UNLIMITED (no auto-start, admin starts draft manually)
 * - Captains are the TOP 2 players by LP (rank points)
 * - Captains draft from ALL queued players (pool = queue minus captains)
 * - Each team drafts exactly 4 players + 1 captain = 5 total
 * - All interaction is button-driven
 * - Role assignment is fully button-driven per player
 */

const ROLES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];

// LP lookup table for auto-captain selection
const LP_TABLE = {
  Challenger:   2800,
  Grandmaster:  2600,
  Master:       2400,
  Diamond:      2000,
  Emerald:      1600,
  Platinum:     1200,
  Gold:          800,
  Silver:        400,
  Bronze:        200,
  Iron:          100,
  Unranked:        0,
};

// Map<guildId, QueueState>
const queues = new Map();
// Map<lobbyId, LobbyState>
const lobbies = new Map();
// Map<guildId, GuildConfig>
const configs = new Map();

let lobbyCounter = 1;

// ─── LP Helpers ───────────────────────────────────────────────────────────────

function getLP(player) {
  return (LP_TABLE[player.rank] || 0) + (player.lp || 0);
}

function selectCaptainsByLP(players) {
  const sorted = [...players].sort((a, b) => getLP(b) - getLP(a));
  return [sorted[0], sorted[1]]; // top 2 by LP
}

// ─── Queue ────────────────────────────────────────────────────────────────────

function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, { players: [] });
  }
  return queues.get(guildId);
}

function addToQueue(guildId, player) {
  const q = getQueue(guildId);
  if (q.players.find(p => p.id === player.id)) return { ok: false, reason: 'already_in_queue' };
  if (getLobbyByGuild(guildId)) return { ok: false, reason: 'draft_active' };
  q.players.push(player);
  return { ok: true };
}

function removeFromQueue(guildId, userId) {
  const q = getQueue(guildId);
  const before = q.players.length;
  q.players = q.players.filter(p => p.id !== userId);
  return q.players.length < before;
}

function clearQueue(guildId) {
  const q = getQueue(guildId);
  q.players = [];
}

// ─── Lobby / Draft ────────────────────────────────────────────────────────────

function createLobby(guildId, allQueuedPlayers) {
  if (allQueuedPlayers.length < 2) return null;

  const id = `lobby_${guildId}_${lobbyCounter++}`;

  // Auto-select captains by highest LP
  const [captain1, captain2] = selectCaptainsByLP(allQueuedPlayers);

  // Draft pool = everyone except the two captains
  const draftPool = allQueuedPlayers.filter(
    p => p.id !== captain1.id && p.id !== captain2.id
  );

  const lobby = {
    id,
    guildId,
    // Phase: 'drafting' → 'assigning_roles' → 'ready' → 'finished'
    status: 'drafting',
    captain1,
    captain2,
    team1: [captain1],   // captain1 is always on Team 1
    team2: [captain2],   // captain2 is always on Team 2
    draftPool,           // players available to be picked
    currentPick: captain1.id,  // captain1 picks first
    pickNumber: 1,
    // Role assignment state
    roleAssignments: {},         // { playerId: role }
    rolePickIndex: 0,            // index into rolePickQueue
    rolePickQueue: [],           // built after draft completes
    // UI state
    channelId: null,
    draftMessageId: null,
    roleMessageId: null,
    createdAt: Date.now(),
    votes: { cancel: new Set() },
  };

  lobbies.set(id, lobby);
  return lobby;
}

function getLobby(lobbyId) {
  return lobbies.get(lobbyId) || null;
}

function getLobbyByGuild(guildId) {
  for (const [, lobby] of lobbies) {
    if (lobby.guildId === guildId && lobby.status !== 'finished') return lobby;
  }
  return null;
}

/**
 * Captain picks a player from the draft pool.
 * Each captain picks 4 players (captain themselves = slot 1).
 * Snake order: C1 → C2 → C2 → C1 → C1 → C2 → C2 → C1
 * (first pick each side, then pairs)
 */
function draftPlayer(lobby, captainId, targetId) {
  if (lobby.status !== 'drafting') return { ok: false, reason: 'wrong_phase' };
  if (lobby.currentPick !== captainId) return { ok: false, reason: 'not_your_turn' };

  const idx = lobby.draftPool.findIndex(p => p.id === targetId);
  if (idx === -1) return { ok: false, reason: 'player_not_in_pool' };

  const [drafted] = lobby.draftPool.splice(idx, 1);

  if (captainId === lobby.captain1.id) {
    lobby.team1.push(drafted);
  } else {
    lobby.team2.push(drafted);
  }

  lobby.pickNumber++;

  // Draft complete: each team has 5 (captain + 4 picks)
  if (lobby.team1.length === 5 && lobby.team2.length === 5) {
    lobby.status = 'assigning_roles';
    // Build role queue: C1 assigns roles to all of Team1, then C2 assigns Team2
    lobby.rolePickQueue = [
      ...lobby.team1.map(p => ({ captainId: lobby.captain1.id, playerId: p.id, team: 1 })),
      ...lobby.team2.map(p => ({ captainId: lobby.captain2.id, playerId: p.id, team: 2 })),
    ];
    lobby.rolePickIndex = 0;
    return { ok: true, draftComplete: true };
  }

  // Snake draft turn order
  // Picks 1,4,5,8 → C1   |   Picks 2,3,6,7 → C2
  const snakeC1 = [1, 4, 5, 8];
  lobby.currentPick = snakeC1.includes(lobby.pickNumber)
    ? lobby.captain1.id
    : lobby.captain2.id;

  return { ok: true, draftComplete: false };
}

/**
 * Assign a role to the current player in the role queue.
 * Captain must click a role button for the indicated player.
 */
function assignRole(lobby, captainId, role) {
  if (lobby.status !== 'assigning_roles') return { ok: false, reason: 'wrong_phase' };

  const step = lobby.rolePickQueue[lobby.rolePickIndex];
  if (!step) return { ok: false, reason: 'no_more_assignments' };
  if (step.captainId !== captainId) return { ok: false, reason: 'not_your_turn' };

  // Check role not already used on this team
  const usedOnTeam = Object.entries(lobby.roleAssignments)
    .filter(([pid]) => {
      const inTeam1 = lobby.team1.some(p => p.id === pid);
      return step.team === 1 ? inTeam1 : !inTeam1;
    })
    .map(([, r]) => r);

  if (usedOnTeam.includes(role)) return { ok: false, reason: 'role_taken' };

  lobby.roleAssignments[step.playerId] = role;
  lobby.rolePickIndex++;

  if (lobby.rolePickIndex >= lobby.rolePickQueue.length) {
    lobby.status = 'ready';
    return { ok: true, allAssigned: true };
  }

  return { ok: true, allAssigned: false };
}

function getUsedRolesForCurrentStep(lobby) {
  const step = lobby.rolePickQueue[lobby.rolePickIndex];
  if (!step) return [];
  return Object.entries(lobby.roleAssignments)
    .filter(([pid]) => {
      const inTeam1 = lobby.team1.some(p => p.id === pid);
      return step.team === 1 ? inTeam1 : !inTeam1;
    })
    .map(([, r]) => r);
}

function finishLobby(lobbyId) {
  const lobby = lobbies.get(lobbyId);
  if (lobby) lobby.status = 'finished';
}

// ─── Config ───────────────────────────────────────────────────────────────────

function getConfig(guildId) {
  if (!configs.has(guildId)) {
    configs.set(guildId, { queueChannelId: null, adminRoleId: null });
  }
  return configs.get(guildId);
}

function setConfig(guildId, key, value) {
  const cfg = getConfig(guildId);
  cfg[key] = value;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  ROLES,
  LP_TABLE,
  getLP,
  selectCaptainsByLP,
  getQueue,
  addToQueue,
  removeFromQueue,
  clearQueue,
  createLobby,
  getLobby,
  getLobbyByGuild,
  draftPlayer,
  assignRole,
  getUsedRolesForCurrentStep,
  finishLobby,
  getConfig,
  setConfig,
};
