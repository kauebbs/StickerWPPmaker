// Leitura dos comandos e das opções digitadas no WhatsApp

const { COLORS } = require('./converter');

const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-_]/g, '');

const MODE_ALIASES = {
    esticar: 'esticar', esticado: 'esticar', esticada: 'esticar',
    cortar: 'cortar', cortado: 'cortar', quadrado: 'cortar', crop: 'cortar',
    ajustar: 'ajustar', original: 'ajustar', inteiro: 'ajustar', inteira: 'ajustar', bordas: 'ajustar',
    redondo: 'redondo', redonda: 'redondo', circulo: 'redondo', bola: 'redondo',
};

const EFFECT_ALIASES = {
    arcoiris: 'arcoiris', rainbow: 'arcoiris', colorido: 'arcoiris',
    pulsar: 'pulsar', pulsando: 'pulsar',
    tremer: 'tremer', tremendo: 'tremer',
    piscar: 'piscar', piscando: 'piscar', pisca: 'piscar',
    digitar: 'digitar', digitando: 'digitar', maquina: 'digitar',
    balancar: 'balancar', balancando: 'balancar',
    neon: 'neon',
};

// "5" -> 5, "1:05" -> 65, "2.5s" -> 2.5
function parseTime(s) {
    const clean = s.replace(/s$/i, '');
    if (clean.includes(':')) {
        const [m, sec] = clean.split(':');
        return Number(m) * 60 + Number(sec);
    }
    return Number(clean);
}

const TIME = '(\\d+(?::\\d{1,2})?(?:\\.\\d+)?)s?';
const RANGE_RE = new RegExp(`^${TIME}-${TIME}$`, 'i');
const DURATION_RE = /^(\d+(?:\.\d+)?)s$/i;

// Lê as opções do começo do texto; o resto vira legenda/frase.
// ex.: "redondo amarelo 3-8 bom dia" -> { mode: 'redondo', color, start: 3, duration: 5, text: 'bom dia' }
// "flags" mapeia palavras para opções liga/desliga, ex.: { mp4: 'mp4', video: 'mp4' }
function parseOptions(raw, { modes = false, time = false, colors = true, effects = false, file = false, flags = {} } = {}) {
    const tokens = raw.split(/\s+/).filter(Boolean);
    const opts = {};
    let i = 0;
    for (; i < tokens.length; i++) {
        const tok = tokens[i];
        const n = normalize(tok);
        const dot = tok.replace(/,/g, '.');
        const range = time && dot.match(RANGE_RE);
        const dur = time && dot.match(DURATION_RE);
        if (modes && !opts.mode && MODE_ALIASES[n]) opts.mode = MODE_ALIASES[n];
        else if (colors && !opts.color && COLORS[n]) opts.color = COLORS[n];
        else if (effects && !opts.effect && EFFECT_ALIASES[n]) opts.effect = EFFECT_ALIASES[n];
        else if (file && !opts.file && ['arquivo', 'documento', 'baixar'].includes(n)) opts.file = true;
        else if (flags[n] && !opts[flags[n]]) opts[flags[n]] = true;
        else if (range && opts.start === undefined) {
            const a = parseTime(range[1]);
            const b = parseTime(range[2]);
            if (!(b > a)) break;
            opts.start = a;
            opts.duration = b - a;
        } else if (dur && !opts.duration) opts.duration = Number(dur[1]);
        else break;
    }
    opts.text = tokens.slice(i).join(' ');
    return opts;
}

function parseCommand(body, prefix) {
    const text = (body || '').trim();
    if (!text.startsWith(prefix)) return null;
    const m = text.slice(prefix.length).match(/^(\S+)\s*([\s\S]*)$/);
    if (!m) return null;
    return { name: normalize(m[1]), raw: m[2].trim() };
}

module.exports = { parseOptions, parseCommand, normalize };
