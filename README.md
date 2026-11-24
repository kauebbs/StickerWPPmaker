# WhatsApp Sticker Bot (kuebot)

Um bot em Node.js para WhatsApp que transforma fotos, vídeos e GIFs em figurinhas (normais e animadas), cria figurinhas de texto animado e converte figurinhas/vídeos em GIF.

## Funcionalidades
- Fotos (JPG, PNG, WEBP) → figurinha 512x512, com 4 modos: **esticar**, **cortar**, **ajustar** (bordas transparentes) e **redondo**.
- Vídeos e GIFs → **figurinha animada**, já comprimida para caber no limite do WhatsApp.
- Escolha do **trecho do vídeo** (ex.: do segundo 3 ao 8).
- **Legenda** estilo meme em qualquer figurinha (estática ou animada), com cor à escolha.
- **Figurinha de texto** e **figurinha de texto animada** (arco-íris, tremer, digitar, neon...).
- **Figurinha/vídeo → GIF** (GIF do WhatsApp ou arquivo `.gif`).
- **Figurinha → imagem** PNG.
- **Renomear** pacote/autor de qualquer figurinha.
- Funciona respondendo a uma mídia (não precisa reenviar a foto/vídeo).
- Reage com ⏳ / ✅ / ❌ e responde citando a mensagem.
- Funciona em chats privados e grupos.
- **Começa desligado**: só você liga/desliga, por chat ou geral, e com tempo para desligar sozinho.

---

## Requisitos

- [Node.js](https://nodejs.org/) **versão 20 ou superior**
- [Git](https://git-scm.com/)
- Conta no WhatsApp logada no celular para ler o QR Code
- *(Recomendado)* [Google Chrome](https://www.google.com/chrome/) instalado — necessário para o bot **enviar** GIFs no formato do WhatsApp. Sem ele, o `!gif` manda um arquivo `.gif`.

O FFmpeg já vem junto pelo `npm install` (pacote `ffmpeg-static`), não precisa instalar à parte.

---

## Como instalar e rodar pelo CMD (Windows)

**1. Clone este repositório:**
```bash
git clone https://github.com/kauebbs/StickerWPPmaker.git
```

**2. Entre na pasta do bot:**
```bash
cd StickerWPPmaker
```

**3. Instale as dependências:**
```bash
npm install
```

**4. Inicie o bot:**
```bash
npm start
```

**5. Conecte seu WhatsApp:**
- Um QR Code vai aparecer no terminal.
- No celular: "Aparelhos Conectados" > "Conectar um Aparelho".
- Escaneie o QR Code.

---

## Ligando e desligando o bot

O bot **começa desligado** e não responde ninguém até você ligar. Isso é pensado para rodar no seu número pessoal sem que qualquer pessoa consiga usá-lo.

Só **você** (mensagens enviadas do número conectado) pode usar estes comandos. Se outra pessoa mandar, o bot ignora em silêncio.

| Comando | O que faz |
|---|---|
| `!ligar` | Liga o bot **neste chat** (todos do chat/grupo podem usar) |
| `!ligar 2h` | Liga por um tempo e desliga sozinho (`30m`, `1h30`, `1d`...) |
| `!ligar tudo` | Liga em **todos os chats** (aceita tempo: `!ligar tudo 1h`) |
| `!desligar` | Desliga neste chat |
| `!desligar tudo` | Desliga em todos os chats |
| `!status` | Mostra onde o bot está ligado e por quanto tempo |

- Nos chats desligados, comandos de outras pessoas são ignorados (sem reação nem resposta).
- **Seus próprios comandos** (`!fig`, `!gif`...) funcionam em qualquer chat, mesmo com o bot desligado. Para mudar isso, use `OWNER_ALWAYS_ALLOWED=false`.
- O estado fica salvo em `bot-estado.json`, então continua igual se você reiniciar o bot.

---

## Comandos

Mande **`!menu`** no WhatsApp para ver a lista a qualquer momento.

| Comando | O que faz |
|---|---|
| `!fig` (ou `!s`, `!figurinha`) | Foto, vídeo ou GIF → figurinha. Envie com a legenda ou **responda** a uma mídia. |
| `!texto frase` | Figurinha só de texto |
| `!animado [efeito] frase` | Figurinha de texto animada |
| `!gif` | Responda a um vídeo ou figurinha animada → GIF. `!gif arquivo` manda o `.gif` |
| `!img` | Responda a uma figurinha → imagem PNG |
| `!renomear Pacote \| Autor` | Responda a uma figurinha → reenvia com outro nome/autor |
| `!menu` | Lista de comandos |

### Opções do `!fig`
As opções vão **no começo**, em qualquer ordem. O que sobrar vira legenda.

- **Modo:** `esticar` (padrão), `cortar`, `ajustar`, `redondo`
- **Trecho do vídeo:** `3-8` (do 3s ao 8s), `1:05-1:12`, ou `4s` (só os 4 primeiros segundos)
- **Cor da legenda:** `branco`, `preto`, `vermelho`, `azul`, `verde`, `amarelo`, `rosa`, `roxo`, `laranja`, `ciano`, `dourado`

Exemplos:
```
!fig cortar
!fig redondo 2-6 bom dia grupo
!fig amarelo quando o código compila de primeira
!texto azul sextou
!animado tremer SOCORRO
!animado digitar carregando...
!gif 0-5
```

**Efeitos do `!animado`:** `arcoiris` (padrão), `pulsar`, `tremer`, `piscar`, `digitar`, `balancar`, `neon`.

---

## Configuração (opcional)

Tudo fica em `src/config.js` e também pode ser trocado por variáveis de ambiente. Exemplo no CMD:
```bash
set STICKER_AUTHOR=MeuNome&& set STICKER_NAME=MeuPack&& npm start
```

| Variável | Padrão | Descrição |
|---|---|---|
| `BOT_PREFIX` | `!` | Prefixo dos comandos |
| `OWNER_ALWAYS_ALLOWED` | `true` | Seus comandos funcionam mesmo com o bot desligado |
| `STICKER_NAME` / `STICKER_AUTHOR` | `.` / `kuebot` | Nome do pacote e autor das figurinhas |
| `ANIM_MAX_DURATION` | `10` | Duração máxima da figurinha animada (s) |
| `ANIM_DEFAULT_DURATION` | `6` | Duração usada quando nenhum trecho é informado |
| `ANIM_MAX_KB` | `900` | Tamanho máximo da figurinha animada |
| `GIF_MAX_DURATION` | `15` | Duração máxima do `!gif` (s) |
| `LOAD_TIMEOUT_MS` | `60000` | Quanto esperar o WhatsApp Web carregar (ms) |
| `WA_WEB_VERSION` | versões fixadas | Versão(ões) do WhatsApp Web, separadas por vírgula, ou `latest` |
| `HEADLESS` | `true` | `false` mostra a janela do navegador (para investigar problemas) |
| `BOT_DATA_DIR` | `%LOCALAPPDATA%\kuebot` | Onde ficam a sessão do WhatsApp e o cache |
| `CHROME_PATH` | auto | Caminho do Chrome. Use `none` para forçar o Chromium padrão |
| `FFMPEG_PATH` | auto | Caminho de outro FFmpeg, se quiser |

---

## Problemas comuns

**O QR Code não aparece no CMD (fica em "estado: carregando página" / "Waiting failed")**
Em 23/11/2026 o WhatsApp Web mudou e o whatsapp-web.js parou de gerar o QR Code ([issue #201988](https://github.com/wwebjs/whatsapp-web.js/issues/201988)). O bot contorna isso carregando uma versão do WhatsApp Web anterior à mudança e, se não der certo, tenta as próximas da lista. Quando a biblioteca for corrigida, atualize (`npm update whatsapp-web.js`) e use `WA_WEB_VERSION=latest`.

**`TimeoutError: Waiting failed: 30000ms exceeded`**
O WhatsApp Web demorou para abrir. Esta versão já espera até 60 segundos, mostra o progresso no CMD, salva uma captura da tela do navegador em `diagnostico.png` e tenta de novo sozinha (trocando de navegador se o Chrome falhar). A sessão fica em `%LOCALAPPDATA%\kuebot`, fora do OneDrive, porque a sincronização do OneDrive deixa o navegador muito lento. Se continuar, rode com a janela visível para ver o que está travando:
```bash
set HEADLESS=false&& npm start
```

**Quero conectar outro número / o QR Code não aparece mais**
Apague a pasta `%LOCALAPPDATA%\kuebot\sessao` e inicie o bot de novo.

---

## Estrutura

```
index.js           # conexão com o WhatsApp e comandos
src/config.js      # configurações
src/converter.js   # conversões de imagem/vídeo/texto (sharp + FFmpeg)
src/parse.js       # leitura dos comandos e opções
src/access.js      # liga/desliga por chat (só o dono)
```

---
*Desenvolvido por Kauê Boscariol.*
