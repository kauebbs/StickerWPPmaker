// Conversões de mídia: imagem -> figurinha, vídeo/GIF -> figurinha animada,
// texto -> figurinha (estática ou animada) e figurinha/vídeo -> GIF.

const sharp = require('sharp');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const SIZE = 512;

// ---------------------------------------------------------------------------
// FFmpeg
// ---------------------------------------------------------------------------

function resolveFfmpeg() {
    if (config.ffmpegPath) return config.ffmpegPath;
    try {
        const p = require('ffmpeg-static');
        if (p) return p;
    } catch (_) { /* não instalado */ }
    return 'ffmpeg';
}

const FFMPEG = resolveFfmpeg();

function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true });
        let stderr = '';
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('error', (err) => {
            if (err.code === 'ENOENT') {
                reject(new Error('FFmpeg não encontrado. Rode "npm install" ou instale o FFmpeg (winget install ffmpeg).'));
            } else reject(err);
        });
        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`FFmpeg falhou (código ${code}): ${stderr.trim().slice(-600)}`));
        });
    });
}

// Pasta temporária que se apaga sozinha no final
async function withTempDir(fn) {
    const dir = path.join(os.tmpdir(), `kuebot-${crypto.randomBytes(6).toString('hex')}`);
    await fs.mkdir(dir, { recursive: true });
    try {
        return await fn(dir);
    } finally {
        fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
}

function extFromMime(mimetype = '') {
    if (mimetype.includes('gif')) return '.gif';
    if (mimetype.includes('webm')) return '.webm';
    if (mimetype.includes('quicktime')) return '.mov';
    if (mimetype.includes('webp')) return '.webp';
    if (mimetype.includes('3gpp')) return '.3gp';
    if (mimetype.includes('ogg')) return '.ogg';
    if (mimetype.includes('mpeg') || mimetype.includes('mp3')) return '.mp3';
    if (mimetype.includes('aac')) return '.aac';
    if (mimetype.includes('wav')) return '.wav';
    if (mimetype.includes('audio/mp4') || mimetype.includes('m4a')) return '.m4a';
    if (mimetype.includes('opus')) return '.opus';
    return '.mp4';
}

// O FFmpeg não lê WebP animado: extraímos os quadros com o sharp e
// passamos para o FFmpeg como sequência de imagens.
async function webpToFrames(buffer, dir, background) {
    let img = sharp(buffer, { animated: true });
    if (background) img = img.flatten({ background });
    const meta = await sharp(buffer, { animated: true }).metadata();
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pages = meta.pages || 1;
    const h = meta.pageHeight || info.height;
    const frameBytes = info.width * h * 4;
    const framesDir = path.join(dir, 'webp_frames');
    await fs.mkdir(framesDir, { recursive: true });
    await Promise.all(Array.from({ length: pages }, (_, i) =>
        sharp(data.subarray(i * frameBytes, (i + 1) * frameBytes), { raw: { width: info.width, height: h, channels: 4 } })
            .png({ compressionLevel: 1 })
            .toFile(path.join(framesDir, `w_${String(i).padStart(4, '0')}.png`))));
    const delays = (meta.delay && meta.delay.length) ? meta.delay : [100];
    const avg = delays.reduce((a, b) => a + b, 0) / delays.length || 100;
    const fps = Math.min(30, Math.max(1, Math.round(1000 / avg)));
    return ['-framerate', String(fps), '-i', path.join(framesDir, 'w_%04d.png')];
}

async function isAnimatedWebp(buffer) {
    try {
        const meta = await sharp(buffer, { animated: true }).metadata();
        return (meta.pages || 1) > 1;
    } catch (_) {
        return false;
    }
}

// Prepara a mídia de entrada e devolve os argumentos de entrada do FFmpeg
// (com o -ss de início, quando houver)
async function inputArgs(dir, buffer, mimetype, start = 0, background) {
    const ss = start > 0 ? ['-ss', String(start)] : [];
    if (mimetype.includes('webp')) {
        const args = await webpToFrames(buffer, dir, background);
        // Em sequência de imagens o -ss funciona melhor depois da entrada
        return { pre: args, post: ss };
    }
    const file = path.join(dir, `input${extFromMime(mimetype)}`);
    await fs.writeFile(file, buffer);
    return { pre: [...ss, '-i', file], post: [] };
}

// ---------------------------------------------------------------------------
// Texto em SVG
// ---------------------------------------------------------------------------

const FONT = "'Arial Black', Impact, 'Segoe UI Black', Arial, 'DejaVu Sans', sans-serif";

const COLORS = {
    branco: '#ffffff', preto: '#111111', vermelho: '#ff2d2d', azul: '#2d8cff',
    verde: '#2ee66b', amarelo: '#ffe11a', rosa: '#ff5ec4', roxo: '#9b5cff',
    laranja: '#ff8c1a', ciano: '#1ae5ff', dourado: '#ffc83d',
};

function escapeXml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function wrapText(text, maxChars) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (let w of words) {
        while ([...w].length > maxChars) {
            if (cur) { lines.push(cur); cur = ''; }
            const chars = [...w];
            lines.push(chars.slice(0, maxChars).join(''));
            w = chars.slice(maxChars).join('');
        }
        if (!w) continue;
        if (!cur) cur = w;
        else if ([...(cur + ' ' + w)].length <= maxChars) cur += ' ' + w;
        else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
}

// Escolhe o maior tamanho de fonte que faz o texto caber sem quebrar palavras
function fitText(text, { width, maxLines, maxFont, minFont }) {
    const longestWord = Math.max(1, ...text.split(/\s+/).map((w) => [...w].length));
    for (let size = maxFont; size >= minFont; size -= 4) {
        const maxChars = Math.max(1, Math.floor(width / (size * 0.62)));
        if (longestWord > maxChars && size - 4 >= minFont) continue;
        const lines = wrapText(text, maxChars);
        if (lines.length <= maxLines) return { size, lines };
    }
    const maxChars = Math.max(1, Math.floor(width / (minFont * 0.62)));
    return { size: minFont, lines: wrapText(text, maxChars).slice(0, maxLines) };
}

function strokedLines(lines, { size, ys, fill, stroke, x = 0 }) {
    const sw = Math.max(4, Math.round(size * 0.18));
    const outline = lines.map((l, i) =>
        `<text x="${x}" y="${ys[i]}" fill="${stroke}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round">${escapeXml(l)}</text>`).join('');
    const body = lines.map((l, i) =>
        `<text x="${x}" y="${ys[i]}" fill="${fill}">${escapeXml(l)}</text>`).join('');
    return outline + body;
}

// Legenda estilo meme na parte de baixo da figurinha (PNG transparente 512x512)
async function captionOverlay(caption, { color = '#ffffff' } = {}) {
    const { size, lines } = fitText(caption, { width: SIZE - 32, maxLines: 3, maxFont: 64, minFont: 28 });
    const lh = Math.round(size * 1.12);
    const bottom = SIZE - 18;
    const ys = lines.map((_, i) => bottom - (lines.length - 1 - i) * lh - Math.round(size * 0.18));
    const stroke = color.toLowerCase() === '#111111' ? '#ffffff' : '#000000';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
<g font-family="${FONT}" font-weight="900" font-size="${size}" text-anchor="middle">
${strokedLines(lines, { size, ys, fill: color, stroke, x: SIZE / 2 })}
</g></svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
}

// Um quadro de texto grande e centralizado (usado em !texto e !gif)
function textFrameSvg(layout, { fill, stroke = '#000000', scale = 1, dx = 0, dy = 0, rotate = 0, visible = Infinity, cursor = false, opacity = 1 }) {
    const { size, lines } = layout;
    const lh = Math.round(size * 1.1);
    const ys = lines.map((_, i) => Math.round((i - (lines.length - 1) / 2) * lh + size * 0.36));

    // Efeito de digitação: mostra só os primeiros "visible" caracteres
    let remaining = visible;
    const shown = lines.map((l) => {
        const chars = [...l];
        const take = Math.max(0, Math.min(chars.length, remaining));
        remaining -= take;
        return chars.slice(0, take).join('');
    });
    if (cursor) {
        let idx = shown.findIndex((s, i) => [...s].length < [...lines[i]].length);
        if (idx === -1) idx = shown.length - 1;
        shown[idx] = shown[idx] + '▌';
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
<g transform="translate(${SIZE / 2 + dx} ${SIZE / 2 + dy}) rotate(${rotate}) scale(${scale})" opacity="${opacity}"
   font-family="${FONT}" font-weight="900" font-size="${size}" text-anchor="middle">
${strokedLines(shown, { size, ys, fill, stroke })}
</g></svg>`;
}

function textLayout(text) {
    return fitText(text, { width: SIZE - 60, maxLines: 5, maxFont: 120, minFont: 30 });
}

// ---------------------------------------------------------------------------
// Imagem -> figurinha estática
// ---------------------------------------------------------------------------

const MODES = {
    esticar: 'fill',
    cortar: 'cover',
    redondo: 'cover',
    ajustar: 'contain',
};

function circleMaskSvg(bg = false) {
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
${bg ? `<rect width="${SIZE}" height="${SIZE}" fill="#000"/>` : ''}
<circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}" fill="#fff"/></svg>`);
}

async function encodeStaticWebp(pngBuffer) {
    const max = config.staticMaxKB * 1024;
    let out;
    for (const quality of [92, 82, 72, 62, 50, 40, 30]) {
        out = await sharp(pngBuffer).webp({ quality, effort: 5 }).toBuffer();
        if (out.length <= max) break;
    }
    return out;
}

// Imagem 512x512 com transparência (modo, recorte redondo e legenda aplicados)
async function renderStaticPng(buffer, { mode = 'esticar', caption = '', color } = {}) {
    const fit = MODES[mode] || 'fill';
    let png = await sharp(buffer, { animated: false })
        .rotate() // respeita a orientação da foto do celular
        .ensureAlpha()
        .resize(SIZE, SIZE, { fit, position: 'centre', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

    if (mode === 'redondo') png = await sharp(png).composite([{ input: circleMaskSvg(), blend: 'dest-in' }]).png().toBuffer();
    if (caption) {
        png = await sharp(png).composite([{ input: await captionOverlay(caption, { color }) }]).png().toBuffer();
    }
    return png;
}

async function imageToSticker(buffer, opts = {}) {
    return encodeStaticWebp(await renderStaticPng(buffer, opts));
}

// ---------------------------------------------------------------------------
// Vídeo / GIF -> figurinha animada
// ---------------------------------------------------------------------------

function modeFilter(mode) {
    switch (mode) {
        case 'cortar':
        case 'redondo':
            return `scale=${SIZE}:${SIZE}:force_original_aspect_ratio=increase:flags=lanczos,crop=${SIZE}:${SIZE}`;
        case 'ajustar':
            return `scale=${SIZE}:${SIZE}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${SIZE}:${SIZE}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`;
        case 'esticar':
        default:
            return `scale=${SIZE}:${SIZE}:flags=lanczos`;
    }
}

// Monta um WebP animado a partir de quadros PNG.
// (O encoder WebP do FFmpeg deixa "rastro" em áreas transparentes; o sharp não.)
// Vai reduzindo qualidade, FPS e duração até caber no limite de tamanho.
const ANIM_ATTEMPTS = [
    { fps: 15, q: 75, durFactor: 1 },
    { fps: 15, q: 55, durFactor: 1 },
    { fps: 12, q: 45, durFactor: 1 },
    { fps: 10, q: 35, durFactor: 1 },
    { fps: 10, q: 25, durFactor: 0.7 },
    { fps: 8, q: 18, durFactor: 0.5 },
];

// Para figurinha com som: a animação NUNCA fica mais curta que o som. Em vez de cortar
// a duração, diminui qualidade, quadros por segundo e o tamanho da imagem (o WhatsApp
// aceita figurinha menor que 512 px e amplia na tela).
const SOUND_ANIM_ATTEMPTS = [
    { fps: 15, q: 75 },
    { fps: 15, q: 55 },
    { fps: 12, q: 45 },
    { fps: 10, q: 35 },
    { fps: 10, q: 30, side: 448 },
    { fps: 8, q: 30, side: 384 },
    { fps: 8, q: 25, side: 320 },
    { fps: 6, q: 20, side: 256 },
    { fps: 5, q: 15, side: 192 },
];

async function encodeAnimatedWebp(framePaths, sourceFps, attempts = ANIM_ATTEMPTS) {
    const maxBytes = config.animated.maxKB * 1024;
    const frames = await Promise.all(framePaths.map((f) => fs.readFile(f)));
    const totalMs = Math.round((frames.length * 1000) / sourceFps);
    let out;
    for (const att of attempts) {
        const fps = Math.min(att.fps, sourceFps);
        const keepCount = Math.max(1, Math.round(frames.length * (att.durFactor || 1)));
        let picked = [];
        for (let i = 0; ; i++) {
            const idx = Math.round((i * sourceFps) / fps);
            if (idx >= keepCount) break;
            picked.push(frames[idx]);
        }
        if (att.side && att.side < SIZE) {
            picked = await Promise.all(picked.map((f) => sharp(f).resize(att.side, att.side).png({ compressionLevel: 1 }).toBuffer()));
        }
        // Tempo de cada quadro somando exatamente a duração original (sem ganhar nem perder ms)
        const keptMs = Math.round(totalMs * (keepCount / frames.length));
        const delay = picked.map((_, k) => Math.round(((k + 1) * keptMs) / picked.length) - Math.round((k * keptMs) / picked.length));
        out = await sharp(picked, { join: { animated: true } })
            .webp({ quality: att.q, effort: 4, loop: 0, delay })
            .toBuffer();
        if (out.length <= maxBytes) break;
    }
    return out;
}

// Duração total (s) e lado (px) de uma figurinha animada
async function animatedInfo(webp) {
    const m = await sharp(webp, { animated: true }).metadata();
    const ms = (m.delay || []).reduce((a, b) => a + b, 0);
    return { seconds: ms / 1000, side: m.width, frames: m.pages || 1 };
}

// Monta os filtros do FFmpeg para a entrada de vídeo [0:v]: FPS, modo (esticar/cortar/...),
// recorte redondo e legenda. Devolve as entradas extras e o nome da saída do filtro.
async function stickerFilterGraph(dir, { mode, caption, color, fps, firstInput = 1 }) {
    const extraInputs = [];
    let n = firstInput;
    let graph = `[0:v]fps=${fps},format=rgba,${modeFilter(mode)},setsar=1[v0]`;
    let cur = 'v0';

    if (mode === 'redondo') {
        const maskFile = path.join(dir, 'mask.png');
        await sharp(circleMaskSvg(true)).greyscale().png().toFile(maskFile);
        extraInputs.push('-loop', '1', '-i', maskFile);
        graph += `;[${n}:v]format=gray,scale=${SIZE}:${SIZE}[m];[${cur}][m]alphamerge[v1]`;
        cur = 'v1';
        n++;
    }
    if (caption) {
        const capFile = path.join(dir, 'caption.png');
        await fs.writeFile(capFile, await captionOverlay(caption, { color }));
        extraInputs.push('-loop', '1', '-i', capFile);
        graph += `;[${cur}][${n}:v]overlay=0:0:shortest=1:format=auto[v2]`;
        cur = 'v2';
        n++;
    }
    return { extraInputs, graph, out: cur, nextInput: n };
}

async function videoToSticker(buffer, mimetype, { mode = 'esticar', caption = '', color, start = 0, duration, keepDuration = false } = {}) {
    const dur = Math.min(duration || config.animated.defaultDuration, config.animated.maxDuration);
    const FPS = 15;

    return withTempDir(async (dir) => {
        const input = await inputArgs(dir, buffer, mimetype, start);
        const { extraInputs, graph, out } = await stickerFilterGraph(dir, { mode, caption, color, fps: FPS });

        const framesDir = path.join(dir, 'frames');
        await fs.mkdir(framesDir);
        await runFfmpeg([
            ...input.pre,
            ...extraInputs,
            '-filter_complex', graph,
            '-map', `[${out}]`,
            ...input.post,
            '-t', String(dur),
            '-an',
            '-frames:v', String(Math.ceil(dur * FPS)),
            path.join(framesDir, 'f_%04d.png'),
        ]);

        const files = (await fs.readdir(framesDir)).filter((f) => f.endsWith('.png')).sort();
        if (!files.length) throw new Error('Nenhum quadro extraído (o início escolhido passa do fim do vídeo?)');
        return encodeAnimatedWebp(files.map((f) => path.join(framesDir, f)), FPS, keepDuration ? SOUND_ANIM_ATTEMPTS : ANIM_ATTEMPTS);
    });
}

// Um quadro do vídeo (no segundo "start") -> figurinha parada
async function videoFrameToSticker(buffer, mimetype, { mode, caption, color, start = 0 } = {}) {
    return withTempDir(async (dir) => {
        const input = await inputArgs(dir, buffer, mimetype, start);
        const frame = path.join(dir, 'quadro.png');
        await runFfmpeg([...input.pre, ...input.post, '-frames:v', '1', frame]);
        return imageToSticker(await fs.readFile(frame), { mode, caption, color });
    });
}

// ---------------------------------------------------------------------------
// Trecho mais alto do áudio (ideia do StikSound: efeitos sonoros costumam ter
// silêncio antes/depois; a janela com mais energia é um começo melhor)
// ---------------------------------------------------------------------------

const PCM_RATE = 8000;

async function decodePcm(buffer, mimetype, maxSeconds = 180) {
    return withTempDir(async (dir) => {
        const file = path.join(dir, `audio${extFromMime(mimetype)}`);
        await fs.writeFile(file, buffer);
        const raw = path.join(dir, 'audio.f32');
        try {
            await runFfmpeg(['-i', file, '-t', String(maxSeconds), '-map', '0:a:0', '-ac', '1', '-ar', String(PCM_RATE), '-f', 'f32le', raw]);
        } catch (err) {
            if (/matches no streams|does not contain any stream/i.test(err.message)) throw new NoAudioError('sem áudio');
            throw err;
        }
        const data = await fs.readFile(raw);
        return new Float32Array(data.buffer, data.byteOffset, Math.floor(data.length / 4));
    });
}

// Segundo em que começa a janela de "windowSec" com mais energia
function loudestWindowStart(samples, windowSec, rate = PCM_RATE) {
    const total = samples.length / rate;
    if (total <= windowSec) return 0;
    const block = Math.max(1, Math.round(rate * 0.02)); // blocos de 20 ms
    const blocks = Math.floor(samples.length / block);
    const energy = new Float64Array(blocks);
    for (let b = 0; b < blocks; b++) {
        let sum = 0;
        for (let i = b * block, end = i + block; i < end; i++) sum += samples[i] * samples[i];
        energy[b] = sum;
    }
    const win = Math.min(blocks, Math.round(windowSec / 0.02));
    let cur = 0;
    for (let b = 0; b < win; b++) cur += energy[b];
    let best = cur;
    let bestStart = 0;
    for (let start = 1; start + win <= blocks; start++) {
        cur += energy[start + win - 1] - energy[start - 1];
        if (cur > best * 1.0001) { best = cur; bestStart = start; }
    }
    return Math.min(bestStart * 0.02, total - windowSec);
}

async function findLoudestStart(buffer, mimetype, windowSec) {
    const samples = await decodePcm(buffer, mimetype);
    return +loudestWindowStart(samples, windowSec).toFixed(2);
}

// ---------------------------------------------------------------------------
// Texto -> figurinha
// ---------------------------------------------------------------------------

const EFFECTS = ['arcoiris', 'pulsar', 'tremer', 'piscar', 'digitar', 'balancar', 'neon'];

function framesForEffect(effect, layout, color) {
    const frames = [];
    const N = 24;
    const base = color || '#ffffff';
    const palette = ['#ff2d2d', '#ffe11a', '#2ee66b', '#2d8cff', '#ff5ec4', '#ffffff'];
    const rand = (a) => (Math.random() * 2 - 1) * a;

    switch (effect) {
        case 'pulsar':
            for (let i = 0; i < N; i++) {
                const t = (i / N) * Math.PI * 2;
                frames.push({ fill: color || '#ffe11a', scale: 0.92 + 0.12 * Math.sin(t) });
            }
            break;
        case 'tremer':
            for (let i = 0; i < 16; i++) {
                frames.push({ fill: color || (i % 4 < 2 ? '#ff2d2d' : '#ffffff'), dx: rand(10), dy: rand(10), rotate: rand(4) });
            }
            break;
        case 'piscar':
            for (let i = 0; i < 18; i++) {
                frames.push({ fill: color ? (i % 6 < 3 ? color : '#ffffff') : palette[Math.floor(i / 3) % palette.length] });
            }
            break;
        case 'balancar':
            for (let i = 0; i < N; i++) {
                const t = (i / N) * Math.PI * 2;
                frames.push({ fill: color || '#1ae5ff', rotate: 9 * Math.sin(t), dy: 6 * Math.cos(t * 2) });
            }
            break;
        case 'neon':
            for (let i = 0; i < N; i++) {
                const flick = [3, 4, 11, 17].includes(i);
                frames.push({ fill: flick ? '#333333' : (color || '#ff5ec4'), stroke: flick ? '#000000' : '#ffffff', opacity: flick ? 0.6 : 1 });
            }
            break;
        case 'digitar': {
            const total = layout.lines.reduce((n, l) => n + [...l].length, 0);
            const step = Math.max(1, Math.ceil(total / 36));
            for (let v = 0; v < total; v += step) frames.push({ fill: base, visible: v, cursor: true });
            for (let i = 0; i < 14; i++) frames.push({ fill: base, visible: total, cursor: i % 6 < 3 });
            break;
        }
        case 'arcoiris':
        default:
            for (let i = 0; i < N; i++) {
                const t = i / N;
                frames.push({ fill: `hsl(${Math.round(t * 360)}, 100%, 60%)`, scale: 1 + 0.05 * Math.sin(t * Math.PI * 2) });
            }
    }
    return frames;
}

async function textToSticker(text, { color } = {}) {
    const layout = textLayout(text);
    const svg = textFrameSvg(layout, { fill: color || '#ffffff', stroke: color === '#111111' ? '#ffffff' : '#000000' });
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return encodeStaticWebp(png);
}

async function textToAnimatedSticker(text, { effect = 'arcoiris', color } = {}) {
    const layout = textLayout(text);
    const frames = framesForEffect(effect, layout, color);

    return withTempDir(async (dir) => {
        const files = await Promise.all(frames.map(async (f, i) => {
            const file = path.join(dir, `f_${String(i).padStart(3, '0')}.png`);
            await sharp(Buffer.from(textFrameSvg(layout, f))).png().toFile(file);
            return file;
        }));
        return encodeAnimatedWebp(files, 12, [
            { fps: 12, q: 80 }, { fps: 12, q: 60 }, { fps: 12, q: 40 }, { fps: 12, q: 25 },
        ]);
    });
}

// ---------------------------------------------------------------------------
// Figurinha / vídeo -> GIF
// ---------------------------------------------------------------------------

// MP4 sem áudio e em loop: é assim que o WhatsApp entende "GIF"
async function toGifVideo(buffer, mimetype, { start = 0, duration } = {}) {
    const dur = Math.min(duration || config.gif.maxDuration, config.gif.maxDuration);
    const w = config.gif.width;
    return withTempDir(async (dir) => {
        const input = await inputArgs(dir, buffer, mimetype, start, '#ffffff');
        const output = path.join(dir, 'gif.mp4');
        await runFfmpeg([
            ...input.pre,
            ...input.post,
            '-t', String(dur),
            '-an',
            '-vf', `scale='min(${w},iw)':-2:flags=lanczos,format=yuv420p`,
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
            '-movflags', '+faststart',
            output,
        ]);
        return fs.readFile(output);
    });
}

// Arquivo .gif de verdade (para baixar/usar fora do WhatsApp)
async function toGifFile(buffer, mimetype, { start = 0, duration } = {}) {
    const w = Math.min(config.gif.width, 400);
    const dur = Math.min(duration || config.gif.maxDuration, config.gif.maxDuration);
    return withTempDir(async (dir) => {
        const input = await inputArgs(dir, buffer, mimetype, start, '#ffffff');
        const output = path.join(dir, 'saida.gif');
        await runFfmpeg([
            ...input.pre,
            ...input.post,
            '-t', String(dur),
            '-filter_complex', `fps=12,scale='min(${w},iw)':-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
            '-loop', '0',
            output,
        ]);
        return fs.readFile(output);
    });
}

// Áudio de um vídeo ou de um áudio -> mensagem de voz (OGG/Opus, como o WhatsApp grava)
class NoAudioError extends Error {}

async function extractVoiceNote(buffer, mimetype, { start = 0, duration, maxDuration } = {}) {
    const cap = maxDuration || config.sound.maxDuration;
    const dur = Math.min(duration || cap, cap);
    return withTempDir(async (dir) => {
        const file = path.join(dir, `input${extFromMime(mimetype)}`);
        await fs.writeFile(file, buffer);
        const wav = path.join(dir, 'audio.wav');
        const output = path.join(dir, 'audio.ogg');
        try {
            // Etapa 1: PCM mono 48 kHz começando exatamente no zero.
            // Vídeos de celular costumam ter o áudio começando um pouco depois do vídeo
            // (atraso do AAC, listas de edição do iPhone). O aresample preenche esse começo
            // com silêncio (mantém a sincronia) e o Ogg final não fica com "buraco" no início,
            // que faz o WhatsApp mostrar "Couldn't play sticker sound".
            await runFfmpeg([
                ...(start > 0 ? ['-ss', String(start)] : []),
                '-i', file,
                '-map', '0:a:0', '-vn', '-sn', '-dn', '-map_metadata', '-1',
                '-af', 'aresample=48000:async=1:first_pts=0,asetpts=PTS-STARTPTS',
                '-ac', '1', '-ar', '48000',
                '-t', String(dur),
                '-c:a', 'pcm_s16le',
                wav,
            ]);
        } catch (err) {
            if (/matches no streams|does not contain any stream|Output file is empty/i.test(err.message)) {
                throw new NoAudioError('sem áudio');
            }
            throw err;
        }
        const pcmBytes = (await fs.stat(wav)).size - 44;
        if (pcmBytes < 48000 * 2 * 0.1) throw new NoAudioError('sem áudio'); // menos de 0,1 s

        // Etapa 2: Opus mono, como a mensagem de voz do WhatsApp, com fade de 15 ms nas
        // pontas (corte no meio da onda vira um "clique")
        await runFfmpeg([
            '-i', wav,
            '-af', 'afade=t=in:d=0.015,areverse,afade=t=in:d=0.015,areverse',
            '-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on', '-application', 'voip', '-frame_duration', '20',
            '-ac', '1', '-ar', '48000', '-map_metadata', '-1',
            output,
        ]);
        const out = await fs.readFile(output);
        if (out.length < 200) throw new NoAudioError('sem áudio');
        return out;
    });
}

// Figurinha -> imagem PNG (primeiro quadro)
async function stickerToImage(buffer) {
    return sharp(buffer, { animated: false }).png().toBuffer();
}

module.exports = {
    MODES: Object.keys(MODES),
    EFFECTS,
    COLORS,
    FFMPEG,
    isAnimatedWebp,
    imageToSticker,
    videoToSticker,
    textToSticker,
    textToAnimatedSticker,
    toGifVideo,
    toGifFile,
    stickerToImage,
    extractVoiceNote,
    videoFrameToSticker,
    animatedInfo,
    findLoudestStart,
    loudestWindowStart,
    NoAudioError,
};
