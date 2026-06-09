#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "Atualizando pacotes do Termux..."
pkg update -y
pkg upgrade -y

echo "Instalando dependências do sistema..."
pkg install nodejs git ffmpeg imagemagick -y

echo "Instalando dependências do bot..."
npm install

echo "Instalação concluída. Inicie com: npm start"
