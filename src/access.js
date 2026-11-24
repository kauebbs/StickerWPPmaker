// Controle de onde o bot responde.
// O bot começa DESLIGADO em todos os chats. Só o dono do número (mensagens
// enviadas por você mesmo) pode ligar/desligar. O estado fica salvo em
// bot-estado.json, então sobrevive a reinícios.

const fs = require('fs');
const path = require('path');

const STATE_FILE = process.env.BOT_STATE_FILE || path.join(__dirname, '..', 'bot-estado.json');

let state = { global: null, chats: {} };

function load() {
    try {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        state = { global: data.global || null, chats: data.chats || {} };
    } catch (_) { /* primeiro uso: tudo desligado */ }
}

function save() {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
        console.warn('Não consegui salvar o estado do bot:', err.message);
    }
}

// Uma ativação é { since, until } — until = null significa "até desligar"
const isLive = (entry) => !!entry && (entry.until == null || entry.until > Date.now());

function cleanup() {
    let changed = false;
    if (state.global && !isLive(state.global)) {
        state.global = null;
        changed = true;
        console.log('⏰ Tempo esgotado: bot desligado em todos os chats.');
    }
    for (const [id, entry] of Object.entries(state.chats)) {
        if (!isLive(entry)) {
            delete state.chats[id];
            changed = true;
            console.log(`⏰ Tempo esgotado: bot desligado em ${entry.name || id}.`);
        }
    }
    if (changed) save();
}

function isActive(chatId) {
    cleanup();
    return !!state.global || !!state.chats[chatId];
}

function activate(chatId, { name, minutes } = {}) {
    const entry = { since: Date.now(), until: minutes ? Date.now() + minutes * 60000 : null, name };
    if (chatId === '*') state.global = entry;
    else state.chats[chatId] = entry;
    save();
    return entry;
}

function deactivate(chatId) {
    if (chatId === '*') {
        state.global = null;
        state.chats = {};
    } else {
        delete state.chats[chatId];
    }
    save();
}

function status() {
    cleanup();
    return { global: state.global, chats: { ...state.chats } };
}

// "30m", "30min", "2h", "1d", "1h30" -> minutos
function parseDuration(s) {
    const m = String(s).toLowerCase().match(/^(\d+)\s*(m|min|mins|minutos?|h|hr|horas?|d|dias?)?(\d+)?$/);
    if (!m) return null;
    const n = Number(m[1]);
    const unit = (m[2] || 'm')[0];
    let minutes = unit === 'h' ? n * 60 : unit === 'd' ? n * 1440 : n;
    if (m[3] && unit === 'h') minutes += Number(m[3]);
    return minutes > 0 ? minutes : null;
}

function formatRemaining(entry) {
    if (!entry || entry.until == null) return 'até você desligar';
    const min = Math.max(1, Math.round((entry.until - Date.now()) / 60000));
    if (min < 60) return `por mais ${min} min`;
    const h = Math.floor(min / 60);
    const r = min % 60;
    return `por mais ${h}h${r ? String(r).padStart(2, '0') : ''}`;
}

load();

module.exports = { isActive, activate, deactivate, status, parseDuration, formatRemaining, STATE_FILE };
