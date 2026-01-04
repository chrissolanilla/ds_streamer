console.log(game);
//TODO: make it adapt to different screens sizes(mobile) and rotation?
game.width = 800;
game.height = 800;

//colors
const backgroundColor = "#1C1E26";
const fillColor = "#FF7AC6";
const borderColor = "#BF95F9";

//ctx init
const ctx = game.getContext("2d");
console.log(ctx);
//fps
const FPS = 60;
let dz = 0;

//functions
function clear() {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0,0,game.width,game.height);
}

function point({x,y}) {
    const s = 20;
    ctx.fillStyle = fillColor;
    ctx.fillRect(x-s/2,y-s/2,s,s);
}

function screen(p){
    //translate values from -1..1 to 0..w/h
    //make y correctly go up
    return {
        x: (p.x + 1)/2*game.width,
        y: (1-(p.y + 1)/2)*game.height,
    }
}

function project({x,y,z}){
    return {
        x: x/z,
        y:y/z,
    }
}


function frame() {
    const dt = 1/FPS;
    dz+=1*dt;
    clear()
    point(screen(project({x: 0.5, y: 0.5, z: 1+dz})))
    point(screen(project({x: -0.5, y: 0.5, z: 1+dz})))
    point(screen(project({x: 0.5, y: -0.5, z: 1+dz})))
    point(screen(project({x: -0.5, y: -0.5, z: 1+dz})))
    //console.log(dz)
    setTimeout(frame, 1000/FPS);
}

//this is our main loop i guess?
setTimeout(frame, 1000/FPS);





