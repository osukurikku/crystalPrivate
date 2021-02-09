const configPrivate = require("../config.json");
const utils = require("../../utils");
const {RichEmbed} = require("discord.js");
const {AntiCheat} = require("./index");
const fs = require("fs");
/*
 {\"gm\": 0,
 \"user\":
 {
 \"username\": \"Shinki\", \"userID\": 1901, \"rank\": 126, \"oldaccuracy\": 90.74479675293, \"accuracy\": 90.802619934082, \"oldpp\": 1696, \"pp\": 1699},
 \"score\": {\"scoreID\": 91043, \"mods\": 0, \"accuracy\": 0.8563218390804598, \"missess\": 1, \"combo\": 201, \"pp\": 46.480323791503906, \"rank\": 1, \"ranking\": null}, \"beatmap\": {\"beatmapID\": 523397, \"beatmapSetID\": 224175, \"max_combo\": 466, \"song_name\": \"Tomatsu Haruka - courage [Insane]\"}}W
*/

module.exports = {
    call: async (dsc, channel, message) => {
        let message_json = JSON.parse(message);
        let replay;
        try {
            replay = fs.readFileSync(`${configPrivate['oopsie-replay-prefix']}${message_json['score']['scoreID']}.osr`);
        } catch (e) {
            console.error(`[O-o-o-psie] can't open replay! ${message_json['score']['scoreID']}`)
            return;
        }
        if ((message_json['score']['mods'] & 128) > 0 || (message_json['score']['mods'] & 8192) > 0) return; // don't execute it on relax/ap

        let file = Buffer.from(replay);
        let ACInstance = new AntiCheat(file, message_json['score']['mods']);
        try {
            await ACInstance.parseFile();
        } catch (e) {
            console.error(`[O-o-o-psie] can't parse replay! ${message_json['score']['scoreID']}`)
            return;
        }

        let embed = new RichEmbed()
            .setAuthor(`${message_json.user.username}`, `https://a.kurikku.pw/${message_json.user.userID}`, `https://kurikku.pw/u/${message_json.user.userID}`)
            .setColor(0xffee58)
            .setFooter('osu!Kurikku • today at '+utils.getDateTime())

        let need_to_send = false;
        switch (message_json['gm']) {
            case 0:
                // STD LOGIC
                let diffv1v2 = ACInstance.TimewarpDetector();
                if (diffv1v2[2] < 13) {
                    embed.setDescription("Prob timewarped chmo.")
                    need_to_send = true;
                }
                embed.addField("CV Frametime v1(includes dt/ht)", diffv1v2[0].toString(), true)
                embed.addField("CV Frametime v2", diffv1v2[1].toString(), true);
                embed.addField("CV Frametime v3(circleguard edition)", diffv1v2[2].toString(), true);
                break;
            case 1:
                let alert_data = ACInstance.TaikoLowPressesDetector();
                if (alert_data[0]) {
                    embed.setDescription("Dolboeb was found on taiko gamemode with low keypresses")
                    for (const keyInfo of alert_data[1]) {
                        embed.addField(
                            keyInfo[0],
                            `${keyInfo[1].toFixed(2)}ms`,
                            true
                        )
                    }
                    need_to_send = alert_data[0];
                }
                break;
        }

        embed.addField(`ScoreID`, `${message_json['score']['scoreID']}`, true)
        if (need_to_send) {
            dsc.channels.get(configPrivate['oopsie-poster-chan']).send(embed);
        }
    }
}