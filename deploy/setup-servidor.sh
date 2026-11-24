#!/usr/bin/env bash
# Prepara um servidor Debian/Ubuntu (ex.: Google Cloud e2-micro) para rodar o kuebot.
#
# Uso (no terminal SSH do servidor):
#   curl -fsSL https://raw.githubusercontent.com/kauebbs/StickerWPPmaker/main/deploy/setup-servidor.sh | bash
#
# Pode rodar de novo quando quiser: ele só instala o que estiver faltando e
# atualiza o código do bot.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/kauebbs/StickerWPPmaker.git}"
DIR="${DIR:-$HOME/StickerWPPmaker}"
SWAP_SIZE="${SWAP_SIZE:-2G}"

step() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

if [ "$(id -u)" -eq 0 ]; then
    echo "Rode este script como usuário comum (sem sudo). Ele pede sudo quando precisar."
    exit 1
fi

step "1/7 Memória extra (swap de $SWAP_SIZE) — o servidor gratuito só tem 1 GB de RAM"
if ! sudo swapon --show | grep -q '/swapfile'; then
    sudo fallocate -l "$SWAP_SIZE" /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile >/dev/null
    sudo swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
    echo "Swap criado."
else
    echo "Swap já existe."
fi

step "2/7 Pacotes básicos e fontes (para texto e emoji nas figurinhas)"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    git curl ca-certificates gnupg fonts-dejavu-core fonts-liberation fonts-noto-color-emoji >/dev/null
echo "Ok."

step "3/7 Node.js 22"
NODE_MAJOR=0
command -v node >/dev/null && NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null
fi
echo "Node $(node -v)"

step "4/7 Navegador"
ARCH="$(dpkg --print-architecture)"
if [ "$ARCH" = "amd64" ]; then
    if ! command -v google-chrome >/dev/null; then
        curl -fsSL -o /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq /tmp/chrome.deb >/dev/null
        rm -f /tmp/chrome.deb
    fi
    echo "$(google-chrome --version) (envio de GIF nativo ativado)"
else
    # Servidores ARM (ex.: Oracle Ampere) não têm Google Chrome
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq chromium >/dev/null
    echo "$(chromium --version) (GIFs irão como arquivo .gif)"
fi

step "5/7 Código do bot em $DIR"
if [ -d "$DIR/.git" ]; then
    # O npm install pode mexer no package-lock.json; descarta isso para o pull não travar
    git -C "$DIR" checkout -- package-lock.json 2>/dev/null || true
    git -C "$DIR" pull --ff-only
else
    git clone "$REPO_URL" "$DIR"
fi
cd "$DIR"
# Usamos o Chrome instalado acima, então não precisa baixar outro navegador
PUPPETEER_SKIP_DOWNLOAD=true npm install --omit=dev --no-audit --no-fund

step "6/7 pm2 (mantém o bot ligado e reinicia se cair)"
if ! command -v pm2 >/dev/null; then
    sudo npm install -g pm2 --no-audit --no-fund >/dev/null
fi
# Faz o pm2 subir sozinho quando o servidor reiniciar
sudo env PATH="$PATH" "$(command -v pm2)" startup systemd -u "$USER" --hp "$HOME" >/dev/null
echo "pm2 $(pm2 -v)"

# Se o bot já estava rodando, reinicia com o código novo
if pm2 describe kuebot >/dev/null 2>&1; then
    pm2 restart kuebot --update-env >/dev/null
    echo "Bot reiniciado com o código atualizado."
fi

step "7/7 Pronto!"
cat <<EOF

Próximos passos:

  1) Conecte o WhatsApp (só na primeira vez):
       cd $DIR && npm run servidor:qr
     Escaneie o QR Code. Quando aparecer "Bot conectado!", aperte Ctrl+C.

  2) Deixe o bot rodando para sempre:
       cd $DIR && npm run servidor:iniciar

  Comandos úteis:
       pm2 logs kuebot        # ver o que o bot está fazendo (Ctrl+C para sair)
       pm2 restart kuebot     # reiniciar
       pm2 stop kuebot        # parar
       bash $DIR/deploy/setup-servidor.sh   # atualizar o bot depois de mudar o código no GitHub

EOF
