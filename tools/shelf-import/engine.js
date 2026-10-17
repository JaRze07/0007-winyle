/* Lifted verbatim from index.html so the server-side import and the phone agree.
   The only shim needed is a canvas: these functions all reach for one. */
const jpeg=require('jpeg-js');

/* A canvas with just the surface these functions touch: width/height, a 2d
   context with drawImage/getImageData, and toDataURL. drawImage box-averages
   rather than point-samples, which is what a browser does when it shrinks an
   image, and that matters because every threshold in frameStats and sigFrom was
   tuned against browser output. */
function createCanvas(){
  const cv={width:0,height:0,_px:null,
    getContext(){ return {
      filter:'',
      drawImage(img,...a){
        const W=cv.width,H=cv.height;
        let sx=0,sy=0,sw=img.width,sh=img.height,dx=0,dy=0,dw=W,dh=H;
        if(a.length===4)[dx,dy,dw,dh]=a; else if(a.length===8)[sx,sy,sw,sh,dx,dy,dw,dh]=a;
        const out=new Uint8ClampedArray(W*H*4);
        for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
          const x0=sx+x*sw/dw, x1=sx+(x+1)*sw/dw, y0=sy+y*sh/dh, y1=sy+(y+1)*sh/dh;
          const ix0=Math.max(0,Math.floor(x0)), ix1=Math.min(img.width, Math.max(ix0+1,Math.ceil(x1)));
          const iy0=Math.max(0,Math.floor(y0)), iy1=Math.min(img.height,Math.max(iy0+1,Math.ceil(y1)));
          let r=0,g=0,b=0,n=0;
          for(let yy=iy0;yy<iy1;yy++)for(let xx=ix0;xx<ix1;xx++){
            const s=(yy*img.width+xx)*4; r+=img.data[s]; g+=img.data[s+1]; b+=img.data[s+2]; n++;
          }
          if(!n) continue;
          const t=((dy+y)*W+(dx+x))*4;
          out[t]=r/n; out[t+1]=g/n; out[t+2]=b/n; out[t+3]=255;
        }
        cv._px=out;
      },
      getImageData(){ return {data:cv._px||new Uint8ClampedArray(cv.width*cv.height*4)}; }
    };},
    toDataURL(_t,q){
      const buf=Buffer.from(cv._px||new Uint8ClampedArray(cv.width*cv.height*4));
      const enc=jpeg.encode({data:buf,width:cv.width,height:cv.height},Math.round((q||0.82)*100));
      return 'data:image/jpeg;base64,'+enc.data.toString('base64');
    }};
  return cv;
}
const document={createElement:t=>t==="canvas"?createCanvas():{}};

function exifFromBuffer(v){
  try{
    if(!v||v.byteLength<12||v.getUint16(0)!==0xFFD8) return null;
    let off=2,tiff=-1;
    while(off+4<=v.byteLength){
      if(v.getUint8(off)!==0xFF) break;
      const marker=v.getUint8(off+1);
      if(marker===0xD8||marker===0x01||(marker>=0xD0&&marker<=0xD7)){ off+=2; continue; }
      if(marker===0xDA) break;                       // image data - no EXIF after this
      const len=v.getUint16(off+2);
      if(len<2) break;
      if(marker===0xE1&&off+10<=v.byteLength){
        let tag=''; for(let i=0;i<4;i++) tag+=String.fromCharCode(v.getUint8(off+4+i));
        if(tag==='Exif'){ tiff=off+10; break; }
      }
      off+=2+len;
    }
    if(tiff<0||tiff+8>v.byteLength) return null;
    const bo=v.getUint16(tiff);
    if(bo!==0x4949&&bo!==0x4D4D) return null;
    const LE=(bo===0x4949);
    const u16=o=>v.getUint16(o,LE),u32=o=>v.getUint32(o,LE);
    if(u16(tiff+2)!==0x002A) return null;
    const str=(o,n)=>{ let s=''; for(let i=0;i<n&&o+i<v.byteLength;i++){ const c=v.getUint8(o+i); if(!c) break; s+=String.fromCharCode(c); } return s; };
    const walk=(ifd,want)=>{
      const out={};
      if(ifd+2>v.byteLength) return out;
      const n=u16(ifd);
      for(let i=0;i<n;i++){
        const e=ifd+2+i*12;
        if(e+12>v.byteLength) break;
        const tag=u16(e),type=u16(e+2),cnt=u32(e+4);
        if(want.indexOf(tag)<0) continue;
        if(type===3) out[tag]=u16(e+8);
        else if(type===4) out[tag]=u32(e+8);
        else { const size=cnt; out[tag]=size>4?str(tiff+u32(e+8),Math.min(size,32)):str(e+8,Math.min(size,4)); }
      }
      return out;
    };
    const ifd0=walk(tiff+u32(tiff+4),[0x8769,0x0132]);
    let dt=null,sub=0;
    if(ifd0[0x8769]!==undefined){
      const ex=walk(tiff+ifd0[0x8769],[0x9003,0x9004,0x9291,0x9292]);
      dt=ex[0x9003]||ex[0x9004]||null;
      const ss=((ex[0x9291]||ex[0x9292]||'')+'').replace(/\D/g,'').slice(0,3);
      sub=ss?parseInt((ss+'000').slice(0,3),10):0;     // "9" is .900s, not 9 ms
    }
    if(!dt) dt=ifd0[0x0132]||null;
    if(!dt) return null;
    const m=(dt+'').match(/(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if(!m) return null;
    const ms=new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]).getTime();
    if(!isFinite(ms)) return null;
    return {ms,sub};
  }catch(e){ return null; }
}

function seqFromName(name){
  const m=(name||'').match(/(\d+)(?!.*\d)/);        // the last run of digits
  return m?parseInt(m[1],10):0;
}

function byCaptureOrder(a,b){
  return (a.ms-b.ms)||(a.sub-b.sub)||(a.seq-b.seq)||String(a.name).localeCompare(String(b.name));
}

function frameStats(drawable){
  try{
    const N=48,cv=document.createElement('canvas');
    cv.width=cv.height=N;
    const cx=cv.getContext('2d',{willReadFrequently:true});
    cx.drawImage(drawable,0,0,N,N);
    const d=cx.getImageData(0,0,N,N).data,n=N*N;
    let mr=0,mg=0,mb=0;
    for(let i=0;i<n;i++){ mr+=d[i*4]; mg+=d[i*4+1]; mb+=d[i*4+2]; }
    mr/=n; mg/=n; mb/=n;
    let off=0,ls=0,lss=0;
    for(let i=0;i<n;i++){
      const r=d[i*4],g=d[i*4+1],b=d[i*4+2];
      if(Math.abs(r-mr)+Math.abs(g-mg)+Math.abs(b-mb)>60) off++;
      const l=r*0.299+g*0.587+b*0.114; ls+=l; lss+=l*l;
    }
    const lm=ls/n,lstd=Math.sqrt(Math.max(0,lss/n-lm*lm));
    const mx=Math.max(mr,mg,mb),mn=Math.min(mr,mg,mb);
    const sat=mx?(mx-mn)/mx:0;
    let hue=0;
    if(mx!==mn){
      if(mx===mr) hue=60*(((mg-mb)/(mx-mn))%6);
      else if(mx===mg) hue=60*((mb-mr)/(mx-mn)+2);
      else hue=60*((mr-mg)/(mx-mn)+4);
      if(hue<0) hue+=360;
    }
    return {mean:[Math.round(mr),Math.round(mg),Math.round(mb)],off:off/n,lstd,sat,hue,val:mx/255};
  }catch(e){ return null; }
}

function classifyFrame(st){
  if(!st) return {sep:false,kind:'photo'};
  const flat=(st.off<0.06&&st.lstd<16);
  if(!flat) return {sep:false,kind:'photo',st};
  if(st.hue>=10&&st.hue<=55&&st.sat>=0.30) return {sep:true,kind:'orange',st};
  if(st.sat<0.15) return {sep:true,kind:'blank',st};
  return {sep:false,kind:'flat',st};               // flat but not a colour we shoot dividers in
}

function groupIntoCases(items){
  const cases=[]; let cur=[];
  for(const it of items){
    if(it.sep){ if(cur.length) cases.push(cur); cur=[]; }
    else cur.push(it);
  }
  if(cur.length) cases.push(cur);
  return cases;
}

function positionsFor(photos,frontFirst){
  const n=photos.length;
  return photos.map((p,i)=>({photo:p,position:frontFirst?n-i:i+1}));
}

function sigFrom(drawable){
  try{
    const N=16,cv=document.createElement('canvas');
    cv.width=N;cv.height=N;
    const cx=cv.getContext('2d',{willReadFrequently:true});
    cx.drawImage(drawable,0,0,N,N);
    const d=cx.getImageData(0,0,N,N).data;
    const g=new Float32Array(N*N),col=new Float32Array(48);
    for(let i=0;i<N*N;i++){
      const r=d[i*4],gr=d[i*4+1],b=d[i*4+2];
      g[i]=r*0.299+gr*0.587+b*0.114;
      const q=(Math.floor(Math.floor(i/N)/4)*4+Math.floor((i%N)/4))*3;
      col[q]+=r/16; col[q+1]+=gr/16; col[q+2]+=b/16;
    }
    const bits=[];
    for(let y=0;y<N;y++) for(let x=0;x<N-1;x++) bits.push(g[y*N+x]>g[y*N+x+1]?1:0);
    for(let x=0;x<N;x++) for(let y=0;y<N-1;y++) bits.push(g[y*N+x]>g[(y+1)*N+x]?1:0);
    let mean=0; for(let i=0;i<48;i++) mean+=col[i]; mean/=48;
    return {bits,col,mean:mean||1};
  }catch(e){ return null; }
}

function coverDist(a,b){
  if(!a||!b) return 1;
  let diff=0; for(let i=0;i<a.bits.length;i++) if(a.bits[i]!==b.bits[i]) diff++;
  const bitD=Math.min(1,(diff/a.bits.length)/0.5);     // 0.5 of the bits differ = unrelated
  // scale both colour signatures to a common brightness first, so a photo taken
  // in a dim room still matches the same artwork scanned under studio light
  const ka=1/a.mean,kb=1/b.mean;
  let cd=0; for(let i=0;i<48;i++) cd+=Math.abs(a.col[i]*ka-b.col[i]*kb);
  const colD=Math.min(1,cd/48/0.9);
  return 0.62*bitD+0.38*colD;
}

function trimSquare(img,max){
  try{
      // Step 1: draw full image
      const tmp=document.createElement('canvas');
      tmp.width=img.width;tmp.height=img.height;
      const tctx=tmp.getContext('2d',{willReadFrequently:true});
      tctx.drawImage(img,0,0);
      // Step 2: auto-trim — detect background and crop
      const idata=tctx.getImageData(0,0,tmp.width,tmp.height);
      const d=idata.data;
      const w=tmp.width,h=tmp.height;
      // sample edge pixels to find background color
      let rSum=0,gSum=0,bSum=0,count=0;
      const sampleEdge=(x,y)=>{const i=(y*w+x)*4;rSum+=d[i];gSum+=d[i+1];bSum+=d[i+2];count++;};
      for(let x=0;x<w;x+=Math.max(1,Math.floor(w/50))){sampleEdge(x,0);sampleEdge(x,h-1);}
      for(let y=0;y<h;y+=Math.max(1,Math.floor(h/50))){sampleEdge(0,y);sampleEdge(w-1,y);}
      const bgR=rSum/count,bgG=gSum/count,bgB=bSum/count;
      const thresh=35;
      const isBg=(x,y)=>{const i=(y*w+x)*4;return Math.abs(d[i]-bgR)+Math.abs(d[i+1]-bgG)+Math.abs(d[i+2]-bgB)<thresh*3;};
      const step=Math.max(1,Math.floor(Math.min(w,h)/100));
      let top=0,bot=h-1,left=0,right=w-1;
      // top edge
      outer:for(let y=0;y<h*0.4;y+=step){for(let x=Math.floor(w*0.2);x<w*0.8;x+=step){if(!isBg(x,y)){top=Math.max(0,y-2);break outer;}}}
      // bottom edge
      outer2:for(let y=h-1;y>h*0.6;y-=step){for(let x=Math.floor(w*0.2);x<w*0.8;x+=step){if(!isBg(x,y)){bot=Math.min(h-1,y+2);break outer2;}}}
      // left edge
      outer3:for(let x=0;x<w*0.4;x+=step){for(let y=Math.floor(h*0.2);y<h*0.8;y+=step){if(!isBg(x,y)){left=Math.max(0,x-2);break outer3;}}}
      // right edge
      outer4:for(let x=w-1;x>w*0.6;x-=step){for(let y=Math.floor(h*0.2);y<h*0.8;y+=step){if(!isBg(x,y)){right=Math.min(w-1,x+2);break outer4;}}}
      // only crop if meaningful bounds
      let cx=left,cy=top,cw=right-left+1,ch=bot-top+1;
      if(cw<w*0.4||ch<h*0.4){cx=0;cy=0;cw=w;ch=h;}
      // Step 3: make squarish
      const side=Math.min(cw,ch);
      if(cw>ch*1.15){cx+=Math.floor((cw-side)/2);cw=side;}
      else if(ch>cw*1.15){cy+=Math.floor((ch-side)/2);ch=side;}
      // Step 4: downscale to max 600px
      const s=Math.min(1,(max||600)/Math.max(cw,ch));
      const cv=document.createElement('canvas');
      cv.width=Math.round(cw*s);cv.height=Math.round(ch*s);
      cv.getContext('2d').drawImage(tmp,cx,cy,cw,ch,0,0,cv.width,cv.height);
      return cv.toDataURL('image/jpeg',0.82);
  }catch(e){ try{ return resizeSquare(img,max||600); }catch(e2){ return null; } }
}

function resizeSquare(drawable,max,q){
  const w=drawable.width||drawable.videoWidth,h=drawable.height||drawable.videoHeight;
  const side=Math.min(w,h),s=Math.min(1,(max||600)/side);
  const cv=document.createElement('canvas');
  cv.width=cv.height=Math.round(side*s);
  cv.getContext('2d').drawImage(drawable,Math.floor((w-side)/2),Math.floor((h-side)/2),side,side,0,0,cv.width,cv.height);
  return cv.toDataURL('image/jpeg',q||0.82);
}

const NOISE=/\b(remaster(ed)?|remastered version|deluxe|expanded|edition|anniversary|mono|stereo|vinyl|lp|ep|reissue|bonus tracks?|the original|original recording|explicit|single)\b/g;
function normTxt(s){
  return (s||'').toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g,' ')
    .replace(/&/g,' and ')
    .replace(NOISE,' ')
    .replace(/[^a-z0-9]+/g,' ').replace(/\bthe\b/g,' ').trim();
}

function simTxt(a,b){
  a=normTxt(a); b=normTxt(b);
  if(!a||!b) return 0;
  if(a===b) return 1;
  const A=a.split(' ').filter(Boolean),B=b.split(' ').filter(Boolean);
  const sA=new Set(A),sB=new Set(B);
  let inter=0; sA.forEach(t=>{ if(sB.has(t)) inter++; });
  const dice=(2*inter)/(sA.size+sB.size);
  const cont=(a.includes(b)||b.includes(a))?0.88:0;
  return Math.max(dice,cont);
}

/* --- Node-side helpers the browser gets for free --- */
function decodeJPEG(buf){
  const d=jpeg.decode(buf,{useTArray:true,maxMemoryUsageInMB:512});
  return {width:d.width,height:d.height,data:d.data};
}
function captureTimeOf(buf,name){
  const t=exifFromBuffer(new DataView(buf.buffer,buf.byteOffset,buf.byteLength));
  return {ms:t?t.ms:0,sub:t?t.sub:0,exif:!!t,seq:seqFromName(name),name:name||''};
}
function dataUrlToImg(u){ return decodeJPEG(Buffer.from(String(u).split(',')[1],'base64')); }

module.exports={exifFromBuffer,seqFromName,byCaptureOrder,frameStats,classifyFrame,groupIntoCases,
  positionsFor,sigFrom,coverDist,trimSquare,resizeSquare,normTxt,simTxt,
  decodeJPEG,captureTimeOf,dataUrlToImg,createCanvas};
