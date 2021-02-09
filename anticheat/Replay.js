const LZMA = require("lzma");
const util = require('util');
const osuBuffer = require('osu-buffer');
const {ReplayFrame} = require("./ReplayFrame");

const PromiseLZMADecompress = function (data) {
    return new Promise((resolve, reject) => {
        LZMA.decompress(data, (data2, error) => {
            if (error) return reject(error);
            resolve(data2);
        })
    })
}

class Replay {
    constructor(replay_file) {
        this.replay_file = replay_file;
        this.osu_buffer = new osuBuffer(this.replay_file);

        this.mods = 0;
        this.frames = [];
    }

    async readFrames() {
        try {
            let data = await PromiseLZMADecompress(this.replay_file);
            if (data === null) return false;

            let lastTime = 0.00;
            let frames = data.split(",");

            for (const [ind, frame] of frames.entries()) {
                let fSplit = frame.split("|");

                if (fSplit.length < 4) continue;
                if (fSplit[0] === "-12345") continue;

                let diff = parseFloat(fSplit[0]);
                lastTime += diff;

                // osu-stable adds a zero-tcime frame before potentially valid negative user frames. we need to ignore this.
                if (ind === 0 && diff === 0) continue;
                if (diff < 0) continue;
                //time, timeDiff, x, y, buttons
                this.frames.push(
                    new ReplayFrame(lastTime, diff, parseFloat(fSplit[1]), parseFloat(fSplit[2]), parseInt(fSplit[3]))
                )
            }

            return true;
        } catch(e) {
            console.error(e);
            return false;
        }
    }
}

module.exports = { Replay }