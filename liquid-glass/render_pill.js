// Clean "Liquid Glass" pill toolbar over a green card — offline preview.
// Verifies the look before porting to After Effects.
const zlib = require('zlib');
const fs = require('fs');

const W = 900, H = 440;
const bg = new Float64Array(W * H * 3);

const clamp = (v,a,b)=>v<a?a:v>b?b:v;
const lerp = (a,b,t)=>a+(b-a)*t;
const sm = t => { t=clamp(t,0,1); return t*t*(3-2*t); };
const I = (x,y)=>(y*W+x)*3;

function set(x,y,r,g,b,a){ if(x<0||y<0||x>=W||y>=H)return; const i=I(x|0,y|0),A=a==null?1:clamp(a,0,1);
  bg[i]=lerp(bg[i],r,A); bg[i+1]=lerp(bg[i+1],g,A); bg[i+2]=lerp(bg[i+2],b,A); }
function add(x,y,r,g,b,a){ if(x<0||y<0||x>=W||y>=H)return; const i=I(x|0,y|0);
  bg[i]=clamp(bg[i]+r*a,0,1); bg[i+1]=clamp(bg[i+1]+g*a,0,1); bg[i+2]=clamp(bg[i+2]+b*a,0,1); }

function rrSDF(x,y,cx,cy,w,h,r){ const dx=Math.abs(x-cx)-(w/2-r),dy=Math.abs(y-cy)-(h/2-r);
  return Math.hypot(Math.max(dx,0),Math.max(dy,0))+Math.min(Math.max(dx,dy),0)-r; }
const covIn = s => clamp(0.5 - s, 0, 1);
const ringCov = (s,w) => clamp(w - Math.abs(s), 0, 1);

// distance to a segment (for icon strokes)
function segDist(px,py,ax,ay,bx,by){ const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay;
  let t=(wx*vx+wy*vy)/(vx*vx+vy*vy); t=clamp(t,0,1);
  return Math.hypot(px-(ax+vx*t), py-(ay+vy*t)); }

function stroke(ax,ay,bx,by,wid,col,op){ op=op==null?1:op;
  const x0=Math.floor(Math.min(ax,bx)-wid-2),x1=Math.ceil(Math.max(ax,bx)+wid+2);
  const y0=Math.floor(Math.min(ay,by)-wid-2),y1=Math.ceil(Math.max(ay,by)+wid+2);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){ const d=segDist(x+.5,y+.5,ax,ay,bx,by);
    const a=clamp(wid/2 - d + .5,0,1)*op; if(a>0) set(x,y,col[0],col[1],col[2],a); } }
function strokeRR(cx,cy,w,h,r,wid,col,op){ op=op==null?1:op;
  for(let y=Math.floor(cy-h/2-wid-2);y<Math.ceil(cy+h/2+wid+2);y++)
  for(let x=Math.floor(cx-w/2-wid-2);x<Math.ceil(cx+w/2+wid+2);x++){
    const a=ringCov(rrSDF(x+.5,y+.5,cx,cy,w,h,r),wid/2)*op; if(a>0) set(x,y,col[0],col[1],col[2],a); } }
function dot(cx,cy,rad,col,op){ for(let y=Math.floor(cy-rad-2);y<Math.ceil(cy+rad+2);y++)
  for(let x=Math.floor(cx-rad-2);x<Math.ceil(cx+rad+2);x++){
    const a=clamp(rad-Math.hypot(x+.5-cx,y+.5-cy)+.5,0,1)*(op==null?1:op); if(a>0) set(x,y,col[0],col[1],col[2],a);} }

// ---------------- 1. black background ----------------
for(let i=0;i<W*H*3;i++) bg[i]=0.02;

// ---------------- 2. green card ----------------------
const card={cx:450,cy:560,w:840,h:760,r:78};
for(let y=140;y<H;y++)for(let x=0;x<W;x++){
  const s=rrSDF(x+.5,y+.5,card.cx,card.cy,card.w,card.h,card.r);
  const cv=covIn(s); if(cv<=0)continue;
  const v=clamp((y-150)/300,0,1);                       // top->down
  let r=lerp(0.42,0.20,v), g=lerp(0.74,0.46,v), b=lerp(0.32,0.17,v);
  const rad=Math.hypot((x-430)/420,(y-210)/260);        // soft top light
  const lift=(1-clamp(rad,0,1))*0.10; r+=lift;g+=lift;b+=lift;
  const edge=clamp((Math.abs(x-450)-250)/200,0,1)*0.10; // darker sides
  r-=edge;g-=edge;b-=edge;
  set(x,y,clamp(r,0,1),clamp(g,0,1),clamp(b,0,1),cv);
}

// ---------------- 3. blurred copy (frosted backdrop) -
function boxBlur(src,radius,passes){ let cur=src;
  for(let p=0;p<passes;p++){ const tmp=new Float64Array(cur.length),out=new Float64Array(cur.length);
    for(let y=0;y<H;y++)for(let c=0;c<3;c++){ let acc=0; const n=radius*2+1;
      for(let x=-radius;x<=radius;x++)acc+=cur[I(clamp(x,0,W-1),y)+c];
      for(let x=0;x<W;x++){ tmp[I(x,y)+c]=acc/n; acc+=cur[I(clamp(x+radius+1,0,W-1),y)+c]-cur[I(clamp(x-radius,0,W-1),y)+c]; } }
    for(let x=0;x<W;x++)for(let c=0;c<3;c++){ let acc=0; const n=radius*2+1;
      for(let y=-radius;y<=radius;y++)acc+=tmp[I(x,clamp(y,0,H-1))+c];
      for(let y=0;y<H;y++){ out[I(x,y)+c]=acc/n; acc+=tmp[I(x,clamp(y+radius+1,0,H-1))+c]-tmp[I(x,clamp(y-radius,0,H-1))+c]; } }
    cur=out; } return cur; }
const blur=boxBlur(bg.slice(),13,3);

// ---------------- 4. drop shadow under the pill ------
const pill={cx:450,cy:196,w:436,h:132,r:66};
for(let y=pill.cy-120;y<pill.cy+150;y++)for(let x=pill.cx-pill.w/2-40;x<pill.cx+pill.w/2+40;x++){
  if(x<0||y<0||x>=W||y>=H)continue;
  const s=rrSDF(x+.5,y+.5+14,pill.cx,pill.cy,pill.w,pill.h,pill.r);
  const a=clamp(-s/26,0,1)*0.30; if(a>0) set(x,y,0,0,0,a);
}

// ---------------- 5. the glass pill ------------------
const pTop=pill.cy-pill.h/2, pBot=pill.cy+pill.h/2;
for(let y=Math.floor(pTop-2);y<Math.ceil(pBot+2);y++)
for(let x=Math.floor(pill.cx-pill.w/2-2);x<Math.ceil(pill.cx+pill.w/2+2);x++){
  if(x<0||y<0||x>=W||y>=H)continue;
  const s=rrSDF(x+.5,y+.5,pill.cx,pill.cy,pill.w,pill.h,pill.r);
  const cv=covIn(s); if(cv<=0)continue;
  const i=I(x,y);
  // frosted backdrop: blurred bg, lightly milky + slightly desaturated
  let r=blur[i], g=blur[i+1], b=blur[i+2];
  const lum=(r+g+b)/3; r=lerp(r,lum,0.12); g=lerp(g,lum,0.12); b=lerp(b,lum,0.12);
  r=lerp(r,1,0.10); g=lerp(g,1,0.10); b=lerp(b,1,0.10);
  // glass thickness: dark soft band at top, bright band at bottom
  const dTop=y-pTop, dBot=pBot-y;
  const topDark=Math.exp(-dTop/20)*0.42;
  const botLight=Math.exp(-dBot/16)*0.30;
  r=clamp(r-topDark+botLight,0,1); g=clamp(g-topDark+botLight,0,1); b=clamp(b-topDark+botLight,0,1);
  set(x,y,r,g,b,cv);
}
// outer rim: bright at bottom, faint at top
for(let y=Math.floor(pTop-3);y<Math.ceil(pBot+3);y++)
for(let x=Math.floor(pill.cx-pill.w/2-3);x<Math.ceil(pill.cx+pill.w/2+3);x++){
  if(x<0||y<0||x>=W||y>=H)continue;
  const s=rrSDF(x+.5,y+.5,pill.cx,pill.cy,pill.w,pill.h,pill.r);
  const rim=ringCov(s,1.1); if(rim<=0)continue;
  const v=clamp((y-pTop)/pill.h,0,1);
  add(x,y,1,1,1,rim*lerp(0.25,0.75,v));
}

// ---------------- 6. icons (thin white strokes) ------
const ICON=[1,1,1], OP=0.92, lw=3.2, iy=pill.cy;
const xs=[pill.cx-132, pill.cx, pill.cx+132];
// (a) plus-in-rounded-rect
(()=>{ const x=xs[0];
  strokeRR(x,iy,52,42,11,lw,ICON,OP);
  stroke(x-11,iy,x+11,iy,lw,ICON,OP);
  stroke(x,iy-11,x,iy+11,lw,ICON,OP);
})();
// (b) bookmark
(()=>{ const x=xs[1], t=iy-24,b=iy+24,w=17;
  stroke(x-w,t,x+w,t,lw,ICON,OP);
  stroke(x-w,t,x-w,b,lw,ICON,OP);
  stroke(x+w,t,x+w,b,lw,ICON,OP);
  stroke(x-w,b,x,b-13,lw,ICON,OP);
  stroke(x+w,b,x,b-13,lw,ICON,OP);
})();
// (c) ellipsis
(()=>{ const x=xs[2]; for(const dx of [-16,0,16]) dot(x+dx,iy,3.1,ICON,OP); })();

// ---------------- 7. faint diagonal sheen ------------
for(let y=Math.floor(pTop);y<Math.ceil(pBot);y++)
for(let x=Math.floor(pill.cx-pill.w/2);x<Math.ceil(pill.cx+pill.w/2);x++){
  const s=rrSDF(x+.5,y+.5,pill.cx,pill.cy,pill.w,pill.h,pill.r);
  if(s>0)continue;
  const band=Math.exp(-Math.pow((x-y*0.5-(pill.cx-180))/60,2))*0.06;
  if(band>0) add(x,y,1,1,1,band);
}

// ---------------- encode PNG ------------------------
const raw=Buffer.alloc((W*3+1)*H); let p=0;
for(let y=0;y<H;y++){ raw[p++]=0; for(let x=0;x<W;x++){ const i=I(x,y);
  raw[p++]=clamp(Math.round(bg[i]*255),0,255); raw[p++]=clamp(Math.round(bg[i+1]*255),0,255); raw[p++]=clamp(Math.round(bg[i+2]*255),0,255);} }
const ct=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;ct[n]=c>>>0;}
const crc=b=>{let c=0xffffffff;for(let i=0;i<b.length;i++)c=ct[(c^b[i])&0xff]^(c>>>8);return(c^0xffffffff)>>>0;};
const ch=(t,d)=>{const L=Buffer.alloc(4);L.writeUInt32BE(d.length);const cd=Buffer.concat([Buffer.from(t),d]);const C=Buffer.alloc(4);C.writeUInt32BE(crc(cd));return Buffer.concat([L,cd,C]);};
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=2;
fs.writeFileSync(__dirname+'/pill_preview.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ihdr),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]));
console.log('wrote pill_preview.png',W+'x'+H);
