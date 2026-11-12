const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const sharp = require('sharp');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Escaneie o QR Code acima.');
});

client.on('ready', () => {
    console.log('Bot conectado! Aceitando fotos e GIFs.');
});

client.on('message_create', async (message) => {
    if (message.body.toLowerCase().trim() === '!figurinha' && message.hasMedia) {
        try {
            console.log('\n--- Processando nova figurinha ---');
            
            const chatDestino = message.fromMe ? message.to : message.from;
            
            const media = await message.downloadMedia();
            
            if (!media) {
                console.log('Erro: Não foi possível baixar a mídia.');
                return;
            }

            console.log(`Formato recebido: ${media.mimetype}`);

            if (media.mimetype.includes('image') && !media.mimetype.includes('gif')) {
                const imageBuffer = Buffer.from(media.data, 'base64');
                const stretchedBuffer = await sharp(imageBuffer)
                    .resize(512, 512, { fit: 'fill' })
                    .webp() 
                    .toBuffer();

                const stretchedMedia = new MessageMedia(
                    'image/webp',
                    stretchedBuffer.toString('base64'),
                    'figurinha.webp'
                );

                await client.sendMessage(chatDestino, stretchedMedia, {
                    sendMediaAsSticker: true,
                    stickerAuthor: 'kuebot',
                    stickerName: '.'
                });
                console.log('Figurinha de foto enviada!');

            } else if (media.mimetype.includes('video') || media.mimetype.includes('gif')) {
                console.log('GIF/Vídeo detectado! Convertendo para figurinha animada...');
                
                await client.sendMessage(chatDestino, media, {
                    sendMediaAsSticker: true,
                    stickerAuthor: '.',
                    stickerName: '.'
                });
                console.log('Figurinha animada enviada!');
                
            } else {
                console.log('Formato não suportado.');
                client.sendMessage(chatDestino, 'Mande apenas fotos, vídeos curtos ou GIFs!');
            }
            
        } catch (error) {
            console.error('Erro ao processar:', error);
        }
    }
});

client.initialize();