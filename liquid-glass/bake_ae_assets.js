// Bakes AE-ready assets from the physics glass model:
//   ae_displacement.png  - RG displacement map for AE's Displacement Map effect
//   ae_surface.png       - RGBA overlay (tint, specular, rim, inner shadow, icons)
// Both are oversized (margin) with the capsule centred, so the layer can be
// moved in AE without exposing edges. Prints MAXDISP for the AE script.
const zlib = require('zlib'), fs = require('fs');

const W = 1200, H = 700;                 // oversized canvas (comp is 900x440)
const cap = { cx: 600, cy: 350, w: 436, h: 132, r: 66 };

const clamp = (v,a,b)=>v<a?a:v>b?b:v;
const smooth = (e0,e1,x)=>{const t=clamp((x-e0)/(e1-e0),0,1);return t*t*(3-2*t);};
function rrSDF(x,y,cx,cy,w,h,r){const dx=Math.abs(x-cx)-(w/2-r),dy=Math.abs(y-cy)-(h/2-r);
  return Math.hypot(Math.max(dx,0),Math.max(dy,0))+Math.min(Math.max(dx,dy),0)-r;}
const surf = x => Math.pow(1 - Math.pow(1 - x, 4), 0.25);   // squircle bezel

// physics params (match glass.js)
const ior = 1.7, thick = 70;
const bezel = Math.min(cap.r, Math.min(cap.w, cap.h) / 2) * 0.95;
function dispFor(slope, h0, ix){ const s=clamp(Math.sin(slope)/ix,-1,1); return h0*thick*(Math.tan(slope)-Math.tan(Math.asin(s))); }

// buffers
const dX = new Float64Array(W*H), dY = new Float64Array(W*H);
// surface premultiplied RGBA accumulator
const sR=new Float64Array(W*H), sG=new Float64Array(W*H), sB=new Float64Array(W*H), sA=new Float64Array(W*H);
function over(i, r,g,b,a){ // src (straight) over acc (premult)
  const ia=1-a;
  sR[i]=r*a + sR[i]*ia; sG[i]=g*a + sG[i]*ia; sB[i]=b*a + sB[i]*ia; sA[i]=a + sA[i]*ia;
}

let maxDisp = 1e-6;
const x0=Math.floor(cap.cx-cap.w/2-2), x1=Math.ceil(cap.cx+cap.w/2+2);
const y0=Math.floor(cap.cy-cap.h/2-2), y1=Math.ceil(cap.cy+cap.h/2+2);
for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const d=rrSDF(x+.5,y+.5,cap.cx,cap.cy,cap.w,cap.h,cap.r);
  if(d>1) continue;
  const i=y*W+x, e=-d;
  let nx=rrSDF(x+1,y,cap.cx,cap.cy,cap.w,cap.h,cap.r)-rrSDF(x-1,y,cap.cx,cap.cy,cap.w,cap.h,cap.r);
  let ny=rrSDF(x,y+1,cap.cx,cap.cy,cap.w,cap.h,cap.r)-rrSDF(x,y-1,cap.cx,cap.cy,cap.w,cap.h,cap.r);
  const nl=Math.hypot(nx,ny)||1; nx/=nl; ny/=nl;
  // refraction displacement
  const t=clamp(e/bezel,0,1), hh=surf(t), dh=(surf(Math.min(t+0.001,1))-hh)/0.001;
  const slope=Math.atan(dh*(thick/bezel));
  const disp=clamp(dispFor(slope,hh,ior), -48, 48);   // clamp the edge spike
  const ddx=-nx*disp, ddy=-ny*disp;
  dX[i]=ddx; dY[i]=ddy;
  if(Math.abs(ddx)>maxDisp)maxDisp=Math.abs(ddx);
  if(Math.abs(ddy)>maxDisp)maxDisp=Math.abs(ddy);
  // ---- surface overlay (alpha-composited, content-independent) ----
  const cov=clamp(-d+0.5,0,1);
  over(i, 255,255,255, 0.06*cov);                               // milky tint
  const v=clamp((y-(cap.cy-cap.h/2))/cap.h,0,1), body=(v-0.45)*28;
  if(body<0) over(i, 0,0,0, clamp(-body/255,0,1)*cov);          // top darken
  const rimDot=Math.abs(nx*0.45+ny*-0.89), rimFall=1-smooth(0,bezel*0.45,e);
  let sh=Math.pow(rimDot*rimFall,1.5)*0.55 + Math.max(0,ny)*rimFall*0.27;
  const innerShadow=1-smooth(0,bezel*0.6,e), dk=innerShadow*0.22*Math.max(0,-ny);
  if(dk>0) over(i, 0,0,0, clamp(dk,0,1)*cov);                   // inner shadow
  if(sh>0) over(i, 255,255,255, clamp(sh,0,0.9)*cov);           // specular + rim
  const innerRim=smooth(0,2,e)*(1-smooth(2,6,e))*0.24;
  if(innerRim>0) over(i, 255,255,255, clamp(innerRim,0,1)*cov); // inner rim
}

// ---- icons (white strokes) over the surface ----
function px(x,y,a){ if(x<0||y<0||x>=W||y>=H)return; over(y*W+x, 255,255,255, clamp(a,0,1)); }
function seg(ax,ay,bx,by,wid){for(let y=Math.floor(Math.min(ay,by)-wid);y<Math.ceil(Math.max(ay,by)+wid);y++)
  for(let x=Math.floor(Math.min(ax,bx)-wid);x<Math.ceil(Math.max(ax,bx)+wid);x++){
    const vx=bx-ax,vy=by-ay,wx=x+.5-ax,wy=y+.5-ay;let t=clamp((wx*vx+wy*vy)/(vx*vx+vy*vy),0,1);
    px(x,y,clamp(wid/2-Math.hypot(x+.5-(ax+vx*t),y+.5-(ay+vy*t))+.5,0,1)*0.95);}}
function strokeRR(cx,cy,w,h,r,wid){for(let y=Math.floor(cy-h/2-wid);y<Math.ceil(cy+h/2+wid);y++)
  for(let x=Math.floor(cx-w/2-wid);x<Math.ceil(cx+w/2+wid);x++)px(x,y,clamp(wid/2-Math.abs(rrSDF(x+.5,y+.5,cx,cy,w,h,r))+.5,0,1)*0.95);}
function dot(cx,cy,rad){for(let y=Math.floor(cy-rad-1);y<Math.ceil(cy+rad+1);y++)for(let x=Math.floor(cx-rad-1);x<Math.ceil(cx+rad+1);x++)
  px(x,y,clamp(rad-Math.hypot(x+.5-cx,y+.5-cy)+.5,0,1)*0.95);}
const iy=cap.cy, lw=3.2, X=[cap.cx-132,cap.cx,cap.cx+132];
strokeRR(X[0],iy,52,42,11,lw); seg(X[0]-11,iy,X[0]+11,iy,lw); seg(X[0],iy-11,X[0],iy+11,lw);
seg(X[1]-17,iy-24,X[1]+17,iy-24,lw); seg(X[1]-17,iy-24,X[1]-17,iy+24,lw); seg(X[1]+17,iy-24,X[1]+17,iy+24,lw); seg(X[1]-17,iy+24,X[1],iy+11,lw); seg(X[1]+17,iy+24,X[1],iy+11,lw);
for(const ddx of [-16,0,16]) dot(X[2]+ddx,iy,3.1);

// ================= encode displacement PNG (RGB) =================
function pngRGB(getRGB){
  const raw=Buffer.alloc((W*3+1)*H); let p=0;
  for(let y=0;y<H;y++){raw[p++]=0;for(let x=0;x<W;x++){const c=getRGB(x,y);raw[p++]=c[0];raw[p++]=c[1];raw[p++]=c[2];}}
  return pngWrap(raw, 2);
}
function pngRGBA(getRGBA){
  const raw=Buffer.alloc((W*4+1)*H); let p=0;
  for(let y=0;y<H;y++){raw[p++]=0;for(let x=0;x<W;x++){const c=getRGBA(x,y);raw[p++]=c[0];raw[p++]=c[1];raw[p++]=c[2];raw[p++]=c[3];}}
  return pngWrap(raw, 6);
}
function pngWrap(raw, colorType){
  const ct=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;ct[n]=c>>>0;}
  const crc=b=>{let c=0xffffffff;for(let i=0;i<b.length;i++)c=ct[(c^b[i])&0xff]^(c>>>8);return(c^0xffffffff)>>>0;};
  const ch=(t,d)=>{const L=Buffer.alloc(4);L.writeUInt32BE(d.length);const cd=Buffer.concat([Buffer.from(t),d]);const C=Buffer.alloc(4);C.writeUInt32BE(crc(cd));return Buffer.concat([L,cd,C]);};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=colorType;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]);
}

const enc = v => clamp(Math.round(128 + (v/maxDisp)*127), 0, 255);
fs.writeFileSync(__dirname+'/ae_displacement.png', pngRGB((x,y)=>{const i=y*W+x;return [enc(dX[i]), enc(dY[i]), 128];}));
fs.writeFileSync(__dirname+'/ae_surface.png', pngRGBA((x,y)=>{const i=y*W+x, a=sA[i];
  if(a<=0) return [0,0,0,0];
  return [clamp(Math.round(sR[i]/a),0,255), clamp(Math.round(sG[i]/a),0,255), clamp(Math.round(sB[i]/a),0,255), clamp(Math.round(a*255),0,255)];}));

console.log('wrote ae_displacement.png + ae_surface.png ('+W+'x'+H+')');
console.log('MAXDISP =', maxDisp.toFixed(3), '  (capsule centred at '+cap.cx+','+cap.cy+')');
