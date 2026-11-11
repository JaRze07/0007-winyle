#!/usr/bin/env node
/* Browser checks for the app, run against the files in this checkout.

     node tools/smoke-test/run.js            (needs the `playwright` package and its Chromium)

   The folder is served from a throwaway local server under /0007-winyle/, the
   same sub-path GitHub Pages uses, and EVERY request that leaves that server is
   answered here or aborted - the live Worker is never touched. That matters:
   a test profile is a "new phone", and a new phone that pushes anything
   overwrites the real collection.

   What is covered is what can go wrong without a camera: the app starting
   clean, hostile text arriving from the cloud copy, the things that lose data
   (storage full, a stray tap on a full queue, a double tap, demo data pushed
   over the real collection, pushes overtaking each other) and the service
   worker's offline behaviour. The camera paths still need the phone. */
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright');

const ROOT=path.join(__dirname,'..','..');
const SUB='/0007-winyle/';
const WORKER='https://winyle-api.winyle-jr.workers.dev';
const RAW='https://raw.githubusercontent.com/';
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.png':'image/png'};

/* ---- the local "GitHub Pages", with two switches for the outage tests ---- */
const srv={down:false,status:0};      // down: drop the connection · status: answer everything with it
const server=http.createServer((req,res)=>{
  if(srv.down){ req.socket.destroy(); return; }
  if(srv.status){ res.writeHead(srv.status,{'content-type':'text/html'}); res.end('<h1>'+srv.status+'</h1>'); return; }
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(!p.startsWith(SUB)){ res.writeHead(404); res.end(); return; }
  p=p.slice(SUB.length)||'index.html';
  const file=path.join(ROOT,p);
  if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){ res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200,{'content-type':TYPES[path.extname(file)]||'application/octet-stream','cache-control':'max-age=600'});
  fs.createReadStream(file).pipe(res);
});

let browser,base,failed=0,passed=0;
const results=[];
function check(name,ok,detail){
  if(ok) passed++; else failed++;
  results.push((ok?'  ok    ':'  FAIL  ')+name+(ok||!detail?'':'\n          '+detail));
}

/* A fresh profile. `net(request)` may answer an outside request with
   {status,body} (body is JSON text or a Buffer); anything it leaves is aborted. */
async function open(opt){
  opt=opt||{};
  const ctx=await browser.newContext({serviceWorkers:opt.sw?'allow':'block',viewport:{width:412,height:860}});
  const out=[],errors=[];
  await ctx.route('**/*',async route=>{
    const rq=route.request(),u=rq.url();
    if(u.startsWith(base)||u.startsWith('data:')||u.startsWith('blob:')) return route.continue();
    out.push({method:rq.method(),url:u,body:rq.postData()});
    let a=null;
    try{ a=opt.net?await opt.net(rq):null; }catch(e){}
    if(a) return route.fulfill({status:a.status||200,contentType:'application/json; charset=utf-8',
      headers:{'access-control-allow-origin':'*'},body:a.body});
    return route.abort();
  });
  const page=await ctx.newPage();
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource|net::ERR_/.test(m.text())) errors.push('console: '+m.text()); });
  if(opt.init) await page.addInitScript(opt.init);
  await page.goto(base);
  await page.waitForSelector('#nav button');
  return {ctx,page,out,errors};
}
const xssState=page=>page.evaluate(()=>({hit:window.__xss||0,
  nodes:document.querySelectorAll('img[src="x"],[onerror]:not([onerror*="visibility"]),[onmouseover]').length}));
const pushes=out=>out.filter(r=>r.method==='POST'&&r.url.startsWith(WORKER+'/api/db'));
const tab=(page,id)=>page.click('#nav button[data-tab="'+id+'"]');

/* Four "sleeves" on a grey table, for the one-photo-of-four route (the only
   capture route that runs without a camera). */
async function squareOfFour(page){
  const b64=await page.evaluate(()=>{
    const c=document.createElement('canvas'); c.width=c.height=1200;
    const x=c.getContext('2d'); x.fillStyle='#777'; x.fillRect(0,0,1200,1200);
    [[60,60,'#b22'],[660,60,'#2a4'],[60,660,'#24b'],[660,660,'#cb2']].forEach(([px,py,col])=>{
      x.fillStyle=col; x.fillRect(px,py,480,480);
      x.fillStyle='#fff'; x.fillRect(px+90,py+90,150,60);
      x.fillStyle='#111'; x.fillRect(px+250,py+290,110,110);
    });
    return c.toDataURL('image/jpeg',0.9).split(',')[1];
  });
  return {name:'IMG_0001.jpg',mimeType:'image/jpeg',buffer:Buffer.from(b64,'base64')};
}
async function queueFour(page){
  await page.click('.crate-card');
  await page.click('#addRec');
  const [fc]=await Promise.all([page.waitForEvent('filechooser'),page.click('#goQuad')]);
  await fc.setFiles(await squareOfFour(page));
  await page.click('#quadOk');
  await page.waitForSelector('#addAll');
  // identification cannot reach the proxy here, so every row settles as unrecognised
  await page.waitForFunction(()=>!/w toku/.test(document.querySelector('#addAll').textContent),null,{timeout:20000});
  return page.locator('#qlist .brow').count();
}

const tests={
  async 'starts clean and every screen opens'(){
    const {ctx,page,errors}=await open();
    check('demo collection is shown on a new device',await page.locator('.crate-card').count()===2);
    await page.click('.crate-card');
    await page.click('[data-row]');                      // album card
    await page.click('#editThis');
    await page.fill('#egenre','Jazz & Blues <b>');
    await page.click('#esave');
    check('a genre with markup in it is shown as text',
      (await page.locator('#rowList').innerText()).includes('Jazz & Blues <b>')&&await page.locator('#rowList b b').count()===0);
    await page.click('#crateMenu'); await page.click('#sheetClose');
    await tab(page,'listen'); await page.click('#startDeck'); await page.waitForSelector('#centerCard');
    await tab(page,'search'); await page.fill('#sq','evans');
    check('search finds a record',await page.locator('#sres .row').count()===1);
    await tab(page,'settings');
    check('settings shows the build number',/Wersja \d+/.test(await page.locator('#main').innerText()));
    check('no script errors',errors.length===0,errors.join(' | '));
    await ctx.close();
  },

  async 'demo data on a new device is never pushed over the cloud copy'(){
    // every outside request fails: exactly what a first launch without signal looks like
    const {ctx,page,out}=await open();
    await page.waitForTimeout(400);
    check('nothing is POSTed to the Worker after seeding',pushes(out).length===0,pushes(out).length+' push(es) sent');
    check('the pull was attempted first',out.some(r=>r.method==='GET'&&r.url.startsWith(WORKER+'/api/db')));
    await ctx.close();
  },

  async 'hostile text in the cloud copy cannot run'(){
    const P='"><img src=x onerror="window.__xss=1">',Q="'><img src=x onerror='window.__xss=1'>";
    const db={crates:[{id:'c1',name:'Box '+P,closed:false},{id:'c"2\'><i>',name:Q,closed:true}],
      albums:[
        {id:'a1',crateId:'c1',position:1,artist:'Art'+P,title:'Tit'+P,genre:'Gen'+P,mood:'Mood'+P,year:'19'+P,cover:'',rating:3},
        {id:'a"2\'x',crateId:'c1',position:'2'+P,artist:'B',title:'T2',genre:Q,mood:Q,year:1965,cover:P,rating:1e9},
        {id:'a3',crateId:'c1',position:3,artist:null,title:42,genre:'',mood:'',year:'',cover:'javascript:alert(1)',rating:-4,pending:true,code:P}],
      covers:{a1:P,a3:'javascript:alert(1)'}};
    const {ctx,page,errors}=await open({net:rq=>rq.method()==='GET'&&rq.url().startsWith(WORKER+'/api/db')?{body:JSON.stringify(db)}:null});
    const steps=[
      ['box list',async()=>{}],
      ['box',async()=>{ await page.click('.crate-card'); await page.waitForSelector('#rowList .row'); }],
      ['record card',async()=>{ await page.click('[data-row]'); await page.waitForSelector('#editThis'); }],
      ['edit record',async()=>{ await page.click('#editThis'); await page.waitForSelector('#esave'); await page.click('#sheetClose'); }],
      ['close-box summary',async()=>{ await page.click('#closeCrate'); await page.waitForSelector('#seal'); await page.click('#keepOpen'); }],
      ['add-record sheet',async()=>{ await page.click('#addRec'); await page.waitForSelector('#crateSel'); await page.click('#goManual');
                                     await page.waitForSelector('#crateSel3'); await page.click('#sheetClose'); }],
      ['listen filters',async()=>{ await tab(page,'listen'); await page.waitForSelector('#startDeck'); }],
      ['carousel',async()=>{ await page.click('#startDeck'); await page.waitForSelector('#centerCard'); }],
      ['search',async()=>{ await tab(page,'search'); await page.waitForSelector('#sres .row'); }],
      ['settings',async()=>{ await tab(page,'settings'); }]
    ];
    for(const [name,go] of steps){
      let err='';
      try{ await go(); }catch(e){ err=e.message.split('\n')[0]; }
      const x=await xssState(page);
      check('no injection on: '+name,!err&&!x.hit&&!x.nodes,err||('handler ran: '+x.hit+', injected nodes: '+x.nodes));
    }
    check('the three records survived the clean-up',await page.evaluate(()=>state.albums.length)===3);
    check('no script errors',errors.length===0,errors.slice(0,3).join(' | '));
    await ctx.close();
  },

  async 'a pulled collection keeps its Polish characters'(){
    const good=JSON.stringify({crates:[{id:'c1',name:'Sobotni wieczór',closed:false}],
      albums:[{id:'a1',crateId:'c1',position:1,artist:'Czesław Niemen',title:'Dziwny jest ten świat',genre:'Świat',mood:'',year:'1967',cover:''}]});
    // the Worker fails, so this also covers the raw-file fallback
    const {ctx,page,out}=await open({net:rq=>rq.url().startsWith(RAW)?{body:good}:null});
    const got=await page.evaluate(()=>[state.crates[0]&&state.crates[0].name,state.albums[0]&&state.albums[0].artist,state.albums[0]&&state.albums[0].genre]);
    check('names arrive intact through the raw fallback',got.join('|')==='Sobotni wieczór|Czesław Niemen|Świat',got.join('|'));
    await page.waitForTimeout(300);
    check('a pulled collection is not pushed straight back',pushes(out).length===0);
    await ctx.close();
  },

  async 'a full device store is reported, not swallowed'(){
    const {ctx,page}=await open();
    await page.evaluate(()=>{
      const real=Storage.prototype.setItem;
      window.__quota=true;
      Storage.prototype.setItem=function(k,v){
        if(window.__quota&&k==='winyle-meta') throw new DOMException('full','QuotaExceededError');
        return real.call(this,k,v);
      };
    });
    await page.click('#newCrate'); await page.fill('#cn','Pełna'); await page.click('#createCrate');
    check('a warning stays on screen when the save fails',await page.locator('#saveWarn').isVisible().catch(()=>false));
    await page.evaluate(()=>{ window.__quota=false; });
    await page.click('#crateMenu'); await page.fill('#editCrateName','Pełna 2'); await page.click('#saveCrateName');
    check('and goes away once a save succeeds',!(await page.locator('#saveWarn').isVisible().catch(()=>false)));
    await ctx.close();

    // the realistic cause: covers an older build left in localStorage. Full until they are gone.
    const b=await open();
    await b.page.evaluate(()=>{
      localStorage.setItem('winyle-cover-old1',JSON.stringify('data:image/jpeg;base64,AAAA'));
      const real=Storage.prototype.setItem;
      Storage.prototype.setItem=function(k,v){
        if(k==='winyle-meta'&&Object.keys(localStorage).some(x=>x.indexOf('winyle-cover-')===0)) throw new DOMException('full','QuotaExceededError');
        return real.call(this,k,v);
      };
    });
    await b.page.click('#newCrate'); await b.page.fill('#cn','Po migracji'); await b.page.click('#createCrate');
    await b.page.waitForSelector('#back');             // the new box opens once the save has finished
    const r=await b.page.evaluate(async()=>({warn:!!document.getElementById('saveWarn'),
      left:Object.keys(localStorage).filter(x=>x.indexOf('winyle-cover-')===0).length,
      moved:await getCover('old1'),
      stored:JSON.parse(localStorage.getItem('winyle-meta')).crates.some(c=>c.name==='Po migracji')}));
    check('old covers are moved to IndexedDB to make room, and the save goes through',
      !r.warn&&r.left===0&&r.moved==='data:image/jpeg;base64,AAAA'&&r.stored,JSON.stringify(r));
    await b.ctx.close();
  },

  async 'pushes do not overtake each other'(){
    let live=0,peak=0; const bodies=[];
    const {ctx,page}=await open({net:async rq=>{
      if(!rq.url().startsWith(WORKER+'/api/db')||rq.method()!=='POST') return null;
      live++; peak=Math.max(peak,live); bodies.push(JSON.parse(rq.postData()));
      await new Promise(r=>setTimeout(r,350));
      live--; return {body:'{"ok":true}'};
    }});
    await page.evaluate(async()=>{
      for(const n of ['A','B','C']){ state.crates[0].name=n; persist(); await new Promise(r=>setTimeout(r,60)); }
    });
    await page.waitForTimeout(1500);
    check('one push at a time',peak===1,'peak concurrency '+peak);
    const last=bodies[bodies.length-1];
    check('the last push carries the final state',!!last&&last.crates[0].name==='C',last?last.crates[0].name:'no push seen');
    check('saves made while one was in flight are folded into one push',bodies.length===2,bodies.length+' pushes');
    await ctx.close();
  },

  async 'the bulk queue: double tap, and a stray tap outside the sheet'(){
    const {ctx,page,errors}=await open();
    const before=await page.evaluate(()=>state.albums.length);
    check('a square of four queues four rows',await queueFour(page)===4);
    // a tap outside the sheet used to throw the whole list away without a word
    let asked=0;
    page.once('dialog',d=>{ asked++; d.dismiss(); });
    await page.mouse.click(6,6);
    await page.waitForTimeout(150);
    check('closing a sheet with records still in the list asks first',asked===1);
    check('and saying no keeps the list',await page.locator('#qlist .brow').count()===4);
    await page.evaluate(()=>{ const b=document.querySelector('#addAll'); b.click(); b.click(); });
    await page.waitForSelector('#goBatch');
    const after=await page.evaluate(()=>state.albums.length);
    check('a double tap on "Dodaj wszystkie" adds each record once',after-before===4,'added '+(after-before));
    const pos=await page.evaluate(()=>crateAlbums(state.crates[0].id).map(a=>a.position).join(','));
    check('slots stay consecutive',pos===pos.split(',').map((_,i)=>i+1).join(','),pos);
    let asked2=0; page.once('dialog',d=>{ asked2++; d.accept(); });
    await page.mouse.click(6,6);
    await page.waitForTimeout(150);
    check('an empty list closes without asking',asked2===0&&await page.locator('#modalRoot .sheet').count()===0);
    check('no script errors',errors.length===0,errors.slice(0,3).join(' | '));
    await ctx.close();
  },

  async 'photo import: boxes from dividers, own photos as covers, nothing lost on a stray tap'(){
    const {ctx,page,out,errors}=await open();
    const shot=(fill,art)=>page.evaluate(([fill,art])=>{
      const c=document.createElement('canvas'); c.width=c.height=800;
      const x=c.getContext('2d'); x.fillStyle=fill; x.fillRect(0,0,800,800);
      if(art){ x.fillStyle=art; x.fillRect(120,120,560,560); x.fillStyle='#fff'; x.fillRect(200,220,220,70); x.fillStyle='#000'; x.fillRect(420,430,150,150); }
      return c.toDataURL('image/jpeg',0.9).split(',')[1];
    },[fill,art]);
    const file=async(name,fill,art)=>({name,mimeType:'image/jpeg',buffer:Buffer.from(await shot(fill,art),'base64')});
    const files=[await file('IMG_0001.jpg','#888','#a33'),await file('IMG_0002.jpg','#c8641e',null),await file('IMG_0003.jpg','#888','#36a')];
    const before=await page.evaluate(()=>({c:state.crates.length,a:state.albums.length}));
    await page.click('#impOpen');
    const [fc]=await Promise.all([page.waitForEvent('filechooser'),page.click('#impPick')]);
    await fc.setFiles(files);
    await page.waitForSelector('#impGo');
    check('two records, one divider, two boxes',await page.locator('.imp-tile').count()===2&&await page.locator('.imp-sep').count()===1
      &&await page.locator('.imp-h').count()===2);
    let asked=0; page.once('dialog',d=>{ asked++; d.dismiss(); });
    await page.mouse.click(6,6);
    await page.waitForTimeout(150);
    check('closing the import before it is saved asks first',asked===1&&await page.locator('#impGo').count()===1);
    await page.waitForFunction(()=>!/w toku/.test(document.querySelector('#impGo').textContent),null,{timeout:20000});
    await page.click('#impGo');
    await page.waitForSelector('#impDone');
    const got=await page.evaluate(async before=>{
      const added=state.albums.slice(before.a);
      const covers=await Promise.all(added.map(a=>getCover(a.id)));
      return {crates:state.crates.length-before.c,n:added.length,local:added.every(a=>a.cover==='local'),
        own:covers.every(c=>/^data:image\/jpeg/.test(c||'')),placeholders:added.every(a=>a.pending===true&&!a.title)};
    },before);
    check('each record is stored with its own photograph, as a placeholder holding its slot',
      got.crates===2&&got.n===2&&got.local&&got.own&&got.placeholders,JSON.stringify(got));
    check('no artwork address from a database reached the collection',
      await page.evaluate(()=>!/https?:/.test(JSON.stringify(state.albums))));
    let asked2=0; page.once('dialog',d=>{ asked2++; d.accept(); });
    await page.click('#impDone');
    check('after saving it closes without asking',asked2===0&&await page.locator('.crate-card').count()===4);
    check('the saved import is pushed once',pushes(out).length===1,pushes(out).length+' pushes');
    check('no script errors',errors.length===0,errors.slice(0,3).join(' | '));
    await ctx.close();
  },

  async 'service worker: outages, offline, and the update button'(){
    const {ctx,page,errors}=await open({sw:true});
    await page.waitForFunction(()=>navigator.serviceWorker&&navigator.serviceWorker.controller,null,{timeout:15000});
    const cacheName=(await page.evaluate(()=>caches.keys()))[0]||'';
    const build=await page.evaluate(()=>BUILD);
    check('cache name and BUILD move together',cacheName==='winyle-v'+build,cacheName+' vs BUILD '+build);
    const shell=async()=>page.locator('#nav button').count().then(n=>n===4).catch(()=>false);

    srv.status=503;                                   // Pages is having a bad day
    await page.reload().catch(()=>{});
    check('a 503 from the server still opens the app from cache',await shell());
    srv.status=0; srv.down=true;                      // and now there is no network at all
    await page.reload().catch(()=>{});
    check('offline: the app opens (the 503 page was not cached over it)',await shell());
    await page.goto(base+'?utm_source=homescreen').catch(()=>{});
    check('offline: a launch URL with a query string opens too',await shell());

    await tab(page,'settings');
    await page.click('#updateApp');
    await page.waitForFunction(()=>/✗/.test(document.querySelector('#updateStatus').textContent),null,{timeout:8000}).catch(()=>{});
    await page.waitForTimeout(300);
    check('offline: "Pobierz najnowszą wersję" refuses instead of wiping the cache',
      (await page.evaluate(()=>caches.keys())).length===1);
    await page.reload().catch(()=>{});
    check('offline: the app still opens afterwards',await shell());
    srv.down=false;
    await page.reload();
    check('back online: loads normally',await shell());
    check('no script errors',errors.length===0,errors.slice(0,3).join(' | '));
    await ctx.close();
  }
};

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  base='http://127.0.0.1:'+server.address().port+SUB;
  browser=await chromium.launch();
  const only=process.argv[2];
  for(const [name,fn] of Object.entries(tests)){
    if(only&&!name.includes(only)) continue;
    results.length=0; srv.down=false; srv.status=0;
    try{ await fn(); }catch(e){ check('ran to the end',false,String(e.message).split('\n')[0]); }
    console.log(name); console.log(results.join('\n'));
  }
  await browser.close(); server.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed?1:0);
})();
