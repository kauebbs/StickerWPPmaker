const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const config = require('./src/config');
const conv = require('./src/converter');
const { parseOptions, parseCommand, normalize } = require('./src/parse');
const access = require('./src/access');

const P = config.prefix;

// ---------------------------------------------------------------------------
// Navegador: o Chromium que vem com o puppeteer não envia vídeos (sem H.264).
// Se o Google Chrome (ou Edge) estiver instalado, usamos ele para poder mandar GIFs.
// ---------------------------------------------------------------------------

function findChrome() {
    if (config.chromePath) return config.chromePath.toLowerCase() === 'none' ? null : config.chromePath;
    const local = process.env.LOCALAPPDATA || '';
    const candidates = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(local, 'Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
    ];
    return candidates.find((p) => p && fs.existsSync(p)) || null;
}

let chromePath = findChrome();

// Sessão e cache ficam FORA da pasta do projeto (que está no OneDrive):
// o OneDrive sincronizando os arquivos do navegador deixa o WhatsApp Web lentíssimo.
fs.mkdirSync(config.dataDir, { recursive: true });

// Qual versão do WhatsApp Web carregar (ver waWebVersions em src/config.js)
function applyWebVersion(version) {
    if (!version || version === 'latest') {
        client.options.webVersionCache = { type: 'local', path: path.join(config.dataDir, 'cache') };
        return 'mais recente';
    }
    client.options.webVersion = version;
    client.options.webVersionCache = { type: 'remote', remotePath: config.waWebVersionUrl, strict: true };
    return version;
}

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(config.dataDir, 'sessao') }),
    webVersionCache: { type: 'local', path: path.join(config.dataDir, 'cache') },
    authTimeoutMs: config.loadTimeoutMs,
    puppeteer: {
        headless: config.headless,
        ...(chromePath ? { executablePath: chromePath } : {}),
    },
});

// ---------------------------------------------------------------------------
// Fila simples: evita travar o PC se chegarem muitos vídeos de uma vez
// ---------------------------------------------------------------------------

let running = 0;
const queue = [];
function enqueue(fn) {
    return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        pump();
    });
}
function pump() {
    if (running >= config.maxConcurrent || !queue.length) return;
    const { fn, resolve, reject } = queue.shift();
    running++;
    fn().then(resolve, reject).finally(() => { running--; pump(); });
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

// Pega a mídia da própria mensagem ou da mensagem respondida
async function getMedia(message) {
    let source = null;
    if (message.hasMedia) source = message;
    else if (message.hasQuotedMsg) {
        const quoted = await message.getQuotedMessage();
        if (quoted && quoted.hasMedia) source = quoted;
    }
    if (!source) return null;
    const media = await source.downloadMedia();
    if (!media || !media.data) throw new UserError('Não consegui baixar essa mídia. Tente enviar de novo.');
    return { media, buffer: Buffer.from(media.data, 'base64'), mimetype: media.mimetype || '' };
}

async function mediaKind({ mimetype, buffer }) {
    if (mimetype.includes('webp')) return (await conv.isAnimatedWebp(buffer)) ? 'animated-sticker' : 'sticker';
    if (mimetype.includes('gif') || mimetype.startsWith('video')) return 'video';
    if (mimetype.startsWith('image')) return 'image';
    return null;
}

class UserError extends Error {}

async function react(message, emoji) {
    try { await message.react(emoji); } catch (_) { /* reações podem falhar em chats antigos */ }
}

function chatOf(message) {
    return message.fromMe ? message.to : message.from;
}

async function reply(message, content, options = {}) {
    return client.sendMessage(chatOf(message), content, { quotedMessageId: message.id._serialized, ...options });
}

async function sendSticker(message, webp, { name, author } = {}) {
    const media = new MessageMedia('image/webp', webp.toString('base64'), 'figurinha.webp');
    await reply(message, media, {
        sendMediaAsSticker: true,
        stickerName: name ?? config.stickerName,
        stickerAuthor: author ?? config.stickerAuthor,
    });
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

const MENU = `🤖 *kuebot — comandos*

🖼️ *${P}fig* — foto, vídeo ou GIF → figurinha
   Envie com a legenda ou responda a uma mídia.
   Opções (podem ser combinadas, sempre no começo):
   • modo: _esticar_ (padrão), _cortar_, _ajustar_, _redondo_
   • trecho do vídeo: _3-8_ (do 3s ao 8s) ou _4s_ (só 4s)
   • cor da legenda: _amarelo_, _vermelho_, _azul_...
   • o resto vira *legenda*
   Ex.: ${P}fig redondo 2-6 bom dia grupo

🔤 *${P}texto* frase — figurinha só de texto
   Ex.: ${P}texto amarelo sextou!

✨ *${P}animado* [efeito] frase — figurinha de texto animada
   Efeitos: ${conv.EFFECTS.join(', ')}
   Ex.: ${P}animado tremer SOCORRO

🎞️ *${P}gif* — vídeo ou figurinha animada → GIF
   Responda ao vídeo/figurinha. Aceita trecho (_2-7_).
   Use _${P}gif arquivo_ para receber o arquivo .gif

🖼️ *${P}img* — figurinha → imagem (responda à figurinha)

🏷️ *${P}renomear* Pacote | Autor — troca o nome/autor da figurinha respondida

❓ *${P}menu* — mostra esta lista`;

const OWNER_MENU = `

🔐 *Só você (dono do número) vê isto:*
🟢 *${P}ligar* — liga o bot neste chat
   _${P}ligar 2h_ — liga por 2 horas (aceita 30m, 1h30, 1d)
   _${P}ligar tudo_ — liga em todos os chats
🔴 *${P}desligar* — desliga neste chat (_${P}desligar tudo_ desliga geral)
📋 *${P}status* — onde o bot está ligado
${config.ownerAlwaysAllowed ? '\n_Seus próprios comandos funcionam mesmo com o bot desligado._' : ''}`;

const commands = {};
function command(names, handler) {
    for (const n of names) commands[n] = handler;
}

command(['menu', 'ajuda', 'help', 'comandos'], async (message) => {
    await reply(message, message.fromMe ? MENU + OWNER_MENU : MENU);
});

// Comandos que só o dono do número pode usar
const ownerCommands = {};
function ownerCommand(names, handler) {
    for (const n of names) ownerCommands[n] = handler;
}

const ALL_WORDS = ['tudo', 'todos', 'geral', 'global', 'all'];

async function chatName(message) {
    try {
        const chat = await message.getChat();
        return chat.name || 'chat';
    } catch (_) {
        return 'chat';
    }
}

ownerCommand(['ligar', 'on', 'ativar'], async (message, raw) => {
    const tokens = raw.split(/\s+/).filter(Boolean).map(normalize);
    const all = tokens.some((t) => ALL_WORDS.includes(t));
    const durTok = tokens.find((t) => !ALL_WORDS.includes(t));
    const minutes = durTok ? access.parseDuration(durTok) : null;
    if (durTok && !minutes) throw new UserError(`Não entendi o tempo "${durTok}". Use por exemplo: *${P}ligar 30m*, *${P}ligar 2h*, *${P}ligar 1d*.`);

    const name = all ? 'todos os chats' : await chatName(message);
    const entry = access.activate(all ? '*' : chatOf(message), { name, minutes });
    console.log(`🟢 Ligado em ${name} (${access.formatRemaining(entry)})`);
    await reply(message, `🟢 Bot *ligado* ${all ? 'em *todos os chats*' : 'neste chat'} ${access.formatRemaining(entry)}.\nMande *${P}menu* para ver os comandos.`);
});

ownerCommand(['desligar', 'off', 'desativar'], async (message, raw) => {
    const all = raw.split(/\s+/).map(normalize).some((t) => ALL_WORDS.includes(t));
    if (all) {
        access.deactivate('*');
        console.log('🔴 Desligado em todos os chats');
        await reply(message, '🔴 Bot *desligado em todos os chats*.');
        return;
    }
    const wasGlobal = !!access.status().global;
    access.deactivate(chatOf(message));
    console.log(`🔴 Desligado em ${await chatName(message)}`);
    await reply(message, wasGlobal
        ? `🔴 Desliguei neste chat, mas o bot continua ligado em *todos os chats*. Use *${P}desligar tudo* para desligar geral.`
        : '🔴 Bot *desligado* neste chat.');
});

ownerCommand(['status', 'onde'], async (message) => {
    const st = access.status();
    const lines = [];
    if (st.global) lines.push(`🌐 *Todos os chats* — ${access.formatRemaining(st.global)}`);
    for (const entry of Object.values(st.chats)) lines.push(`💬 ${entry.name || 'chat'} — ${access.formatRemaining(entry)}`);
    const here = access.isActive(chatOf(message)) ? '🟢 ligado' : '🔴 desligado';
    await reply(message, `📋 *Status do bot*\nNeste chat: ${here}\n\n${lines.length ? lines.join('\n') : 'Desligado em todos os chats.'}`);
});

command(['fig', 'figurinha', 's', 'sticker', 'f'], async (message, raw) => {
    const input = await getMedia(message);
    if (!input) throw new UserError(`Envie uma foto/vídeo/GIF com a legenda *${P}fig* ou responda a uma mídia com *${P}fig*.`);
    const opts = parseOptions(raw, { modes: true, time: true });
    const kind = await mediaKind(input);
    const common = { mode: opts.mode, caption: opts.text, color: opts.color };

    let webp;
    if (kind === 'image' || kind === 'sticker') {
        webp = await conv.imageToSticker(input.buffer, common);
    } else if (kind === 'video' || kind === 'animated-sticker') {
        webp = await conv.videoToSticker(input.buffer, input.mimetype, { ...common, start: opts.start, duration: opts.duration });
    } else {
        throw new UserError('Formato não suportado. Mande foto, vídeo curto ou GIF!');
    }
    await sendSticker(message, webp);
});

command(['texto', 'ttp', 'txt'], async (message, raw) => {
    const opts = parseOptions(raw);
    if (!opts.text) throw new UserError(`Escreva a frase: *${P}texto sua frase aqui*`);
    if (opts.text.length > 120) throw new UserError('Frase muito grande (máx. 120 caracteres).');
    await sendSticker(message, await conv.textToSticker(opts.text, { color: opts.color }));
});

command(['animado', 'attp', 'textogif', 'txtgif'], async (message, raw) => {
    const opts = parseOptions(raw, { effects: true });
    if (!opts.text) throw new UserError(`Escreva a frase: *${P}animado [efeito] sua frase*\nEfeitos: ${conv.EFFECTS.join(', ')}`);
    if (opts.text.length > 80) throw new UserError('Frase muito grande (máx. 80 caracteres).');
    const webp = await conv.textToAnimatedSticker(opts.text, { effect: opts.effect || 'arcoiris', color: opts.color });
    await sendSticker(message, webp);
});

command(['gif', 'paragif', 'togif'], async (message, raw) => {
    const input = await getMedia(message);
    if (!input) throw new UserError(`Responda a um vídeo ou figurinha animada com *${P}gif*.\nPara texto animado use *${P}animado sua frase*.`);
    const opts = parseOptions(raw, { time: true, colors: false, file: true });
    const kind = await mediaKind(input);
    if (kind !== 'video' && kind !== 'animated-sticker') {
        throw new UserError('Isso não é animado 😅 Responda a um vídeo, GIF ou figurinha animada.');
    }
    const range = { start: opts.start, duration: opts.duration };

    if (!opts.file && chromePath) {
        try {
            const mp4 = await conv.toGifVideo(input.buffer, input.mimetype, range);
            await reply(message, new MessageMedia('video/mp4', mp4.toString('base64'), 'gif.mp4'), { sendVideoAsGif: true });
            return;
        } catch (err) {
            console.warn('Não deu para enviar como GIF do WhatsApp, mandando arquivo .gif:', err.message);
        }
    }

    const gif = await conv.toGifFile(input.buffer, input.mimetype, range);
    await reply(message, new MessageMedia('image/gif', gif.toString('base64'), 'kuebot.gif'), { sendMediaAsDocument: true });
});

command(['img', 'toimg', 'imagem', 'foto'], async (message) => {
    const input = await getMedia(message);
    if (!input || !input.mimetype.includes('webp')) throw new UserError(`Responda a uma figurinha com *${P}img*.`);
    const png = await conv.stickerToImage(input.buffer);
    await reply(message, new MessageMedia('image/png', png.toString('base64'), 'figurinha.png'));
});

command(['renomear', 'rename', 'roubar', 'nome'], async (message, raw) => {
    const input = await getMedia(message);
    if (!input || !input.mimetype.includes('webp')) throw new UserError(`Responda a uma figurinha com *${P}renomear Pacote | Autor*.`);
    const [name, author] = raw.split('|').map((s) => s.trim());
    await sendSticker(message, input.buffer, {
        name: name || config.stickerName,
        author: author || config.stickerAuthor,
    });
});

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

client.on('qr', (qr) => {
    stopWatchdog();
    qrcode.generate(qr, { small: true });
    console.log('Escaneie o QR Code acima.');
});

client.on('loading_screen', (percent, msg) => console.log(`Carregando conversas: ${percent}% ${msg || ''}`));
client.on('authenticated', () => { console.log('QR Code aceito, carregando...'); startWatchdog(); });
client.on('auth_failure', (msg) => console.error('Falha na autenticação:', msg));

// ---------------------------------------------------------------------------
// Diagnóstico: enquanto o WhatsApp Web carrega, mostra o progresso e salva
// uma captura da tela escondida do navegador em diagnostico.png
// ---------------------------------------------------------------------------

const DIAG_FILE = path.join(__dirname, 'diagnostico.png');
let watchdog = null;

function startWatchdog() {
    stopWatchdog();
    const t0 = Date.now();
    watchdog = setInterval(async () => {
        const secs = Math.round((Date.now() - t0) / 1000);
        const page = client.pupPage;
        if (!page || page.isClosed()) {
            console.log(`  ... abrindo o navegador (${secs}s)`);
            return;
        }
        try {
            const info = await page.evaluate(() => {
                let state = null;
                try { state = window.require('WAWebSocketModel').Socket.state; } catch (_) { /* ainda não carregou */ }
                const text = (document.body && document.body.innerText || '').replace(/\s+/g, ' ').trim();
                return { state, title: document.title, url: location.href, text: text.slice(0, 120) };
            });
            console.log(`  ... ${secs}s | estado: ${info.state || 'carregando página'} | ${info.url}${info.text ? ` | "${info.text}"` : ''}`);
            if (!info.state && /\/login/.test(info.url)) {
                console.log('      (WhatsApp Web na página /login/ nova: esta versão não funciona com a biblioteca, vou tentar outra)');
            }
            await page.screenshot({ path: DIAG_FILE });
        } catch (err) {
            console.log(`  ... ${secs}s | página ocupada (${String(err.message).slice(0, 80)})`);
        }
    }, 10000);
}

function stopWatchdog() {
    if (watchdog) clearInterval(watchdog);
    watchdog = null;
}

client.on('ready', () => {
    stopWatchdog();
    console.log('Bot conectado!');
    const st = access.status();
    const active = [st.global && 'todos os chats', ...Object.values(st.chats).map((c) => c.name)].filter(Boolean);
    console.log(active.length
        ? `Ligado em: ${active.join(', ')}`
        : `O bot está DESLIGADO. Mande ${P}ligar no chat onde quer usar (só funciona vindo do seu número).`);
    console.log(`FFmpeg: ${conv.FFMPEG}`);
    console.log(chromePath
        ? `Navegador: ${chromePath} (envio de GIF ativado)`
        : 'Navegador: Chromium padrão — GIFs serão enviados como arquivo .gif (instale o Google Chrome para mandar GIF nativo).');
});

client.on('message_create', async (message) => {
    if (message.from === 'status@broadcast') return;
    const cmd = parseCommand(message.body, P);
    if (!cmd) return;

    // Comandos do dono (ligar/desligar/status): só mensagens enviadas por você
    if (ownerCommands[cmd.name]) {
        if (!message.fromMe) return;
        try {
            await ownerCommands[cmd.name](message, cmd.raw);
        } catch (err) {
            await reply(message, err instanceof UserError ? err.message : '❌ Erro ao executar o comando.').catch(() => {});
            if (!(err instanceof UserError)) console.error(err);
        }
        return;
    }

    if (!commands[cmd.name]) return;

    // Bot desligado neste chat: ignora em silêncio (a não ser que seja você)
    const allowed = access.isActive(chatOf(message)) || (message.fromMe && config.ownerAlwaysAllowed);
    if (!allowed) return;

    console.log(`\n--- ${P}${cmd.name} ${cmd.raw ? `(${cmd.raw}) ` : ''}---`);
    await react(message, '⏳');
    const started = Date.now();

    try {
        await enqueue(() => commands[cmd.name](message, cmd.raw));
        await react(message, '✅');
        console.log(`Pronto em ${((Date.now() - started) / 1000).toFixed(1)}s`);
    } catch (err) {
        await react(message, '❌');
        if (err instanceof UserError) {
            await reply(message, err.message).catch(() => {});
        } else {
            console.error('Erro ao processar:', err);
            await reply(message, '❌ Deu erro ao processar essa mídia. Tente outro arquivo ou um trecho menor.').catch(() => {});
        }
    }
});

client.on('disconnected', (reason) => {
    console.log(`WhatsApp desconectado (${reason}). Reiniciando...`);
    start();
});

// ---------------------------------------------------------------------------
// Inicialização com novas tentativas (o WhatsApp Web às vezes demora a abrir)
// ---------------------------------------------------------------------------

const MAX_TRIES = Math.max(4, config.waWebVersions.length + 1);
let starting = false;

async function start(attempt = 1) {
    if (starting) return;
    starting = true;
    console.log(attempt === 1
        ? `Abrindo o WhatsApp Web... (sessão em ${config.dataDir})`
        : `Tentativa ${attempt} de ${MAX_TRIES}...`);
    const versions = config.waWebVersions;
    const version = applyWebVersion(versions[Math.min(attempt - 1, versions.length - 1)]);
    console.log(`Navegador: ${chromePath || 'Chromium do puppeteer'} | WhatsApp Web: ${version}`);
    startWatchdog();
    try {
        await client.initialize();
        starting = false;
    } catch (err) {
        starting = false;
        stopWatchdog();
        console.error(`\n⚠️  Não conseguiu abrir o WhatsApp Web: ${err && err.message ? err.message : err}`);
        try { await client.destroy(); } catch (_) { /* navegador já fechado */ }

        if (attempt >= MAX_TRIES) {
            console.error('\nDesisti depois de várias tentativas. Verifique sua internet e rode "npm start" de novo.');
            console.error(`Dica: veja a captura em ${DIAG_FILE} ou rode com HEADLESS=false para ver a janela do navegador.`);
            process.exit(1);
        }

        // Se já tentou todas as versões com Chrome/Edge, tenta o navegador do puppeteer
        if (attempt >= config.waWebVersions.length && chromePath && !config.chromePath) {
            console.log('Trocando para o navegador padrão do puppeteer (GIFs irão como arquivo .gif).');
            chromePath = null;
            delete client.options.puppeteer.executablePath;
        }

        await new Promise((r) => setTimeout(r, 5000));
        start(attempt + 1);
    }
}

start();
