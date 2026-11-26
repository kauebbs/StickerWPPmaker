// Figurinha com som de verdade (WhatsApp, liberada no Brasil em 24/11/2026).
//
// Não existe API oficial para isso. O envio usa os módulos internos do próprio WhatsApp Web,
// do mesmo jeito que a extensão "WhatsApp Audio Stickers"
// (https://github.com/KaraBala10/whatsapp-audio-stickers, licença MIT):
//   1. a figurinha .webp leva nos metadados (EXIF) o emoji 🔊 e o "sound-sha256" do áudio;
//   2. o áudio Ogg/Opus é enviado com o upload do próprio WhatsApp;
//   3. a figurinha é enviada com esse áudio anexado (stickerAudio).
// Para o WhatsApp Web aceitar, a opção de figurinha com som é ligada localmente na página
// do bot (não muda nada na sua conta nem no celular).
//
// Por ser engenharia reversa, pode parar de funcionar quando o WhatsApp Web mudar.
// Nesse caso o bot manda a figurinha e o som separados.

const crypto = require('crypto');
const webpmux = require('node-webpmux');

class SoundStickerError extends Error {}

// ---------------------------------------------------------------------------
// Metadados (EXIF) da figurinha, no formato que o WhatsApp lê
// ---------------------------------------------------------------------------

function packId(name, author) {
    const h = crypto.createHash('sha256').update(`kuebot|${name}|${author}`).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function buildExif(meta) {
    const json = Buffer.from(JSON.stringify(meta), 'utf8');
    const header = Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
        0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const exif = Buffer.concat([header, json]);
    exif.writeUIntLE(json.length, 14, 4);
    return exif;
}

async function tagSoundSticker(webp, ogg, { name = '', author = '' } = {}) {
    const soundSha = crypto.createHash('sha256').update(ogg).digest('base64');
    const meta = { 'sticker-pack-id': packId(name, author), emojis: ['🔊'], 'sound-sha256': soundSha };
    if (name) meta['sticker-pack-name'] = name;
    if (author) meta['sticker-pack-publisher'] = author;
    const img = new webpmux.Image();
    await img.load(webp);
    img.exif = buildExif(meta);
    return img.save(null);
}

// Duração real de um Ogg/Opus (último granule da página menos o pre-skip, a 48 kHz)
function oggOpusSeconds(ogg) {
    const head = ogg.indexOf(Buffer.from('OpusHead'));
    const preSkip = head >= 0 ? ogg.readUInt16LE(head + 10) : 0;
    const last = ogg.lastIndexOf(Buffer.from('OggS'));
    if (last < 0) return 0;
    const granule = Number(ogg.readBigInt64LE(last + 6));
    return Math.max(0, (granule - preSkip) / 48000);
}

// ---------------------------------------------------------------------------
// Código que roda DENTRO da página do WhatsApp Web
// ---------------------------------------------------------------------------

/* eslint-disable no-undef */
async function sendInPage({ chatId, webpB64, oggB64, seconds, isAnimated, side = 512 }) {
    const ns = (name) => {
        if (typeof window.importNamespace === 'function') {
            try { const m = window.importNamespace(name); if (m) return m; } catch (_) { /* tenta require */ }
        }
        return window.require(name);
    };
    const def = (name) => { const m = ns(name); return m && m.default !== undefined ? m.default : m; };
    const fromB64 = (b64, type) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type });
    };
    const toB64 = (v) => {
        if (v == null || typeof v === 'string') return v;
        const bytes = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer || v);
        let s = '';
        for (const b of bytes) s += String.fromCharCode(b);
        return btoa(s);
    };

    // 1) Liga a figurinha com som nesta página
    const PROPS = ['sound_stickers_consumption_enabled', 'sound_stickers_creation_enabled', 'sound_stickers_audio_playing_enabled'];
    try {
        const AB = ns('WAWebABProps');
        if (!AB.getABPropConfigValue.__kuebot) {
            const original = AB.getABPropConfigValue;
            const patched = function (name) {
                if (PROPS.includes(name)) return true;
                return original.apply(this, arguments);
            };
            patched.__kuebot = true;
            AB.getABPropConfigValue = patched;
        }
    } catch (_) { /* segue com o módulo de gating */ }

    let gating;
    try { gating = ns('WAWebSoundStickerGating'); } catch (e) {
        throw new Error(`SEM_SUPORTE: esta versão do WhatsApp Web não tem figurinha com som (${e.message})`);
    }
    try {
        if (!(gating.isSoundStickerCreationEnabled() && gating.isSoundStickerConsumptionEnabled())) {
            gating.isSoundStickerConsumptionEnabled = () => true;
            gating.isSoundStickerCreationEnabled = () => true;
            gating.isSoundStickerPlaybackEnabled = () => true;
        }
    } catch (_) { /* tenta assim mesmo */ }

    const chat = await window.WWebJS.getChat(chatId, { getAsModel: false });
    if (!chat) throw new Error('Chat não encontrado');

    // 2) Envia o áudio com o upload do WhatsApp
    const ogg = fromB64(oggB64, 'audio/ogg; codecs=opus');
    const MEDIA_TYPES = ns('WAWebMmsMediaTypes').MEDIA_TYPES;
    let uploadOrigin = 1;
    try { uploadOrigin = def('WAWebMediaGetUploadOriginForChat')(chat); } catch (_) { /* padrão */ }
    const noopQpl = new Proxy({}, { get: () => () => undefined });
    const params = {
        blob: ogg, type: MEDIA_TYPES.AUDIO, signal: new AbortController().signal, uploadQpl: noopQpl,
        uploadOrigin, fileOrigin: undefined, userUploadAttemptCount: 0, forwardedFromWeb: false,
        isViewOnce: false, isHdPhoto: false,
    };
    let res;
    try {
        const metrics = def('WAWebCreateMediaUploadMetrics')(params);
        res = await def('WAWebUploadManagerMainThread').encryptAndUpload(params, metrics);
    } catch (_) {
        res = await def('WAWebUploadManager').encryptAndUpload(params);
    }
    const oggBytes = new Uint8Array(await ogg.arrayBuffer());
    const filehash = toB64(new Uint8Array(await crypto.subtle.digest('SHA-256', oggBytes)));
    const stickerAudio = {
        deprecatedMms3Url: res.url || undefined,
        directPath: res.directPath,
        mediaKey: toB64(res.mediaKey),
        mediaKeyTimestamp: res.mediaKeyTimestamp,
        filehash,
        encFilehash: toB64(res.encFilehash),
        size: oggBytes.length,
        mimetype: 'audio/ogg; codecs=opus',
        duration: seconds,
    };
    let complete = null;
    try { complete = ns('WAWebSoundStickerUtils').isCompleteStickerAudio(stickerAudio); } catch (e) { complete = `erro: ${e.message}`; }
    if (complete !== true) throw new Error(`O WhatsApp não aceitou o áudio enviado (${complete})`);

    // 3) Envia a figurinha com o áudio anexado
    const webp = fromB64(webpB64, 'image/webp');
    const opaque = await def('WAWebMediaOpaqueData').createFromData(webp, 'image/webp');
    const MediaPrep = def('WAWebMediaPrep');
    const prep = new MediaPrep('sticker', Promise.resolve({
        type: 'sticker', mediaBlob: opaque, mimetype: 'image/webp', size: webp.size,
        fullWidth: side, fullHeight: side, isAnimated: !!isAnimated, emojis: ['🔊'],
    }));
    const result = await prep.sendToChat({ chat, options: { stickerAudio } });
    const OK = ns('WAWebSendMsgResultAction').SendMsgResult.OK;
    if (!result || result.messageSendResult !== OK) {
        throw new Error(`O WhatsApp não enviou a figurinha (${result && result.messageSendResult})`);
    }
    const msg = result.msg;
    return {
        id: msg && msg.id ? msg.id._serialized : null,
        hasAudio: !!(msg && (msg.stickerAudio || (msg.attributes && msg.attributes.stickerAudio))),
    };
}
/* eslint-enable no-undef */

// ---------------------------------------------------------------------------
// API usada pelo bot
// ---------------------------------------------------------------------------

async function sendSoundSticker(client, chatId, webp, ogg, { isAnimated = false, side = 512, name = '', author = '' } = {}) {
    if (!client.pupPage) throw new SoundStickerError('O WhatsApp Web ainda não está aberto.');
    const tagged = await tagSoundSticker(webp, ogg, { name, author });
    const seconds = Math.max(1, Math.round(oggOpusSeconds(ogg) || 1));
    try {
        return await client.pupPage.evaluate(sendInPage, {
            chatId,
            webpB64: tagged.toString('base64'),
            oggB64: ogg.toString('base64'),
            seconds,
            isAnimated,
            side,
        });
    } catch (err) {
        const msg = String(err && err.message || err).replace(/^Evaluation failed:\s*(Error:\s*)?/, '').split('\n')[0];
        throw new SoundStickerError(msg);
    }
}

module.exports = { sendSoundSticker, tagSoundSticker, oggOpusSeconds, buildExif, sendInPage, SoundStickerError };
