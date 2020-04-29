const twitchCron = require("./twitch_checker");

module.exports = {
    db: null,
    init: (clientObject) => {
        module.exports.db = clientObject.config.SQL

        console.log("[Private] Module called!")
        
        // Twitch checker!
        console.log("[Private] Twitch Check inited")
        twitchCron.init(clientObject)
    }
}


