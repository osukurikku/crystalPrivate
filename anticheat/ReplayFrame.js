const ButtonState = {
    M1: (1 << 0),
    M2: (1 << 1),
    K1: (1 << 2) | (1 << 0),
    K2: (1 << 3) | (1 << 1)
}

class ReplayFrame {
    constructor(time, timeDiff, x, y, buttons) {
        this.time = time;
        this.timeDiff = timeDiff;
        this.position = [x, y];
        this.buttons = buttons;
    }
}

module.exports = {
    ReplayFrame,
    ButtonState
}