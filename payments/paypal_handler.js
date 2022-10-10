const utils = require("../../utils");
const Discord = require("discord.js");
const querystring = require('querystring');
const request = require('request');
const axios = require("axios");

module.exports = {
    dbpool: null,
    client: null,
    execute: async function (req, res, next) {
        // STEP 1: read POST data
        req.body = req.body || {};
        res.send('OK');
        next();

        // read the IPN message sent from PayPal and prepend 'cmd=_notify-validate'
        let postreq = 'cmd=_notify-validate';
        for (const key in req.body) {
            if (req.body.hasOwnProperty(key)) {
                const value = querystring.escape(req.body[key]);
                postreq = postreq + "&" + key + "=" + value;
            }
        }

        // Step 2: POST IPN data back to PayPal to validate
        const options = {
            url: 'https://www.paypal.com/cgi-bin/webscr',
            method: 'POST',
            headers: {
                'Connection': 'close'
            },
            body: postreq,
            strictSSL: true,
            rejectUnauthorized: false,
            requestCert: true,
            agent: false
        };

        request(options, async function callback(error, response, body) {
            if (!error && response.statusCode === 200) {

                // inspect IPN validation result and act accordingly
                if (body.substring(0, 8) === 'VERIFIED') {
                    // The IPN is verified, process it
                    console.log('Verified IPN!'.green);
                    console.log('\n\n');

                    // assign posted variables to local variables
                    const username = req.body['custom'].split("=")[1];
                    if (username === undefined) {
                        return;
                    }
                    const payment_status = req.body['payment_status'];
                    const payment_amount = req.body['mc_gross'];
                    const payment_currency = req.body['mc_currency'];

                    let to_payout = payment_amount;

                    if (payment_currency !== "RUB" && payment_currency === "EUR") {
                        const currency_globals = await axios.get("https://www.cbr-xml-daily.ru/daily_json.js");
                        to_payout = (currency_globals.data.Valute.EUR.Value * payment_amount).toFixed(2);
                    }

                    //Lets check a variable
                    console.log("Checking variable".bold);
                    console.log("payment_status:", payment_status)
                    console.log('\n\n');

                    // IPN message values depend upon the type of notification sent.
                    // To loop through the &_POST array and print the NV pairs to the screen:
                    console.log('Printing all key-value pairs...'.bold)
                    for (var key in req.body) {
                        if (req.body.hasOwnProperty(key)) {
                            var value = req.body[key];
                            console.log(key + "=" + value);
                        }
                    }

                    await utils.query(
                        module.exports.dbpool,
                        'update users set balance = balance + ? where username = ?',
                        +to_payout, username
                    )

                    var embed = new Discord.MessageEmbed()
                        .setTitle(`New donation!`)
                        .setAuthor(username)
                        .setColor("aa1a4d")
                        .setDescription(`Hey! Thank you!`)
                        .addField("Summ", `${payment_amount} ${payment_currency}`)
                        .addField("Donate link", "https://kurikku.pw/donate")

                    module.exports.client.channels.cache.get("511200428122177537").send({embed});
                } else if (body.substring(0, 7) === 'INVALID') {
                    // IPN invalid, log for manual investigation
                    console.error('Invalid IPN!');
                    console.log('\n\n');
                }
            }
        });

        return next();
    }
}