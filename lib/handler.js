const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const config = require('../config');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = async (sock, msg) => {
    // Se não vier nenhuma mensagem válida, ignora para não crashar o terminal
    if (!msg || !msg.key) return; 

    // =================================================================
    // 🏢 DEFINIÇÃO REAL DE REMETENTE E CHAT
    // =================================================================
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = isGroup ? (msg.key.participant || msg.key.remoteJid) : msg.key.remoteJid;
    const numeroRemetente = sender ? sender.split('@')[0] : '';

    const texto =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        '';

    // FORCE A VERIFICAÇÃO (Segurança para os seus comandos de Moderação)
    const botAdm = true; // Finge que é admin para evitar falhas do WhatsApp

    // =================================================================
    // 🛡️ BANCO DE DADOS (DB) - CARREGAMENTO E CONFIGURAÇÃO
    // =================================================================
    const caminhoDB = path.resolve(__dirname, 'dados', 'src', 'database.json');
    let db = {};

    const dbPadrao = {
        premium: [],
        donos: [],
        bloqueados: [],
        manutencao: { status: false },
        autostatus: { status: false },
        backups: [],
        stats: { comandos: 0, reinicios: 0, backups: 0, totalComandos: 0 },
        antilink: {},
        configuracoes: { antilink: false, menuItem: '🩵', tipoMenuMidia: null, caminhoMenuMidia: null },
        grupos_banidos: [],
        executados: [],
        usuarios_mutados: {},
        advertencias: {}
    };

    try {
        if (fs.existsSync(caminhoDB)) {
            const conteudoConte = fs.readFileSync(caminhoDB, 'utf8').trim();
            if (conteudoConte.length > 0) {
                db = JSON.parse(conteudoConte);
                db = { ...dbPadrao, ...db };
            } else {
                db = dbPadrao;
                fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
            }
        } else {
            const pastaSrc = path.dirname(caminhoDB);
            if (!fs.existsSync(pastaSrc)) fs.mkdirSync(pastaSrc, { recursive: true });
            db = dbPadrao;
            fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
        }
    } catch (e) {
        console.log("⚠️ Erro ao carregar/criar banco de dados:", e);
        db = dbPadrao;
    }

    // Garante que a pasta de mídia externa (asents) existe
    const pastaAsents = path.resolve(__dirname, 'asents');
    if (!fs.existsSync(pastaAsents)) {
        fs.mkdirSync(pastaAsents, { recursive: true });
    }

    // =================================================================
    // 📊 CONFIGURAÇÕES DE VARIÁVEIS GLOBAIS (USANDO SENDER E CONFIG)
    // =================================================================
    const prefixoBot = config.prefix || '.'; 
    const corpoMensagem = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const isCmd = corpoMensagem.startsWith(prefixoBot);
    const limpoOwner = String(config.ownerNumber).trim();
    
    // Define se quem enviou a mensagem é o dono principal ou administrador global
    const isOwner = (numeroRemetente === limpoOwner || db.donos.includes(numeroRemetente) || msg.key.fromMe);
    const ehDono = isOwner; 

    // Moderação Real-time: Apagar mensagens de usuários mutados no grupo
    if (isGroup && db.usuarios_mutados?.[from]?.includes(numeroRemetente)) {
        if (!isOwner && !msg.key.fromMe) {
            try {
                await sock.sendMessage(from, { delete: msg.key });
                return;
            } catch (err) {
                console.log("Erro ao apagar mensagem de usuário mutado:", err);
            }
        }
    }

    // No início dos comandos que precisam de adm:
    let participantes = [];
    let usuarioAdm = false;

    if (isGroup) {
        try {
            const metadata = await sock.groupMetadata(from); 
            participantes = metadata.participants || [];
            
            const senderPuro = sender.split(':')[0].split('@')[0];
            const usuarioNaLista = participantes.find(p => p.id.split(':')[0].split('@')[0] === senderPuro);
            usuarioAdm = usuarioNaLista?.admin === 'admin' || usuarioNaLista?.admin === 'superadmin';
        } catch (err) {
            console.log("Erro ao buscar metadados do grupo:", err);
        }
    }

    // ==============================================================
    // 🛡️ SISTEMA AUTOMÁTICO DE ANTI-LINK INTERNO
    // ==============================================================
    if (isGroup && db.configuracoes?.antilink) {
        const contemLink = /(https?:\/\/[^\s]+)/gi.test(corpoMensagem) || corpoMensagem.includes('chat.whatsapp.com/');
        if (contemLink && !isOwner && !msg.key.fromMe) {
            if (!usuarioAdm) {
                if (!botAdm) {
                    await sock.sendMessage(from, { text: `⚠️ *Anti-Link Detectado!* @${numeroRemetente}, mas eu não posso banir pois não sou Administradora!`, mentions: [sender] });
                } else {
                    try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
                    await sock.groupParticipantsUpdate(from, [sender], 'remove');
                    await sock.sendMessage(from, { text: `🚨 *ANTI-LINK!* @${numeroRemetente} foi removido por enviar links. 🔨`, mentions: [sender] });
                }
                return;
            }
        }
    }

    // ========================================================
    // 🛡️ TRAVAS GLOBAIS DE SEGURANÇA (MANUTENÇÃO E BLACKLIST)
    // ========================================================
    if (db.bloqueados) {
        const banIndex = db.bloqueados.findIndex(b => (typeof b === 'object' ? b.numero === numeroRemetente : b === numeroRemetente));
        if (banIndex !== -1) {
            const dadosBan = db.bloqueados[banIndex];
            if (typeof dadosBan === 'object' && dadosBan.expiraEm) {
                if (Date.now() > dadosBan.expiraEm) {
                    db.bloqueados.splice(banIndex, 1);
                    fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
                } else {
                    if (isCmd) {
                        const restanteMs = dadosBan.expiraEm - Date.now();
                        const minutos = Math.ceil(restanteMs / (1000 * 60));
                        const tempoTxt = minutos >= 60 ? `${Math.ceil(minutos / 60)} hora(s)` : `${minutos} minuto(s)`;
                        await sock.sendMessage(from, { 
                            text: `❌ *Acesso Negado!*\n\nVocê está banido temporariamente deste bot por mais *${tempoTxt}*.` 
                        }, { quoted: msg });
                    }
                    return; 
                }
            } else {
                if (isCmd) {
                    await sock.sendMessage(from, { 
                        text: `❌ *Acesso Negado!* O seu acesso a este bot foi banido permanentemente.` 
                    }, { quoted: msg });
                }
                return; 
            }
        }
    }

    if (db.manutencao && db.manutencao.status && !isOwner) {
        if (isCmd) {
            await sock.sendMessage(from, { 
                text: `⚙️ *Sistema em Manutenção!* O bot está em manutenção no momento no palco principal.` 
            }, { quoted: msg });
        }
        return; 
    }

    if (!texto.startsWith(config.prefix)) return;

    const args = texto
        .slice(config.prefix.length)
        .trim()
        .split(/ +/);

    const comando = args.shift()?.toLowerCase();
    const prefix = config.prefix;
    const command = comando;
    const text = args.join(' ');

    // Incrementa estatísticas básicas no banco
    if (!db.stats) db.stats = { comandos: 0, totalComandos: 0 };
    db.stats.comandos += 1;
    db.stats.totalComandos += 1;

    const m = {
        chat: from,
        key: msg.key,
        pushName: msg.pushName || 'Usuário',
        reply: async (textoBot) => {
            return await sock.sendMessage(from, { text: textoBot }, { quoted: msg });
        }
    };

    const systemZR = sock;

    // Filtro de segurança para chats privados
    if (!isGroup && !isOwner) {
        await sock.sendMessage(from, {
            text: 'Número errado. Não jogo e não faço trocas. Bloqueado e denunciado.'
        });
        await sock.updateBlockStatus(from, 'block');
        return;
    }

    // ============================================
    // 📊 CONFIGURAÇÕES DOS MEDIDORES E MEMES
    // ============================================
    const comandosTextos = {
        ping: '🏓 Pong!',
        status: '✅ Sistema Online e operando perfeitamente!',
        bot: `𩵢 ${config.botName} funcionando a todo vapor!`,
        regras: '📜 *REGRAS DO GRUPO*\n1. Não flodar o bot.\n2. Respeitar os membros.\n3. Sem links sem autorização.',
        suporte: `🛠️ Precisa de ajuda? Entre em contato pelo suporte: ${config.links.suporte}`,
        criador: `👑 Este bot foi desenvolvido por ${config.ownerName} usando Node.js + Baileys.`,
        github: `💻 Repositório: ${config.links.github}`,
        versao: `📦 ${config.botName} • Termux Edition`,
        donos: `👑 Diretor do Show: @${config.ownerNumber}`,
        host: '🖥️ Servidor ativo via ambiente local de alta performance!',
        playlist: '🎵 Em breve: Sistema de download de músicas direto no chat.',
        ajuda: `📖 Digite ${prefix}menu para ver todos os comandos disponíveis no meu sistema!`,
        termux: '🐚 Hospedado em ambiente Linux estável e liso.',
        baileys: '⚡ Conexão via @whiskeysockets/baileys super atualizada!',
        bomdia: '☀️ Bom dia! Que o seu dia seja incrível e livre de bugs na memória.',
        boatarde: '🌤️ Boa tarde! Hora daquele café esperto para continuar os trabalhos.',
        boanoite: '🌙 Boa noite! Desligando os refletores por hoje. Descanse bem.',
        madrugada: '🦉 Salve, guerreiro da madrugada! O terminal nunca dorme.',
        oi: '👋 Olá! Como posso animar o seu dia hoje?',
        olá: '👋 Olá, nobre membro! O show já vai começar.',
        tchau: '🏃💨 Já vai? Volte logo para assistir ao próximo ato.',
        f: '🇫 Pressione F para prestar suas homenagens e respeitos.',
        pipoca: '🍿 Pegando a pipoca porque o barraco no grupo ficou interessante!',
        fofoca: '🗣️ Conta logo! O Ministério da Fofoca exige saber de tudo.',
        motivacional: '💪 Não importa o quão devagar você vai, desde que não pare.',
        foco: '🎯 Mantenha os olhos no objetivo. Distrações não criam impérios.',
        sucesso: '🏆 O sucesso é a soma de pequenos esforços repetidos dia após dia.',
        estudar: '📚 O conhecimento é a única coisa que ninguém pode tirar de você.',
        codigo: '💻 Programar não é só digitar, é resolver problemas que você não sabia que tinha.',
        linux: '🐧 No Linux, você é o mestre do seu próprio sistema operacional.',
        windows: '🪟 Atualizando o sistema... Por favor, não desligue o computador.',
        paz: '🕊️ Que a paz reine nos grupos e que os administradores tenham paciência.',
        vida: '🌱 A vida é como um laço *while*: continua rodando enquanto houver energia.',
        tempo: '⏳ O tempo voa, mas lembre-se de que você é o piloto.',
        donation: '🪙 Apoie o desenvolvimento! Entre em contato com o dono para ver a chave Pix.',
        premium: '⭐ Usuários VIP têm prioridade na fila de execução de comandos pesados.',
        free: '🆓 Versão pública disponível para testes comunitários.',
        fim: '🎬 Obrigado pela audiência! O show terminou.'
    };

    if (comandosTextos[command]) {
        return await m.reply(comandosTextos[command]);
    }

    const listaMedidores = [
        'gay', 'gado', 'feio', 'gostoso', 'sorte', 'corno', 'pobre', 'rico', 'safado', 
        'fiel', 'talarico', 'inteligente', 'burro', 'lindo', 'ciumento', 'bêbado', 
        'otaku', 'fofoqueiro', 'flertador', 'heroi', 'vilao', 'perfeito', 'azarado', 
        'famoso', 'gamer', 'cringe', 'psicopata', 'gaspi', 'romantico'
    ];

    if (listaMedidores.includes(command)) {
        const rando = Math.floor(Math.random() * 101);
        let barra = '';
        for (let i = 0; i < 10; i++) {
            barra += i < Math.round(rando / 10) ? '🟩' : '⬛';
        }
        const txt = `📊 *[ ${command.toUpperCase()} ]* 🩵\n\n@${sender.split('@')[0]} é *${rando}%* ${command}!\n${barra}`;
        return await sock.sendMessage(from, { text: txt, mentions: [sender] }, { quoted: msg });
    }

    // =================================================================
    // 🎛️ SWITCH PRINCIPAL DE COMANDOS CRUCIAIS
    // =================================================================
    switch (command) {
    
        case 'menu':
        case 'help': {
            try {
                const item = db.configuracoes?.menuItem || '🩵';

                const textoDoMenu = `╭―――――――――
╠―『me』${item} ${config.botName}
╠―『total』Mais de 200 Comandos Otimizados!
╠――『usuario』@${numeroRemetente}
╰―――――――――

╭―『⚙️ PALCO PRINCIPAL』―――
║ ${item}| ${prefix}menubn - Menu de Brincadeiras e Jogos
║ ${item}| ${prefix}menufig - Menu de Figurinhas, Fotos e Vídeos
║ ${item}| ${prefix}menuadm - Painel de Moderação de Grupos
║ ${item}| ${prefix}menudono - Painel do Diretor Supremo (Dono)
╰―――『${item}』――――――
> ${config.footer}`;

                const tipoSalvo = db.configuracoes?.tipoMenuMidia;
                const caminhoSalvo = db.configuracoes?.caminhoMenuMidia;
                const caminhoMenuPadrao = path.resolve(__dirname, 'asents', 'menu.jpg');

                if (tipoSalvo && caminhoSalvo && fs.existsSync(caminhoSalvo)) {
                    const bufferMidia = fs.readFileSync(caminhoSalvo);
                    await sock.sendMessage(from, { 
                        [tipoSalvo === 'imagem' ? 'image' : 'video']: bufferMidia, 
                        caption: textoDoMenu, 
                        gifPlayback: tipoSalvo === 'video', 
                        mentions: [sender] 
                    }, { quoted: msg });
                } else if (fs.existsSync(caminhoMenuPadrao)) {
                    await sock.sendMessage(from, { 
                        image: fs.readFileSync(caminhoMenuPadrao), 
                        caption: textoDoMenu,
                        mentions: [sender]
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: textoDoMenu, mentions: [sender] }, { quoted: msg });
                }
            } catch (e) {
                console.log("⚠️ Erro no menu principal:", e);
            }
            break;
        }

        case 'menubn':
        case 'menubot': {
            try {
                const item = db.configuracoes?.menuItem || '🩵';

                const textoDoMenu = `╭―――――――――
╠―『me』${item} ${config.botName}
╠―『total』Mais de 40 Comandos de Diversão!
╠――『usuario』@${numeroRemetente}
╰―――――――――

╭―『📊 MEDIDORES AUTOMÁTICOS』―――
║ ${item}| ${prefix}gay | ${prefix}gado | ${prefix}feio | ${prefix}gostoso | ${prefix}sorte
║ ${item}| ${prefix}corno | ${prefix}pobre | ${prefix}rico | ${prefix}safado | ${prefix}fiel
║ ${item}| ${prefix}talarico | ${prefix}inteligente | ${prefix}burro | ${prefix}lindo
║ ${item}| ${prefix}ciumento | ${prefix}bêbado | ${prefix}otaku | ${prefix}fofoqueiro
║ ${item}| ${prefix}flertador | ${prefix}heroi | ${prefix}vilao | ${prefix}perfeito
║ ${item}| ${prefix}azarado | ${prefix}famoso | ${prefix}gamer | ${prefix}cringe
║ ${item}| ${prefix}psicopata | ${prefix}gaspi | ${prefix}romantico | ${prefix}ship
╰―――『${item}』――――――

╭―『🎲 JOGOS & INTERATIVOS』―――
║ ${item}| ${prefix}seucelular - Qual seu celular?
║ ${item}| ${prefix}casal - Sorteia um casal no grupo
║ ${item}| ${prefix}dado - Joga um dado de 6 lados
║ ${item}| ${prefix}moeda - Cara ou Coroa
║ ${item}| ${prefix}piada | ${prefix}frase | ${prefix}signo | ${prefix}anime
╰―――『${item}』――――――

╭―『📱 NOVELA DO MOTO G54』―――
║ ${item}| ${prefix}motog54 | ${prefix}moto
║ ${item}| ${prefix}ajudarmoto | ${prefix}nãoajudarmoto | ${prefix}naoajudarmoto
╰―――『${item}』――――――
> ${config.footer}`;

                const tipoSalvo = db.configuracoes?.tipoMenuMidia;
                const caminhoSalvo = db.configuracoes?.caminhoMenuMidia;

                if (tipoSalvo && caminhoSalvo && fs.existsSync(caminhoSalvo)) {
                    const bufferMidia = fs.readFileSync(caminhoSalvo);
                    await sock.sendMessage(from, { 
                        [tipoSalvo === 'imagem' ? 'image' : 'video']: bufferMidia, 
                        caption: textoDoMenu, 
                        gifPlayback: tipoSalvo === 'video', 
                        mentions: [sender] 
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: textoDoMenu, mentions: [sender] }, { quoted: msg });
                }
            } catch (e) {
                console.log(e);
            }
            break;
        }

        case 'menufig':
        case 'menumidia': {
            try {
                const item = db.configuracoes?.menuItem || '𩵢';

                let textoMidia = `╭―――――――――
╠―『me』${item} ${config.botName}
╠―『total』Comandos de Criação e Mídia!
╠――『usuario』@${numeroRemetente}
╰―――――――――

╭―『🎨 STICKERS & EDIÇÃO』―――
║ ${item}| ${prefix}figualeatoria - Envia sticker da pasta
║ ${item}| ${prefix}stickeraleatorio - Gatilho alternativo
║ ${item}| ${prefix}setmenufoto - Altera foto/video do menu
║ ${item}| ${prefix}setpfp - Altera o avatar do bot
║ ${item}| ${prefix}setmenuitem - Altera o emoji das caixas
╰―――『${item}』――――――

╭―『📥 BUSCAS & DOWNLOADS』―――
║ ${item}| ${prefix}play <nome> - Baixa áudio do YouTube (yt-dlp)
║ ${item}| ${prefix}playvid <nome> - Baixa vídeo do YouTube
║ ${item}| ${prefix}pin <termo> - Busca imagem no Pinterest
║ ${item}| ${prefix}pinterest <termo> - Atalho Pinterest
╰―――『${item}』――――――
> ${config.footer}`;

                const tipoSalvo = db.configuracoes?.tipoMenuMidia;
                const caminhoSalvo = db.configuracoes?.caminhoMenuMidia;
                const caminhoMenuPadrao = path.resolve(__dirname, 'asents', 'menu.jpg');

                if (tipoSalvo && caminhoSalvo && fs.existsSync(caminhoSalvo)) {
                    const bufferMidia = fs.readFileSync(caminhoSalvo);
                    await sock.sendMessage(from, { 
                        [tipoSalvo === 'imagem' ? 'image' : 'video']: bufferMidia, 
                        caption: textoMidia, 
                        gifPlayback: tipoSalvo === 'video', 
                        mentions: [sender] 
                    }, { quoted: msg });
                } else if (fs.existsSync(caminhoMenuPadrao)) {
                    await sock.sendMessage(from, { 
                        image: fs.readFileSync(caminhoMenuPadrao), 
                        caption: textoMidia,
                        mentions: [sender]
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: textoMidia, mentions: [sender] }, { quoted: msg });
                }
            } catch (e) {
                console.log("⚠️ Erro no menufig:", e);
            }
            break;
        }

        case 'menudono':
        case 'menuowner': {
            try {
                const item = db.configuracoes?.menuItem || '👑';

                const textoDoMenu = `╭―――――――――
╠―『me』${item} ${config.botName}
╠―『total』Controles do Diretor Supremo!
╠――『usuario』@${numeroRemetente}
╰―――――――――

╭―『⚙️ CORE & SISTEMA CONTROLE』―――
║ ${item}| ${prefix}recarregar - Dá reload no arquivo handler.js
║ ${item}| ${prefix}setprefix - Altera o prefixo geral do bot
║ ${item}| ${prefix}desligar - Desliga os processos activos do bot
║ ${item}| ${prefix}statusram - Verifica consumo de RAM e CPU
║ ${item}| ${prefix}manutencao - Liga/Desliga o modo manutenção do bot
║ ${item}| ${prefix}autostatus - Liga/Desliga a visualização de status
╰―――『${item}』――――――

╭―『🚫 GERENCIAMENTO DE BANS & BLACKLIST』―――
║ ${item}| ${prefix}banirbot - Bloqueia um usuário do bot permanentemente
║ ${item}| ${prefix}banirbottemp - Bloqueia temporariamente
║ ${item}| ${prefix}desbanirbot - Remove usuário da blacklist
║ ${item}| ${prefix}addpremium - Adiciona um novo vip premium
║ ${item}| ${prefix}delpremium - Remove privilégios premium
║ ${item}| ${prefix}statsbot - Estatísticas do banco de dados
╰―――wn『${item}』――――――

╭―『📢 TRANSMISSÕES & BROADCAST』―――
║ ${item}| ${prefix}join <link> - Entra em grupos via link direto
║ ${item}| ${prefix}leave - Sai do grupo atual imediatamente
╰―――『${item}』――――――
> ${config.footer}`;

                const tipoSalvo = db.configuracoes?.tipoMenuMidia;
                const caminhoSalvo = db.configuracoes?.caminhoMenuMidia;

                if (tipoSalvo && caminhoSalvo && fs.existsSync(caminhoSalvo)) {
                    const bufferMidia = fs.readFileSync(caminhoSalvo);
                    await sock.sendMessage(from, { 
                        [tipoSalvo === 'imagem' ? 'image' : 'video']: bufferMidia, 
                        caption: textoDoMenu, 
                        gifPlayback: tipoSalvo === 'video', 
                        mentions: [sender] 
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: textoDoMenu, mentions: [sender] }, { quoted: msg });
                }
            } catch (e) {
                console.log(e);
            }
            break;
        }

        case 'menuadm':
        case 'menugrupo': {
            try {
                const item = db.configuracoes?.menuItem || '𩵢';

                const textoDoMenu = `╭―――――――――
╠―『me』${item} ${config.botName}
╠―『total』Painel de Controle do Grupo!
╠――『usuario』@${numeroRemetente}
╰―――――――――

╭―『🤫 SILENCIAMENTO (BANCO DE DADOS)』―――
║ ${item}| ${prefix}mute @user - Apaga todas as msgs do membro
║ ${item}| ${prefix}unmute @user - Devolve a voz ao membro
╰―――『${item}』――――――

╭―『⚠️ SISTEMA DE ADVERTÊNCIAS』―――
║ ${item}| ${prefix}adv @user - Aplica 1 ADV (3 ADVs = Ban automatico)
║ ${item}| ${prefix}resetadv @user - Zera as advertências do membro
╰―――『${item}』――――――

╭―『🔨 EXPULSÃO & CARGOS』―――
║ ${item}| ${prefix}kick @user - Remove um membro do grupo
║ ${item}| ${prefix}promover @user - Dá cargo de Administrador
║ ${item}| ${prefix}rebaixar @user - Remove cargo de Administrador
╰―――『${item}』――――――

╭―『⚙️ CONFIGURAÇÃO DO GRUPO』―――
║ ${item}| ${prefix}grupo abrir/fechar - Altera quem pode enviar msgs
║ ${item}| ${prefix}antilink - Liga/Desliga o anti-link automático no grupo
║ ${item}| ${prefix}infogp - Mostra todos os dados e metadados do chat
╰―――『${item}』――――――
> ${config.footer}`;

                const tipoSalvo = db.configuracoes?.tipoMenuMidia;
                const caminhoSalvo = db.configuracoes?.caminhoMenuMidia;

                if (tipoSalvo && caminhoSalvo && fs.existsSync(caminhoSalvo)) {
                    const bufferMidia = fs.readFileSync(caminhoSalvo);
                    await sock.sendMessage(from, { 
                        [tipoSalvo === 'imagem' ? 'image' : 'video']: bufferMidia, 
                        caption: textoDoMenu, 
                        gifPlayback: tipoSalvo === 'video', 
                        mentions: [sender] 
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: textoDoMenu, mentions: [sender] }, { quoted: msg });
                }
            } catch (e) {
                console.log(e);
            }
            break;
        }

        case 'calc': {
            if (!args.length) return sock.sendMessage(from, { text: `Ex: ${prefix}calc 2+2` });
            try {
                const resultado = Function(`'use strict'; return (${args.join(' ')})`)();
                await sock.sendMessage(from, { text: `🧮 Resultado: ${resultado}` });
            } catch {
                await sock.sendMessage(from, { text: '❌ Conta inválida' });
            }
        }
        break;

        case 'dado': {
            const n = Math.floor(Math.random() * 6) + 1;
            await sock.sendMessage(from, { text: `🎲 Você tirou ${n}` });
        }
        break;

        case 'moeda': {
            const r = Math.random() < 0.5 ? 'Cara 🪙' : 'Coroa 🪙';
            await sock.sendMessage(from, { text: r });
        }
        break;

        case 'id': {
            await sock.sendMessage(from, {
                text: `🆔 Informações\n\nid:\n${from}\n\nsender:\n${sender}\n\npushName:\n${msg.pushName || 'Sem nome'}`
            });
        }
        break;

        case 'setprefix': {
            if (!isOwner) return m.reply(config.messages.onlyOwner);
            const novoPrefix = args[0]?.trim();
            if (!novoPrefix) return m.reply(`⚠️ Uso correto: ${prefix}${command} <novo_prefixo>\nEx: ${prefix}${command} !`);
            if (novoPrefix.length > 3) return m.reply('❌ O prefixo deve ter no máximo 3 caracteres por segurança!');

            try {
                const caminhoConfig = path.resolve(__dirname, 'config.js');
                config.prefix = novoPrefix;

                if (fs.existsSync(caminhoConfig)) {
                    let conteudo = fs.readFileSync(caminhoConfig, 'utf8');
                    conteudo = conteudo.replace(/(prefix\s*:\s*['"`]).*?(['"`])/g, `$1${novoPrefix}$2`);
                    fs.writeFileSync(caminhoConfig, conteudo, 'utf8');
                }
                await sock.sendMessage(from, { text: `⚙️ *PREFIXO ALTERADO!* \n\nA partir de agora, use o comando assim: *${novoPrefix}menu*` }, { quoted: msg });
            } catch (e) {
                await m.reply(`✅ Prefixo alterado na memória RAM para: *${novoPrefix}* (Erro ao salvar no arquivo config.js).`);
            }
        }
        break;

        case 'pin':
        case 'pinterest': {
            if (!text) return m.reply(`Uso: ${prefix}${command} <termo> [qtd]\nEx: ${prefix}${command} gato 6`);
            const argsPin = text.trim().split(/\s+/);
            let limit = 6;
            if (/^\d+$/.test(argsPin[argsPin.length - 1])) {
                limit = Math.max(1, Math.min(10, parseInt(argsPin.pop(), 10)));
            }
            const query = argsPin.join(" ");
            await systemZR.sendMessage(m.chat, { react: { text: "🔎", key: m.key } });
         
            try {
                const { data } = await axios.get("https://systemzone.store/api/pinterest", {
                    params: { q: query, limit: 50 },
                    timeout: 120000
                });
                const results = Array.isArray(data?.results) ? data.results : [];
                if (!results.length) {
                    await systemZR.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
                    return m.reply("Nenhum resultado encontrado.");
                }
         
                const { generateWAMessageFromContent, prepareWAMessageMedia } = require("@whiskeysockets/baileys");
                const cards = [];
         
                for (let i = 0; i < Math.min(limit, results.length); i++) {
                    const img = results[i]?.image_url;
                    if (!img) continue;
                    const media = await prepareWAMessageMedia({ image: { url: img } }, { upload: systemZR.waUploadToServer });
                    cards.push({
                        header: { title: ` ᴘɪɴᴛᴇʀᴇsᴛ • ${query} (${i + 1}/${limit})`, hasMediaAttachment: true, imageMessage: media.imageMessage },
                        body: { text: "Toque abaixo para interagir" },
                        nativeFlowMessage: {
                            buttons: [
                                { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "𝘼𝘽𝙍𝙄𝙍 𝙄𝙈𝘼𝙂𝙀𝙈", url: img }) },
                                { name: "cta_copy", buttonParamsJson: JSON.stringify({ display_text: "𝘾𝙊𝙋𝙄𝘼𝙍 𝙐𝙍𝙇", copy_code: img }) }
                            ]
                        }
                    });
                }
         
                const msgImg = generateWAMessageFromContent(m.chat, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                header: { title: "ᴘɪɴᴛᴇʀᴇsᴛ" },
                                body: { text: ` 𝑴𝒆𝒊𝒔𝒉𝒐 • 𝑷𝒆𝒔𝒘𝒖𝒊𝒔𝒂: *${query}*\n 𝑹𝒆𝒔𝒖𝒍𝒕𝒂𝒅𝒐ˢ: *${cards.length}*` },
                                footer: { text: config.footer },
                                carouselMessage: { cards }
                            }
                        }
                    }
                }, { userJid: systemZR.user.id, quoted: m });
         
                await systemZR.relayMessage(m.chat, msgImg.message, { messageId: msgImg.key.id });
                await systemZR.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
            } catch (e) {
                await systemZR.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
                m.reply("Erro ao buscar imagens no Pinterest.");
            }
        }
        break;

        case 'setpfp': {
            if (!isOwner) return m.reply(config.messages.onlyOwner);
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted?.imageMessage) return m.reply(`🖼️ Marque uma imagem com ${prefix}setpfp`);

            try {
                const buffer = await downloadMediaMessage({ message: quoted }, 'buffer', {}, { logger: console, uploaderRequest: sock.updateMediaMessage });
                await sock.updateProfilePicture(sock.user.id, buffer);
                await m.reply('✅ Foto do perfil alterada com sucesso!');
            } catch (e) {
                await m.reply('❌ Erro ao alterar foto de perfil.');
            }
        }
        break;
               
        case 'motog54':
        case 'moto': {
            let textoSocorro = `SOCORRO!!!! MEU DONO QUER ME ENTORTAR SÓ POR QUE SEGUNDO ELE EU SOU RUIM!!!! SOCORRO!!!! 😭😭😭😭\n\n`;
            textoSocorro += `Eu sou apenas um *Moto G54 Verde* de 256GB, tenho 8GB+4GB de RAM, câmera de 50 MP e já estou rodando o Android 15! Não mereço isso! 💚\n\n`;
            textoSocorro += `Digite *${prefix}ajudarmoto* para me salvar ou *${prefix}nãoajudarmoto* para deixar ele me quebrar!`;
            
            const caminhoFoto = path.resolve(__dirname, 'asents', 'moto_normal.jpg');
            if (fs.existsSync(caminhoFoto)) {
                await sock.sendMessage(from, { image: fs.readFileSync(caminhoFoto), caption: textoSocorro }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: textoSocorro }, { quoted: msg });
            }
        }
        break;

        case 'ajudarmoto': {
            let textoAjuda = `🧼 *Obrigado por me ajudar!*\n\n`;
            textoAjuda += `Espero que aquele cara malvado não faça isso com meus 12GB RAM!! Olhem só, estou novinho em folha! ✨️💚`;
            
            const caminhoFoto = path.resolve(__dirname, 'asents', 'moto_limpo.jpg');
            if (fs.existsSync(caminhoFoto)) {
                await sock.sendMessage(from, { image: fs.readFileSync(caminhoFoto), caption: textoAjuda }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: textoAjuda }, { quoted: msg });
            }
        }
        break;

        case 'nãoajudarmoto':
        case 'naoajudarmoto': {
            let textoMorte = `😭 *CRACK!* Você assistiu friamente enquanto o pobre Moto G54 era destruído...\n\n`;
            textoMorte += `Restavam apenas 209GB livres... Agora restou apenas a carcaça verde no chão. Adeus! 💔⚙️`;
            
            const caminhoFoto = path.resolve(__dirname, 'asents', 'moto_quebrado.jpg');
            if (fs.existsSync(caminhoFoto)) {
                await sock.sendMessage(from, { image: fs.readFileSync(caminhoFoto), caption: textoMorte }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: textoMorte }, { quoted: msg });
            }
        }
        break;

        case 'play': {
            if (!args.length) return m.reply(`🎵 Uso: ${prefix}play nome da música`);
            const busca = args.join(' ');
            const arquivo = path.join(__dirname, `audio_${Date.now()}.mp3`);
            await m.reply(config.messages.wait);
            exec(`npx yt-dlp "ytsearch1:${busca}" -x --audio-format mp3 -o "${arquivo}"`, async (err) => {
                if (err) return m.reply(config.messages.error);
                await sock.sendMessage(from, { audio: fs.readFileSync(arquivo), mimetype: 'audio/mp4' }, { quoted: msg });
                if (fs.existsSync(arquivo)) fs.unlinkSync(arquivo);
            });
        }
        break;

        case 'playvid': {
            if (!args.length) return m.reply(`🎬 Uso: ${prefix}playvid nome do vídeo`);
            const busca = args.join(' ');
            const arquivo = path.join(__dirname, `video_${Date.now()}.mp4`);
            await m.reply(config.messages.wait);
            exec(`npx yt-dlp "ytsearch1:${busca}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best" -o "${arquivo}"`, async (err) => {
                if (err) return m.reply(config.messages.error);
                await sock.sendMessage(from, { video: fs.readFileSync(arquivo), caption: `🎬 ${busca}` }, { quoted: msg });
                if (fs.existsSync(arquivo)) fs.unlinkSync(arquivo);
            });
        }
        break;

        case 'dono': {
            const caminhoDono = path.resolve(__dirname, 'asents', 'dono.jpg');
            const textoDono = `
╭――――――――――――╮
║ 😍 Meu Dono ║
╰――――――――――――╯
╭――――――――――――――╮
╠―『numero』+${config.ownerNumber}
╠―『nome』${config.ownerName}
╠―『canal』${config.links.CanalWhatsapp}
╰――――――――――――――╯`.trim();
            if (fs.existsSync(caminhoDono)) {
                await sock.sendMessage(from, { image: fs.readFileSync(caminhoDono), caption: textoDono }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: textoDono }, { quoted: msg });
            }
        }
        break;

        case 'canais': {
            await sock.sendMessage(from, {
                text: `╭―――――――――――――――\n║👋 Olá ${msg.pushName}!\n╰―――――――――――――――\n\nNossos canais oficiais:\n💙 Canal WhatsApp: ${config.links.CanalWhatsapp}`
            }, { quoted: msg });
        }
        break;

        case 'figualeatoria':
        case 'stickeraleatorio': {
            const pastaFigus = path.resolve(__dirname, 'asents', 'figurinhas');
            if (!fs.existsSync(pastaFigus)) fs.mkdirSync(pastaFigus, { recursive: true });
            try {
                const arquivos = fs.readdirSync(pastaFigus);
                const figurinhas = arquivos.filter(file => file.endsWith('.webp'));
                if (figurinhas.length === 0) return m.reply(`📂 Nenhuma figurinha .webp encontrada na pasta.`);
                const figuSorteada = figurinhas[Math.floor(Math.random() * figurinhas.length)];
                await sock.sendMessage(from, { sticker: fs.readFileSync(path.join(pastaFigus, figuSorteada)) }, { quoted: msg });
            } catch (e) {
                await m.reply('❌ Erro ao ler a pasta de figurinhas.');
            }
        }
        break;

        case 'setmenufoto':
        case 'setimgmenu':
        case 'setmenumidia': {
            if (!isOwner) return sock.sendMessage(from, { text: '❌ Apenas o Diretor Supremo pode alterar a mídia do menu!' }, { quoted: msg });

            try {
                const tipoMensagemRespondida = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                
                if (!tipoMensagemRespondida) {
                    return sock.sendMessage(from, { text: `⚠️ *Uso correto:* Responda a uma Foto, GIF ou Vídeo curto com o comando *${prefix}${command}*` }, { quoted: msg });
                }

                const possuiImagem = tipoMensagemRespondida.imageMessage;
                const possuiVideo = tipoMensagemRespondida.videoMessage;

                if (!possuiImagem && !possuiVideo) {
                    return sock.sendMessage(from, { text: '❌ Mídia inválida! Responda apenas a uma Foto, GIF ou Vídeo.' }, { quoted: msg });
                }

                const pastaMidia = path.resolve(__dirname, 'asents');
                if (!fs.existsSync(pastaMidia)) fs.mkdirSync(pastaMidia, { recursive: true });

                const extensao = possuiImagem ? '.jpg' : '.mp4';
                const tipoMidiaSalva = possuiImagem ? 'imagem' : 'video';
                const caminhoDestino = path.join(pastaMidia, `menu${extensao}`);

                await sock.sendMessage(from, { text: '⏳ *Baixando e atualizando a mídia do menu...*' }, { quoted: msg });

                const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
                const msgMidiaReal = possuiImagem ? tipoMensagemRespondida.imageMessage : tipoMensagemRespondida.videoMessage;
                const stream = await downloadContentFromMessage(msgMidiaReal, possuiImagem ? 'image' : 'video');
                
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                if (fs.existsSync(path.join(pastaMidia, 'menu.jpg'))) fs.unlinkSync(path.join(pastaMidia, 'menu.jpg'));
                if (fs.existsSync(path.join(pastaMidia, 'menu.mp4'))) fs.unlinkSync(path.join(pastaMidia, 'menu.mp4'));

                fs.writeFileSync(caminhoDestino, buffer);

                if (!db.configuracoes) db.configuracoes = {};
                db.configuracoes.tipoMenuMidia = tipoMidiaSalva;
                db.configuracoes.caminhoMenuMidia = caminhoDestino;
                
                fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');

                await sock.sendMessage(from, { 
                    text: `✅ *[MENU ATUALIZADO]*\n\nA nova mídia do menu foi configurada com sucesso!\n✨ *Formato:* ${tipoMidiaSalva.toUpperCase()}` 
                }, { quoted: msg });

            } catch (e) {
                console.log("⚠️ Erro ao definir foto do menu:", e);
                sock.sendMessage(from, { text: '❌ Ocorreu um erro ao salvar a mídia.' }, { quoted: msg });
            }
            break;
        }

        case 'mute':
        case 'mutar': {
            if (!isGroup) return m.reply(config.messages.onlyGroup);
            if (!isOwner && !usuarioAdm) return m.reply(config.messages.onlyAdmin);

            let usuarioAlvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (!usuarioAlvo && args[0]) usuarioAlvo = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            if (!usuarioAlvo) return m.reply(`⚠️ Marque alguém para mutar.`);

            const numeroAlvo = usuarioAlvo.split('@')[0];
            
            if (numeroAlvo === limpoOwner || db.donos.includes(numeroAlvo)) return m.reply('❌ Não pode mutar administradores ou donos!');

            if (!db.usuarios_mutados) db.usuarios_mutados = {};
            if (!db.usuarios_mutados[from]) db.usuarios_mutados[from] = [];
            if (db.usuarios_mutados[from].includes(numeroAlvo)) return m.reply('⚠️ Usuário já mutado neste grupo!');

            db.usuarios_mutados[from].push(numeroAlvo);
            fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
            await m.reply(`🔇 @${numeroAlvo} mutado! Suas mensagens serão apagadas instantaneamente.`, { mentions: [usuarioAlvo] });
        }
        break;

        case 'unmute':
        case 'desmutar': {
            if (!isGroup) return m.reply(config.messages.onlyGroup);
            if (!isOwner && !usuarioAdm) return m.reply(config.messages.onlyAdmin);

            let usuarioAlvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (!usuarioAlvo && args[0]) usuarioAlvo = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            if (!usuarioAlvo) return m.reply(`⚠️ Marque alguém.`);

            const numeroAlvo = usuarioAlvo.split('@')[0];
            if (!db.usuarios_mutados?.[from]?.includes(numeroAlvo)) return m.reply('⚠️ Usuário não está na lista de mutados.');

            db.usuarios_mutados[from] = db.usuarios_mutados[from].filter(num => num !== numeroAlvo);
            fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
            await m.reply(`🔊 @${numeroAlvo} foi desmutado com sucesso!`, { mentions: [usuarioAlvo] });
        }
        break;

        case 'adv':
        case 'advertir': {
            if (!isGroup) return m.reply(config.messages.onlyGroup);
            if (!isOwner && !usuarioAdm) return m.reply(config.messages.onlyAdmin);

            let usuarioAlvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (!usuarioAlvo && args[0]) usuarioAlvo = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            if (!usuarioAlvo) return m.reply(`⚠️ Marque quem deseja advertir.`);

            const numeroAlvo = usuarioAlvo.split('@')[0];
            if (numeroAlvo === limpoOwner || db.donos.includes(numeroAlvo)) return m.reply('❌ Proteção activa: impossível advertir adms/donos.');

            if (!db.advertencias) db.advertencias = {};
            if (!db.advertencias[from]) db.advertencias[from] = {};
            if (!db.advertencias[from][numeroAlvo]) db.advertencias[from][numeroAlvo] = 0;

            db.advertencias[from][numeroAlvo] += 1;
            const totalAdv = db.advertencias[from][numeroAlvo];

            if (totalAdv >= 3) {
                delete db.advertencias[from][numeroAlvo];
                fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
                await sock.sendMessage(from, { text: `🔨 @${numeroAlvo} atingiu 3/3 advertências e foi banido automaticamente do chat!`, mentions: [usuarioAlvo] });
                await sock.groupParticipantsUpdate(from, [usuarioAlvo], 'remove').catch(() => m.reply('❌ Falha ao expulsar (Bot é adm?)'));
            } else {
                fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
                await sock.sendMessage(from, { text: `⚠️ @${numeroAlvo} recebeu uma advertência!\n📊 *Contador:* ${totalAdv}/3`, mentions: [usuarioAlvo] });
            }
        }
        break;

        case 'resetadv':
        case 'deladv':
        case 'removeradv': {
            if (!isGroup) return m.reply(config.messages.onlyGroup);
            if (!isOwner && !usuarioAdm) return m.reply(config.messages.onlyAdmin);

            let usuarioAlvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (!usuarioAlvo && args[0]) usuarioAlvo = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            if (!usuarioAlvo) return m.reply(`⚠️ Marque alguém.`);

            const numeroAlvo = usuarioAlvo.split('@')[0];
            if (!db.advertencias?.[from]?.[numeroAlvo]) return m.reply('✅ O usuário já está com histórico limpo (0 ADVs).');

            delete db.advertencias[from][numeroAlvo];
            fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
            await m.reply(`😇 Advertências de @${numeroAlvo} zeradas com sucesso!`, { mentions: [usuarioAlvo] });
        }
        break;

        case 'addpremium':
        case 'addprem': {
            if (!isOwner) return m.reply(config.messages.onlyOwner);
            let alvo = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0];
            if (!alvo) return await m.reply(`Mencione ou digite o número. Exemplo: ${prefix}addpremium @user`);
            
            if (!alvo.includes('@')) alvo = `${alvo}@s.whatsapp.net`;
            let numeroAlvo = alvo.split('@')[0];

            if (db.premium.includes(numeroAlvo)) return await m.reply('⭐ Este usuário já é Premium!');
            db.premium.push(numeroAlvo);
            fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
            await m.reply(`⭐ @${numeroAlvo} agora possui vantagens Premium!`, { mentions: [alvo] });
        }
        break;

        case 'delpremium':
        case 'delprem': {
            if (!isOwner) return m.reply(config.messages.onlyOwner);
            let alvo = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0];
            if (!alvo) return await m.reply(`Mencione alguém.`);
            
            if (!alvo.includes('@')) alvo = `${alvo}@s.whatsapp.net`;
            let numeroAlvo = alvo.split('@')[0];

            if (!db.premium.includes(numeroAlvo)) return await m.reply('❌ Usuário não é Premium.');
            db.premium = db.premium.filter(num => num !== numeroAlvo);
            fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
            await m.reply(`❌ Privilégios VIP Premium revogados de @${numeroAlvo}.`, { mentions: [alvo] });
        }
        break;

        case 'statsbot': {
            if (!isOwner) return;
            m.reply(`📊 *ESTATÍSTICAS DA ${config.botName.toUpperCase()}*\n\nTotal de comandos rodados: ${db.stats?.totalComandos || 0}\nPremium salvos: ${db.premium.length}\nDonos secundários: ${db.donos.length}\nLista Negra (Bans): ${db.bloqueados.length}\nManutenção Global: ${db.manutencao?.status ? "LIGADO ⚠️" : "DESLIGADO ✅"}`);
        }
        break;

        case 'manutencao': {
            if (!isOwner) return await m.reply(config.messages.onlyOwner);
            db.manutencao.status = !db.manutencao.status;
            fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
            const statusTxt = db.manutencao.status ? 'ATIVADO ⚠️ (O bot agora só responde aos donos)' : 'DESATIVADO ✅ (Bot liberado para todos)';
            await m.reply(`⚙️ Modo manutenção foi: *${statusTxt}*`);
        }
        break;

        case 'autostatus': {
            if (!isOwner) return await m.reply(config.messages.onlyOwner);
            db.autostatus.status = !db.autostatus.status;
            fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
            const statusTxt = db.autostatus.status ? 'ATIVADO 👀 (Visualizando status automaticamente)' : 'DESATIVADO 💤';
            await m.reply(`📸 Sistema de Auto-Status foi: *${statusTxt}*`);
        }
        break;

        case 'banirbot':
        case 'blockbot': {
            if (!isOwner) return await m.reply(config.messages.onlyOwner);
            let alvo = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0];
            if (!alvo) return await m.reply(`⚠️ Mencione o usuário ou digite o número.\nExemplo: ${prefix}banirbot @user`);
            
            if (!alvo.includes('@')) alvo = `${alvo}@s.whatsapp.net`;
            let numeroAlvo = alvo.split('@')[0];

            if (numeroAlvo === limpoOwner || db.donos.includes(numeroAlvo)) return await m.reply('❌ Você não pode banir diretores ou o dono principal!');
            if (db.bloqueados.includes(numeroAlvo)) return await m.reply('❌ Este usuário já está na blacklist!');

            db.bloqueados.push(numeroAlvo);
            fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
            await sock.sendMessage(from, { text: `🚫 @${numeroAlvo} foi banido permanentemente do sistema!`, mentions: [alvo] }, { quoted: msg });
        }
        break;

        case 'desbanirbot':
        case 'unblockbot': {
            if (!isOwner) return await m.reply(config.messages.onlyOwner);
            let alvo = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0];
            if (!alvo) return await m.reply(`⚠️ Mencione o usuário.`);
            
            if (!alvo.includes('@')) alvo = `${alvo}@s.whatsapp.net`;
            let numeroAlvo = alvo.split('@')[0];

            if (!db.bloqueados.includes(numeroAlvo)) return await m.reply('❌ Este usuário não está na blacklist.');

            db.bloqueados = db.bloqueados.filter(num => num !== numeroAlvo);
            fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
            await sock.sendMessage(from, { text: `✅ @${numeroAlvo} foi perdoado e removido da blacklist!`, mentions: [alvo] }, { quoted: msg });
        }
        break;

        case 'grupo':
        case 'group': {
            if (!isGroup) return await m.reply(config.messages.onlyGroup);
            if (!isOwner && !usuarioAdm) return await m.reply(config.messages.onlyAdmin);
            if (!args[0]) return await m.reply(`⚠️ Use: *${prefix}grupo abrir* ou *${prefix}grupo fechar*`);

            if (args[0].toLowerCase() === 'abrir' || args[0].toLowerCase() === 'open') {
                await sock.groupSettingUpdate(from, 'not_announcement');
                await m.reply('✅ O grupo foi *ABERTO*! Todos podem falar.');
            } else if (args[0].toLowerCase() === 'fechar' || args[0].toLowerCase() === 'close') {
                await sock.groupSettingUpdate(from, 'announcement');
                await m.reply('🔒 O grupo foi *FECHADO*! Apenas adms falam.');
            }
        }
        break;

        case 'kick':
        case 'ban': {
            if (!isGroup) return await m.reply(config.messages.onlyGroup);
            if (!isOwner && !usuarioAdm) return await m.reply(config.messages.onlyAdmin);

            let alvo = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.mentionedJid?.[0] || args[0];
            if (!alvo) return await m.reply(`⚠️ Marque quem deseja retirar.`);
            if (!alvo.includes('@')) alvo = `${alvo}@s.whatsapp.net`;

            if (alvo.split('@')[0] === limpoOwner) return await m.reply('❌ Impossível retirar o criador.');
            await sock.groupParticipantsUpdate(from, [alvo], 'remove');
            await m.reply('🔨 Usuário removido do palco com sucesso.');
        }
        break;

        case 'promover': {
            if (!isGroup) return m.reply(config.messages.onlyGroup);
            if (!isOwner && !usuarioAdm) return m.reply(config.messages.onlyAdmin);

            let alvo = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.mentionedJid?.[0] || args[0];
            if (!alvo) return m.reply(`⚠️ Marque o alvo.`);
            if (!alvo.includes('@')) alvo = `${alvo}@s.whatsapp.net`;

            await sock.groupParticipantsUpdate(from, [alvo], 'promote');
            await m.reply('👑 Membro promovido a Administrador local!');
        }
        break;

        case 'rebaixar': {
            if (!isGroup) return m.reply(config.messages.onlyGroup);
            if (!isOwner && !usuarioAdm) return m.reply(config.messages.onlyAdmin);

            let alvo = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.mentionedJid?.[0] || args[0];
            if (!alvo) return m.reply(`⚠️ Marque quem deseja rebaixar.`);
            if (!alvo.includes('@')) alvo = `${alvo}@s.whatsapp.net`;

            await sock.groupParticipantsUpdate(from, [alvo], 'demote');
            await m.reply('📉 Cargo administrativo retirado.');
        }
        break;

        case 'infogp': {
            if (!isGroup) return await m.reply(config.messages.onlyGroup);
            try {
                const metadata = await sock.groupMetadata(from);
                const participantesLista = metadata.participants || [];
                const adms = participantesLista.filter(p => p.admin).length;

                const txtInfo = `🏢 *DADOS DO GRUPO LOCAL* 🏢\n\n` +
                                 `📝 *Nome:* ${metadata.subject}\n` +
                                 `🆔 *ID:* ${metadata.id}\n` +
                                 `👥 *Total de Membros:* ${participantesLista.length}\n` +
                                 `👑 *Administradores:* ${adms}\n` +
                                 `📅 *Criado em:* ${new Date(metadata.creation * 1000).toLocaleString('pt-BR')}\n\n` +
                                 `⚙️ _Use os comandos administrativos para gerenciar este chat._`;
                await m.reply(txtInfo);
            } catch (err) {
                await m.reply('❌ Erro ao coletar informações do grupo.');
            }
        }
        break;

        case 'antilink': {
            if (!isGroup) return await m.reply(config.messages.onlyGroup); 
            if (!isOwner && !usuarioAdm) return await m.reply(config.messages.onlyAdmin);

            const acao = args[0]?.toLowerCase();
            
            if (acao === 'ativar' || acao === 'on') {
                if (!db.configuracoes) db.configuracoes = {};
                db.configuracoes.antilink = true;
                fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
                await sock.sendMessage(from, { text: '🛡️ Anti-link ATIVADO com sucesso neste grupo!' }, { quoted: msg });
            } else if (acao === 'desativar' || acao === 'off') {
                if (!db.configuracoes) db.configuracoes = {};
                db.configuracoes.antilink = false;
                fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');
                await sock.sendMessage(from, { text: '🛡️ Anti-link DESATIVADO!' }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: `💡 Use: *${prefix}antilink ativar* ou *${prefix}antilink desativar*` }, { quoted: msg });
            }
            break;
        }

        case 'setmenuitem':
        case 'setitem': {
            if (!isOwner) return m.reply(config.messages.onlyOwner);
            const novoItem = args.join(' ').trim();

            if (!novoItem) {
                return sock.sendMessage(from, { 
                    text: `❌ Você precisa especificar o emoji!\n\n💡 *Exemplo:* \n${prefix}setmenuitem ✨\n${prefix}setmenuitem 💜` 
                }, { quoted: msg });
            }

            if (!db.configuracoes) db.configuracoes = {};
            db.configuracoes.menuItem = novoItem;
            fs.writeFileSync(caminhoDB, JSON.stringify(db, null, 4), 'utf8');

            await sock.sendMessage(from, { 
                text: `✅ *[SUCESSO]*\n\nO emoji decorativo foi alterado para: ${novoItem}` 
            }, { quoted: msg });
            break;
        }

        default: {
            let textoDefault = `╭―――――――――
║ 👋 Olá, ${msg.pushName || 'Usuário'}!
╠―――――――――
║ 🤧 Comando não encontrado
╠―――――――――
║ 📖 Use ${prefix}menu para ver
║ os comandos disponíveis
╰―――――――――`.trim();

            const tipoSalvo = db.configuracoes?.tipoMenuMidia;
            const caminhoSalvo = db.configuracoes?.caminhoMenuMidia;
            const caminhoNaoEncontrado = path.resolve(__dirname, 'asents', 'naoencontrado.jpg');

            if (tipoSalvo && caminhoSalvo && fs.existsSync(caminhoSalvo)) {
                const bufferMidia = fs.readFileSync(caminhoSalvo);
                await sock.sendMessage(from, { 
                    [tipoSalvo === 'imagem' ? 'image' : 'video']: bufferMidia, 
                    caption: textoDefault, 
                    gifPlayback: tipoSalvo === 'video'
                }, { quoted: msg });
            } else if (fs.existsSync(caminhoNaoEncontrado)) {
                await sock.sendMessage(from, { 
                    image: fs.readFileSync(caminhoNaoEncontrado), 
                    caption: textoDefault 
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: textoDefault }, { quoted: msg });
            }
        }
        break;
    }
};

