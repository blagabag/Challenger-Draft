/**
 * Loads all commands into client.commands, including split-export files.
 * Call this from index.js instead of the inline loader.
 */
const fs = require('fs');
const path = require('path');

function loadCommands(client) {
  const commandsPath = path.join(__dirname, '..', 'commands');
  for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    const mod = require(path.join(commandsPath, file));

    // Single export: { data, execute }
    if (mod.data && mod.execute) {
      client.commands.set(mod.data.name, mod);
      console.log(`✅ Loaded: /${mod.data.name}`);
    } else {
      // Named exports: { leave: { data, execute }, queue: { data, execute } }
      for (const [, cmd] of Object.entries(mod)) {
        if (cmd?.data && cmd?.execute) {
          client.commands.set(cmd.data.name, cmd);
          console.log(`✅ Loaded: /${cmd.data.name}`);
        }
      }
    }
  }
}

module.exports = { loadCommands };
