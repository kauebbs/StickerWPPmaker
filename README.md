# WhatsApp Sticker Bot

Um bot em Node.js para WhatsApp que transforma automaticamente imagens, GIFs e vídeos curtos em figurinhas (normais e animadas). 

## Funcionalidades
- Converte fotos (JPG, PNG, WEBP) em figurinhas preenchendo as bordas automaticamente (512x512).
- Converte vídeos curtos e GIFs em figurinhas animadas.
- Funciona tanto em chats privados quanto em grupos.
- Responde diretamente ao usuário que enviou o comando.

---

## Requisitos

Antes de começar, você precisará ter instalado no seu computador:
- [Node.js](https://nodejs.org/) (Versão 18 ou superior)
- [Git](https://git-scm.com/) (Para clonar o repositório)
- Conta no WhatsApp logada no celular para ler o QR Code.

---

## Como instalar e rodar pelo CMD (Windows)

Abra o seu Prompt de Comando (CMD) ou PowerShell e siga os passos abaixo:

**1. Clone este repositório para o seu computador:**
```bash
git clone [https://github.com/SEU_USUARIO/NOME_DO_SEU_REPOSITORIO.git](https://github.com/SEU_USUARIO/NOME_DO_SEU_REPOSITORIO.git)
```
*(Não esqueça de trocar o link acima pelo link real do seu repositório no GitHub)*

**2. Entre na pasta do bot:**
```bash
cd NOME_DO_SEU_REPOSITORIO
```

**3. Instale as bibliotecas necessárias do Node.js:**
```bash
npm install
```

**4. Instale o FFmpeg (Obrigatório para GIFs e vídeos):**
No Windows, você pode instalar facilmente executando o comando abaixo (digite `Y` se pedir confirmação):
```bash
winget install ffmpeg
```
*Importante: Após instalar o FFmpeg, feche o CMD e abra-o novamente na pasta do projeto para que o Windows reconheça o comando.*

---

## Como usar

**1. Inicie o bot no terminal:**
```bash
node index.js
```

**2. Conecte seu WhatsApp:**
- Um QR Code vai aparecer no seu terminal.
- Abra o WhatsApp no seu celular.
- Vá em "Aparelhos Conectados" > "Conectar um Aparelho".
- Escaneie o QR Code.

**3. Crie figurinhas!**
- Envie uma foto, vídeo curto ou GIF em qualquer chat ou grupo.
- Coloque a legenda **`!figurinha`**.
- O bot processará a mídia e responderá com o sticker pronto em poucos segundos!

---
*Desenvolvido por Kauê Boscariol.*