const axios = require("axios");

module.exports = {
    getCoolMapStat: async (id, mods, combo, acc, xmiss) => {
        return axios.get(`https://pp.osuck.net/pp`, {
            params: {
                'id': id,
                'mods': mods,
                'combo': combo,
                'acc': acc,
                'miss': xmiss
            }
        })
    }
}