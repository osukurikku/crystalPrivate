const axios = require("axios");
const utils = require("../../utils");
const configPrivate = require("../config.json");

module.exports = {
    db: null,
    init: async (db) => {
        module.exports.db = db
        console.log("[Twitch Check] checking is online!")

        while (true) {
            // Check new streamers
            await module.exports.checkNewStreams()
            // Check existed strems
            await module.exports.checkExistsStreams()

            // wait cooldown
            await utils.sleep(configPrivate['twitch-update']*1000)
        }
    },
    checkNewStreams: async () => {
        try {
            let streamers = await utils.query(module.exports.db, "select user_id, account_id from social_networks where account_type = 'twitch'");

            for (const streamer of streamers) {
                let accId = streamer.account_id;
                let twitchResult = await module.exports.checkTwitchStream(accId);
                if (twitchResult.length < 1) continue; // skip useless user

                // user stream exist!
                let streamExists = await utils.query(module.exports.db, `select * from twitch_streams where streamer = ?`, accId);
                if (streamExists.length > 0) continue; // skip he exist

                let isUserOnline = await module.exports.checkUserIdOnline(streamer.user_id);
                if (!isUserOnline) continue; // skip he is offline on kurikku)

                // add new stream to checking queue
                await utils.query(
                    module.exports.db,
                    "insert into twitch_streams (user_id, streamer, name, viewer_count) values (?, ?, ?, ?)",
                    streamer.user_id, accId, twitchResult[0]['title'], twitchResult[0]['viewer_count'] 
                )
                console.log(`[Twitch Check] User ${streamer.user_id} has turned on stream with ${twitchResult[0]['viewer_count']} viewers!`)
            }
        } catch (e) {
            console.log(e)
        }
    },
    checkExistsStreams: async () => {
        try {
            let streams = await utils.query(module.exports.db, "select * from twitch_streams");

            for (const stream of streams) {
                let twitchStream = await module.exports.checkTwitchStream(stream.streamer);
                let isUserOnline = await module.exports.checkUserIdOnline(stream.user_id);
                if (twitchStream.length < 1 || !isUserOnline) {
                    // we need to delete this stream, user now is offline on twitch or in kurikku
                    await utils.query(module.exports.db, "delete from twitch_streams where id = ?", stream.id)
                    console.log(`[Twitch Check] User ${stream.user_id} has stoped him stream!`)
                    continue;
                }

                // user online! let update values
                await utils.query(
                    module.exports.db,
                    "update twitch_streams set name = ?, viewer_count = ? where id = ?",
                    twitchStream[0]['title'], twitchStream[0]['viewer_count'], stream.id
                )
            }
        } catch (e) {
            console.log(e);
        }
    },
    checkUserIdOnline: async (user_id) => {
        try {
            let result = await axios.get("https://c.kurikku.pw/api/v1/isOnline", {
                params: {
                    id: user_id
                }
            })
            return result.data.result
        }
        catch (e) {
            console.log(`[Twitch Check] user ${user_id} can't be checked isOnline`)
            return false;
        }
    },
    checkTwitchStream: async (user) => {
        try {
            let result = await axios.get("https://api.twitch.tv/helix/streams", {
                params: {
                    user_login: user
                },
                headers: {
                    "Authorization": "Bearer "+configPrivate["twtich-bearer-token"]
                }
            })
            return result.data.data
        } catch (e) {
            await utils.sleep(5000)
            console.log(e)
            return []
        }
    }
}