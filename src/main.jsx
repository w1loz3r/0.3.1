import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {invoke} from '@tauri-apps/api/core';
import {getCurrentWindow} from '@tauri-apps/api/window';
import './styles.css';

const MANIFEST='https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const MODRINTH='https://api.modrinth.com/v2';
const defaultProfile=()=>JSON.parse(localStorage.getItem('sakura.profile')||'null');
const getBuilds=()=>JSON.parse(localStorage.getItem('sakura.builds')||'[]');
const saveBuilds=(b)=>localStorage.setItem('sakura.builds',JSON.stringify(b));
const defaultSettings={accent:'#f4a0bd',theme:'sakura',particles:true,particleCount:42,particleSpeed:1,particleOpacity:.34,particleSize:1,glow:true,animations:true,javaPath:''};
const getSettings=()=>({...defaultSettings,...JSON.parse(localStorage.getItem('sakura.settings')||'{}')});
const appWindow=getCurrentWindow();

function App(){
 const [tab,setTab]=useState('home');
 const [profile,setProfile]=useState(defaultProfile());
 const [builds,setBuilds]=useState(getBuilds());
 const [selected,setSelected]=useState(null);
 const [versions,setVersions]=useState([]);
 const [loadingVersions,setLoadingVersions]=useState(false);
 const [modal,setModal]=useState(null);
 const [status,setStatus]=useState('');
 const [mods,setMods]=useState([]);
 const [modQuery,setModQuery]=useState('');
 const [modLoader,setModLoader]=useState('fabric');
 const [modVersion,setModVersion]=useState('');
 const [skin,setSkin]=useState(null);
 const [skinColor,setSkinColor]=useState('#f4a0bd');
 const [settings,setSettings]=useState(getSettings);
 const canvasRef=useRef(null);

 useEffect(()=>{ if(!profile) return; localStorage.setItem('sakura.profile',JSON.stringify(profile)); },[profile]);
 useEffect(()=>{saveBuilds(builds)},[builds]);
 useEffect(()=>{localStorage.setItem('sakura.settings',JSON.stringify(settings));},[settings]);
 useEffect(()=>{ if(tab==='versions' && !versions.length) loadVersions(); },[tab]);

 async function loadVersions(){
   setLoadingVersions(true); setStatus('Получаю реальные версии Minecraft…');
   try{const r=await fetch(MANIFEST); const j=await r.json(); setVersions(j.versions||[]); setStatus('');}
   catch(e){setStatus('Не удалось получить список версий Minecraft.');}
   finally{setLoadingVersions(false)}
 }
 async function createBuild(data){
   if(!data.name||!data.version) return;
   setStatus('Создаю сборку…');
   try{
     const created=await invoke('create_instance',{name:data.name,version:data.version,loader:data.loader||'Vanilla'});
     const build={...created,mods:[],createdAt:Date.now(),installed:false};
     setBuilds(x=>[...x,build]); setSelected(build); setModal(null); setTab('home');
   }catch(e){setStatus(String(e))}
 }
 async function install(build){
   setStatus(`Скачиваю Minecraft ${build.version}… Это может занять время.`);
   try{await invoke('install_minecraft',{id:build.id,version:build.version,loader:build.loader||'Vanilla'}); setBuilds(xs=>xs.map(x=>x.id===build.id?{...x,installed:true}:x)); setStatus('Minecraft установлена. Теперь можно запускать.');}
   catch(e){setStatus(String(e))}
 }
 async function launch(build){
   if(!profile?.name){setModal('profile');return}
   try{
     if(!build.installed){setStatus(`Сначала устанавливаю Minecraft ${build.version}…`);await invoke('install_minecraft',{id:build.id,version:build.version,loader:build.loader||'Vanilla'});setBuilds(xs=>xs.map(x=>x.id===build.id?{...x,installed:true}:x));}
     setStatus('Запускаю Minecraft…');
     await invoke('launch_instance',{id:build.id,version:build.version,username:profile.name,loader:build.loader||'Vanilla',javaPath:settings.javaPath||null});
     setStatus('Minecraft запущена.');
   }catch(e){setStatus(String(e))}
 }
 async function searchMods(){
   if(!modQuery.trim()) return;
   setStatus('Ищу моды на Modrinth…');
   try{
     const facets=JSON.stringify([[`project_type:mod`],[`categories:${modLoader}`],...(modVersion?[[`versions:${modVersion}`]]:[]) ]);
     const u=`${MODRINTH}/search?query=${encodeURIComponent(modQuery)}&facets=${encodeURIComponent(facets)}&limit=24`;
     const r=await fetch(u); const j=await r.json(); setMods(j.hits||[]); setStatus('');
   }catch(e){setStatus('Modrinth недоступен.');}
 }
 async function addMod(project){
   if(!selected) return;
   try{
     const u=`${MODRINTH}/project/${project.project_id}/version?loaders=${encodeURIComponent(JSON.stringify([modLoader]))}${modVersion?`&game_versions=${encodeURIComponent(JSON.stringify([modVersion]))}`:''}&featured=true`;
     const r=await fetch(u); const vs=await r.json(); const v=vs[0]; const file=v?.files?.find(x=>x.primary)||v?.files?.[0];
     if(!file) throw new Error('У мода нет подходящего .jar');
     setStatus(`Устанавливаю ${project.title}…`); await invoke('install_mod',{id:selected.id,url:file.url,filename:file.filename});
     setSelected({...selected,mods:[...(selected.mods||[]),file.filename]});
     setBuilds(xs=>xs.map(x=>x.id===selected.id?{...x,mods:[...(x.mods||[]),file.filename]}:x)); setStatus(`${project.title} установлен.`);
   }catch(e){setStatus(String(e))}
 }
 function deleteBuild(id){if(!confirm('Удалить эту сборку из списка? Файлы Minecraft останутся на диске.'))return; setBuilds(x=>x.filter(b=>b.id!==id)); if(selected?.id===id)setSelected(null)}
 function saveSkin(){const c=canvasRef.current;if(!c)return; const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download='sakura-skin.png';a.click();}
 function openSkin(file){const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const c=canvasRef.current;c.width=64;c.height=64;c.getContext('2d').drawImage(img,0,0,64,64);setSkin('loaded')};img.src=r.result};r.readAsDataURL(file)}
 function paint(e){const c=canvasRef.current;if(!c)return;const rect=c.getBoundingClientRect();const x=Math.floor((e.clientX-rect.left)/rect.width*64),y=Math.floor((e.clientY-rect.top)/rect.height*64);const ctx=c.getContext('2d');ctx.fillStyle=skinColor;ctx.fillRect(x,y,1,1);}
 useEffect(()=>{if(tab==='skins'&&canvasRef.current&&!skin){const c=canvasRef.current;c.width=64;c.height=64;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,64,64);ctx.fillStyle='#c9859d';ctx.fillRect(8,0,8,8);ctx.fillRect(40,0,8,8);ctx.fillStyle='#e9b6c7';ctx.fillRect(8,8,8,8);ctx.fillRect(40,8,8,8);ctx.fillStyle='#8b536a';ctx.fillRect(20,20,8,12);ctx.fillRect(36,20,8,12);}},[tab,skin]);
 if(!profile) return <Onboarding onDone={setProfile}/>;
 const nav=[['home','⌂','Главная'],['versions','◈','Версии'],['mods','✦','Моды'],['skins','◇','Скины']];
 const petals=Array.from({length:settings.particles?settings.particleCount:0},(_,i)=>({x:(i*47+13)%100,y:(i*73+7)%100,d:(9+(i%9))/settings.particleSpeed,delay:-i*.61,s:((i%4)+1)*settings.particleSize,r:(i*67)%360}));
 const appStyle={'--accent':settings.accent,'--particle-opacity':settings.particleOpacity,'--particle-size':settings.particleSize};
 return <div className={`app theme-${settings.theme} ${settings.glow?'glow-on':''} ${settings.animations?'animations-on':''}`} style={appStyle}>
   <div className="titlebar" data-tauri-drag-region><div className="titlebarBrand" data-tauri-drag-region>SAKURA</div><div className="windowControls"><button title="Свернуть" onClick={()=>appWindow.minimize()}>−</button><button title="Развернуть" onClick={()=>appWindow.toggleMaximize()}>□</button><button className="closeWin" title="Закрыть" onClick={()=>appWindow.close()}>×</button></div></div>
   <div className="ambient a1"/><div className="ambient a2"/><div className="petals">{petals.map((p,i)=><i key={i} style={{'--x':`${p.x}%`,'--y':`${p.y}%`,'--d':`${p.d}s`,'--delay':`${p.delay}s`,'--s':`${p.s}px`,'--r':`${p.r}deg`}}/>)}</div>
   <aside><div className="brand"><img src="/src/assets/icon.png"/><div><b>SAKURA</b><span>CRAFT LAUNCHER</span></div></div>
    <nav>{nav.map(x=><button key={x[0]} className={tab===x[0]?'active':''} onClick={()=>setTab(x[0])}><em>{x[1]}</em>{x[2]}</button>)}</nav>
    <div className="sidebottom"><button onClick={()=>setModal('settings')}>⚙ Настройки</button><small>v0.3.1 • minecraft core</small></div>
   </aside>
   <main><header><div className="crumb">{nav.find(x=>x[0]===tab)?.[2]||'Моя сборка'}</div><div className="account" onClick={()=>setModal('profile')}><span className="dot online"/> {profile.name} <b>⌄</b></div></header>
    {tab==='home'&&<Home builds={builds} selected={selected} setSelected={setSelected} install={install} launch={launch} openBuild={setSelected} setModal={setModal} deleteBuild={deleteBuild}/>} 
    {tab==='versions'&&<Versions versions={versions} loading={loadingVersions} onCreate={v=>setModal({type:'create',version:v.id})} />}
    {tab==='mods'&&<Mods query={modQuery} setQuery={setModQuery} loader={modLoader} setLoader={setModLoader} version={modVersion} setVersion={setModVersion} search={searchMods} mods={mods} add={addMod} selected={selected}/>} 
    {tab==='skins'&&<SkinEditor canvasRef={canvasRef} paint={paint} color={skinColor} setColor={setSkinColor} save={saveSkin} open={openSkin}/>} 
   </main>
   {selected&&<BuildPanel build={selected} close={()=>setSelected(null)} launch={launch} install={install} deleteBuild={deleteBuild} />}
   {modal==='settings'&&<SettingsModal settings={settings} setSettings={setSettings} close={()=>setModal(null)} reset={()=>setSettings(defaultSettings)}/>}
   {modal==='profile'&&<ProfileModal profile={profile} close={()=>setModal(null)} save={p=>{setProfile(p);setModal(null)}}/>}
   {modal?.type==='create'&&<CreateModal initialVersion={modal.version} versions={versions} close={()=>setModal(null)} create={createBuild}/>} 
   {status&&<div className="toast" onClick={()=>setStatus('')}>{status}</div>}
 </div>
}

function Onboarding({onDone}){const [name,setName]=useState('');return <div className="onboarding"><div className="onboardCard"><img src="/src/assets/icon.png"/><span>SAKURA LAUNCHER</span><h1>Добро пожаловать</h1><p>Придумай локальный ник. Он сохранится на этом компьютере.</p><input autoFocus value={name} onChange={e=>setName(e.target.value.replace(/[^A-Za-z0-9_]/g,'').slice(0,16))} placeholder="Твой ник"/><button disabled={name.length<3} onClick={()=>onDone({name})}>Продолжить</button><small>Автономный профиль не заменяет Microsoft-авторизацию для официальных онлайн-серверов.</small></div></div>}
function Home({builds,selected,setSelected,install,launch,setModal,deleteBuild}){return <><section className="hero"><div className="heroCopy"><span className="eyebrow">MINECRAFT JAVA EDITION</span><h1>Твой Minecraft.<br/><strong>Твой мир.</strong></h1><p>Реальные версии, сборки и моды — в одном месте.</p><div className="heroActions">{selected?<button className="play" onClick={()=>launch(selected)}>▶ ИГРАТЬ</button>:<button className="play" onClick={()=>setModal({type:'create'})}>＋ СОЗДАТЬ СБОРКУ</button>}</div></div><div className="world"><div className="moon"/><div className="mountain m1"/><div className="mountain m2"/><div className="tree"><div className="trunk"/><div className="crown"/></div><div className="ground"/></div></section><section className="buildHead"><div><h2>Мои сборки</h2><p>{builds.length?'Только созданные тобой экземпляры':'Здесь появятся твои сборки'}</p></div><button className="new" onClick={()=>setModal({type:'create'})}>＋ Новая сборка</button></section><div className="builds">{builds.map(b=><article className={'build '+(selected?.id===b.id?'selected':'')} onClick={()=>setSelected(b)} key={b.id}><div className="cover"><span>{b.loader==='Fabric'?'F':b.loader==='Forge'?'F':'◇'}</span></div><div className="binfo"><h3>{b.name}</h3><p>{b.version} · {b.loader}</p><div className="meta"><span>{(b.mods||[]).length} модов</span><span>{b.installed?'установлена':'не установлена'}</span></div></div><button className="more" onClick={e=>{e.stopPropagation();deleteBuild(b.id)}}>×</button></article>)}</div></>}
function Versions({versions,loading,onCreate}){const [filter,setFilter]=useState('release');const list=versions.filter(v=>filter==='all'||v.type===filter);return <section className="page"><div className="pageTop"><div><h1>Версии Minecraft</h1><p>Официальный список Mojang.</p></div><button className="reload" onClick={()=>location.reload()}>↻</button></div><div className="filters">{['release','snapshot','old_beta','old_alpha','all'].map(f=><button className={filter===f?'active':''} onClick={()=>setFilter(f)} key={f}>{f==='release'?'Релизы':f==='snapshot'?'Снапшоты':f==='old_beta'?'Beta':f==='old_alpha'?'Alpha':'Все'}</button>)}</div>{loading?<div className="loading">Загружаю версии…</div>:<div className="versionGrid">{list.slice(0,120).map(v=><article className="versionCard" key={v.id}><div><b>{v.id}</b><span>{v.type}</span></div><button onClick={()=>onCreate(v)}>＋ Сборка</button></article>)}</div>}</section>}
function Mods({query,setQuery,loader,setLoader,version,setVersion,search,mods,add,selected}){return <section className="page"><div className="pageTop"><div><h1>Моды</h1><p>Поиск и установка .jar напрямую из Modrinth.</p></div></div><div className="modSearch"><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Например: Sodium, Iris, AppleSkin…"/><select value={loader} onChange={e=>setLoader(e.target.value)}><option value="fabric">Fabric</option><option value="forge">Forge</option><option value="neoforge">NeoForge</option><option value="quilt">Quilt</option></select><input value={version} onChange={e=>setVersion(e.target.value)} placeholder="Версия, напр. 1.21.8"/><button onClick={search}>Искать</button></div>{!selected&&<div className="hint">Выбери сборку на Главной, чтобы устанавливать моды в неё.</div>}<div className="modGrid">{mods.map(m=><article className="modCard" key={m.project_id}>{m.icon_url&&<img src={m.icon_url}/>}<div><h3>{m.title}</h3><p>{m.description}</p><small>↓ {m.downloads.toLocaleString()}</small></div><button disabled={!selected} onClick={()=>add(m)}>Установить</button></article>)}</div></section>}
function SkinEditor({canvasRef,paint,color,setColor,save,open}){const colors=['#f4a0bd','#ffffff','#16161d','#8d5a6c','#e8b49f','#5b7cfa','#67c58a','#f0d36b','#a66cff','#4b3038'];return <section className="skinPage"><div className="skinHead"><div><h1>Skin Studio</h1><p>Редактируй классический 64×64 Minecraft skin и экспортируй PNG.</p></div><label className="upload">Загрузить PNG<input type="file" accept="image/png" onChange={e=>e.target.files[0]&&open(e.target.files[0])}/></label><button onClick={save}>Скачать skin</button></div><div className="skinWorkspace"><div className="skinCanvasWrap"><canvas ref={canvasRef} onPointerDown={paint} width="64" height="64"/></div><div className="skinTools"><h3>Палитра</h3><div className="palette">{colors.map(c=><button key={c} style={{background:c}} className={color===c?'sel':''} onClick={()=>setColor(c)}/>)}</div><input type="color" value={color} onChange={e=>setColor(e.target.value)}/><p>Кликай по пикселям. PNG остаётся стандартного размера 64×64.</p></div></div></section>}
function BuildPanel({build,close,launch,install,deleteBuild}){const [files,setFiles]=useState({mods:[]});useEffect(()=>{invoke('list_instance_files',{id:build.id}).then(setFiles).catch(()=>{})},[build.id]);return <div className="drawer"><button className="close" onClick={close}>×</button><span className="eyebrow">СБОРКА</span><h1>{build.name}</h1><p className="drawerSub">{build.version} · {build.loader}</p><div className="drawerActions"><button className="play small" onClick={()=>launch(build)}>▶ Играть</button><button onClick={()=>install(build)}>{build.installed?'Переустановить':'Скачать Minecraft'}</button><button onClick={()=>invoke('open_instance',{id:build.id})}>Открыть папку</button></div><div className="drawerStats"><span><b>{files.mods?.length||0}</b> модов</span><span><b>{build.installed?'Готово':'Нет'}</b> состояние</span></div><h3>Моды</h3><div className="fileList">{(files.mods||[]).length?files.mods.map(m=><div key={m.name}><span>◆ {m.name}</span><small>{Math.round(m.size/1024)} KB</small></div>):<p>Папка mods пока пуста.</p>}</div><h3>Папка сборки</h3><code>{files.path||build.dir}</code><button className="danger" onClick={()=>deleteBuild(build.id)}>Удалить из лаунчера</button></div>}
function CreateModal({initialVersion,versions,close,create}){const [name,setName]=useState('Моя сборка');const [version,setVersion]=useState(initialVersion||versions.find(v=>v.type==='release')?.id||'');const [loader,setLoader]=useState('Vanilla');return <div className="modalShade"><div className="modal"><button className="close" onClick={close}>×</button><span className="eyebrow">НОВАЯ СБОРКА</span><h2>Создать Minecraft instance</h2><input value={name} onChange={e=>setName(e.target.value)} placeholder="Название"/><select value={version} onChange={e=>setVersion(e.target.value)}>{versions.filter(v=>v.type==='release').slice(0,80).map(v=><option key={v.id}>{v.id}</option>)}</select><select value={loader} onChange={e=>setLoader(e.target.value)}><option>Vanilla</option><option>Fabric</option></select><button className="play full" onClick={()=>create({name,version,loader})}>Создать сборку</button></div></div>}

function SettingsModal({settings,setSettings,close,reset}){
 const set=(key,value)=>setSettings(s=>({...s,[key]:value}));
 return <div className="modalShade"><div className="settingsModal">
  <button className="close" onClick={close}>×</button><div className="settingsTitle"><div><span className="eyebrow">КАСТОМИЗАЦИЯ</span><h2>Настройки Sakura</h2><p>Меняй внешний вид, частицы и эффекты — всё сохраняется автоматически.</p></div></div>
  <div className="settingsGrid">
   <section className="settingSection"><h3>Оформление</h3><label>Тема</label><div className="themeChoices">{[['sakura','Sakura'],['midnight','Midnight'],['rose','Rose']].map(([id,label])=><button key={id} className={settings.theme===id?'chosen':''} onClick={()=>set('theme',id)}>{label}</button>)}</div><label>Акцент</label><div className="accentRow"><input type="color" value={settings.accent} onChange={e=>set('accent',e.target.value)}/><input className="accentText" value={settings.accent} onChange={e=>set('accent',e.target.value)} /></div><Toggle label="Свечение интерфейса" value={settings.glow} onChange={v=>set('glow',v)}/><Toggle label="Плавные анимации" value={settings.animations} onChange={v=>set('animations',v)}/><label>Java для запуска</label><div className="javaRow"><input className="accentText" value={settings.javaPath} onChange={e=>set('javaPath',e.target.value)} placeholder="Автоопределение: javaw.exe"/><button onClick={async()=>{const p=await invoke('find_java');if(p)set('javaPath',p)}}>Найти</button></div></section>
   <section className="settingSection particleEditor"><div className="sectionTitle"><div><h3>Редактор частиц</h3><p>Настрой поток лепестков в реальном времени.</p></div><span className="particlePreview">{settings.particles?'✦':'—'}</span></div><Toggle label="Включить частицы" value={settings.particles} onChange={v=>set('particles',v)}/><Range label="Количество" value={settings.particleCount} min={8} max={100} step={1} onChange={v=>set('particleCount',v)}/><Range label="Скорость" value={settings.particleSpeed} min={0.3} max={2.5} step={0.1} suffix="×" onChange={v=>set('particleSpeed',v)}/><Range label="Прозрачность" value={settings.particleOpacity} min={0.08} max={0.75} step={0.01} onChange={v=>set('particleOpacity',v)}/><Range label="Размер" value={settings.particleSize} min={0.5} max={2.5} step={0.1} suffix="×" onChange={v=>set('particleSize',v)}/></section>
  </div>
  <div className="settingsBottom"><span>Настройки сохраняются на этом компьютере.</span><div><button className="resetBtn" onClick={reset}>Сбросить</button><button className="play small" onClick={close}>Готово</button></div></div>
 </div></div>
}
function Toggle({label,value,onChange}){return <button className={'toggle '+(value?'on':'')} onClick={()=>onChange(!value)}><span>{label}</span><i/></button>}
function Range({label,value,min,max,step,onChange,suffix=''}){return <label className="range"><span><b>{label}</b><em>{value}{suffix}</em></span><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>}

function ProfileModal({profile,close,save}){const [name,setName]=useState(profile.name);return <div className="modalShade"><div className="modal"><button className="close" onClick={close}>×</button><span className="eyebrow">ПРОФИЛЬ</span><h2>Автономный профиль</h2><input value={name} onChange={e=>setName(e.target.value.replace(/[^A-Za-z0-9_]/g,'').slice(0,16))}/><button className="play full" disabled={name.length<3} onClick={()=>save({name})}>Сохранить</button></div></div>}
createRoot(document.getElementById('root')).render(<App/>);
