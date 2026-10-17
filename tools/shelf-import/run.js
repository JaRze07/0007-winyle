#!/usr/bin/env node
/* Server-side twin of the app's "Import ze zdjęć", for doing the whole shelf at
   once from a folder of photographs. Same engine (lifted from index.html), same
   rules: capture time orders, flat orange/blank frames cut the boxes, the first
   photo of a box is its front, THE STORED COVER IS THE PHOTOGRAPH, and a name
   is only written when the artwork actually matches.

   usage: node run.js <folder> [--upload] [--budget-kb 900]
          without --upload it identifies and reports, and writes nothing. */
const fs=require('fs'),path=require('path');
const E=require('./engine.js');
const UA='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const WORKER='https://winyle-api.winyle-jr.workers.dev';
const COVER_ACCEPT=0.62, COVER_MARGIN=0.06;
const folder=process.argv[2];
const UPLOAD=process.argv.includes('--upload');
const _bi=process.argv.indexOf('--budget-kb');
const BUDGET=1024*((_bi>0&&parseInt(process.argv[_bi+1],10))||900);   // indexOf -1 used to make this NaN,
                                                                      // which silently forced the smallest covers
if(!folder){ console.error('usage: node run.js <folder> [--upload]'); process.exit(2); }
const CACHE=path.join(folder,'.winyle-identify-cache.json');
const cache=fs.existsSync(CACHE)?JSON.parse(fs.readFileSync(CACHE,'utf8')):{};
const saveCache=()=>fs.writeFileSync(CACHE,JSON.stringify(cache));

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function getJSON(url,opts,tries){
  for(let i=0;i<(tries||3);i++){
    try{
      const r=await fetch(url,Object.assign({headers:{'User-Agent':UA}},opts||{}));
      if(r.status===503||r.status===429){ await sleep(1200*(i+1)); continue; }  // MB says "busy" often
      if(!r.ok) return null;
      return await r.json();
    }catch(e){ await sleep(600*(i+1)); }
  }
  return null;
}
/* MusicBrainz asks for one request a second and a real user agent. */
let mbChain=Promise.resolve();
function mbFetch(url){
  mbChain=mbChain.then(()=>sleep(1100));
  return mbChain.then(()=>getJSON(url,{headers:{'User-Agent':'winyle-import/1.0 ( jacek@klimtechnologies.com )'}},4));
}
const itMap=r=>({src:'it',artist:r.artistName||'',title:(r.collectionName||'').replace(/\s*[\(\[].*?(Deluxe|Remaster|Edition|Live|Version).*?[\)\]]/i,'').trim(),
  year:(r.releaseDate||'').slice(0,4),genre:r.primaryGenreName||'',artistId:r.artistId,
  cover:(r.artworkUrl100||'').replace('100x100bb','400x400bb'),
  coverBig:(r.artworkUrl100||'').replace('100x100bb','600x600bb')});
async function itunesSearch(artist,title,limit){
  const term=(artist+' '+title).trim(); if(!term) return [];
  const d=await getJSON('https://itunes.apple.com/search?term='+encodeURIComponent(term)+'&entity=album&limit='+(limit||12));
  return ((d&&d.results)||[]).filter(r=>r.collectionName).map(itMap);
}
async function itunesDiscography(artistId,limit){
  if(!artistId) return [];
  const d=await getJSON('https://itunes.apple.com/lookup?id='+artistId+'&entity=album&limit='+(limit||40));
  return ((d&&d.results)||[]).filter(r=>r.wrapperType==='collection'&&r.collectionName).map(itMap);
}
async function mbGroups(artist,title,limit){
  const parts=[];
  if(artist) parts.push('artist:"'+artist.replace(/"/g,'')+'"');
  if(title) parts.push('releasegroup:"'+title.replace(/"/g,'')+'"');
  if(!parts.length) return [];
  const d=await mbFetch('https://musicbrainz.org/ws/2/release-group/?query='+encodeURIComponent(parts.join(' AND '))+'&fmt=json&limit='+(limit||8));
  return ((d&&d['release-groups'])||[]).map(rg=>({src:'mb',artist:(rg['artist-credit']||[]).map(a=>a.name).join(', '),
    title:rg.title||'',year:(rg['first-release-date']||'').slice(0,4),genre:'',
    cover:'https://coverartarchive.org/release-group/'+rg.id+'/front-250',
    coverBig:'https://coverartarchive.org/release-group/'+rg.id+'/front-500'}));
}
async function claudeVision(dataUrl){
  try{
    const r=await fetch(WORKER+'/api/claude',{method:'POST',
      headers:{'Content-Type':'application/json','User-Agent':UA,'Origin':'https://jarze07.github.io'},
      body:JSON.stringify({image:dataUrl,query:'Identify this vinyl LP from the photo of its sleeve. Reply with JSON only: {"artist","title","year","genre","alternatives":[{"artist","title"}]}. Put up to 3 other plausible albums in alternatives. If you are sure of the artist but not the exact album, still give the artist and leave title empty rather than guessing a different album by that artist.'})});
    if(!r.ok) return null;
    const d=await r.json();
    if(d&&(d.title!==undefined||d.artist!==undefined)) return d;
    const text=((d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('')||'').trim();
    const m=text.replace(/```json|```/g,'').match(/\{[\s\S]*\}/);
    return m?JSON.parse(m[0]):null;
  }catch(e){ return null; }
}
const sigMemo=new Map();
async function sigOfUrl(u){
  if(!u) return null;
  if(sigMemo.has(u)) return sigMemo.get(u);
  let s=null;
  try{
    const r=await fetch(u,{headers:{'User-Agent':UA},redirect:'follow'});
    if(r.ok){ const b=Buffer.from(await r.arrayBuffer()); s=E.sigFrom(E.decodeJPEG(b)); }
  }catch(e){}
  sigMemo.set(u,s);
  return s;
}
const dedupe=cs=>{ const seen=new Set(),out=[];
  for(const c of cs){ const k=(E.normTxt(c.artist)+'|'+E.normTxt(c.title)); if(!k||seen.has(k))continue; seen.add(k); out.push(c);} return out; };

/* The app's identifyPhoto, with the same accept rule. */
async function identify(photoSig,coverDataUrl){
  const guess=await claudeVision(coverDataUrl);
  if(!guess||(!guess.artist&&!guess.title)) return {status:'none',reason:'unread'};
  let cands=[...await itunesSearch(guess.artist||'',guess.title||'',12)];
  for(const alt of (Array.isArray(guess.alternatives)?guess.alternatives:[]).slice(0,3))
    cands.push(...await itunesSearch(alt.artist||guess.artist||'',alt.title||'',5));
  const withId=cands.find(c=>c.artistId&&E.simTxt(c.artist,guess.artist||'')>0.6);
  if(withId) cands.push(...await itunesDiscography(withId.artistId,40));   // right artist, wrong record is the failure mode
  if(cands.length<6) cands.push(...await mbGroups(guess.artist||'',guess.title||'',8));
  cands=dedupe(cands);
  if(!cands.length) return {status:'none',guess,reason:'nocands'};
  const scored=[];
  for(const c of cands.slice(0,14)){
    const s=await sigOfUrl(c.cover||c.coverBig);
    if(!s) continue;
    c.dist=E.coverDist(photoSig,s);
    c.txt=0.45*E.simTxt(guess.artist||'',c.artist)+0.55*E.simTxt(guess.title||'',c.title);
    c.total=c.dist-0.10*c.txt;
    scored.push(c);
  }
  if(!scored.length) return {status:'none',guess,reason:'noart'};
  scored.sort((a,b)=>a.total-b.total);
  const best=scored[0],second=scored[1];
  const clear=!second||(second.dist-best.dist)>=COVER_MARGIN;
  const top=scored.slice(0,5).map(c=>({artist:c.artist,title:c.title,year:c.year,genre:c.genre,dist:+c.dist.toFixed(3)}));
  if(best.dist<=COVER_ACCEPT&&clear) return {status:'ok',best,top,guess};
  return {status:'ambiguous',best,top,guess};
}

(async()=>{
  const files=fs.readdirSync(folder).filter(f=>/\.(jpe?g|png|webp|heic|heif)$/i.test(f)).sort();
  console.log(`folder: ${folder}\nfiles : ${files.length}\n`);
  const items=[],skipped=[];
  for(const name of files){
    const buf=fs.readFileSync(path.join(folder,name));
    let im=null;
    try{ im=E.decodeJPEG(buf); }catch(e){ skipped.push({name,why:/\.(heic|heif)$/i.test(name)?'HEIC - nieobsługiwany format':'nie udało się zdekodować'}); continue; }
    const t=E.captureTimeOf(buf,name);
    const st=E.frameStats(im), cls=E.classifyFrame(st);
    items.push({name,...t,stats:st,kind:cls.kind,sep:cls.sep,cover:E.trimSquare(im,600)});
    process.stdout.write(`\r  read ${items.length}/${files.length}`);
  }
  console.log('');
  if(skipped.length){ console.log('\nNIE WCZYTANE:'); skipped.forEach(s=>console.log('  '+s.name+' — '+s.why)); }
  const noExif=items.filter(i=>!i.exif);
  if(noExif.length) console.log(`\nUWAGA: ${noExif.length} zdjęć bez daty EXIF — kolejność tych opiera się na numerze w nazwie pliku.`);
  items.sort(E.byCaptureOrder);

  const cases=E.groupIntoCases(items);
  const seps=items.filter(i=>i.sep);
  console.log(`\nprzekładki: ${seps.length} (${seps.map(s=>s.kind).join(', ')})`);
  console.log(`skrzynki  : ${cases.length} → ${cases.map(c=>c.length+' płyt').join(', ')}\n`);

  // identify every record photo, three at a time, caching so a re-run is free
  const recs=items.filter(i=>!i.sep);
  let done=0;
  const work=recs.map(it=>async()=>{
    const key=it.name;
    if(cache[key]){ it.res=cache[key]; }
    else {
      const sig=E.sigFrom(E.dataUrlToImg(it.cover));
      it.res=await identify(sig,it.cover);
      delete it.res.best;                      // keep the cache small
      cache[key]=it.res; saveCache();
    }
    process.stdout.write(`\r  identified ${++done}/${recs.length}`);
  });
  const running=new Set();
  for(const job of work){
    const p=job().finally(()=>running.delete(p));
    running.add(p);
    if(running.size>=3) await Promise.race(running);
  }
  await Promise.all(running);
  console.log('\n');

  // ---- the review, box by box, exactly as it will be stored ----
  const collection={crates:[],albums:[]},covers={};
  let ok=0,ph=0;
  cases.forEach((photos,ci)=>{
    const crate={id:'imp'+Date.now().toString(36)+ci,name:'Skrzynka '+(ci+1),closed:true};
    collection.crates.push(crate);
    console.log(`\n=== ${crate.name} (${photos.length}) ===`);
    for(const {photo,position} of E.positionsFor(photos,true)){
      const r=photo.res||{status:'none'};
      const d=r.status==='ok'?r.top[0]:null;
      const id='alb'+Math.random().toString(36).slice(2,10);
      collection.albums.push({id,crateId:crate.id,position,
        artist:d?d.artist:'',title:d?d.title:'',genre:d?d.genre:'',mood:'',year:d?d.year:'',
        cover:'local',rating:0,pending:d?undefined:true});
      covers[id]=photo.cover;
      if(d) ok++; else ph++;
      const mark=d?'✓':(r.status==='ambiguous'?'?':'✗');
      console.log(`  #${position} ${mark} ${photo.name.padEnd(18)} ${d?`${d.artist} — ${d.title} (${d.year}) dist=${d.dist}`:
        (r.top&&r.top.length?`niepewne: ${r.top.slice(0,2).map(t=>`${t.artist} — ${t.title} [${t.dist}]`).join(' | ')}`:'nie rozpoznano')}`);
    }
  });
  console.log(`\nRAZEM: ${ok} z nazwą, ${ph} do uzupełnienia, ${collection.crates.length} skrzynek`);
  fs.writeFileSync(path.join(folder,'winyle-import-report.json'),JSON.stringify({collection,report:recs.map(r=>({name:r.name,res:r.res}))},null,1));

  if(!UPLOAD){ console.log('\n(nie wysłano — uruchom z --upload)'); return; }

  // ---- covers must fit what the Worker can serve back; shrink to the budget ----
  let px=400,q=0.7,payload=null;
  for(const [p,qq] of [[400,0.7],[320,0.66],[256,0.62],[200,0.6],[160,0.55],[128,0.5],[96,0.45]]){
    const small={};
    for(const [id,url] of Object.entries(covers)) small[id]=E.resizeSquare(E.dataUrlToImg(url),p,qq);
    const body=JSON.stringify({crates:collection.crates,albums:collection.albums,covers:small});
    if(body.length<=BUDGET||p===96){ px=p;q=qq;payload=body; break; }
  }
  if(!isFinite(BUDGET)||BUDGET<=0){ console.error('zły budżet — przerwane'); process.exit(2); }
  console.log(`\nokładki do chmury: ${px}px q${q} → ${(payload.length/1024).toFixed(0)} kB z ${(BUDGET/1024).toFixed(0)} kB`);
  if(px<256) console.log('  (mała rozdzielczość — tyle płyt nie zmieści się większych; pełne zdjęcia są w raporcie lokalnie)');
  const r=await fetch(WORKER+'/api/db',{method:'POST',
    headers:{'Content-Type':'application/json','User-Agent':UA,'Origin':'https://jarze07.github.io'},body:payload});
  console.log('POST /api/db ->',r.status,(await r.text()).slice(0,120));
  const back=await fetch(WORKER+'/api/db',{headers:{'User-Agent':UA},cache:'no-store'});
  if(back.ok){ const v=await back.json();
    console.log(`GET /api/db -> ok: ${v.crates.length} skrzynek, ${v.albums.length} płyt, ${Object.keys(v.covers||{}).length} okładek`); }
  else console.log('GET /api/db ->',back.status,'(za duże — zmniejsz budżet)');
})();
