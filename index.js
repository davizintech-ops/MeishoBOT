const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline-sync');
const qrcode = require('qrcode-terminal');
const config = require('./config');

// Importa o teu handler de comandos externo
const handler = require('./lib/handler');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionName);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    // MODO 1: QR Code só será impresso se o pairing code estiver desativado
    printQRInTerminal: !config.usePairingCode,
    browser: ['Ubuntu', 'Chrome', '20.0.04'], // Padrão mais aceito pelo WhatsApp Web
    auth: state
  });

  // ==========================================
  // METODO DE LOGIN 2: CÓDIGO DE PAREAMENTO (PAIRING CODE)
  // ==========================================
  if (config.usePairingCode && !sock.authState.creds.registered) {
    console.log('\n=========================================');
    console.log('📱 MÉTODO DE LOGIN: CÓDIGO DE PAREAMENTO');
    console.log('=========================================');
    
    // Pega do config ou pergunta no terminal, limpando letras e símbolos
    let phoneNumber = config.phoneNumber ? String(config.phoneNumber).replace(/\D/g, '') : '';
    
    if (!phoneNumber) {
      phoneNumber = readline.question('Insira o número do Bot com código do país (Ex: 5564999999999): ').replace(/\D/g, '');
    }

    if (!phoneNumber || phoneNumber.length < 10) {
      console.log('❌ Número inválido! Reinicie o bot e digite corretamente.');
      process.exit(0);
    }

    // Delay inteligente aguardando o socket conectar aos servidores para pedir o código
    setTimeout(async () => {
      try {
        let code;
        try {
          // Primeira tentativa com o número fornecido
          code = await sock.requestPairingCode(phoneNumber);
        } catch (firstError) {
          // Sistema de correção automática de 9º dígito para números do Brasil (DDI 55)
          if (phoneNumber.startsWith('55')) {
            let ddd = phoneNumber.substring(2, 4);
            let resto = phoneNumber.substring(4);

            if (resto.length === 9 && resto.startsWith('9')) {
              // Se tinha o 9, tenta remover
              phoneNumber = '55' + ddd + resto.substring(1);
            } else if (resto.length === 8) {
              // Se não tinha o 9, tenta adicionar
              phoneNumber = '55' + ddd + '9' + resto;
            }
            console.log(`⚠️ Ajustando formato do número para o WhatsApp: ${phoneNumber}`);
            code = await sock.requestPairingCode(phoneNumber);
          } else {
            throw firstError;
          }
        }

        if (code) {
          console.log('\n-----------------------------------------');
          console.log(`👉 O TEU CÓDIGO DE LOGIN É: \x1b[32m${code}\x1b[0m`);
          console.log('-----------------------------------------\n');
          console.log('Abra o WhatsApp > Aparelhos Conectados > Conectar um aparelho > Conectar com número de telefone.');
        }
      } catch (err) {
        console.error('❌ Erro fatal ao gerar código de pareamento:', err.message || err);
        console.log('Dica: Apague a pasta "session" com "rm -rf session" e mude o número no config.js.');
      }
    }, 3000);
  }

  // Salva as credenciais automaticamente
  sock.ev.on('creds.update', saveCreds);

  // Gerenciamento da Conexão
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    // ==========================================
    // METODO DE LOGIN 1: QR CODE EM TERMINAL
    // ==========================================
    if (qr && !config.usePairingCode) {
      console.log('\n=========================================');
      console.log('📸 MÉTODO DE LOGIN: ESCANEIE O QR CODE');
      console.log('=========================================');
      qrcode.generate(qr, { small: true });
    }

    // Lógica de Reconexão e Status
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Conexão fechada. Tentando reconectar:', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('\n=========================================');
      console.log('✅ BOT CONECTADO COM SUCESSO!');
      console.log(`🤖 Logado como: ${sock.user.name || 'Furina MD'}`);
      console.log('=================================\n');
    }
  });

  // Ouvinte de Mensagens que joga pro handler.js
  sock.ev.on('messages.upsert', async (chatUpdate) => {
    try {
      const msg = chatUpdate.messages[0];
      if (!msg || !msg.message || msg.key.fromMe) return;

      // Executa o seu arquivo handler.js gigante de comandos
      await handler(sock, msg);

    } catch (error) {
      console.error('Erro no processamento do handler:', error);
    }
  });
}

startBot().catch(err => console.error('Erro fatal:', err));

