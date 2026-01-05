//you dont need to do get element id if its valid lowkey
console.log(game);
//TODO: make it adapt to different screens sizes(mobile) and rotation?
// game.width = 800;
// game.height = 800;

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

//functions
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
    return {
        x: (p.x + 1)/2*w,
        y: (1-(p.y + 1)/2)*h,
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

function frame() {
    const dt = 1/FPS;
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
                screen(project(translate_z(rotate_xz(a,angle),dz))),
                screen(project(translate_z(rotate_xz(b,angle),dz)))
            )
        }
    }
    //console.log(dz)
    setTimeout(frame, 1000/FPS);
}

//this is our main loop i guess?
setTimeout(frame, 1000/FPS);





