// Baixa o som de um link do MyInstants (https://www.myinstants.com/...).
// Por segurança, só acessa myinstants.com por HTTPS, com limite de redirecionamentos,
// de tempo e de tamanho. Ideia e regras inspiradas no StikSound
// (https://github.com/SilverFeit/StikSound, MIT OR Apache-2.0).

const ALLOWED_HOSTS = ['www.myinstants.com', 'myinstants.com'];
const MAX_REDIRECTS = 2;
const TIMEOUT_MS = 20000;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_PAGE_BYTES = 3 * 1024 * 1024;

const URL_RE = /https?:\/\/(?:www\.)?myinstants\.com\/[^\s<>"']+/i;

class MyInstantsError extends Error {}

function validateUrl(raw) {
    let url;
    try {
        url = new URL(String(raw).trim());
    } catch (_) {
        throw new MyInstantsError('Link inválido.');
    }
    if (url.protocol !== 'https:') url.protocol = 'https:';
    if (url.username || url.password) throw new MyInstantsError('Link inválido.');
    if (url.port && url.port !== '443') throw new MyInstantsError('Link inválido.');
    if (!ALLOWED_HOSTS.includes(url.hostname.toLowerCase())) {
        throw new MyInstantsError('Só aceito links do myinstants.com.');
    }
    return url;
}

// Faz a requisição seguindo no máximo MAX_REDIRECTS, sempre dentro do myinstants.com
async function guardedFetch(rawUrl, maxBytes) {
    let url = validateUrl(rawUrl);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const res = await fetch(url, {
            redirect: 'manual',
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: { 'User-Agent': 'Mozilla/5.0 (kuebot; +https://github.com/kauebbs/StickerWPPmaker)' },
        });
        if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
            url = validateUrl(new URL(res.headers.get('location'), url).toString());
            continue;
        }
        if (!res.ok) throw new MyInstantsError(`O MyInstants respondeu com erro ${res.status}.`);

        const declared = Number(res.headers.get('content-length') || 0);
        if (declared > maxBytes) throw new MyInstantsError('Esse som é grande demais.');

        const chunks = [];
        let total = 0;
        for await (const chunk of res.body) {
            total += chunk.length;
            if (total > maxBytes) throw new MyInstantsError('Esse som é grande demais.');
            chunks.push(chunk);
        }
        return { url, buffer: Buffer.concat(chunks), contentType: res.headers.get('content-type') || '' };
    }
    throw new MyInstantsError('Redirecionamentos demais.');
}

const MEDIA_RE = /(\/media\/sounds\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+\.(?:mp3|wav|ogg|m4a))/i;
const TITLE_RE = /<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i;

function mimeFromPath(p) {
    if (/\.wav$/i.test(p)) return 'audio/wav';
    if (/\.ogg$/i.test(p)) return 'audio/ogg';
    if (/\.m4a$/i.test(p)) return 'audio/mp4';
    return 'audio/mpeg';
}

// Encontra um link do MyInstants dentro de um texto e devolve { url, rest }
function findMyInstantsUrl(text) {
    const m = String(text || '').match(URL_RE);
    if (!m) return { url: null, rest: text };
    return { url: m[0], rest: (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim() };
}

async function downloadMyInstants(rawUrl) {
    const url = validateUrl(rawUrl);
    let mediaPath;
    let title = null;

    if (/^\/media\/sounds\//i.test(url.pathname)) {
        mediaPath = url.pathname;
    } else {
        const page = await guardedFetch(url.toString(), MAX_PAGE_BYTES);
        const html = page.buffer.toString('utf8');
        const media = html.match(MEDIA_RE);
        if (!media) throw new MyInstantsError('Não achei o som nessa página do MyInstants.');
        mediaPath = media[1];
        const t = html.match(TITLE_RE);
        if (t) title = t[1].replace(/\s*[-|]\s*Myinstants.*$/i, '').trim().slice(0, 120) || null;
    }

    const audio = await guardedFetch(`https://www.myinstants.com${mediaPath}`, MAX_AUDIO_BYTES);
    return { buffer: audio.buffer, mimetype: mimeFromPath(mediaPath), title };
}

module.exports = { downloadMyInstants, findMyInstantsUrl, validateUrl, MyInstantsError };
