const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config.json');
const examplePath = path.join(__dirname, '..', 'config.example.json');

let config = null;

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, configPath);
    } else {
      return { api: {}, pet: {}, voice: {} };
    }
  }
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return config;
}

function saveConfig(newConfig) {
  config = newConfig;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  return true;
}

function getConfig() {
  if (!config) loadConfig();
  return config;
}

module.exports = { loadConfig, saveConfig, getConfig };
