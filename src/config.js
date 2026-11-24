const os = require('os');
const path = require('path');

// Configurações do bot. Tudo pode ser trocado por variáveis de ambiente
// (ex.: no CMD: set STICKER_AUTHOR=MeuNome && node index.js)

module.exports = {
    // Prefixo dos comandos (!fig, !gif, ...)
    prefix: process.env.BOT_PREFIX || '!',

    // O bot começa desligado; você liga com !ligar. Com isto em true, os SEUS
    // comandos (enviados do seu número) funcionam mesmo com o bot desligado.
    ownerAlwaysAllowed: (process.env.OWNER_ALWAYS_ALLOWED || 'true').toLowerCase() !== 'false',

    // Metadados padrão das figurinhas
    stickerName: process.env.STICKER_NAME || '.',
    stickerAuthor: process.env.STICKER_AUTHOR || 'kuebot',

    // Figurinhas animadas
    animated: {
        defaultDuration: Number(process.env.ANIM_DEFAULT_DURATION || 6), // segundos
        maxDuration: Number(process.env.ANIM_MAX_DURATION || 10),        // limite do WhatsApp ~10s
        maxKB: Number(process.env.ANIM_MAX_KB || 900),                   // tamanho máximo do .webp
    },

    // Figurinhas estáticas (WhatsApp recomenda até 100 KB)
    staticMaxKB: Number(process.env.STATIC_MAX_KB || 100),

    // GIFs gerados (!paragif)
    gif: {
        maxDuration: Number(process.env.GIF_MAX_DURATION || 15),
        width: Number(process.env.GIF_WIDTH || 480),
    },

    // Quantas mídias processar ao mesmo tempo
    maxConcurrent: Number(process.env.MAX_CONCURRENT || 2),

    // Caminho do Google Chrome (necessário para ENVIAR vídeos/GIFs pelo whatsapp-web.js).
    // Se vazio, o bot tenta achar o Chrome automaticamente.
    chromePath: process.env.CHROME_PATH || '',

    // Onde ficam a sessão do WhatsApp e o cache (fora do OneDrive de propósito)
    dataDir: process.env.BOT_DATA_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), 'kuebot'),

    // Quanto tempo esperar o WhatsApp Web carregar (ms) antes de tentar de novo.
    loadTimeoutMs: Number(process.env.LOAD_TIMEOUT_MS || 60000),

    // Versões do WhatsApp Web a usar, em ordem de tentativa.
    // Em 23/11/2026 o WhatsApp Web mudou e o whatsapp-web.js parou de gerar o QR Code
    // (https://github.com/wwebjs/whatsapp-web.js/issues/201988). Fixamos versões anteriores
    // à mudança. Quando a biblioteca for corrigida, use WA_WEB_VERSION=latest.
    // Ex.: set WA_WEB_VERSION=2.3000.1055837054-alpha
    waWebVersions: (process.env.WA_WEB_VERSION || '2.3000.1055837054-alpha,2.3000.1055832065-alpha,2.3000.1055816824-alpha,latest')
        .split(',').map((v) => v.trim()).filter(Boolean),
    waWebVersionUrl: process.env.WA_WEB_VERSION_URL
        || 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',

    // HEADLESS=false mostra a janela do navegador (útil para descobrir problemas)
    headless: (process.env.HEADLESS || 'true').toLowerCase() !== 'false',

    // Caminho do FFmpeg. Se vazio, usa o ffmpeg-static (instalado pelo npm) ou o do sistema.
    ffmpegPath: process.env.FFMPEG_PATH || '',
};
