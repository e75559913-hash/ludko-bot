const TelegramBot = require('node-telegram-bot-api');

const TOKEN = '8871083538:AAF2v9Vulpk_UqEQTI33C1Q_gurtaIDrdpo';
const ADMIN_ID = 6669055918;
const CHAT_ID = -1003570027486;

const bot = new TelegramBot(TOKEN, { polling: true });

let game = { active: false, type: null, prize: null, secretNumber: null, min: null, max: null, silenceUntil: null, silenceSec: null, lastUser: null, lastName: null };
let players = {};
let adminState = {};

bot.onText(/\/start/, (msg) => {
    const uid = msg.from.id;
    if (msg.chat.type === 'private' && uid !== ADMIN_ID) {
        return bot.sendMessage(msg.chat.id, '🚫 Только для крутых!');
    }
    if (msg.chat.type === 'private' && uid === ADMIN_ID) {
        return bot.sendMessage(msg.chat.id, '🎮 АДМИН-ПАНЕЛЬ', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🎰 777', callback_data: 'g777' }, { text: '🔢 Число', callback_data: 'gguess' }, { text: '⏳ Слово', callback_data: 'gword' }]
                ]
            }
        });
    }
    bot.sendMessage(msg.chat.id, '🎰 Лудко-Бот на связи! /top');
});

bot.on('callback_query', (q) => {
    if (q.from.id !== ADMIN_ID) return bot.answerCallbackQuery(q.id, { text: '🚫 Не админ' });
    const d = q.data;
    if (d === 'g777') {
        game = { active: true, type: '777', prize: null };
        bot.sendMessage(q.message.chat.id, '🎰 777\nВведи приз:');
        adminState[q.from.id] = 'p777';
    } else if (d === 'gguess') {
        game = { active: true, type: 'guess', prize: null, secretNumber: null, min: null, max: null };
        bot.sendMessage(q.message.chat.id, '🔢 Введи: МИН МАКС ЗАГАД ПРИЗ');
        adminState[q.from.id] = 'sguess';
    } else if (d === 'gword') {
        game = { active: true, type: 'word', prize: null, silenceSec: null, silenceUntil: null, lastUser: null, lastName: null };
        bot.sendMessage(q.message.chat.id, '⏳ Введи: СЕКУНДЫ ПРИЗ');
        adminState[q.from.id] = 'sword';
    }
    bot.answerCallbackQuery(q.id);
});

bot.on('message', (msg) => {
    if (msg.from.id !== ADMIN_ID) return;
    const text = msg.text?.trim();
    const state = adminState[msg.from.id];
    
    if (state === 'p777') {
        game.prize = text;
        delete adminState[msg.from.id];
        bot.sendMessage(CHAT_ID, `🎰 ИГРА 777!\nКидайте 🎰 — первый выбивший 777 получит: ${text}!`);
        bot.sendMessage(msg.chat.id, `✅ Запущено! Приз: ${text}`);
    } else if (state === 'sguess') {
        const p = text.split(' ');
        game.min = parseInt(p[0]);
        game.max = parseInt(p[1]);
        game.secretNumber = parseInt(p[2]);
        game.prize = p.slice(3).join(' ') || 'Приз';
        delete adminState[msg.from.id];
        bot.sendMessage(CHAT_ID, `🔢 УГАДАЙ ЧИСЛО!\nОт ${game.min} до ${game.max}. Приз: ${game.prize}\n\nПишите числа — без подсказок!`);
        bot.sendMessage(msg.chat.id, `✅ Загадано: ${game.secretNumber}`);
    } else if (state === 'sword') {
        const p = text.split(' ');
        game.silenceSec = parseInt(p[0]);
        game.prize = p.slice(1).join(' ') || 'Приз';
        game.silenceUntil = Date.now() + game.silenceSec * 1000;
        game.lastUser = null;
        game.lastName = null;
        delete adminState[msg.from.id];
        bot.sendMessage(CHAT_ID, `⏳ ПОСЛЕДНЕЕ СЛОВО!\nЕсли чат замолчит на ${game.silenceSec} сек — победит последний написавший.\nПриз: ${game.prize}\n\nОбщайтесь!`);
        bot.sendMessage(msg.chat.id, '✅ Запущено!');
    }
});

bot.on('message', (msg) => {
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') return;
    if (msg.chat.id !== CHAT_ID) return;
    if (!game.active) return;
    
    const uid = msg.from.id;
    const uname = msg.from.username || msg.from.first_name || 'Аноним';
    
    if (game.type === '777' && msg.dice && msg.dice.emoji === '🎰' && msg.dice.value === 64) {
        if (!players[uid]) players[uid] = { name: uname, wins: 0 };
        players[uid].wins++;
        game.active = false;
        bot.sendMessage(CHAT_ID, `🎉 @${uname} выбил 777! Получает: ${game.prize}!`);
    }
    
    if (game.type === 'guess' && msg.text && /^-?\d+$/.test(msg.text.trim())) {
        const x = parseInt(msg.text.trim());
        if (x < game.min || x > game.max) return;
        if (x === game.secretNumber) {
            if (!players[uid]) players[uid] = { name: uname, wins: 0 };
            players[uid].wins++;
            game.active = false;
            bot.sendMessage(CHAT_ID, `🎉 @${uname} угадал число ${game.secretNumber}! Получает: ${game.prize}!`);
        }
        // Без подсказок — ничего не отвечаем
    }
    
    if (game.type === 'word' && (msg.text || msg.sticker || msg.dice)) {
        game.lastUser = uid;
        game.lastName = uname;
        game.silenceUntil = Date.now() + game.silenceSec * 1000;
    }
});

// Проверка тишины
setInterval(() => {
    if (game.active && game.type === 'word' && game.silenceUntil && Date.now() >= game.silenceUntil) {
        if (game.lastUser) {
            if (!players[game.lastUser]) players[game.lastUser] = { name: game.lastName, wins: 0 };
            players[game.lastUser].wins++;
            bot.sendMessage(CHAT_ID, `⏰ Время вышло! Последним был @${game.lastName}.\n🎉 Получает: ${game.prize}!`);
        } else {
            bot.sendMessage(CHAT_ID, '⏰ Время вышло, но никто не написал...');
        }
        game.active = false;
    }
}, 5000);

bot.onText(/\/top/, (msg) => {
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') return;
    const arr = Object.values(players).sort((a, b) => b.wins - a.wins).slice(0, 10);
    if (!arr.length) return bot.sendMessage(CHAT_ID, '🏆 ТОП-10 ЛУДОМАНОВ пока пуст...');
    let txt = '🏆 ТОП-10 ЛУДОМАНОВ:\n\n';
    arr.forEach((p, i) => txt += `${i+1}. ${p.name}: ${p.wins} побед\n`);
    bot.sendMessage(CHAT_ID, txt);
});

console.log('🎰 ЛУДКО-БОТ ГОТОВ! Жду 777...');
