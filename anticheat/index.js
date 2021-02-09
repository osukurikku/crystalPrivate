const {ButtonState} = require("./ReplayFrame");
const {Replay} = require("./Replay");
var nj = require('numjs');

let KeyboardTSEnum;
(function (KeyboardTSEnum) {
    KeyboardTSEnum[KeyboardTSEnum["None"] = 0] = "None";
    KeyboardTSEnum[KeyboardTSEnum["M1"] = 1] = "M1";
    KeyboardTSEnum[KeyboardTSEnum["M2"] = 2] = "M2";
    KeyboardTSEnum[KeyboardTSEnum["K1"] = 5] = "K1";
    KeyboardTSEnum[KeyboardTSEnum["K2"] = 10] = "K2";
})(KeyboardTSEnum || (KeyboardTSEnum = {}));

class AntiCheat {
    constructor(replayFile, mods) {
        this.replay = new Replay(replayFile);
        this.replay_file = replayFile;
        this.mods = mods;
    }

    async parseFile() {
        return await this.replay.readFrames();
    }

    CalculateAverageFrameTimeDiffV2() {
        let count = 0;
        let sum = 0;

        const frames = this.replay.frames;

        for (let i = 1; i < frames.length - 1; i += 1) {
            if (!((frames[i - 1].buttons & ButtonState.K1) === ButtonState.K1)
                && !((frames[i - 1].buttons & ButtonState.K2) === ButtonState.K2)
                && !((frames[i - 1].buttons & ButtonState.M1) === ButtonState.M1)
                && !((frames[i - 1].buttons & ButtonState.M2) === ButtonState.M2)

                && !((frames[i].buttons & ButtonState.K1) === ButtonState.K1)
                && !((frames[i].buttons & ButtonState.K2) === ButtonState.K2)
                && !((frames[i].buttons & ButtonState.M1) === ButtonState.M1)
                && !((frames[i].buttons & ButtonState.M2) === ButtonState.M2)

                && !((frames[i + 1].buttons & ButtonState.K1) === ButtonState.K1)
                && !((frames[i + 1].buttons & ButtonState.K2) === ButtonState.K2)
                && !((frames[i + 1].buttons & ButtonState.M1) === ButtonState.M1)
                && !((frames[i + 1].buttons & ButtonState.M2) === ButtonState.M2)) {
                count++;
                sum += frames[i].timeDiff;
            }
        }

        if (count === 0)
            return -1.0;
        return sum / count;
    }

    median(values) {
        if(values.length === 0) return 0;

        values.sort(function(a, b){
            return a-b;
        });

        var half = Math.floor(values.length / 2);

        if (values.length % 2)
            return values[half];

        return (values[half - 1] + values[half]) / 2.0;
    }

    CalculateAverageFrameTimeDiffV3() {
        const frames = this.replay.frames;
        const frames_t = frames.map((x) => x.timeDiff)
        let mediana = this.median(frames_t);

        return mediana;
    }

    TimewarpDetector() {
        const average = arr => arr.reduce((p, c) => p + c, 0) / arr.length;
        let frameTimeDiff =  average(this.replay.frames.filter(x => x.timeDiff > 0 && x.timeDiff < 30).map((x) => x.timeDiff))
        let frameTimeDiffV2 = this.CalculateAverageFrameTimeDiffV2();
        let frameTimeDiffV3 = this.CalculateAverageFrameTimeDiffV3();

        if ((this.mods & 64) > 0) {
            frameTimeDiff *= (1 / 1.5);
            frameTimeDiffV2 *= (1 / 1.5);
            frameTimeDiffV3 *= (1 / 1.5);
        }
        if ((this.mods & 256) > 0) {
            frameTimeDiff *= (1 / 0.75);
            frameTimeDiffV2 *= (1 / 0.75);
            frameTimeDiffV3 *= (1 / 0.75);
        }

        return [frameTimeDiff, frameTimeDiffV2, frameTimeDiffV3];
    }

    CalculateTaikoAVGPresses() {
        const frames = this.replay.frames;
        const useful_keys = [ButtonState.K1, ButtonState.K2, ButtonState.M1, ButtonState.M2]

        let press_times = {};
        press_times[ButtonState.K1] = [];
        press_times[ButtonState.K2] = [];
        press_times[ButtonState.M1] = [];
        press_times[ButtonState.M2] = [];

        let cumulative = {}
        cumulative[ButtonState.K1] = 0;
        cumulative[ButtonState.K2] = 0;
        cumulative[ButtonState.M1] = 0;
        cumulative[ButtonState.M2] = 0;

        let prev_frame = frames[0]
        for (const frame of frames.slice(1)) {
            for (const key of useful_keys) {
                if ((frame.buttons & key) === key) {
                    cumulative[key] += frame.timeDiff
                }
                else if ((prev_frame.buttons & key) === key) {
                    press_times[key].push(cumulative[key])
                    cumulative[key] = 0
                }
            }

            prev_frame = frame
        }

        return press_times;
    }

    TaikoLowPressesDetector() {
        /*

        press_times = get_press_times(frames)
        config = glob.config.surveillance['hitobj_low_presstimes']

        cond = lambda pt: (sum(pt) / len(pt) < config['value']
                           and len(pt) > config['min_presses'])

        if any(map(cond, press_times.values())):

         */

        let presses = this.CalculateTaikoAVGPresses();
        let alert = false;
        let alertValues = [];

        for (const key of Object.keys(presses)) {
            let kpt = presses[key];
            let sum = kpt.reduce((a, b) => a + b, 0)
            let length = kpt.length;
            if (sum / length < 40 && length > 100) {
                alert = true;
                break
            }
        }

        if (alert) {
            for (const key of Object.keys(presses)) {
                let kpt = presses[key];
                let sum = kpt.reduce((a, b) => a + b, 0)
                let length = kpt.length;
                alertValues.push([KeyboardTSEnum[key], sum / length])
            }
        }

        return [alert, alertValues]
    }
}

module.exports = {
    AntiCheat
}