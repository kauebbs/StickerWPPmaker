# ☁️ Hospedando o kuebot de graça no Google Cloud

Este guia coloca o bot para rodar 24 horas numa máquina gratuita do Google Cloud (**e2-micro**), sem precisar deixar o seu PC ligado.

**Tempo:** uns 20 minutos.
**Custo:** zero, desde que você siga as configurações abaixo à risca.

> **O que é gratuito no Google Cloud ([documentação oficial](https://cloud.google.com/free/docs/free-cloud-features#compute)):**
> - 1 máquina **e2-micro** por mês, só nas regiões **us-west1** (Oregon), **us-central1** (Iowa) ou **us-east1** (Carolina do Sul)
> - **30 GB** de **disco permanente padrão**
> - **1 GB por mês** de tráfego de saída
> - IP externo sem custo
>
> Qualquer coisa fora disso é cobrada. Os pontos marcados com ⚠️ são os que mais geram cobrança por engano.

---

## Antes de começar: suba o código para o GitHub

O servidor baixa o bot direto do GitHub, então a versão mais nova precisa estar lá.

**No GitHub Desktop:** escolha o repositório **StickerWPPmaker**, escreva um resumo (ex.: "Bot v2"), clique em **Commit to main** e depois em **Push origin**.

**Ou no CMD**, dentro da pasta do projeto:
```bash
git add .
git commit -m "Bot v2: GIFs, novos comandos e hospedagem"
git push
```

---

## 1. Crie a conta no Google Cloud

1. Acesse [cloud.google.com/free](https://cloud.google.com/free) e clique em **Comece gratuitamente**.
2. Entre com sua conta Google e preencha os dados. **Ele pede um cartão**, só para confirmar a identidade.
3. Você ganha um teste de 90 dias com crédito. A máquina e2-micro continua gratuita depois disso.

> ⚠️ **Quando o teste de 90 dias acabar**, o Google pede para **ativar a conta completa** (botão "Ativar" / "Upgrade" no topo do console). Faça isso, senão as máquinas criadas no teste são apagadas. A e2-micro continua gratuita na conta completa.

---

## 2. Crie um alerta de gastos (recomendado)

Assim você recebe um e-mail se algo começar a cobrar.

1. No menu ☰, vá em **Faturamento → Orçamentos e alertas → Criar orçamento**.
2. Valor: **US$ 1**. Deixe os alertas em 50%, 90% e 100%.
3. Salve.

---

## 3. Crie a máquina

1. No menu ☰, vá em **Compute Engine → Instâncias de VM**. Se pedir, clique em **Ativar** a API e espere um minuto.
2. Clique em **Criar instância** e preencha:

| Campo | Valor |
|---|---|
| **Nome** | `kuebot` |
| **Região** ⚠️ | `us-central1 (Iowa)`, `us-west1 (Oregon)` ou `us-east1 (Carolina do Sul)` |
| **Zona** | qualquer uma |
| **Série** | `E2` |
| **Tipo de máquina** ⚠️ | `e2-micro` (2 vCPU, 1 GB de memória) |

3. Em **SO e armazenamento** (Boot disk), clique em **Mudar** e escolha:

| Campo | Valor |
|---|---|
| **Sistema operacional** | `Debian` |
| **Versão** | `Debian GNU/Linux 12 (bookworm)`, **x86/64** |
| **Tipo de disco** ⚠️ | **Disco permanente padrão** (*Standard persistent disk*). O padrão "equilibrado" **é cobrado** |
| **Tamanho** | `30` GB |

4. Em **Rede**, deixe tudo como está. Não precisa marcar HTTP nem HTTPS.
5. Clique em **Criar**.

> 💡 A tela de criação mostra uma "estimativa mensal" de alguns dólares. **Isso é normal**: o desconto do nível gratuito só aparece na fatura. Confira em **Faturamento → Relatórios** depois de alguns dias: o custo deve estar em US$ 0,00.

---

## 4. Instale o bot

1. Na lista de **Instâncias de VM**, clique no botão **SSH** ao lado da máquina `kuebot`. Abre um terminal no navegador.
2. Cole este comando e aperte Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/kauebbs/StickerWPPmaker/main/deploy/setup-servidor.sh | bash
```

O script instala tudo sozinho, em uns 5 minutos:
- memória extra (swap de 2 GB), porque a máquina só tem 1 GB;
- Node.js 22;
- Google Chrome, para o `!gif` enviar GIF nativo;
- fontes para texto e emoji;
- o bot e o `pm2`, que mantém o bot ligado e reinicia se ele cair.

---

## 5. Conecte o WhatsApp (só na primeira vez)

> ⚠️ **Pare o bot no seu PC antes** (Ctrl+C no CMD). Se os dois ficarem ligados, cada comando é respondido duas vezes.

No terminal SSH:
```bash
cd ~/StickerWPPmaker && npm run servidor:qr
```

1. Espere o QR Code aparecer. Pode levar até um minuto.
2. No celular: **Aparelhos conectados → Conectar um aparelho** e escaneie.
3. Quando aparecer **"Bot conectado!"**, aperte **Ctrl+C**.

> 💡 Se o QR Code ficar grande demais para a tela, diminua o zoom do navegador com **Ctrl + -** antes de escanear.

---

## 6. Deixe rodando para sempre

```bash
cd ~/StickerWPPmaker && npm run servidor:iniciar
```

Pronto! 🎉 Pode fechar a janela do SSH: o bot continua rodando e volta sozinho se o servidor reiniciar.

Teste mandando `!ligar` e depois `!fig` em algum chat.

---

## Comandos do dia a dia

Rode estes comandos no terminal SSH:

| Comando | Para quê |
|---|---|
| `pm2 logs kuebot` | Ver o que o bot está fazendo. **Ctrl+C** sai (o bot continua) |
| `pm2 status` | Ver se está rodando e quanta memória usa |
| `pm2 restart kuebot` | Reiniciar |
| `pm2 stop kuebot` | Parar |
| `bash ~/StickerWPPmaker/deploy/setup-servidor.sh` | **Atualizar** depois de subir mudanças no GitHub (reinicia o bot sozinho) |

---

## Problemas comuns

<details>
<summary><b>A sessão caiu e preciso escanear o QR Code de novo</b></summary>

```bash
pm2 stop kuebot
cd ~/StickerWPPmaker && npm run servidor:qr
# escaneie, espere "Bot conectado!" e aperte Ctrl+C
pm2 restart kuebot
```
</details>

<details>
<summary><b>Quero conectar outro número</b></summary>

```bash
pm2 stop kuebot
rm -rf ~/kuebot/sessao
cd ~/StickerWPPmaker && npm run servidor:qr
pm2 restart kuebot
```
</details>

<details>
<summary><b>O bot está lento ou reiniciando sozinho</b></summary>

A máquina gratuita é pequena. Vídeos longos pesam mais: prefira trechos curtos (`!fig 0-4`). Veja o consumo de memória com `pm2 status` e `free -h`.
</details>

<details>
<summary><b>Apareceu cobrança na fatura</b></summary>

Confira os três pontos com ⚠️:
- a região é us-west1, us-central1 ou us-east1;
- o tipo de máquina é e2-micro;
- o disco é **padrão** (não "equilibrado" nem SSD) e tem no máximo 30 GB.

Lembre também que o tráfego de saída gratuito é de **1 GB por mês**. Cada figurinha animada tem até ~900 KB, então um uso normal cabe tranquilo, mas centenas de figurinhas animadas por dia podem passar do limite.
</details>

---

[← Voltar para o README](README.md)
