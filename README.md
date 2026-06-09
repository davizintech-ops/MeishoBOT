# MeishoBOT
Um bot de WhatsApp editavel 

# MeishoBOT para Termux

**Este projeto é um bot de WhatsApp em Node.js para Termux, com menu moderno, conexão por código de pareamento, sistema modular e diversos comandos organizados por categorias. O projeto foi desenvolvido para ser leve, rápido e fácil de editar diretamente pelo celular.**

«Utilize este bot apenas com uma conta de WhatsApp própria ou com autorização do titular. Não utilize automação para spam, golpes, invasões ou qualquer atividade abusiva.»

# ---

# Recursos principais
```bash
Recurso| Descrição
Plataforma| WhatsApp utilizando Baileys em Node.js.
Ambiente| Compatível com Termux no Android.
Login| Código de pareamento sem necessidade de QR Code.
Menu| Menu moderno com imagem personalizada e legenda organizada.
Comandos| Mais de 120 comandos divididos por categorias.
Estrutura| Projeto modular e simples de editar.
Personalização| Prefixo, dono, nome e mensagens configuráveis.
```
---

# Instalação no Termux

**Caso o projeto esteja compactado em ".zip", extraia-o antes de iniciar.**

**dependências usando pkg**

```bash
pkg update -y && pkg upgrade -y
pkg install nodejs git ffmpeg imagemagick -y
git clone https://github.com/davizintech-ops/MeishoBOT/
```

**agora vamos entrar na pasta**
```bash
cd meishoBOT
```

**instala usando npm**
```bash
npm install
```
**ou**
```bash
chmod +x install-termux.sh
./install-termux.sh
```

**agora inicia o bot!**
```bash
npm start
```

**Na primeira execução será solicitado seu número do WhatsApp.**

**Exemplo:**
```bash
5511999999999
```
**Após informar o número, será exibido um código de pareamento.**

**No WhatsApp acesse:**
```bash
Dispositivos conectados
→ Conectar dispositivo
→ Conectar com número de telefone
```

Digite o código mostrado no Termux.

---

### Configuração do proprietário

**Edite o arquivo:**
```bash
config.js
```
### Configure os seguintes campos:
```bash
ownerName: "Seu Nome",
ownerNumber: "ID",
prefix: ".",
botName: "meishoBOT"
```
# AVISO!
**digite .id para ver seu id e colocá-lo no ownerNumber**

**O número deve conter apenas números, incluindo DDI e DDD.**

# ---

# Como utilizar

**Após conectar o bot, envie:**
```bash
.menu
```
**Para visualizar o menu principal.**

**Também existem comandos como:**

```bash
.ping
.botinfo
.perfil
.ajuda
```

# ---

# ⚙️ Categorias

Categoria| Exemplos
Principal| menu, ping, botinfo, perfil
Administração| ban, kick, promover, rebaixar
Grupo| antilink, antifake, hidetag
Downloads| play, ytmp3, tiktok, instagram
Figurinhas| sticker, toimg, attp, qc
Anime| waifu, neko, animeinfo
Diversão| dado, ship, casal, piada
Jogos| slot, ppt, quiz, forca
Utilidades| cep, clima, calcular, qrcode
Dono| eval, exec, reiniciar, broadcast

# ---

# Personalização do menu

**A imagem utilizada pelo menu está localizada em:**

```bash
assets/menu.jpg
```

**Basta substituir por outra imagem mantendo o mesmo nome ou digitar .setmenufoto respondendo a imagem.**

**É recomendado utilizar uma imagem vertical em proporção 3:4.**

# ---

# Reiniciar a sessão

Para conectar outro número:

```bash
rm -rf session

npm start
```
# ---

# Solução de problemas

Problema| Solução
Código não aparece| Verifique se informou DDI + DDD corretamente.
Bot desconecta| Execute "npm start" novamente.
Comandos não funcionam| Confira o prefixo configurado.
Erro no npm| Execute "npm install" novamente.
Menu sem imagem| Confira se "assets/menu.jpg" existe ou acontece porquê você nao executou o .setmenufoto.

# ---

# 📂 Estrutura do projeto
```estrutura
meishoBOT/
├── assets/
│   └── menu.jpg
├── lib/
│   └── headler.js
├── config.js
├── index.js
├── package.json
├── README.md
└── session/
```
# ---

# Diferenciais do meishoBOT

- Sistema leve para Termux
- Código organizado
- Fácil de modificar
- Menu personalizado
- Conexão por pareamento
- Compatível com Android
- Estrutura modular
- Respostas rápidas
- Suporte a comandos personalizados
- Fácil integração com APIs

---

# ⚠️Aviso

**Este projeto serve como uma base para criação de bots de WhatsApp. Recursos que dependem de serviços externos, como downloads, IA ou pesquisas, podem necessitar de APIs próprias.**

**O desenvolvedor é responsável por respeitar os termos de uso das plataformas utilizadas.**

# ---

# Arquitetura do meishoBOT

O meishoBOT foi desenvolvido em Node.js, utilizando a biblioteca Baileys para comunicação com o WhatsApp via código de pareamento.

Sua estrutura é modular, organizada e otimizada para execução no Termux.

# ---

# como funciona

Arquivo| Função
"index.js"| Inicializa o bot e gerencia eventos.
"config.js"| Configurações gerais do bot.
"lib/headler.js"| Registro dos comandos.
"assets/menu.jpg"| Imagem utilizada no menu.
"package.json"| Dependências do projeto.
"README.md"| Guia de instalação.

# ---

# Organização
```organizacao
Mensagem recebida
        │
        ▼
Verificação do prefixo
        │
        ▼
Busca do comando
        │
        ▼
Execução da função
        │
        ▼
Resposta enviada ao usuário
```
# ---

Recursos
```bash
- Conexão por código de pareamento
- Sistema modular
- Eventos do WhatsApp
- Menu automático
- Configuração simples
- Compatível com Android
- Fácil expansão de comandos
- Suporte a APIs externas
```
# ---
# Objetivo

O meishoBOT foi criado para servir como uma base moderna, organizada e fácil de expandir, permitindo que desenvolvedores adicionem novas funções sem alterar a arquitetura principal do projeto.
