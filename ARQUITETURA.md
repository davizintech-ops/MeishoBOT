# Arquitetura do Bot HuTao Termux

Este projeto será um bot de WhatsApp em Node.js compatível com Termux, usando a biblioteca Baileys para conexão via código de pareamento. A estrutura será simples, modular e fácil de editar no celular.

## Estrutura prevista

| Caminho | Função |
|---|---|
| `index.js` | Arquivo principal do bot, conexão, eventos e roteamento de comandos. |
| `config.js` | Nome do bot, dono, prefixo, imagem do menu e mensagens básicas. |
| `lib/menu.js` | Geração do menu visual em texto, com legenda e imagem. |
| `lib/commands.js` | Catálogo com 120 comandos e metadados. |
| `lib/helpers.js` | Funções auxiliares para resposta, delay, formatação e envio de mídia. |
| `assets/menu.jpg` | Imagem anime/Hu Tao usada no menu. |
| `package.json` | Dependências e scripts de execução. |
| `README.md` | Tutorial de instalação e uso no Termux. |

## Categorias e quantidade de comandos

| Categoria | Quantidade | Exemplos |
|---|---:|---|
| Principal | 10 | menu, ping, perfil, dono, status |
| Grupo/Admin | 20 | ban, promover, rebaixar, abrirgrupo, fechargrupo |
| Figurinhas | 12 | sticker, toimg, attp, ttp, emoji |
| Downloads | 14 | play, video, instagram, tiktok, mediafire |
| Anime | 12 | waifu, neko, cosplay, animeinfo, mangainfo |
| Diversão | 16 | dado, casal, ship, gay, corno |
| Jogos | 10 | adivinhar, ppt, slot, quiz, forca |
| Utilidades | 16 | cep, clima, calcular, traduzir, encurtar |
| Dono | 10 | reiniciar, sair, block, unblock, broadcast |

Total: 120 comandos.

## Observação de segurança

O bot foi projetado para automação comum de WhatsApp, sem captura de dados, invasão, clonagem ou acesso indevido a contas. O código de pareamento deve ser usado apenas com o número do próprio usuário ou com autorização do titular do dispositivo.

## Lista resumida dos 120 comandos

Principal: menu, menulist, ping, botinfo, perfil, dono, runtime, prefixo, regras, ajuda.

Grupo/Admin: ban, promover, rebaixar, marcar, hidetag, abrirgrupo, fechargrupo, linkgrupo, resetlink, add, kick, grupo, bemvindo, despedida, antifake, antilink, antispam, mute, unmute, listadmins.

Figurinhas: sticker, s, toimg, togif, attp, ttp, roubar, stickerinfo, emoji, qc, figaleatoria, renamefig.

Downloads: play, playvideo, ytsearch, ytmp3, ytmp4, tiktok, instagram, facebook, twitter, mediafire, apk, pinterest, wallpaper, spotify.

Anime: waifu, neko, shinobu, megumin, cosplay, animeinfo, mangainfo, personagem, quoteanime, wallpaperanime, topanime, topmanga.

Diversão: dado, moeda, casal, ship, gay, feio, lindo, corno, burro, inteligente, sorte, azar, piada, cantada, verdade, desafio.

Jogos: ppt, slot, adivinhar, quiz, forca, velha, mathgame, memoria, cassino, roleta.

Utilidades: cep, clima, calcular, traduzir, ddd, ddi, encurtar, gerarcpf, gerarcnpj, qrcode, readqr, printsite, ssweb, horamundial, moedaex, lembrete.

Dono: reiniciar, desligar, eval, exec, broadcast, entrar, sair, block, unblock, setprefix.
