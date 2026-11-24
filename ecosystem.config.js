// Configuração do pm2 para rodar o bot num servidor (ex.: Google Cloud e2-micro).
// Uso: pm2 start ecosystem.config.js && pm2 save

module.exports = {
    apps: [
        {
            name: 'kuebot',
            script: 'index.js',
            // Reinicia sozinho se cair, esperando 10s entre tentativas
            autorestart: true,
            restart_delay: 10000,
            max_restarts: 50,
            // Reinicia se o processo do Node passar disso (o navegador é contado à parte)
            max_memory_restart: '600M',
            time: true,
            env: {
                NODE_ENV: 'production',
                // Servidor gratuito tem só 1 GB de RAM: uma mídia por vez e navegador econômico
                MAX_CONCURRENT: '1',
                LOW_MEMORY: 'true',
            },
        },
    ],
};
