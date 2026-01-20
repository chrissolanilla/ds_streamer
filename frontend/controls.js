//webrtc
(async () => {
    const video = document.getElementById("video");
    const unmuteBtn = document.getElementById("unmute");

    //autoplay stared mutd
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;

    function waitIceComplete(pc) {
        if (pc.iceGatheringState === "complete") return Promise.resolve();
        return new Promise((resolve) => {
            const check = () => {
                if (pc.iceGatheringState === "complete") {
                    pc.removeEventListener("icegatheringstatechange", check);
                    resolve();
                }
            };
            pc.addEventListener("icegatheringstatechange", check);
        });
    }

    const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.ontrack = (e) => {
        const stream = e.streams[0];
        video.srcObject = stream;

        const hasAudio = stream.getAudioTracks().length > 0;
        if (hasAudio) unmuteBtn?.classList.remove("hidden");
    };

    pc.oniceconnectionstatechange = () => {
        console.log("webrtc ice:", pc.iceConnectionState);
    };

    // prob dont start with that on the phone irl
    const whepBase = `http://${location.hostname}:8889`;
    const streamPath = "ds";
    const whepUrl = `${whepBase}/${streamPath}/whep`;

    const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
    });
    await pc.setLocalDescription(offer);
    await waitIceComplete(pc);

    const res = await fetch(whepUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription.sdp,
    });

    const answerSDP = await res.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });

    //ujnmute
    if (unmuteBtn) {
        unmuteBtn.addEventListener("click", async () => {
            video.muted = false;
            try {
                await video.play();
            } catch {}
            unmuteBtn.classList.add("hidden");
        });
    }
})().catch(console.error);

//same controls
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const soundBuffers = new Map();

async function loadSound(name, url) {
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buf = await audioCtx.decodeAudioData(arr);
    soundBuffers.set(name, buf);
}

function playSound(name, { volume = 0.6 } = {}) {
    const buf = soundBuffers.get(name);
    if (!buf) return;
    if (audioCtx.state !== "running") audioCtx.resume();

    const src = audioCtx.createBufferSource();
    src.buffer = buf;

    const gain = audioCtx.createGain();
    gain.gain.value = volume;

    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(0);
}

Promise.all([
    loadSound("a", "sounds/plink.mp3"),
    loadSound("b", "sounds/shiny-pokemon.mp3"),
    loadSound("start", "sounds/pokemon-battle.mp3"),
    loadSound("select", "sounds/quien.mp3"),
]).catch(console.error);

const dpad = document.querySelector(".dpad");
const leftButton = document.getElementById("left");
const rightButton = document.getElementById("right");
const upButton = document.getElementById("up");
const downButton = document.getElementById("down");

const aButton = document.getElementById("a");
const bButton = document.getElementById("b");
const xButton = document.getElementById("x");
const yButton = document.getElementById("y");
const startButton = document.getElementById("start");
const selectButton = document.getElementById("select");
const rButton = document.getElementById("r");
const lButton = document.getElementById("l");

let held = {
    left: false,
    right: false,
    up: false,
    down: false,
    a: false,
    b: false,
    x: false,
    y: false,
    start: false,
    select: false,
    l: false,
    r: false,
};

function clearHeld() {
    held.left = held.right = held.up = held.down = false;
}

function setHeld(dir) {
    clearHeld();
    if (dir) held[dir] = true;
}

function directionFromPoint(clientX, clientY) {
    const r = dpad.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;

    const deadZone = Math.min(r.width, r.height) * 0.12;
    if (Math.hypot(dx, dy) < deadZone) return null;

    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
    return dy < 0 ? "up" : "down";
}

function endDpad(e) {
    if (dpad.hasPointerCapture(e.pointerId))
        dpad.releasePointerCapture(e.pointerId);
    clearHeld();
    sendState(true);
}

//good for no scrolls
document
    .querySelectorAll(".dpad button, .ab button, .meta button, .bumpers button")
    .forEach((btn) => {
        btn.addEventListener("contextmenu", (e) => e.preventDefault());
    });

dpad.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dpad.setPointerCapture(e.pointerId);
    setHeld(directionFromPoint(e.clientX, e.clientY));
    sendState(true);
});

dpad.addEventListener("pointermove", (e) => {
    if (!dpad.hasPointerCapture(e.pointerId)) return;
    e.preventDefault();
    setHeld(directionFromPoint(e.clientX, e.clientY));
    sendState(false);
});

dpad.addEventListener("pointerup", endDpad);
dpad.addEventListener("pointercancel", endDpad);

function bindHold(btn, key) {
    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        held[key] = true;
        sendState(true);
    });
    btn.addEventListener("pointerup", (e) => {
        e.preventDefault();
        held[key] = false;
        sendState(true);
    });
    btn.addEventListener("pointercancel", () => {
        held[key] = false;
        sendState(true);
    });
    btn.addEventListener("pointerleave", () => {
        held[key] = false;
        sendState(true);
    });
}

function bindHoldFlag(btn, flagName) {
    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        held[flagName] = true;
        sendState(true);
    });
    btn.addEventListener("pointerup", (e) => {
        e.preventDefault();
        held[flagName] = false;
        sendState(true);
    });
    btn.addEventListener("pointercancel", () => {
        held[flagName] = false;
        sendState(true);
    });
    btn.addEventListener("pointerleave", () => {
        held[flagName] = false;
        sendState(true);
    });
}

bindHold(leftButton, "left");
bindHold(rightButton, "right");
bindHold(upButton, "up");
bindHold(downButton, "down");

bindHoldFlag(aButton, "a");
bindHoldFlag(bButton, "b");
bindHoldFlag(xButton, "x");
bindHoldFlag(yButton, "y");
bindHoldFlag(startButton, "start");
bindHoldFlag(selectButton, "select");
bindHoldFlag(rButton, "r");
bindHoldFlag(lButton, "l");

function onPress(btn, soundName) {
    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        playSound(soundName);
    });
}
onPress(aButton, "a");
onPress(bButton, "b");
onPress(startButton, "start");
onPress(selectButton, "select");

const ws = new WebSocket(`ws://${location.hostname}:9001`);
ws.addEventListener("open", () => console.log("ws connected"));
ws.addEventListener("close", () => console.log("ws closed"));
ws.addEventListener("error", () => console.log("ws error"));

const BTN = {
    B: 1 << 0,
    Y: 1 << 1,
    SELECT: 1 << 2,
    START: 1 << 3,
    UP: 1 << 4,
    DOWN: 1 << 5,
    LEFT: 1 << 6,
    RIGHT: 1 << 7,
    A: 1 << 8,
    X: 1 << 9,
    L: 1 << 10,
    R: 1 << 11,
};

function computeMask() {
    let m = 0;
    if (held.up) m |= BTN.UP;
    if (held.down) m |= BTN.DOWN;
    if (held.left) m |= BTN.LEFT;
    if (held.right) m |= BTN.RIGHT;
    if (held.a) m |= BTN.A;
    if (held.b) m |= BTN.B;
    if (held.x) m |= BTN.X;
    if (held.y) m |= BTN.Y;
    if (held.l) m |= BTN.L;
    if (held.r) m |= BTN.R;
    if (held.start) m |= BTN.START;
    if (held.select) m |= BTN.SELECT;
    return m;
}

let lastSentMask = -1;

function sendState(force = false) {
    if (ws.readyState !== WebSocket.OPEN) return;
    const mask = computeMask();
    if (!force && mask === lastSentMask) return;

    lastSentMask = mask;

    //ts lil endian
    const buf = new ArrayBuffer(2);
    new DataView(buf).setUint16(0, lastSentMask, true);
    ws.send(buf);
}

setInterval(() => sendState(false), 1000 / 60);

