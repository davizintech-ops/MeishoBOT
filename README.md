# HuTao MD Bot para Termux

Este projeto é um **bot de WhatsApp em Node.js para Termux**, com menu visual anime, imagem própria do menu, conexão por **código de pareamento** e catálogo com **120 comandos** organizados por categorias. O projeto foi feito para ser simples de editar diretamente no celular.

> Use este bot apenas com uma conta de WhatsApp que seja sua ou com autorização do titular. Não use automação para spam, golpes, invasão, perseguição ou qualquer prática abusiva.

## Recursos principais

| Recurso | Descrição |
|---|---|
| Plataforma | WhatsApp via Baileys em Node.js. |
| Ambiente | Compatível com Termux no Android. |
| Login | Código de pareamento, sem precisar escanear QR. |
| Menu | Menu com imagem anime estilo Hu Tao e legenda completa. |
| Comandos | 120 comandos cadastrados em 9 categorias. |
| Edição | Arquivos simples: `config.js`, `lib/commands.js` e `lib/menu.js`. |

## Instalação no Termux

Abra o Termux e execute os comandos abaixo. Se o projeto estiver em arquivo `.zip`, primeiro extraia o arquivo na pasta desejada.

```bash
pkg update -y && pkg upgrade -y
pkg install nodejs git ffmpeg imagemagick -y
cd hutao-termux-bot
npm install
npm start
```

Na primeira execução, o terminal vai pedir seu número. Digite com DDI e DDD, sem espaços, por exemplo:

```text
5511999999999
```

Depois disso, o bot mostrará um **código de pareamento**. No WhatsApp, abra **Dispositivos conectados**, escolha **Conectar dispositivo** e depois **Conectar com número de telefone**. Digite o código mostrado no Termux.

## Como configurar o dono

Abra o arquivo `config.js` e altere estes campos:

```js
ownerName: 'Seu Nome',
ownerNumber: '5511999999999',
prefix: '!',
```

O campo `ownerNumber` deve ficar com DDI, DDD e número, usando apenas números. Isso permite que os comandos da categoria **Dono** reconheçam você.

## Como usar

Depois que o bot estiver conectado, envie no WhatsApp:

```text
!menu
```

O bot responderá com a imagem anime e o menu completo. Para ver uma lista simples, envie:

```text
!menulist
```

## Categorias dos comandos

| Categoria | Quantidade | Exemplos |
|---|---:|---|
| Principal | 10 | `!menu`, `!ping`, `!botinfo`, `!dono` |
| Grupo/Admin | 20 | `!ban`, `!promover`, `!abrirgrupo`, `!antilink` |
| Figurinhas | 12 | `!sticker`, `!toimg`, `!attp`, `!qc` |
| Downloads | 14 | `!play`, `!ytmp3`, `!tiktok`, `!instagram` |
| Anime | 12 | `!waifu`, `!neko`, `!animeinfo`, `!topanime` |
| Diversão | 16 | `!dado`, `!ship`, `!piada`, `!desafio` |
| Jogos | 10 | `!ppt`, `!slot`, `!quiz`, `!forca` |
| Utilidades | 16 | `!cep`, `!calcular`, `!qrcode`, `!traduzir` |
| Dono | 10 | `!reiniciar`, `!desligar`, `!broadcast`, `!setprefix` |

## Observação sobre os comandos

O projeto já vem com **120 comandos cadastrados**. Alguns comandos já têm resposta funcional simples, como `!menu`, `!ping`, `!botinfo`, `!perfil`, `!dado`, `!moeda`, `!calcular`, `!cep`, `!waifu`, `!neko`, `!slot` e `!ppt`. Outros estão estruturados com descrição e resposta base, para que você possa completar depois com APIs específicas ou funções avançadas.

Essa escolha deixa o bot mais leve e mais fácil de rodar no Termux. Se você quiser, pode editar `lib/commands.js` e adicionar APIs de download, figurinhas ou sistemas de grupo conforme sua preferência.

## Trocar a imagem do menu

A imagem usada no menu fica em:

```text
assets/menu.jpg
```

Para trocar, substitua esse arquivo por outra imagem com o mesmo nome. O recomendado é usar imagem vertical, de preferência em proporção **3:4**.

## Reiniciar sessão

Se precisar conectar outro número, pare o bot e apague a pasta de sessão:

```bash
rm -rf session
npm start
```

## Solução de problemas

| Problema | Solução |
|---|---|
| Código não aparece | Confira se digitou o número com DDI e DDD. |
| Bot desconecta | Execute `npm start` novamente. |
| Comando não responde | Verifique se está usando o prefixo correto, por exemplo `!menu`. |
| Erro ao instalar | Rode `pkg update -y` e depois `npm install` novamente. |
| Menu sem imagem | Confira se `assets/menu.jpg` existe. |

## Estrutura do projeto

```text
hutao-termux-bot/
├── assets/
│   └── menu.jpg
├── lib/
│   ├── commands.js
│   ├── helpers.js
│   └── menu.js
├── ARQUITETURA.md
├── config.js
├── index.js
├── package.json
└── README.md
```

## Aviso final

Este projeto é uma base pronta e editável. Para comandos que dependem de serviços externos, como downloads de redes sociais ou busca de mídia, talvez seja necessário conectar APIs próprias e respeitar os termos de uso de cada plataforma.
