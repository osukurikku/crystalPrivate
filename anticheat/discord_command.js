const utils = require("../../utils");
const {AntiCheat} =  require("./index");
const configPrivate = require("../config.json");
const fs = require("fs");
const {RichEmbed} = require("discord.js");

const isNumeric = (s) => {
    return !isNaN(s - parseFloat(s));
}

module.exports = {
    async execute(client, message, args) {
//	console.log(message.member);
        if (!(message.member.roles.has('523944680787017728') || message.member.roles.has('511200922966294529') || message.member.roles.has('511200922966294529'))) return;
        if (args.length < 1) return;
        if (!isNumeric(args[0])) return;

        let score_from_db = await utils.query(client.config.SQL, `select userid, mods, play_mode from scores where id = ?`, +args[0]);

        if (score_from_db.length < 1) return;
        score_from_db = score_from_db[0];

        let replay;
        try {
            replay = fs.readFileSync(`${configPrivate['oopsie-replay-prefix']}${args[0]}.osr`);
        } catch (e) {
            console.error(`[O-o-o-psie] can't open replay! ${args[0]}`)
            console.error(e);
            return;
        }
        if ((score_from_db.mods & 128) > 0 || (score_from_db.mods & 8192) > 0) return; // don't execute it on relax/ap

        let file = Buffer.from(replay);
        let ACInstance = new AntiCheat(file, score_from_db.mods);
        try {
            await ACInstance.parseFile();
        } catch (e) {
            console.error(`[O-o-o-psie] can't parse replay! ${args[0]}`)
            return;
        }

        let embed = new RichEmbed()
            .setAuthor(`Some user (${score_from_db.userid})`, `https://a.kurikku.pw/${score_from_db.userid}`, `https://kurikku.pw/u/${score_from_db.userid}`)
            .setColor(0xffee58)
            .setFooter('osu!Kurikku • today at '+utils.getDateTime())

        switch (score_from_db.play_mode) {
            case 0:
                // STD LOGIC
                let diffv1v2 = ACInstance.TimewarpDetector();
                if (diffv1v2[2] < 13) {
                    embed.setDescription("Prob timewarped chmo.")
                }
                embed.addField("CV Frametime v1(includes dt/ht)", diffv1v2[0].toString(), true)
                embed.addField("CV Frametime v2", diffv1v2[1].toString(), true);
                embed.addField("CV Frametime v3(circleguard edition)", diffv1v2[2].toString(), false);
                break;
            case 1:
                let alert_data = ACInstance.TaikoLowPressesDetector();
                if (alert_data[0]) {
                    embed.setDescription("Prob dolboeb on taiko with low keypresses")
                }
                for (const keyInfo of alert_data[1]) {
                    embed.addField(
                        keyInfo[0],
                        `${keyInfo[1].toFixed(2)}ms`,
                        true
                    )
                }
                break;
        }

        embed.addField(`ScoreID`, `${args[0]}`, true)
        message.channel.send(embed).catch(console.error);
    }
}