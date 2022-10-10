const Helpers = require('./helpers');
const utils = require("../../utils");
const Discord = require("discord.js");
const crypto = require("crypto");
const UnitPay = require("unitpay-api").default;

const SECRET_KEY = '';
const PUBLIC_KEY = '';

const payment = new UnitPay({
    secretKey: SECRET_KEY
})

const CIS_COUNTRIES = ["RU", "UA", "KZ", "AZ", "AM", "BY", "KG", "MD", "TJ", "UZ", "GE"];

module.exports = {
    dbpool: null,
    client: null,
    execute: async function (req, res, next) {     
        // Получаем параметры GET-запроса
        let request = req.query;
    
        if (Helpers.empty(request) || Helpers.empty(request.params) || !Helpers.is_array(request.params)) {
            return getResponseError('Incorrect request');
        }
    
        let method = request.method;
        let params = request.params;

        if (params.signature != getSHA256Sign(method, params, SECRET_KEY)) {
            return getResponseError('Invalid digital sign');
        }
    
        if (method == 'check') {
            let result = await utils.query(
                module.exports.dbpool, 
                `SELECT id FROM users_payment WHERE id = ?`,
                params.unitpayId
            )
            if (result.length > 0) {
                return getResponseSuccess('OK');
            }

            if (+params.account === NaN) {
                return getResponseError('account is not valid');
            }

            result = await utils.query(
                module.exports.dbpool,
                'insert into users_payment values (?, ?, ?, 0)',
                params.unitpayId, params.account, params.sum
            )
    
            return getResponseSuccess('OK');
        }
    
        if (method == 'pay') {
            let result = await utils.query(
                module.exports.dbpool, 
                `SELECT completed FROM users_payment WHERE id = ?`,
                params.unitpayId
            )
            if (result.length < 1) {
                return getResponseError('Bad payment');
            }
    
            if (result && result[0].completed === 1) {
                return getResponseSuccess('OK');
            }
            
            await utils.query(
                module.exports.dbpool,
                'UPDATE users_payment SET completed = 1 WHERE id = ?',
                +params.unitpayId
            )
            await utils.query(
                module.exports.dbpool,
                'update users set balance = balance + ? where id = ?',
                +params.sum, +params.account
            )

            const nickname = await utils.query(
                module.exports.dbpool,
                'select username from users where id = ?',
                +params.account
            )
            if (nickname.length > 0) {
                var embed = new Discord.MessageEmbed()
                .setTitle(`New donation!`)
                .setAuthor(nickname[0].username)
                .setColor("aa1a4d")
                .setDescription(`Hey! Thank you!`)
                .addField("Summ", `${params.sum} RUB`)
                .addField("Donate link", "https://kurikku.pw/donate")
    
                module.exports.client.channels.cache.get("511200428122177537").send({embed});
            }
            
            return getResponseSuccess('OK');
        }
    
        // Успешное завершение
        function getResponseSuccess(message) {
            res.send(
                {
                    result: {
                        message: message
                    }
                }
            );
            return next();
        }
    
        // Ошибка запроса
        function getResponseError(message) {
            res.send(
                {
                    error: {
                        code: -32000,
                        message: message
                    }
                }
            );
            return next();
        }
    
        // Генерация цифровой подписи
        function getSHA256Sign(method, params, secretKey) {
            let array = []; 
            for (let property in Helpers.ksort(params)) {
                if (property !== 'signature' && property !== "sign") {
                    array.push(params[property]);
                }
            }
            return crypto.createHash('sha256').update(`${method}{up}`+array.join('{up}') + `{up}${secretKey}`).digest('hex')
        }
    },
    executeForm: async function (req, res, next) {
        let request = req.query;
    
        if (Helpers.empty(request) || !('acc' in req.query) || !('sum' in req.query)) {
            res.send({
                'error': {
                    'msg': 'Arguments has wrong order'
                }
            })
            return next();
        }

        const account = await utils.query(
            module.exports.dbpool,
            `select users.username, users_stats.country from users inner join users_stats on users_stats.id = users.id where users.id = ?`,
            +req.query.acc
        )
        if (account.length < 1) {
            res.send({
                'error': {
                    'msg': 'Account is wrong'
                }
            })
            return next();
        }

        const form = payment.form(PUBLIC_KEY, {
            account: req.query.acc,
            sum: +req.query.sum,
            desc: (CIS_COUNTRIES.includes(account[0].country)) ? `Пополнение счёта на ${+req.query.sum}RUB для ${account[0].username}` : `Top up the account for ${+req.query.sum}RUB for ${account[0].username}`,
            currency: "RUB"
        })

        res.send({
            result: {
                url: form
            }
        })
        return next();
    }
}
