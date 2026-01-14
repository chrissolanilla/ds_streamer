//sound system
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

  //for ios and chrome
  if (audioCtx.state !== "running") audioCtx.resume();

  const src = audioCtx.createBufferSource();
  src.buffer = buf;

  const gain = audioCtx.createGain();
  gain.gain.value = volume;

  src.connect(gain);
  gain.connect(audioCtx.destination);

  src.start(0);
}

//preload sounds for faster
Promise.all([
  loadSound("a", "sounds/plink.mp3"),
  loadSound("b", "sounds/shiny-pokemon.mp3"),
  loadSound("start", "sounds/pokemon-battle.mp3"),
  loadSound("select", "sounds/quien.mp3"),
]).catch(console.error);



//you dont need to do get element id if its valid lowkey
console.log(game);

//colors
const backgroundColor = "#1C1E26";
const fillColor = "#FF7AC6";
const borderColor = "#BF95F9";

//ctx init
const ctx = game.getContext("2d");
//fps
const FPS = 60;
let dz = 1;
let angle = 0;

//our cube object
//verticies
const vs = [
    {x: 0.25, y: 0.25, z: 0.25},
    {x: -0.25, y: 0.25, z: 0.25},
    {x: -0.25, y: -0.25, z: 0.25},
    {x: 0.25, y: -0.25, z: 0.25},
    //behind us
    {x: 0.25, y: 0.25, z: -0.25},
    {x: -0.25, y: 0.25, z: -0.25},
    {x: -0.25, y: -0.25, z: -0.25},
    {x: 0.25, y: -0.25, z: -0.25},
]

//faces
const fs = [
    [0,1,2,3],
    [4,5,6,7],
    [0,4],
    [1,5],
    [2,6],
    [3,7],
]

// shift in model space
let cubePos = { x: 0, y: 0, z: 0 };
let held = {
    left:false,
    right:false,
    up:false,
    down:false
};

//functions
function setHeld(dir){
    clearHeld();
    if(dir){
        held[dir] = true;
    }
}

function clearHeld(){
    held.left = false;
    held.right = false;
    held.up = false;
    held.down = false;
}

function directionFromPoint(clientX,clientY){
    const r = dpad.getBoundingClientRect();
    const cx = r.left +r.width /2;
    const cy = r.top +r.height /2;
    const dx = clientX-cx;
    const dy = clientY-cy;
    //center should be nothing
    const deadZone = Math.min(r.width, r.height) * 0.12;
    if(Math.hypot(dx,dy) < deadZone){
        return null;
    }

    //make the axis win
    if(Math.abs(dx) > Math.abs(dy)){
        return dx < 0 ? "left" : "right";
    }

    return dy < 0 ? "up" : "down";
}

function endDpad(e){
    if(dpad.hasPointerCapture(e.pointerId)){
        dpad.releasePointerCapture(e.pointerId);
    }
    clearHeld();
}

function resizeCanvas(){
    const dpr = window.devicePixelRatio || 1;
    const rect = game.getBoundingClientRect();
    game.width = Math.round(rect.width * dpr);
    game.height = Math.round(rect.height * dpr);
    //make it use css pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

//call this shit once i guess and whenever we resize
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
resizeCanvas();

function clear() {
    const w = game.getBoundingClientRect().width;
    const h = game.getBoundingClientRect().height;
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0,0,w,h);
}

function point({x,y}) {
    const s = 20;
    ctx.fillStyle = fillColor;
    ctx.fillRect(x-s/2,y-s/2,s,s);
}

function line(p1,p2){
    ctx.lineWidth = 3;
    ctx.strokeStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(p1.x,p1.y);
    ctx.lineTo(p2.x,p2.y);
    ctx.stroke();
}

function screen(p){
    //translate values from -1..1 to 0..w/h
    //make y correctly go up
    const w = game.getBoundingClientRect().width;
    const h = game.getBoundingClientRect().height;

    //make it so the cube stays same size and now get taller or wider
    //uniform scale
    const s = Math.min(w, h);
    const cx = w / 2;
    const cy = h / 2;

    return {
        x: cx + p.x * (s / 2),
        y: cy - p.y * (s / 2),
        // x: (p.x + 1)/2*w,
        // y: (1-(p.y + 1)/2)*h,
    }
}

function project({x,y,z}){
    return {
        x: x/z,
        y:y/z,
    }
}

function translate_z({x,y,z}, dz){
    return {x,y, z: z+dz};
}

function rotate_xz({x,y,z}, angle){
    //rorate a vector formula:
    //x`= xcos(theta) -ysin(theta)
    //y` = xsin(theta) +ycos(theta)
    const c = Math.cos(angle);
    const s = Math.sin(angle)
    return {
        x: x*c-z*s,
        y,
        z: x*s+z*c,
    };
}

function translate({x,y,z}, t) {
  return { x: x + t.x, y: y + t.y, z: z + t.z };
}


function shiftCube(){
    //basically, we just got to adjust our array of vertices
}

function frame() {
    const dt = 1/FPS;

    //before we draw have movespeed
    //
    const moveSpeed = 0.9; // units per second
    if (held.left)  cubePos.x -= moveSpeed * dt;
    if (held.right) cubePos.x += moveSpeed * dt;
    if (held.up)    cubePos.y += moveSpeed * dt;
    if (held.down)  cubePos.y -= moveSpeed * dt;

        //
    //dz+=1*dt;
    //control speed by constant
    angle += 1*Math.PI*dt;
    //angle += 2*Math.PI*dt;
    clear()
    //renders vertices, cooler if we dont
    // for(const v of vs){
    //     point(screen(project(translate_z(rotate_xz(v,angle), dz))))
    // }

    //iterate all faces connect current vertex and the other one
    for(const f of fs){
        for(let i =0;i<f.length;++i){
            const a = vs[f[i]];
            //this makes it so that if its the last index, it wraps back around to the first
            const b = vs[f[(i+1)%f.length]];
            line(
                screen(project(translate_z(translate(rotate_xz(a,angle), cubePos), dz))),
                screen(project(translate_z(translate(rotate_xz(b,angle), cubePos), dz)))
            )
        }
    }
    //console.log(dz)
    setTimeout(frame, 1000/FPS);
}

//this is our main loop i guess?
setTimeout(frame, 1000/FPS);


//prevent zoom or scroll when clicking buttons
document.querySelectorAll(".dpad button").forEach(btn => {
    btn.addEventListener("contextmenu", e => e.preventDefault());
    // btn.addEventListener("pointerdown", e => e.preventDefault());
    // btn.addEventListener("pointerup", e => e.preventDefault());
});


//now we can have some logic to move our spinnign cube around.
const leftButton = document.getElementById("left");
const rightButton = document.getElementById("right");
const upButton = document.getElementById("up");
const downButton = document.getElementById("down");
const dpad = document.querySelector(".dpad");

dpad.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dpad.setPointerCapture(e.pointerId);
    setHeld(directionFromPoint(e.clientX, e.clientY));
});

dpad.addEventListener("pointermove", (e) => {
    if (!dpad.hasPointerCapture(e.pointerId)) {
        return;
    }
    e.preventDefault();
    setHeld(directionFromPoint(e.clientX,e.clientY));
});

dpad.addEventListener("pointerup", endDpad);
dpad.addEventListener("pointercancel", endDpad);

//TODO tweak more
const step = 10;

function move(dx, dy) {
    cubePos.x += dx;
    cubePos.y += dy;
}

function bindHold(btn, key) {
    btn.addEventListener("pointerdown", e => { e.preventDefault(); held[key] = true; });
    btn.addEventListener("pointerup",   e => { e.preventDefault(); held[key] = false; });
    btn.addEventListener("pointercancel", () => { held[key] = false; });
    btn.addEventListener("pointerleave",  () => { held[key] = false; });
}

function bindHoldFlag(btn, flagName) {
    btn.addEventListener("pointerdown", e => {
        e.preventDefault();
        held[flagName] = true;
        sendState(true);
    });
    btn.addEventListener("pointerup",   e => {
        e.preventDefault();
        held[flagName] = false;
        sendState(true);
    });
    btn.addEventListener("pointercancel", () => {
        //held[key] = false;
        held[flagName] = false;
        sendState(true);
    });
    btn.addEventListener("pointerleave",  () => {
        //held[key] = false;
        held[flagName] = false;
        sendState(true);
    });
}
//silly shit
const aButton = document.getElementById("a");
const bButton = document.getElementById("b");
const xButton = document.getElementById("x");
const yButton = document.getElementById("y");
const startButton = document.getElementById("start");
const selectButton = document.getElementById("select");
const rButton = document.getElementById("r");
const lButton = document.getElementById("l");

bindHoldFlag(aButton, "a");
bindHoldFlag(bButton, "b");
bindHoldFlag(startButton, "start");
bindHoldFlag(selectButton, "select");
bindHoldFlag(xButton, "x");
bindHoldFlag(yButton, "y");
bindHoldFlag(rButton, "r");
bindHoldFlag(lButton, "l");

//we still keep this and the function so sliding works
bindHold(leftButton, "left");
bindHold(rightButton, "right");
bindHold(upButton, "up");
bindHold(downButton, "down");



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


//web socket
const ws = new WebSocket(`ws://${location.hostname}:9001`);
ws.addEventListener("open", () => console.log("websocket connected"));
ws.addEventListener("close", () => console.log("websocket connection closed"));
ws.addEventListener("error", () => console.log("ERROR: websocket error"));

let seq = 0;

const BTN = {
    B:		1	<< 0,
    Y:		1	<< 1,
    SELECT:	1	<< 2,
    START:	1	<< 3,
    UP:		1	<< 4,
    DOWN:	1	<< 5,
    LEFT:	1	<< 6,
    RIGHT:	1	<< 7,
    A:		1	<< 8,
    X:		1	<< 9,
    L:		1	<< 10,
    R:		1	<< 11,
};

//we use bitmask for speed and in C++ too
function computeMask() {
    let m = 0;
    if (held.up)    m |= BTN.UP;
    if (held.down)  m |= BTN.DOWN;
    if (held.left)  m |= BTN.LEFT;
    if (held.right) m |= BTN.RIGHT;
    if (held.a)     m |= BTN.A;
    if (held.b)     m |= BTN.B;
    if (held.x)     m |= BTN.X;
    if (held.y)     m |= BTN.Y;
    if (held.l)     m |= BTN.L;
    if (held.r)     m |= BTN.R;
    if (held.start) m |= BTN.START;
    if (held.select)m |= BTN.SELECT;
    return m;
}

let lastSentMask = -1;
function sendState(force = false){
    if(ws.readyState !== WebSocket.OPEN) return;
    const mask = computeMask();
    if(!force && mask == lastSentMask) return;
    //if state aight and we got a connection, then send and increment seq
    lastSentMask = mask;
	//send 2 bytes instead of json to be faster
	const buf = new ArrayBuffer(2);
	new DataView(buf).setUint16(0, lastSentMask, true);
    // ws.send(JSON.stringify({type: "state", mask, seq: seq++ }));
	ws.send(buf);
}

//send at the steady rate 60fps ig
setInterval(() => sendState(false), 1000/60);
