const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
ctx.imageSmoothingEnabled=false;
const targetEl=document.getElementById("target"),heartsEl=document.getElementById("hearts"),messageEl=document.getElementById("message"),calendarEl=document.getElementById("calendar");
const W=canvas.width,H=canvas.height,months=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const firemanImgs={};
const firemanLoaded=[];
for(let n=1;n<=12;n++){
 const im=new Image();
 im.src=`assets/firemen/fireman-${String(n).padStart(2,"0")}.png`;
 firemanImgs[n]=im;
 firemanLoaded.push(new Promise(resolve=>{im.onload=resolve;im.onerror=resolve}));
}
const keys={};let player,men,fires,hoses,camera,heart,target,hearts,invuln,last=0,won=false,started=false,cameraCooldown=0,heartCooldown=0,waterCooldown=0;

function rnd(a,b){return a+Math.random()*(b-a)}
function rectHit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function clamp(o){o.x=Math.max(0,Math.min(W-o.w,o.x));o.y=Math.max(0,Math.min(H-o.h,o.y))}
function say(s){messageEl.textContent=s}
function shuffled(a){a=[...a];for(let i=a.length-1;i;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function makeMan(n){
 const im=firemanImgs[n],naturalW=im.naturalWidth||42,naturalH=im.naturalHeight||58;
 const h=58,w=h*(naturalW/naturalH);
 return{n,x:rnd(35,W-w-35),y:rnd(35,H-h-35),w,h,vx:rnd(-38,38)||20,vy:rnd(-38,38)||-20}
}
function hoseRect(h,buffer=0){
 if(h.side==="left")return{x:0,y:h.y-h.thick/2-buffer,w:h.len+buffer,h:h.thick+buffer*2};
 if(h.side==="right")return{x:W-h.len-buffer,y:h.y-h.thick/2-buffer,w:h.len+buffer,h:h.thick+buffer*2};
 if(h.side==="top")return{x:h.x-h.thick/2-buffer,y:0,w:h.thick+buffer*2,h:h.len+buffer};
 return{x:h.x-h.thick/2-buffer,y:H-h.len-buffer,w:h.thick+buffer*2,h:h.len+buffer};
}
function makeHoses(){
 const count=target>=7?12:6,sides=["left","right","top","bottom"],out=[];
 for(let i=0;i<count;i++){
   let h=null;
   for(let tries=0;tries<80;tries++){
     const side=sides[Math.floor(Math.random()*4)],vertical=side==="left"||side==="right";
     h={side,len:rnd(145,195),thick:rnd(18,24),phase:rnd(0,3.6),cycle:rnd(3.1,4.1),warning:.5,active:rnd(1.0,1.35)};
     if(vertical){h.y=rnd(42,H-42);h.x=side==="left"?0:W}else{h.x=rnd(42,W-42);h.y=side==="top"?0:H}
     const tooClose=out.some(o=>o.side===h.side && Math.abs((vertical?h.y:h.x)-((o.side==="left"||o.side==="right")?o.y:o.x))<48);
     const oppositeLane=out.some(o=>((o.side==="left"&&h.side==="right")||(o.side==="right"&&h.side==="left"))&&Math.abs(o.y-h.y)<34 || ((o.side==="top"&&h.side==="bottom")||(o.side==="bottom"&&h.side==="top"))&&Math.abs(o.x-h.x)<34);
     if(!tooClose&&!oppositeLane)break;
   }
   out.push(h);
 }
 return out;
}
function hoseState(h){
 const t=h.phase%h.cycle;
 if(t<h.warning)return"warning";
 if(t<h.warning+h.active)return"active";
 return"off";
}
function makeFire(){
 for(let tries=0;tries<160;tries++){
   const f={x:rnd(35,W-55),y:rnd(35,H-55),w:26,h:30};
   if(!hoses.some(h=>rectHit(f,hoseRect(h,12))))return f;
 }
 return{x:rnd(W*.35,W*.65),y:rnd(H*.35,H*.65),w:26,h:30};
}
function reshuffleFires(){fires=Array.from({length:target>=7?12:6},makeFire)}
function setHazardsForStage(){hoses=makeHoses();reshuffleFires()}
function rerollHazards(){hoses=makeHoses();reshuffleFires()}
function fiveRandom(excludeSet=[]){
 const old=new Set(excludeSet),all=shuffled(Array.from({length:12},(_,i)=>i+1));
 let pick=all.slice(0,5);
 if(pick.every(n=>old.has(n))){const outsider=all.find(n=>!old.has(n));if(outsider!==undefined)pick[0]=outsider}
 return pick;
}
function reroll(){
 const old=men.map(m=>m.n);men=fiveRandom(old).map(makeMan);
 rerollHazards();
 camera={x:rnd(45,W-70),y:rnd(45,H-70),w:30,h:30};
 cameraCooldown=.8;say(`📷 NEW MODELS! FIND ${months[target-1]}.`);
}
function replaceCollected(index){
 const visible=new Set(men.map(m=>m.n));visible.delete(men[index].n);
 const choices=Array.from({length:12},(_,i)=>i+1).filter(n=>!visible.has(n));
 men[index]=makeMan(choices[Math.floor(Math.random()*choices.length)]);
}
function makeCalendar(){
 calendarEl.innerHTML="";
 months.forEach((m,i)=>{const d=document.createElement("div");d.className="month"+(i<target-1?" done":i===target-1&&!won?" current":"");d.textContent=(i<target-1||won?"✓ ":"")+m;calendarEl.appendChild(d)})
}
function updateUI(){targetEl.textContent=won?"CALENDAR COMPLETE":`FIND: #${target} — ${months[target-1]}`;heartsEl.textContent="♥ ".repeat(hearts).trim();makeCalendar()}
function reset(){
 player={x:W/2-10,y:H/2-15,w:22,h:34,speed:190};target=1;hearts=3;invuln=0;won=false;cameraCooldown=0;heartCooldown=0;waterCooldown=0;
 men=fiveRandom().map(makeMan);
 setHazardsForStage();
 camera={x:rnd(45,W-70),y:rnd(45,H-70),w:30,h:30};
 heart={x:rnd(45,W-70),y:rnd(45,H-70),w:28,h:28,active:true};
 updateUI();say("Collect the firemen in calendar order.");
}
function update(dt){
 if(!started||won)return;
 cameraCooldown=Math.max(0,cameraCooldown-dt);heartCooldown=Math.max(0,heartCooldown-dt);waterCooldown=Math.max(0,waterCooldown-dt);invuln=Math.max(0,invuln-dt);hoses.forEach(h=>h.phase+=dt);
 let dx=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0),dy=(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0);
 if(dx&&dy){dx*=.707;dy*=.707}player.x+=dx*player.speed*dt;player.y+=dy*player.speed*dt;clamp(player);
 const hardMultiplier=target>=7?1.65:1;
 men.forEach(m=>{m.x+=m.vx*hardMultiplier*dt;m.y+=m.vy*hardMultiplier*dt;if(m.x<=0||m.x>=W-m.w)m.vx*=-1;if(m.y<=0||m.y>=H-m.h)m.vy*=-1;clamp(m)});
 if(cameraCooldown<=0&&rectHit(player,camera)){reroll();return}
 if(heart.active&&heartCooldown<=0&&rectHit(player,heart)){
   if(hearts<3){
     hearts++;heart.active=false;heartCooldown=1;updateUI();say("❤️ LIFE RESTORED.");
     setTimeout(()=>{heart={x:rnd(45,W-70),y:rnd(45,H-70),w:28,h:28,active:true}},4500);
   }else{
     say("❤️ YOU'RE ALREADY AT FULL HEALTH.");
     heart.x=rnd(45,W-70);heart.y=rnd(45,H-70);heartCooldown=.8;
   }
   return;
 }
 for(let i=0;i<men.length;i++){const m=men[i];if(!rectHit(player,m))continue;
   if(m.n===target){
     const got=target;say(`${months[got-1]} ACQUIRED!`);target++;
     if(target===13){won=true;target=12;say("🔥 CALENDAR COMPLETE! Twelve firemen successfully secured. 🔥");updateUI();return}
     replaceCollected(i);
     if(target===7){setHazardsForStage();say("HALFWAY THERE! THE HOSES ARE ANGRY.");}
     else reshuffleFires();
     updateUI();return;
   }
   if(m.n<target)say(`WE ALREADY HAVE ${months[m.n-1]}.`);
   else say(`THAT'S ${months[m.n-1]}. CONTROL YOURSELF.`);
   const ax=(m.x-player.x)||1,ay=(m.y-player.y)||1,len=Math.hypot(ax,ay);m.x+=ax/len*50;m.y+=ay/len*50;clamp(m);return;
 }
 if(!invuln)for(const f of fires)if(rectHit(player,f)){hearts--;invuln=1.2;say("🔥 MINOR WORKPLACE INJURY.");if(hearts<=0){hearts=3;say("YOU DIED. This seems unnecessarily punitive. Anyway.");player.x=W/2;player.y=H/2}updateUI();break}
 if(waterCooldown<=0)for(const h of hoses)if(hoseState(h)==="active"&&rectHit(player,hoseRect(h))){
   const push=92;
   if(h.side==="left")player.x+=push;else if(h.side==="right")player.x-=push;else if(h.side==="top")player.y+=push;else player.y-=push;
   clamp(player);waterCooldown=.45;say("💦 RUDE.");break
 }
}
function text(t,x,y,size=16){ctx.font=`bold ${size}px "Courier New"`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#24170f";ctx.fillText(t,x,y)}
function draw(){
 ctx.fillStyle="#d7c49e";ctx.fillRect(0,0,W,H);ctx.strokeStyle="#b6a079";ctx.lineWidth=2;
 for(let x=0;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
fires.forEach(f=>text("🔥",f.x+f.w/2,f.y+f.h/2,25));
 hoses.forEach(h=>{
   const state=hoseState(h),r=hoseRect(h);
   // little wall nozzle is always visible
   ctx.fillStyle="#56717b";
   if(h.side==="left")ctx.fillRect(0,h.y-7,12,14);else if(h.side==="right")ctx.fillRect(W-12,h.y-7,12,14);else if(h.side==="top")ctx.fillRect(h.x-7,0,14,12);else ctx.fillRect(h.x-7,H-12,14,12);
   if(state==="warning"){
     ctx.fillStyle="rgba(207,239,245,.72)";
     if(h.side==="left"||h.side==="right")ctx.fillRect(h.side==="left"?10:W-22,h.y-3,12,6);else ctx.fillRect(h.x-3,h.side==="top"?10:H-22,6,12);
   }else if(state==="active"){
     ctx.fillStyle="rgba(187,229,240,.88)";ctx.fillRect(r.x,r.y,r.w,r.h);
     ctx.fillStyle="rgba(244,252,250,.92)";
     if(h.side==="left"||h.side==="right"){ctx.fillRect(r.x,r.y+r.h*.25,r.w,r.h*.28);for(let q=18;q<r.w;q+=31)ctx.fillRect(h.side==="left"?r.x+q:r.x+r.w-q,r.y+r.h-3,7,5)}
     else{ctx.fillRect(r.x+r.w*.25,r.y,r.w*.28,r.h);for(let q=18;q<r.h;q+=31)ctx.fillRect(r.x+r.w-3,h.side==="top"?r.y+q:r.y+r.h-q,5,7)}
   }
 });
 text("📷",camera.x+15,camera.y+15,27);if(heart.active)text("❤️",heart.x+14,heart.y+14,24);
 men.forEach(m=>{
   const im=firemanImgs[m.n];
   if(im&&im.complete&&im.naturalWidth)ctx.drawImage(im,m.x,m.y,m.w,m.h);
   const badgeX=m.x+m.w/2,badgeY=Math.max(14,m.y-8);
   ctx.fillStyle="#fffdf4";ctx.strokeStyle="#24170f";ctx.lineWidth=2;
   ctx.fillRect(badgeX-13,badgeY-11,26,22);ctx.strokeRect(badgeX-13,badgeY-11,26,22);
   ctx.fillStyle="#24170f";ctx.font='bold 14px "Courier New"';ctx.textAlign="center";ctx.textBaseline="middle";
   ctx.fillText(String(m.n),badgeX,badgeY+1);
 });
 if(!invuln||Math.floor(invuln*10)%2===0){ctx.fillStyle="#7b3045";ctx.fillRect(player.x+5,player.y,12,10);ctx.fillStyle="#f2c6a0";ctx.fillRect(player.x+7,player.y+8,8,8);ctx.fillStyle="#314e67";ctx.fillRect(player.x+3,player.y+16,16,13);ctx.fillStyle="#242424";ctx.fillRect(player.x+4,player.y+29,5,5);ctx.fillRect(player.x+13,player.y+29,5,5)}
 if(won){ctx.fillStyle="rgba(23,23,23,.84)";ctx.fillRect(70,145,W-140,190);ctx.fillStyle="#f7e9c5";ctx.font='bold 30px "Courier New"';ctx.textAlign="center";ctx.fillText("🔥 CALENDAR COMPLETE 🔥",W/2,205);ctx.font='bold 18px "Courier New"';ctx.fillText("TWELVE FIREMEN SECURED",W/2,250);ctx.font='15px "Courier New"';ctx.fillText("Fire safety remains inconclusive.",W/2,286)}
}
function loop(ts){const dt=Math.min((ts-last)/1000,.033)||0;last=ts;update(dt);draw();requestAnimationFrame(loop)}
addEventListener("keydown",e=>{if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();keys[e.key]=true;keys[e.key.toLowerCase?.()]=true});
addEventListener("keyup",e=>{keys[e.key]=false;keys[e.key.toLowerCase?.()]=false});
document.getElementById("restart").onclick=reset;
document.getElementById("start").onclick=()=>{document.getElementById("intro").classList.add("hidden");started=true;last=performance.now()};
Promise.all(firemanLoaded).then(()=>{reset();requestAnimationFrame(loop)});
