// Offline preview of the liquid-glass pill toolbar (edge refraction).
// Uses the SAME glass.js the browser widget uses.
const zlib = require('zlib'), fs = require('fs');
const LiquidGlass = require('./glass.js');

const W = 900, H = 440;
const bg = new Float64Array(W * H * 4);
const out = new Float64Array(W * H * 4);
const clamp = (v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t;
const I = (x,y)=>(y*W+x)*4;

function set(x,y,r,g,b,a){ if(x<0||y<0||x>=W||y>=H)return; const i=I(x|0,y|0),A=a==null?1:clamp(a,0,1);
  bg[i]=lerp(bg[i],r,A); bg[i+1]=lerp(bg[i+1],g,A); bg[i+2]=lerp(bg[i+2],b,A); bg[i+3]=255; }
function rrSDF(x,y,cx,cy,w,h,r){const dx=Math.abs(x-cx)-(w/2-r),dy=Math.abs(y-cy)-(h/2-r);
  return Math.hypot(Math.max(dx,0),Math.max(dy,0))+Math.min(Math.max(dx,dy),0)-r;}
const cov=s=>clamp(0.5-s,0,1);
function fillRR(cx,cy,w,h,r,col,op){op=op==null?1:op;
  for(let y=Math.floor(cy-h/2-2);y<Math.ceil(cy+h/2+2);y++)for(let x=Math.floor(cx-w/2-2);x<Math.ceil(cx+w/2+2);x++){
    const c=cov(rrSDF(x+.5,y+.5,cx,cy,w,h,r))*op; if(c>0) set(x,y,col[0],col[1],col[2],c);}}

// ---------------- background scene ----------------
for(let i=0;i<W*H*4;i+=4){ bg[i]=5;bg[i+1]=5;bg[i+2]=5;bg[i+3]=255; }
const card={cx:450,cy:560,w:840,h:760,r:80};
for(let y=150;y<H;y++)for(let x=0;x<W;x++){
  const c=cov(rrSDF(x+.5,y+.5,card.cx,card.cy,card.w,card.h,card.r)); if(c<=0)continue;
  const v=clamp((y-160)/300,0,1);
  let r=lerp(108,44,v),g=lerp(189,140,v),b=lerp(79,58,v);
  const rad=Math.hypot((x-440)/430,(y-210)/260),lift=(1-clamp(rad,0,1))*26; r+=lift;g+=lift;b+=lift;
  set(x,y,clamp(r,0,255),clamp(g,0,255),clamp(b,0,255),c);
}
// text + chips so refraction is visible
function text(){ /* drawn as blocky bars to avoid font deps: a few rounded bars */ }
const chips=[[0.2,0.55,1],[0.1,0.82,0.75],[0.62,0.38,1],[1,0.45,0.5],[0.3,0.85,0.4],[1,0.8,0.2]];
chips.forEach((cc,i)=>fillRR(150+i*110,250,40,40,12,[cc[0]*255,cc[1]*255,cc[2]*255],1));
// a bold "wordmark" bar across where the pill sits, to show the edge bend
fillRR(450,150,520,30,8,[20,20,24],0.9);

// ---------------- blurred copy (frost) ----------------
function boxBlur(src,radius,passes){let cur=src;for(let p=0;p<passes;p++){const tmp=new Float64Array(cur.length),o2=new Float64Array(cur.length);
  for(let y=0;y<H;y++)for(let c=0;c<3;c++){let acc=0;const n=radius*2+1;for(let x=-radius;x<=radius;x++)acc+=cur[I(clamp(x,0,W-1),y)+c];
    for(let x=0;x<W;x++){tmp[I(x,y)+c]=acc/n;acc+=cur[I(clamp(x+radius+1,0,W-1),y)+c]-cur[I(clamp(x-radius,0,W-1),y)+c];}}
  for(let x=0;x<W;x++)for(let c=0;c<3;c++){let acc=0;const n=radius*2+1;for(let y=-radius;y<=radius;y++)acc+=tmp[I(x,clamp(y,0,H-1))+c];
    for(let y=0;y<H;y++){o2[I(x,y)+c]=acc/n;acc+=tmp[I(x,clamp(y+radius+1,0,H-1))+c]-tmp[I(x,clamp(y-radius,0,H-1))+c];}}cur=o2;}return cur;}
const blurred = boxBlur(bg.slice(), 14, 3);

// ---------------- composite ----------------
out.set(bg);
const cap = {cx:450, cy:196, w:436, h:132, r:66};
// drop shadow
for(let y=cap.cy-110;y<cap.cy+150;y++)for(let x=cap.cx-260;x<cap.cx+260;x++){
  if(x<0||y<0||x>=W||y>=H)continue; const s=rrSDF(x+.5,y+.5+14,cap.cx,cap.cy,cap.w,cap.h,cap.r);
  const a=clamp(-s/26,0,1)*0.32; if(a>0){const i=I(x,y);out[i]=lerp(out[i],0,a);out[i+1]=lerp(out[i+1],0,a);out[i+2]=lerp(out[i+2],0,a);}}
// the glass
const glassBuf = new Float64Array(W*H*4);
LiquidGlass.render(bg, blurred, glassBuf, W, H, cap, {});
for(let i=0;i<W*H;i++){const a=glassBuf[i*4+3]/255; if(a>0)for(let c=0;c<3;c++)out[i*4+c]=lerp(out[i*4+c],glassBuf[i*4+c],a);}

// icons (white strokes)
function seg(ax,ay,bx,by,wid){for(let y=Math.floor(Math.min(ay,by)-wid);y<Math.ceil(Math.max(ay,by)+wid);y++)
  for(let x=Math.floor(Math.min(ax,bx)-wid);x<Math.ceil(Math.max(ax,bx)+wid);x++){
    const vx=bx-ax,vy=by-ay,wx=x+.5-ax,wy=y+.5-ay;let t=clamp((wx*vx+wy*vy)/(vx*vx+vy*vy),0,1);
    const dd=Math.hypot(x+.5-(ax+vx*t),y+.5-(ay+vy*t)),a=clamp(wid/2-dd+.5,0,1);
    if(a>0){const i=I(x,y);out[i]=lerp(out[i],255,a);out[i+1]=lerp(out[i+1],255,a);out[i+2]=lerp(out[i+2],255,a);}}}
function strokeRR(cx,cy,w,h,r,wid){for(let y=Math.floor(cy-h/2-wid);y<Math.ceil(cy+h/2+wid);y++)
  for(let x=Math.floor(cx-w/2-wid);x<Math.ceil(cx+w/2+wid);x++){
    const a=clamp(wid/2-Math.abs(rrSDF(x+.5,y+.5,cx,cy,w,h,r))+.5,0,1);
    if(a>0){const i=I(x,y);out[i]=lerp(out[i],255,a);out[i+1]=lerp(out[i+1],255,a);out[i+2]=lerp(out[i+2],255,a);}}}
function dot(cx,cy,rad){for(let y=Math.floor(cy-rad-1);y<Math.ceil(cy+rad+1);y++)for(let x=Math.floor(cx-rad-1);x<Math.ceil(cx+rad+1);x++){
  const a=clamp(rad-Math.hypot(x+.5-cx,y+.5-cy)+.5,0,1);if(a>0){const i=I(x,y);out[i]=lerp(out[i],255,a);out[i+1]=lerp(out[i+1],255,a);out[i+2]=lerp(out[i+2],255,a);}}}
const iy=196, lw=3.2; const X=[450-132,450,450+132];
strokeRR(X[0],iy,52,42,11,lw); seg(X[0]-11,iy,X[0]+11,iy,lw); seg(X[0],iy-11,X[0],iy+11,lw);
seg(X[1]-17,iy-24,X[1]+17,iy-24,lw); seg(X[1]-17,iy-24,X[1]-17,iy+24,lw); seg(X[1]+17,iy-24,X[1]+17,iy+24,lw); seg(X[1]-17,iy+24,X[1],iy+11,lw); seg(X[1]+17,iy+24,X[1],iy+11,lw);
for(const dx of [-16,0,16]) dot(X[2]+dx,iy,3.1);

// ---------------- PNG ----------------
const raw=Buffer.alloc((W*3+1)*H);let p=0;
for(let y=0;y<H;y++){raw[p++]=0;for(let x=0;x<W;x++){const i=I(x,y);raw[p++]=clamp(Math.round(out[i]),0,255);raw[p++]=clamp(Math.round(out[i+1]),0,255);raw[p++]=clamp(Math.round(out[i+2]),0,255);}}
const ct=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;ct[n]=c>>>0;}
const crc=b=>{let c=0xffffffff;for(let i=0;i<b.length;i++)c=ct[(c^b[i])&0xff]^(c>>>8);return(c^0xffffffff)>>>0;};
const ch=(t,d)=>{const L=Buffer.alloc(4);L.writeUInt32BE(d.length);const cd=Buffer.concat([Buffer.from(t),d]);const C=Buffer.alloc(4);C.writeUInt32BE(crc(cd));return Buffer.concat([L,cd,C]);};
const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=2;
fs.writeFileSync(__dirname+'/toolbar_preview.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]));
console.log('wrote toolbar_preview.png',W+'x'+H);
