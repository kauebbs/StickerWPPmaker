# 🤖 kuebot — Bot de Figurinhas para WhatsApp

![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)
![WhatsApp](https://img.shields.io/badge/WhatsApp-Web-25D366?logo=whatsapp&logoColor=white)
![Plataforma](https://img.shields.io/badge/Windows-CMD%20%7C%20PowerShell-0078D6?logo=windows&logoColor=white)

Bot em Node.js que roda no seu próprio número de WhatsApp e transforma **fotos, vídeos e GIFs em figurinhas** (normais e animadas), cria **figurinhas de texto animado** e converte **figurinhas e vídeos em GIF**. Tudo direto pelo chat, com comandos simples.

O bot **começa desligado**: só você, dono do número, liga e desliga, em um chat específico ou em todos, e pode definir um tempo para ele desligar sozinho.

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Hospedagem gratuita 24h](#hospedagem-gratuita-24h)
- [Primeiro uso](#primeiro-uso)
- [Ligar e desligar o bot](#ligar-e-desligar-o-bot)
- [Comandos](#comandos)
- [Configuração](#configuração)
- [Problemas comuns](#problemas-comuns)
- [Como funciona por dentro](#como-funciona-por-dentro)
- [Aviso](#aviso)

---

## Funcionalidades

| | |
|---|---|
| 🖼️ **Foto → figurinha** | 512x512, com 4 modos: esticar, cortar, ajustar (bordas transparentes) e redondo |
| 🎬 **Vídeo/GIF → figurinha animada** | Comprimida automaticamente para caber no limite do WhatsApp |
| ✂️ **Trecho do vídeo** | Escolha de onde até onde, ex.: do segundo 3 ao 8 |
| 💬 **Legenda estilo meme** | Em qualquer figurinha, estática ou animada, com 11 cores |
| 🔤 **Figurinha de texto** | Só a frase, com contorno, na cor que você quiser |
| 🌈 **Texto animado** | 7 efeitos: arco-íris, pulsar, tremer, piscar, digitar, balançar e neon |
| 🎞️ **Figurinha/vídeo → GIF** | Como GIF do WhatsApp ou como arquivo `.gif` |
| 🖼️ **Figurinha → imagem** | Converte qualquer figurinha em PNG |
| 🏷️ **Renomear figurinha** | Troca o nome do pacote e o autor |
| ↩️ **Funciona respondendo** | Responda a uma mídia antiga com o comando, sem reenviar nada |
| 🔐 **Controle de acesso** | Começa desligado, só o dono liga, por chat ou geral, com timer |
| ⏳ **Feedback** | Reage com ⏳ ✅ ❌ e responde citando a sua mensagem |

---

## Requisitos

- **[Node.js](https://nodejs.org/) 20 ou superior.** Confira com `node -v`. Para instalar ou atualizar: `winget install OpenJS.NodeJS.LTS`
- **[Git](https://git-scm.com/)**, para clonar o repositório
- **WhatsApp no celular**, para escanear o QR Code
- *(Recomendado)* **[Google Chrome](https://www.google.com/chrome/)**. Com ele o `!gif` envia GIFs no formato do WhatsApp; sem ele, envia um arquivo `.gif`.

> 💡 O **FFmpeg já vem junto** no `npm install` (pacote `ffmpeg-static`). Não precisa instalar à parte.

---

## Instalação

Abra o **CMD** ou o **PowerShell** e rode:

```bash
git clone https://github.com/kauebbs/StickerWPPmaker.git
cd StickerWPPmaker
npm install
```

O `npm install` baixa tudo que o bot precisa e pode levar alguns minutos na primeira vez.

---

## Primeiro uso

**1. Inicie o bot:**
```bash
npm start
```

**2. Conecte o WhatsApp.** Um QR Code aparece no terminal em até um minuto. No celular, vá em **Aparelhos conectados → Conectar um aparelho** e escaneie.

**3. Ligue o bot** no chat onde quer usar, mandando do seu número:
```
!ligar
```

**4. Teste:** mande uma foto com a legenda `!fig`. Pronto! 🎉

A sessão fica salva. Nas próximas vezes, é só rodar `npm start`, sem precisar de QR Code.

Para **parar o bot**, aperte `Ctrl + C` no terminal.

---

## Hospedagem gratuita 24h

Quer o bot ligado sem deixar o PC ligado? Veja o guia **[HOSPEDAGEM.md](HOSPEDAGEM.md)**: passo a passo para rodar de graça numa máquina **e2-micro do Google Cloud**, com script de instalação automática e `pm2` para manter o bot sempre no ar.

---

## Ligar e desligar o bot

O bot foi feito para rodar no seu **número pessoal** sem que qualquer pessoa consiga usá-lo. Por isso ele **começa desligado** e ignora todo mundo até você ligar.

Estes comandos **só funcionam vindos do seu número**. Se outra pessoa mandar, o bot ignora em silêncio.

| Comando | O que faz |
|---|---|
| `!ligar` | Liga o bot **neste chat**: todos do chat ou grupo podem usar |
| `!ligar 2h` | Liga por um tempo e desliga sozinho. Aceita `30m`, `1h30`, `1d`... |
| `!ligar tudo` | Liga em **todos os chats**. Também aceita tempo: `!ligar tudo 1h` |
| `!desligar` | Desliga neste chat |
| `!desligar tudo` | Desliga em todos os chats |
| `!status` | Mostra onde o bot está ligado e por quanto tempo |

- Nos chats desligados, comandos de outras pessoas são ignorados, sem reação nem resposta.
- **Seus próprios comandos** (`!fig`, `!gif`...) funcionam em qualquer chat, mesmo com o bot desligado. Para mudar isso, use `OWNER_ALWAYS_ALLOWED=false`.
- O que está ligado fica salvo em `bot-estado.json`, então nada muda se você reiniciar o bot.

---

## Comandos

Mande **`!menu`** no WhatsApp para ver a lista a qualquer momento.

### 🖼️ `!fig` — foto, vídeo ou GIF → figurinha

Também funciona como `!s`, `!figurinha` ou `!sticker`. Envie a mídia com o comando na legenda, **ou responda** a uma mídia que já está no chat.

As opções vão **no começo**, em qualquer ordem. O que sobrar vira **legenda**.

| Opção | Valores |
|---|---|
| **Modo** | `esticar` (padrão), `cortar`, `ajustar` (mantém a proporção, bordas transparentes), `redondo` |
| **Trecho do vídeo** | `3-8` (do 3s ao 8s), `1:05-1:12`, ou `4s` (só os 4 primeiros segundos) |
| **Cor da legenda** | `branco`, `preto`, `vermelho`, `azul`, `verde`, `amarelo`, `rosa`, `roxo`, `laranja`, `ciano`, `dourado` |

```
!fig
!fig cortar
!fig redondo 2-6 bom dia grupo
!fig amarelo quando o código compila de primeira
```

> Figurinhas animadas duram até **10 segundos**. Sem trecho informado, o bot usa os **6 primeiros**.

### 🔤 `!texto` — figurinha só de texto

```
!texto sextou!
!texto azul bom dia
```

### 🌈 `!animado` — figurinha de texto animada

Também funciona como `!attp`. Efeitos: `arcoiris` (padrão), `pulsar`, `tremer`, `piscar`, `digitar`, `balancar`, `neon`. Aceita cor.

```
!animado sextou galera
!animado tremer SOCORRO
!animado digitar carregando...
!animado neon rosa boa noite
```

### 🎞️ `!gif` — vídeo ou figurinha animada → GIF

Responda a um vídeo, GIF ou figurinha animada. Aceita trecho do vídeo.

```
!gif
!gif 0-5
!gif arquivo      → recebe o arquivo .gif
```

### 🖼️ `!img` — figurinha → imagem

Responda a uma figurinha com `!img` para receber a imagem em PNG.

### 🏷️ `!renomear` — troca o pacote e o autor

Responda a uma figurinha:
```
!renomear Meu Pacote | Meu Nome
```

---

## Configuração

Tudo fica em [`src/config.js`](src/config.js) e também pode ser trocado por variáveis de ambiente, sem mexer no código.

**No CMD:**
```bash
set STICKER_AUTHOR=MeuNome&& set STICKER_NAME=MeuPack&& npm start
```

**No PowerShell:**
```powershell
$env:STICKER_AUTHOR="MeuNome"; $env:STICKER_NAME="MeuPack"; npm start
```

| Variável | Padrão | Descrição |
|---|---|---|
| `STICKER_NAME` / `STICKER_AUTHOR` | `.` / `kuebot` | Nome do pacote e autor das figurinhas |
| `BOT_PREFIX` | `!` | Prefixo dos comandos |
| `OWNER_ALWAYS_ALLOWED` | `true` | Seus comandos funcionam mesmo com o bot desligado |
| `ANIM_DEFAULT_DURATION` | `6` | Duração da figurinha animada quando nenhum trecho é informado (s) |
| `ANIM_MAX_DURATION` | `10` | Duração máxima da figurinha animada (s) |
| `ANIM_MAX_KB` | `900` | Tamanho máximo da figurinha animada (KB) |
| `STATIC_MAX_KB` | `100` | Tamanho máximo da figurinha estática (KB) |
| `GIF_MAX_DURATION` | `15` | Duração máxima do `!gif` (s) |
| `GIF_WIDTH` | `480` | Largura dos GIFs gerados (px) |
| `MAX_CONCURRENT` | `2` | Quantas mídias processar ao mesmo tempo |
| `LOW_MEMORY` | `false` | `true` deixa o navegador mais econômico (servidores com 1 GB) |
| `WA_WEB_VERSION` | versões fixadas | Versão do WhatsApp Web (separe várias por vírgula), ou `latest` |
| `LOAD_TIMEOUT_MS` | `60000` | Quanto esperar o WhatsApp Web carregar antes de tentar de novo (ms) |
| `HEADLESS` | `true` | `false` mostra a janela do navegador (para investigar problemas) |
| `BOT_DATA_DIR` | `%LOCALAPPDATA%\kuebot` | Onde ficam a sessão do WhatsApp e o cache |
| `BOT_STATE_FILE` | `bot-estado.json` | Onde fica salvo em quais chats o bot está ligado |
| `CHROME_PATH` | automático | Caminho do Chrome/Edge. Use `none` para forçar o navegador padrão |
| `FFMPEG_PATH` | automático | Caminho de outro FFmpeg, se quiser |

---

## Problemas comuns

<details>
<summary><b>O QR Code não aparece no terminal</b></summary>

Em 23/11/2026 o WhatsApp Web mudou e o `whatsapp-web.js` parou de gerar o QR Code ([issue #201988](https://github.com/wwebjs/whatsapp-web.js/issues/201988)). O bot contorna isso carregando uma versão do WhatsApp Web anterior à mudança e, se essa não funcionar, tenta as próximas da lista.

Enquanto carrega, o terminal mostra o progresso a cada 10 segundos e salva uma captura da tela do navegador em `diagnostico.png`, na pasta do projeto. Abra essa imagem para ver o que está acontecendo.

Quando a biblioteca for corrigida:
```bash
npm update whatsapp-web.js
set WA_WEB_VERSION=latest&& npm start
```
</details>

<details>
<summary><b><code>TimeoutError: Waiting failed</code> ou o bot fica parado carregando</b></summary>

O WhatsApp Web demorou para abrir. O bot já tenta de novo sozinho, trocando de versão e de navegador se precisar. Se continuar, rode com a janela do navegador visível para ver onde trava:
```bash
set HEADLESS=false&& npm start
```

A sessão fica em `%LOCALAPPDATA%\kuebot`, **fora da pasta do projeto**, de propósito: se o projeto estiver no OneDrive, a sincronização deixa o navegador muito lento.
</details>

<details>
<summary><b>Quero conectar outro número</b></summary>

Pare o bot, apague a pasta `%LOCALAPPDATA%\kuebot\sessao` e rode `npm start` de novo. Um novo QR Code vai aparecer.
</details>

<details>
<summary><b>O <code>!gif</code> manda um arquivo em vez de um GIF</b></summary>

O navegador que vem com o bot não consegue enviar vídeos. Instale o [Google Chrome](https://www.google.com/chrome/) e reinicie o bot: ele encontra o Chrome sozinho. Ao iniciar, o terminal mostra qual navegador está em uso.
</details>

<details>
<summary><b>A figurinha animada ficou com qualidade baixa</b></summary>

O WhatsApp limita o tamanho das figurinhas, então o bot reduz qualidade e quadros por segundo até caber. Escolha um trecho mais curto (ex.: `!fig 2-5`) para ter mais qualidade.
</details>

<details>
<summary><b><code>npm install</code> deu erro</b></summary>

Confira se o Node é 20 ou mais novo com `node -v`. Se for mais antigo, atualize com `winget install OpenJS.NodeJS.LTS`, feche e abra o terminal de novo, e rode `npm install` outra vez.
</details>

---

## Como funciona por dentro

```
index.js            Conexão com o WhatsApp, comandos e fila de processamento
ecosystem.config.js Configuração do pm2 para rodar em servidor
deploy/
└── setup-servidor.sh  Instala tudo num servidor Linux (ver HOSPEDAGEM.md)
src/
├── config.js       Configurações (todas podem vir de variáveis de ambiente)
├── converter.js    Conversões de imagem, vídeo e texto (sharp + FFmpeg)
├── parse.js        Leitura dos comandos e das opções digitadas
└── access.js       Controle de onde o bot está ligado (só o dono)
```

- **[whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js)** abre o WhatsApp Web num navegador escondido e conversa com ele.
- **[sharp](https://sharp.pixelplumbing.com/)** monta as figurinhas estáticas, o texto, as legendas e os WebP animados.
- **[FFmpeg](https://ffmpeg.org/)** (via `ffmpeg-static`) recorta e redimensiona vídeos e gera os GIFs.

Arquivos que ficam fora do Git (`.gitignore`): `node_modules/`, `bot-estado.json`, `diagnostico.png` e as pastas de sessão.

---

## Aviso

Este projeto **não é oficial** e não tem relação com o WhatsApp ou a Meta. Automatizar uma conta pessoal vai contra os termos de uso do WhatsApp e pode, em casos raros, levar ao **bloqueio do número**. Use com moderação e por sua conta e risco.

---

Desenvolvido por **Kauê Boscariol** · [github.com/kauebbs](https://github.com/kauebbs)
