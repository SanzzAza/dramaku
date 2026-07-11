const API={melolo:'https://api.sonzaix.indevs.in/melolo',freereels:'https://api.sonzaix.indevs.in/freereels',flickreels:'https://api.sonzaix.indevs.in/flickreels',dramanova:'https://api.sonzaix.indevs.in/dramanova',reelshort:'https://api.sonzaix.indevs.in/reelshort',netshort:'https://api.sonzaix.indevs.in/netshort',dramabox:'https://api.sonzaix.indevs.in/dramabox',goodshort:'https://api.sonzaix.indevs.in/goodshort',moviebox:'https://api.sonzaix.indevs.in/moviebox',drakor:'https://api.sonzaix.indevs.in/drama'};
const PLAT_LABELS={melolo:'Melolo',freereels:'FreeReels',flickreels:'FlickReels',dramanova:'DramaNova',reelshort:'ReelShort',netshort:'NetShort',dramabox:'DramaBox',goodshort:'GoodShort',moviebox:'MovieBox',drakor:'Drakor'};
const REMOTE_CONFIG_URL='https://raw.githubusercontent.com/SanzzAza/dramaku/main/remote-config.json';
let remoteConfig=null,remoteConfigMeta={source:'default',updated:0,url:REMOTE_CONFIG_URL};
let P='melolo',curTab='home',pg={},busy={},more={},loaded={};
let curDrama=null,curEps=[],curPE=0,sto=null;
let fitMode=(()=>{try{return localStorage.getItem('dk_fit_mode')||'cover'}catch(e){return 'cover'}})();
let lastSearchResults=[],lastSearchQuery='',searchFilter='all',searchSeq=0;
const APP_VERSION='3.9';
const thumbCache={},platCache={},itemCache={};
let allItems=[];
const jsonMemCache={};

// Splash
setTimeout(()=>{$('#splash').classList.add('hide');setTimeout(()=>$('#splash').remove(),500)},1800);

function resetState(){pg={home:1,populer:1,new:1,t4:1,t5:1,t6:1,t7:1};busy={};more={home:1,populer:1,new:1,t4:1,t5:1,t6:1,t7:1};loaded={};['home','populer','new','history','fav','settings','profile','t4','t5','t6','t7'].forEach(k=>{const el=$('#v-'+k);if(el)el.innerHTML=''})}
function $(s,p){return(p||document).querySelector(s)}
function $$(s,p){return(p||document).querySelectorAll(s)}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function cleanText(v){const d=document.createElement('div');d.innerHTML=String(v||'').replace(/&nbsp;/g,' ');return (d.textContent||d.innerText||'').replace(/\s+/g,' ').trim()}
function jsStr(v){return esc(String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/[\r\n]+/g,' '))}
function platformLabel(p){return PLAT_LABELS[p]||p||'Dramaku'}
function ratingFor(seed){let h=0,s=String(seed||'dramaku');for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return(8.4+(h%16)/10).toFixed(1)}
function searchEmptyHtml(){return '<div class="empty-state" style="padding-top:100px"><svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity=".22"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><p>Ketik judul drama untuk mencari</p><p class="empty-sub">Cari dari 10 platform sekaligus</p></div>'}
function toast(msg){let t=$('#dkToast');if(!t){t=document.createElement('div');t.id='dkToast';t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('on');clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove('on'),1800)}
function nativeCall(name,...args){try{if(window.NativeApp&&typeof NativeApp[name]==='function')NativeApp[name](...args)}catch(e){}}
function setNativePlayback(on){nativeCall('setFullscreen',!!on);nativeCall('keepAwake',!!on)}
function pruneApiCache(){try{Object.keys(localStorage).filter(k=>k.startsWith('dk_api_')).slice(0,20).forEach(k=>localStorage.removeItem(k))}catch(e){}}
function cacheKey(url){try{return 'dk_api_'+btoa(unescape(encodeURIComponent(url))).slice(0,120)}catch(e){return 'dk_api_'+String(url).replace(/\W/g,'').slice(0,120)}}
async function cachedJson(url,ttl=180000){
  const now=Date.now(),mem=jsonMemCache[url];if(mem&&now-mem.t<ttl)return mem.v;
  const k=cacheKey(url);let stale=null;
  try{const raw=localStorage.getItem(k);if(raw){const c=JSON.parse(raw);stale=c;if(now-c.t<ttl){jsonMemCache[url]=c;return c.v}}}catch(e){}
  try{const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw new Error('HTTP '+r.status);const v=await r.json();jsonMemCache[url]={t:now,v};try{localStorage.setItem(k,JSON.stringify({t:now,v}))}catch(e){pruneApiCache()}return v}
  catch(e){ErrorLog.capture('api',url,String(e?.message||e));if(stale?.v){toast('Memakai cache offline');return stale.v}throw e}
}
function rememberItems(items){(items||[]).forEach(d=>{if(!d||!d.drama_id)return;itemCache[d.drama_id]=d;if(!allItems.some(x=>x.drama_id===d.drama_id&&(x._p||platCache[x.drama_id])===(d._p||platCache[d.drama_id])))allItems.push(d)});if(allItems.length>700)allItems=allItems.slice(-700)}
function handleNativeBack(){if($('#epBd')?.classList.contains('on')){closeEpModal();return true}if($('#plOv')?.classList.contains('on')){closePl();return true}if($('#detOv')?.classList.contains('on')){closeDet();return true}if($('#sOv')?.classList.contains('on')){closeSearch();return true}if(curTab!=='home'){go('home');return true}return false}
window.handleNativeBack=handleNativeBack;
function getRemoteConfigUrl(){try{return localStorage.getItem('dk_remote_config_url')||REMOTE_CONFIG_URL}catch(e){return REMOTE_CONFIG_URL}}
function versionLess(a,b){const pa=String(a||'0').split('.').map(n=>parseInt(n)||0),pb=String(b||'0').split('.').map(n=>parseInt(n)||0);for(let i=0;i<Math.max(pa.length,pb.length);i++){const x=pa[i]||0,y=pb[i]||0;if(x<y)return true;if(x>y)return false}return false}
function platformState(p){return remoteConfig?.platforms?.[p]||{}}
function platformEnabled(p){return platformState(p).enabled!==false}
function platformReason(p){return platformState(p).reason||'Platform sedang maintenance'}
function featureEnabled(name){return remoteConfig?.features?.[name]!==false}
function applyRemoteConfig(cfg,source='remote'){
  if(!cfg||typeof cfg!=='object')return;
  remoteConfig=cfg;remoteConfigMeta={source,updated:Date.now(),url:getRemoteConfigUrl()};
  if(cfg.api&&typeof cfg.api==='object'){Object.keys(cfg.api).forEach(k=>{if(API[k]&&cfg.api[k])API[k]=cfg.api[k]})}
  updatePlatformAvailability();
  if(cfg.minAppVersion&&versionLess(APP_VERSION,cfg.minAppVersion)){setTimeout(()=>askConfirm('Update Dramaku tersedia',`Versi minimal yang disarankan ${cfg.minAppVersion}. Versi kamu ${APP_VERSION}. Update APK supaya fitur tetap stabil.`,'Mengerti'),800)}
  setTimeout(()=>showUpdatePrompt(false),1100)
}
async function loadRemoteConfig(force=false){
  const url=getRemoteConfigUrl(),cacheKey='dk_remote_config_cache';
  if(!force){try{const c=JSON.parse(localStorage.getItem(cacheKey)||'null');if(c?.cfg&&Date.now()-(c.t||0)<10*60*1000){applyRemoteConfig(c.cfg,'cache');return c.cfg}}catch(e){}}
  try{const r=await fetch(url+(url.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const cfg=await r.json();localStorage.setItem(cacheKey,JSON.stringify({t:Date.now(),cfg}));applyRemoteConfig(cfg,'remote');return cfg}
  catch(e){ErrorLog.capture('remote_config','Gagal load remote config',{url,error:String(e?.message||e)});try{const c=JSON.parse(localStorage.getItem(cacheKey)||'null');if(c?.cfg){applyRemoteConfig(c.cfg,'stale-cache');toast('Remote config memakai cache');return c.cfg}}catch(_){}return null}
}
async function reloadRemoteConfig(){await loadRemoteConfig(true);renderSettings();toast(remoteConfig?'Remote config diperbarui':'Remote config gagal dimuat')}
function updatePlatformAvailability(){if(!remoteConfig)return;$$('.plat-opt').forEach(e=>{const p=e.dataset.p,off=!platformEnabled(p);e.classList.toggle('disabled',off);if(off)e.title=platformReason(p);else e.removeAttribute('title')})}
function firstEnabledPlatform(){return Object.keys(API).find(platformEnabled)||'melolo'}
function remoteMessageHtml(){const m=remoteConfig?.message;if(!m||m.enabled===false)return'';return`<div class="remote-banner ${m.type==='warning'?'warn':''}"><div class="remote-ico">${m.type==='warning'?'⚠️':'✨'}</div><div class="remote-copy"><b>${esc(m.title||'Info Dramaku')}</b><span>${esc(m.text||'')}</span></div></div>`}
function remoteConfigSettingsHtml(icon){const cfg=remoteConfig,src=remoteConfigMeta.source||'default',url=getRemoteConfigUrl();const status=cfg?'Aktif':'Default';const ver=cfg?.version?`v${cfg.version}`:'-';return`<section class="settings-sec"><h3 class="settings-sec-title">${icon} Remote Config</h3><div class="settings-card">${settingRow(icon,'Refresh remote config','Ambil endpoint, status platform, dan pengumuman terbaru',status,'reloadRemoteConfig()')}${settingRow(icon,'Sumber config',url,ver,'toast(\'Remote config URL tersimpan di app\')')}<div class="remote-config-note">Status: ${esc(src)} · ${cfg?.updatedAt?`Update: ${esc(cfg.updatedAt)}`:'Pakai endpoint bawaan jika config belum tersedia.'}</div></div></section>`}
function openExternalUrl(url){if(!url)return;try{if(window.NativeApp?.openUrl){NativeApp.openUrl(url);return}}catch(e){};try{window.open(url,'_blank')}catch(e){location.href=url}}
function latestUpdateInfo(){const u=remoteConfig?.update||{};return{latest:u.latestVersion||remoteConfig?.latestVersion||'',url:u.downloadUrl||remoteConfig?.downloadUrl||'https://github.com/SanzzAza/dramaku/releases/latest',changelog:u.changelog||remoteConfig?.changelog||[],force:!!u.force}}
function showUpdatePrompt(force=false){const u=latestUpdateInfo();if(!u.latest||!versionLess(APP_VERSION,u.latest))return false;if(!force&&localStorage.getItem('dk_skip_update')===u.latest&&!u.force)return false;const changes=Array.isArray(u.changelog)&&u.changelog.length?'\n\nYang baru:\n- '+u.changelog.slice(0,6).join('\n- '):'';askConfirm('Update Dramaku tersedia',`Versi ${u.latest} siap diunduh. Versi kamu ${APP_VERSION}.${changes}`,'Download',false).then(ok=>{if(ok)openExternalUrl(u.url);else localStorage.setItem('dk_skip_update',u.latest)});return true}
function showInfo(title,msg){return new Promise(resolve=>{const old=$('#dkConfirm');if(old)old.remove();const ov=document.createElement('div');ov.className='dk-confirm';ov.id='dkConfirm';ov.innerHTML=`<div class="dk-confirm-card" role="dialog" aria-modal="true"><div class="dk-confirm-body"><div class="dk-confirm-title">${esc(title)}</div><div class="dk-confirm-msg" style="white-space:pre-line">${esc(msg)}</div></div><div class="dk-confirm-actions"><button class="dk-confirm-ok" style="flex:1" type="button">Mengerti</button></div></div>`;document.body.appendChild(ov);const done=()=>{ov.remove();resolve(true)};ov.querySelector('.dk-confirm-ok').onclick=done;ov.addEventListener('click',e=>{if(e.target===ov)done()})})}
function showAbout(){showInfo('Tentang Dramaku',`Dramaku adalah aplikasi agregator mini drama dan film dari beberapa platform.\n\nDramaku tidak menyimpan video di server sendiri. Semua konten dan hak cipta adalah milik platform/pemilik masing-masing.\n\nFitur laporan episode dipakai untuk membantu mendeteksi link rusak, subtitle bermasalah, atau platform maintenance.\n\nVersi aplikasi: ${APP_VERSION}`)}
function platformStatusHtml(){const keys=Object.keys(API);if(!keys.length)return'';const cards=keys.map(p=>{const st=platformState(p),enabled=platformEnabled(p),status=st.status||(enabled?'active':'maintenance'),reason=st.reason||(enabled?'Siap dipakai':'Sedang maintenance'),cls=enabled?(status==='slow'?'slow':'ok'):'off',ico=enabled?(status==='slow'?'🟡':'🟢'):'🔴';return`<div class="plat-status-card ${cls}" onclick="${enabled?`setPlatform('${p}')`:`toast('${platformLabel(p)}: ${jsStr(reason)}')`}"><b>${ico} ${esc(platformLabel(p))}</b><span>${esc(reason)}</span></div>`}).join('');return`<section class="platform-status"><div class="sec-hd" style="padding:0 16px;margin-bottom:10px"><h2 class="sec-tt">Status Platform</h2><div class="sec-more" onclick="reloadRemoteConfig()">Refresh</div></div><div class="plat-status-scroll">${cards}</div></section>`}
function reportTargetUrl(text){const s=remoteConfig?.support||{};if(s.whatsapp)return`https://wa.me/${String(s.whatsapp).replace(/\D/g,'')}?text=${encodeURIComponent(text)}`;if(s.telegram)return`https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(text+'\n')}`;if(s.email)return`mailto:${encodeURIComponent(s.email)}?subject=${encodeURIComponent('Laporan Episode Dramaku')}&body=${encodeURIComponent(text)}`;return''}


const ErrorLog={
  list(){try{return JSON.parse(localStorage.getItem('dk_errors')||'[]')}catch(e){return[]}},
  capture(type,message,detail){try{let logs=this.list();logs.unshift({type,message:String(message||''),detail:detail||'',time:Date.now(),ua:navigator.userAgent});localStorage.setItem('dk_errors',JSON.stringify(logs.slice(0,80)))}catch(e){}},
  clear(){try{localStorage.removeItem('dk_errors')}catch(e){}},
  text(){return this.list().map(x=>`[${new Date(x.time).toLocaleString()}] ${x.type}: ${x.message}\n${typeof x.detail==='string'?x.detail:JSON.stringify(x.detail,null,2)}`).join('\n\n')}
};
window.addEventListener('error',e=>ErrorLog.capture('js',e.message,{file:e.filename,line:e.lineno,col:e.colno}));
window.addEventListener('unhandledrejection',e=>ErrorLog.capture('promise',e.reason?.message||e.reason||'Unhandled rejection',String(e.reason?.stack||e.reason||'')));
const Settings={
  defaults:{haptic:true,dataSaver:false,autoNext:true,nativeShare:true},
  get(){try{return {...this.defaults,...JSON.parse(localStorage.getItem('dk_settings')||'{}')}}catch(e){return {...this.defaults}}},
  set(k,v){const s=this.get();s[k]=v;try{localStorage.setItem('dk_settings',JSON.stringify(s))}catch(e){};renderSettings()}
};
function haptic(type='light'){try{if(Settings.get().haptic&&window.NativeApp?.haptic)NativeApp.haptic(type)}catch(e){}}
function appVersion(){try{return window.NativeApp?.getVersion?.()||APP_VERSION}catch(e){return APP_VERSION}}
function clearApiCache(){try{Object.keys(localStorage).filter(k=>k.startsWith('dk_api_')).forEach(k=>localStorage.removeItem(k));Object.keys(jsonMemCache).forEach(k=>delete jsonMemCache[k]);toast('Cache API dibersihkan')}catch(e){toast('Gagal membersihkan cache')}}
function clearWebViewCache(){clearApiCache();nativeCall('clearWebViewCache');toast('Cache WebView dibersihkan')}
function askConfirm(title,msg,okText='Oke',danger=false){return new Promise(resolve=>{const old=$('#dkConfirm');if(old)old.remove();const ov=document.createElement('div');ov.className='dk-confirm';ov.id='dkConfirm';ov.innerHTML=`<div class="dk-confirm-card" role="dialog" aria-modal="true"><div class="dk-confirm-body"><div class="dk-confirm-title">${esc(title)}</div><div class="dk-confirm-msg">${esc(msg)}</div></div><div class="dk-confirm-actions"><button class="dk-confirm-cancel" type="button">Batal</button><button class="dk-confirm-ok ${danger?'danger':''}" type="button">${esc(okText)}</button></div></div>`;document.body.appendChild(ov);const done=v=>{ov.remove();resolve(v)};ov.querySelector('.dk-confirm-cancel').onclick=()=>done(false);ov.querySelector('.dk-confirm-ok').onclick=()=>done(true);ov.addEventListener('click',e=>{if(e.target===ov)done(false)});})}
function clearAllHistory(){askConfirm('Hapus riwayat tontonan?','Semua riwayat dan progress yang tersimpan akan dihapus dari perangkat ini.','Hapus',true).then(ok=>{if(ok){localStorage.removeItem('dk_history');renderSettings();renderHistory();toast('Riwayat dihapus')}})}
function clearAllFavs(){askConfirm('Hapus semua favorit?','Daftar drama favorit akan dikosongkan dari perangkat ini.','Hapus',true).then(ok=>{if(ok){localStorage.removeItem('dk_favs');renderSettings();renderFav();toast('Favorit dihapus')}})}
function copyErrorLogs(){const txt=ErrorLog.text()||'Tidak ada log error';navigator.clipboard?.writeText(txt);toast('Log error disalin')}
function clearErrorLogs(){ErrorLog.clear();renderSettings();toast('Log error dihapus')}
function setFitMode(mode){fitMode=mode;try{localStorage.setItem('dk_fit_mode',fitMode)}catch(e){}applyFitMode();renderSettings()}
function nativeShare(title,text,url){try{if(Settings.get().nativeShare&&window.NativeApp?.share){NativeApp.share(title||'Dramaku',text||'',url||location.href);return true}}catch(e){}return false}
function settingIcon(path){return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="${path}"/></svg>`}
function settingRow(icon,title,sub,value,onclick,danger=false){return `<button class="setting-row" onclick="${onclick}"><span class="setting-ico">${icon}</span><span class="setting-copy"><b>${esc(title)}</b><span>${esc(sub)}</span></span>${value?`<span class="setting-value ${danger?'danger-value':''}">${esc(value)}</span>`:''}</button>`}
function settingSwitch(icon,title,sub,on,onclick){return `<button class="setting-row" onclick="${onclick}"><span class="setting-ico">${icon}</span><span class="setting-copy"><b>${esc(title)}</b><span>${esc(sub)}</span></span><span class="setting-switch ${on?'on':''}"></span></button>`}
function renderSettings(){const box=$('#v-settings');if(!box)return;const s=Settings.get(),errs=ErrorLog.list(),h=getHistory(),f=getFavs(),apiCount=Object.keys(localStorage).filter(k=>k.startsWith('dk_api_')).length;const iGear=settingIcon('M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65-2-3.46-2.49 1a7.28 7.28 0 00-1.69-.98L14.5 2h-5l-.38 2.93c-.6.23-1.16.55-1.69.98l-2.49-1-2 3.46 2.11 1.65c-.04.32-.08.65-.08.98s.03.66.08.98l-2.11 1.65 2 3.46 2.49-1c.53.4 1.09.73 1.69.98L9.5 22h5l.38-2.93c.6-.25 1.16-.58 1.69-.98l2.49 1 2-3.46-2.11-1.65zM12 15.5A3.5 3.5 0 1112 8a3.5 3.5 0 010 7.5z');const iPlay=settingIcon('M8 5v14l11-7z');const iTrash=settingIcon('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 4l1-1h6l1 1h4v2H4V4h4z');const iBug=settingIcon('M20 8h-2.81a5.985 5.985 0 00-1.82-1.96L16 4.5 14.5 3l-1.17 2.33A6.58 6.58 0 0012 5c-.46 0-.91.05-1.33.14L9.5 3 8 4.5l.63 1.54A5.985 5.985 0 006.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81A6.011 6.011 0 0012 21a6.011 6.011 0 005.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8z');const logs=errs.length?errs.slice(0,8).map(x=>`<div class="error-log"><b>${esc(x.type)} · ${esc(x.message)}</b><div class="error-time">${new Date(x.time).toLocaleString()}</div><code>${esc(typeof x.detail==='string'?x.detail:JSON.stringify(x.detail,null,2))}</code></div>`).join(''):'<div class="empty-state" style="padding:22px"><p>Tidak ada error tersimpan</p><p class="empty-sub">Kalau ada crash/API error, log akan muncul di sini.</p></div>';box.innerHTML=`<div class="settings-page"><div class="settings-hero"><div class="settings-kicker">Dramaku Control Center</div><div class="settings-title">Setelan & Diagnostik</div><div class="settings-sub">Atur pengalaman nonton, bersihkan cache, dan cek log error untuk build APK yang lebih matang.</div><div class="app-version">Versi aplikasi: ${esc(appVersion())}</div></div><div class="settings-grid"><section class="settings-sec"><h3 class="settings-sec-title">${iGear} Preferensi</h3><div class="settings-card">${settingRow(iPlay,'Mode Video','Full memenuhi layar, Asli menampilkan rasio original',fitMode==='contain'?'Asli':'Full',`setFitMode('${fitMode==='contain'?'cover':'contain'}');toast('Mode video diubah')`)}${settingSwitch(iGear,'Haptic feedback','Getar halus saat tap tombol di APK',s.haptic,`Settings.set('haptic',${!s.haptic})`)}${settingSwitch(iPlay,'Auto next episode','Episode berikutnya otomatis saat video selesai',s.autoNext,`Settings.set('autoNext',${!s.autoNext})`)}${settingSwitch(iGear,'Mode hemat data','Prioritaskan kualitas lebih ringan saat memungkinkan',s.dataSaver,`Settings.set('dataSaver',${!s.dataSaver})`)}${settingSwitch(iGear,'Native share','Pakai Android share sheet jika tersedia',s.nativeShare,`Settings.set('nativeShare',${!s.nativeShare})`)}${settingRow(iGear,'Tampilkan onboarding','Buka ulang panduan awal pengguna','Buka',`localStorage.removeItem('dk_onboard_done');showOnboarding(true)`)}${settingRow(iGear,'Cek update','Periksa versi APK terbaru dari remote config','Cek','showUpdatePrompt(true)')}${settingRow(iGear,'Tentang & Disclaimer','Informasi aplikasi dan penggunaan konten','Buka','showAbout()')}</div></section><section class="settings-sec"><h3 class="settings-sec-title">${iTrash} Penyimpanan</h3><div class="settings-card">${settingRow(iTrash,'Bersihkan cache API',`${apiCount} cache tersimpan`,apiCount+' item','clearApiCache()')}${settingRow(iTrash,'Bersihkan cache WebView','Membersihkan cache native Android WebView','APK','clearWebViewCache()')}${settingRow(iTrash,'Hapus riwayat',`${h.length} drama tersimpan`,h.length+' item','clearAllHistory()',true)}${settingRow(iTrash,'Hapus favorit',`${f.length} drama favorit`,f.length+' item','clearAllFavs()',true)}</div></section></div>${remoteConfigSettingsHtml(iGear)}<section class="settings-sec"><h3 class="settings-sec-title">${iBug} Error Reporting</h3><div class="settings-card">${settingRow(iBug,'Salin log error','Kirim log ini kalau build/API/player bermasalah',errs.length+' log','copyErrorLogs()')}${settingRow(iTrash,'Hapus log error','Kosongkan semua catatan error lokal','Reset','clearErrorLogs()',true)}${logs}</div></section></div>`}


function brandSvg(size=46){return `<svg class="brand-mark" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M17 12h13.5C42.9 12 51 20 51 32s-8.1 20-20.5 20H17V12Z" fill="rgba(255,255,255,.96)"/><path d="M27 23v18.5l14.5-9.25L27 23Z" class="play" fill="#10f5a6"/><path d="M47.5 8l2.4 5.7 5.9 2.3-5.9 2.4-2.4 5.8-2.4-5.8-5.8-2.4 5.8-2.3L47.5 8Z" class="spark" fill="#effff7"/><path d="M54 25l1.1 2.6 2.7 1.1-2.7 1.1L54 32.4l-1.1-2.6-2.6-1.1 2.6-1.1L54 25Z" fill="#34d399"/></svg>`}
function showOnboarding(force=false){if(!force&&localStorage.getItem('dk_onboard_done'))return;if($('#onboard'))return;const s=Settings.get();const el=document.createElement('div');el.className='onboard';el.id='onboard';el.innerHTML=`<div class="onboard-card"><div class="onboard-logo">${brandSvg(46)}</div><div class="onboard-title">Selamat datang di Dramaku</div><div class="onboard-sub">Atur pengalaman nonton pertama kamu. Bisa diubah lagi kapan saja lewat Setelan.</div><div class="onboard-choices"><button class="onb-choice fit ${fitMode==='cover'?'on':''}" onclick="setFitMode('cover');document.querySelectorAll('.onb-choice.fit').forEach(x=>x.classList.remove('on'));this.classList.add('on')"><span class="onb-ico">▣</span><span class="onb-copy"><span class="onb-choice-title">Video Full Layar</span><span class="onb-choice-sub">Mengisi layar HP, cocok untuk mini drama vertikal.</span></span></button><button class="onb-choice fit ${fitMode==='contain'?'on':''}" onclick="setFitMode('contain');document.querySelectorAll('.onb-choice.fit').forEach(x=>x.classList.remove('on'));this.classList.add('on')"><span class="onb-ico">□</span><span class="onb-copy"><span class="onb-choice-title">Video Ukuran Asli</span><span class="onb-choice-sub">Video tidak terpotong, tapi bisa ada bar hitam.</span></span></button><button class="onb-choice ${s.dataSaver?'on':''}" onclick="onboardToggleData(this)"><span class="onb-ico">↯</span><span class="onb-copy"><span class="onb-choice-title">Mode Hemat Data</span><span class="onb-choice-sub">${s.dataSaver?'Aktif':'Nonaktif'} — prioritaskan stream lebih ringan jika tersedia.</span></span></button></div><button class="onboard-start" onclick="finishOnboarding()">Mulai nonton</button><button class="onboard-skip" onclick="finishOnboarding()">Lewati dulu</button></div>`;document.body.appendChild(el)}
function onboardToggleData(btn){const next=!Settings.get().dataSaver;Settings.set('dataSaver',next);btn.classList.toggle('on',next);const sub=btn.querySelector('.onb-choice-sub');if(sub)sub.textContent=(next?'Aktif':'Nonaktif')+' — prioritaskan stream lebih ringan jika tersedia.'}
function finishOnboarding(){try{localStorage.setItem('dk_onboard_done','1')}catch(e){};$('#onboard')?.remove();toast('Dramaku siap dipakai')}
function reportEpisode(btn){if(!featureEnabled('reportEpisode')){toast('Fitur laporan sedang dinonaktifkan');return}const data={platform:curDrama?._p||P,id:curDrama?.drama_id||'',title:curDrama?.drama_name||'',episode:curPE,time:new Date().toISOString(),fitMode,app:APP_VERSION};ErrorLog.capture('video_report','Laporan episode bermasalah',data);const text=`Laporan Episode Bermasalah - Dramaku

Judul: ${data.title}
Platform: ${platformLabel(data.platform)}
Drama ID: ${data.id}
Episode: ${data.episode}
Versi APK: ${data.app}
Waktu: ${data.time}`;const target=reportTargetUrl(text);if(target){openExternalUrl(target);toast('Membuka kontak laporan...')}else if(!nativeShare('Laporan Episode Dramaku',text,location.href)){navigator.clipboard?.writeText(text);toast('Laporan disalin ke clipboard')}else toast('Laporan siap dibagikan');if(btn)btn.classList.add('reported')}

document.addEventListener('click',e=>{if(e.target.closest('button,.card,.tab,.plat-opt,.mood-card,.spotlight-card'))haptic('light')},{capture:true});


function applyFitMode(){const ov=$('#plOv');if(!ov)return;ov.classList.toggle('fit-contain',fitMode==='contain');ov.classList.toggle('fit-cover',fitMode!=='contain');$$('.fit-label',ov).forEach(e=>e.textContent=fitMode==='contain'?'Asli':'Full')}
function toggleFitMode(){setFitMode(fitMode==='contain'?'cover':'contain');toast(fitMode==='cover'?'Video dibuat full layar':'Video ditampilkan ukuran asli')}
function bindSeekBar(slide,vid,did,ep){
  const prog=slide.querySelector('.v-prog'),bar=slide.querySelector('.v-prog-bar');if(!prog||!bar)return;
  let seeking=false,hideTipTimer=null;
  const tip=(()=>{let el=slide.querySelector('.seek-tip');if(!el){el=document.createElement('div');el.className='seek-tip';slide.appendChild(el)}return el})();
  const setByX=(x,commit)=>{
    if(!vid.duration||!isFinite(vid.duration))return;
    const r=prog.getBoundingClientRect();
    const pct=Math.max(0,Math.min(1,(x-r.left)/Math.max(1,r.width)));
    const time=pct*vid.duration;
    try{vid.currentTime=time}catch(e){}
    bar.style.width=(pct*100)+'%';
    tip.textContent=fmtTime(time)+' / '+fmtTime(vid.duration);
    tip.style.left=(pct*100)+'%';
    clearTimeout(hideTipTimer);tip.classList.add('on');
    if(commit)saveWatchProgress(did,ep,time,vid.duration);
  };
  const start=e=>{e.preventDefault();e.stopPropagation();seeking=true;prog.classList.add('seeking');prog.dataset.wasPlaying=vid.paused?'0':'1';try{prog.setPointerCapture(e.pointerId)}catch(_){};vid.pause();setByX(e.clientX,false)};
  const move=e=>{if(!seeking)return;e.preventDefault();e.stopPropagation();setByX(e.clientX,false)};
  const end=e=>{if(!seeking)return;e.preventDefault();e.stopPropagation();setByX(e.clientX,true);seeking=false;prog.classList.remove('seeking');try{prog.releasePointerCapture(e.pointerId)}catch(_){};if(prog.dataset.wasPlaying==='1')vid.play().catch(()=>{});hideTipTimer=setTimeout(()=>tip.classList.remove('on'),900)};
  prog.addEventListener('pointerdown',start,{passive:false});
  prog.addEventListener('pointermove',move,{passive:false});
  prog.addEventListener('pointerup',end,{passive:false});
  prog.addEventListener('pointercancel',end,{passive:false});
  prog.addEventListener('click',e=>{e.preventDefault();e.stopPropagation()});
}
function getRecentSearches(){try{return JSON.parse(localStorage.getItem('dk_recent_searches')||'[]')}catch(e){return[]}}
function saveRecentSearch(q){q=String(q||'').trim();if(q.length<2)return;let a=getRecentSearches().filter(x=>x.toLowerCase()!==q.toLowerCase());a.unshift(q);if(a.length>8)a=a.slice(0,8);try{localStorage.setItem('dk_recent_searches',JSON.stringify(a))}catch(e){}}
function clearRecentSearches(){try{localStorage.removeItem('dk_recent_searches')}catch(e){};renderSearchTools()}
function useSearch(q){$('#sInp').value=q;doSearch()}
function renderSearchTools(){const el=$('#sTools');if(!el)return;if(lastSearchResults.length&&lastSearchQuery){const counts={all:lastSearchResults.length};lastSearchResults.forEach(d=>{const p=d._p||platCache[d.drama_id]||P;counts[p]=(counts[p]||0)+1});const chips=Object.keys(counts).sort((a,b)=>a==='all'?-1:b==='all'?1:platformLabel(a).localeCompare(platformLabel(b))).map(p=>`<button class="chip ${searchFilter===p?'on':''}" onclick="setSearchFilter('${jsStr(p)}')">${p==='all'?'Semua':esc(platformLabel(p))}<span>${counts[p]}</span></button>`).join('');el.innerHTML=`<div class="search-meta"><span>Filter platform</span><span>${lastSearchResults.length} hasil</span></div><div class="search-chips">${chips}</div>`;return}const rec=getRecentSearches();if(!rec.length){el.innerHTML='';return}el.innerHTML=`<div class="search-meta"><span>Terakhir dicari</span><button class="chip danger" style="min-height:26px;padding:5px 9px" onclick="clearRecentSearches()">Hapus</button></div><div class="search-chips">${rec.map(q=>`<button class="chip" onclick="useSearch('${jsStr(q)}')"><span class="live-dot"></span>${esc(q)}</button>`).join('')}</div>`}
function setSearchFilter(p){searchFilter=p;renderSearchResults(lastSearchResults,lastSearchQuery)}
function renderSearchResults(items,q){const box=$('#sRes');renderSearchTools();const list=searchFilter==='all'?items:items.filter(d=>(d._p||platCache[d.drama_id]||P)===searchFilter);const head=`<div class="result-head"><span><strong>${list.length}</strong> judul ${searchFilter==='all'?'ditemukan':'di '+esc(platformLabel(searchFilter))}</span><span>“${esc(q)}”</span></div>`;if(list.length)box.innerHTML=head+`<div class="grid">${list.map(cardHtml).join('')}</div>`;else box.innerHTML=head+emptyHtml('Tidak ada hasil di filter ini','Coba pilih platform lain atau kata kunci lain')}

function togglePlat(){$('#platDd').classList.toggle('on');$('#platBtn').classList.toggle('open')}
function setPlatform(p){
  if(!platformEnabled(p)){toast(platformLabel(p)+' nonaktif: '+platformReason(p));return}
  P=p;$('#platLabel').textContent=platformLabel(p);try{localStorage.setItem('dk_platform',p)}catch(e){}
  $$('.plat-opt').forEach(e=>e.classList.toggle('on',e.dataset.p===p));$('#platDd').classList.remove('on');$('#platBtn').classList.remove('open');
  // Dynamic tabs per platform
  const tabEl=document.querySelector('.tabs');
  const defTabs='<div class="tab on" data-t="home" onclick="go(\'home\')">Beranda</div><div class="tab" data-t="populer" onclick="go(\'populer\')">Populer</div><div class="tab" data-t="new" onclick="go(\'new\')">Terbaru</div>';
  if(p==='moviebox'){
    tabEl.innerHTML='<div class="tab on" data-t="home" onclick="go(\'home\')">Indonesia</div><div class="tab" data-t="populer" onclick="go(\'populer\')">Global</div><div class="tab" data-t="new" onclick="go(\'new\')">Horror</div><div class="tab" data-t="t4" onclick="go(\'t4\')">Asia</div><div class="tab" data-t="t5" onclick="go(\'t5\')">Anime</div><div class="tab" data-t="t6" onclick="go(\'t6\')">CDrama</div><div class="tab" data-t="t7" onclick="go(\'t7\')">Reality</div>';
  }else if(p==='dramabox'){
    tabEl.innerHTML='<div class="tab on" data-t="home" onclick="go(\'home\')">Beranda</div><div class="tab" data-t="populer" onclick="go(\'populer\')">Populer</div><div class="tab" data-t="new" onclick="go(\'new\')">Terbaru</div><div class="tab" data-t="t4" onclick="go(\'t4\')">Ranking</div><div class="tab" data-t="t5" onclick="go(\'t5\')">Cina</div>';
  }else if(p==='drakor'){
    tabEl.innerHTML='<div class="tab on" data-t="home" onclick="go(\'home\')">Korea</div><div class="tab" data-t="populer" onclick="go(\'populer\')">Trending</div><div class="tab" data-t="new" onclick="go(\'new\')">Terbaru</div><div class="tab" data-t="t4" onclick="go(\'t4\')">China</div><div class="tab" data-t="t5" onclick="go(\'t5\')">Ongoing</div><div class="tab" data-t="t6" onclick="go(\'t6\')">Comedy</div>';
  }else{
    tabEl.innerHTML=defTabs;
  }
  resetState();go('home');
}
document.addEventListener('click',e=>{if(!e.target.closest('.plat-sel')){$('#platDd').classList.remove('on');$('#platBtn').classList.remove('open')}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!handleNativeBack()){$('#platDd')?.classList.remove('on');$('#platBtn')?.classList.remove('open')}}});

function fixImg(u){if(!u)return'';if(u.includes('fizzopic.org')&&u.includes('.heic')){const m=u.match(/novel-images-apsoutheast\/([a-f0-9]+)~/);if(m&&m[1])return'https://p19-novel-sg.ibyteimg.com/img/novel-images-sg/'+m[1]+'~tplv-resize:570:810.jpg'}return u}
function flat(data){
  if(!data||typeof data!=='object')return[];let out=[];
  if(Array.isArray(data)){data.forEach(g=>{if(g.books&&Array.isArray(g.books))out.push(...g.books);else if(g.drama_id)out.push(g);else if(g.id&&g.title)out.push({drama_id:g.id,drama_name:g.title,description:cleanText(g.meta_description||g.shoot||''),episode_count:g.meta_episode||g.episode_number||'',watch_value:g.hits||'',thumb_url:g.image||'',tags:g.category?String(g.category).split(',').map(x=>x.trim()).filter(Boolean):[],is_new_book:'0',_p:'drakor',_raw:g})})}
  else if(data.items&&Array.isArray(data.items)){out=data.items.map(d=>({drama_id:d.drama_id,drama_name:d.title||d.drama_name||'',description:d.description||d.synopsis||'',episode_count:d.total_episodes||d.episode_count||'',watch_value:d.view_count?String(d.view_count):'',thumb_url:d.poster||d.raw?.coverImage||d.raw?.posterImg||'',tags:d.categories?d.categories.map(c=>c.name||c):(d.raw?.categoryNames||[]),free:d.free||false,is_new_book:d.is_new_book||'0'}))}
  // MovieBox: data.subjects[] or data.results[].subjects[]
  else if(data.subjects&&Array.isArray(data.subjects)){out=data.subjects.map(d=>({drama_id:d.subjectId,drama_name:d.title||'',description:d.description||'',episode_count:'',watch_value:d.viewers?String(d.viewers):'',thumb_url:d.cover?.url||'',tags:d.genre?d.genre.split(', '):[],is_new_book:'0',_subjectType:d.subjectType}))}
  else if(data.results&&Array.isArray(data.results)){data.results.forEach(r=>{if(r.subjects)r.subjects.forEach(d=>out.push({drama_id:d.subjectId,drama_name:d.title||'',description:d.description||'',episode_count:'',watch_value:'',thumb_url:d.cover?.url||'',tags:d.genre?d.genre.split(', '):[],is_new_book:'0',_subjectType:d.subjectType}))})}
  out.forEach(d=>{if(d.thumb_url)d.thumb_url=fixImg(d.thumb_url);if(!d.thumb_url&&d.cover)d.thumb_url=d.cover;const dp=d.free?'freereels':(d._p||P);if(d.drama_id){d._p=dp;platCache[d.drama_id]=dp;if(d.thumb_url)thumbCache[d.drama_id]=d.thumb_url}});rememberItems(out);
  return out;
}

function go(t){curTab=t;$$('.tab').forEach(e=>e.classList.toggle('on',e.dataset.t===t));$$('.bnav-item').forEach(e=>{const n=e.dataset.n;e.classList.toggle('on',n===t||(n==='profile'&&['profile','settings','fav'].includes(t)))});['home','populer','new','t4','t5','t6','t7','history','fav','settings','profile'].forEach(k=>{const el=$('#v-'+k);if(el)el.style.display=k===t?'block':'none'});
  if(t==='history'){renderHistory()}else if(t==='fav'){renderFav()}else if(t==='settings'){renderSettings()}else if(t==='profile'){renderProfile()}else if(!$('#v-'+t).innerHTML.trim())loadTab(t);window.scrollTo(0,0)}
function goHome(){closeDet();closePl();go('home')}

async function loadTab(t){
  if(busy[t]||more[t]===0)return;busy[t]=1;const box=$('#v-'+t),base=API[P];
  if(t==='home'&&!loaded.home){
    box.innerHTML=skelHtml(9);
    try{
      const nl=P==='flickreels'||P==='dramanova'||P==='reelshort'||P==='netshort';
      const dbLang=P==='dramabox'?'&lang=in':(!nl?'&lang=id':'');
      let hU=base+'/home?page=1'+dbLang,pU=base+'/populer?page=1'+dbLang,nU=base+'/new?page=1'+dbLang;
      if(P==='dramanova'){pU=base+'/discovery?size=10';nU=base+'/recommend?page=1&size=10'}
      else if(P==='flickreels'){pU=base+'/populer';nU=base+'/new?page=1'}
      else if(P==='reelshort'){hU=base+'/home?tab_id=0&sub_tab_id=0';pU=base+'/populer?page=1&limit=20&period=0&rule=0';nU=base+'/new?page=1&limit=20'}
      else if(P==='netshort'){hU=base+'/home?page=1';pU=base+'/populer';nU=base+'/new'}
      else if(P==='dramabox'){hU=base+'/home?page=1&lang=in';pU=base+'/populer?page=1&lang=in';nU=base+'/new?page=1&lang=in'}
      else if(P==='goodshort'){hU=base+'/home';pU=base+'/populer?page=1';nU=base+'/new?page=1&channelId=563'}
      else if(P==='moviebox'){hU=base+'/indonesia?page=1&perPage=10';pU=base+'/indonesia?page=1&perPage=10';nU=base+'/global?page=1&perPage=10'}
      else if(P==='drakor'){hU=base+'/home/korea?page=1&limit=30&sort=LATEST';pU=base+'/trending?page=1&limit=30&days=30';nU=base+'/terbaru?page=1&limit=30'}
      const[hd,pd,nd]=await Promise.all([cachedJson(hU,180000),cachedJson(pU,180000),cachedJson(nU,180000)]);
      const pop=flat(pd.data).slice(0,10),nw=flat(nd.data).slice(0,10),rec=flat(hd.data);
      let h='';
      h+=remoteMessageHtml();
      // Hero / stats banner
      h+=`<div class="stats-banner"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg><div class="stats-text"><div class="stats-kicker">Streaming mini drama</div><div class="stats-title">Temukan drama pendek favoritmu</div><div class="stats-sub">5000+ drama & film dari 10 platform. Cari judul, simpan favorit, lalu lanjutkan episode terakhir tanpa ribet.</div><div class="hero-actions"><button class="hero-search" onclick="openSearch()"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="6" cy="6" r="4.5"/><path d="M9.5 9.5l3 3"/></svg>Cari Judul</button><button class="random-btn" onclick="randomPick()"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>Acak</button></div></div></div>`;
      const spotlightPool=[...pop,...nw,...rec];
      h+=spotlightHtml(spotlightPool);
      h+=moodHtml();
      h+=platformStatusHtml();
      // Continue watching card
      const lastW=getHistory()[0];
      const hr=new Date().getHours();const greet=hr<11?'Selamat pagi':hr<15?'Selamat siang':hr<18?'Selamat sore':'Selamat malam';
      if(lastW){
        const lwId=jsStr(lastW.id),lwThumb=jsStr(lastW.thumb),lwPlat=jsStr(lastW.plat),lwEp=parseInt(lastW.ep)||1;
        const lwPct=Math.max(0,Math.min(100,parseInt(lastW.pct||0)||0));
        const lwProg=lwPct?`<div class="cw-progress"><span style="width:${lwPct}%"></span></div>`:'';
        const lwTime=lastW.dur?`<div class="cw-time">Tersimpan ${fmtTime(lastW.pos||0)} / ${fmtTime(lastW.dur||0)}</div>`:'';
        h+=`<div class="cw-card" onclick="resumeWatch('${lwId}','${lwThumb}','${lwPlat}',${lwEp})"><div class="cw-poster"><img src="${esc(lastW.thumb)}" onerror="this.style.display='none'"/></div><div class="cw-info"><div class="cw-sub">${greet}, lanjut nonton?${lwPct?` · ${lwPct}%`:''}</div><div class="cw-title">${esc(lastW.name)}</div>${lwProg}${lwTime}<button class="cw-btn" onclick="event.stopPropagation();resumeWatch('${lwId}','${lwThumb}','${lwPlat}',${lwEp})"><svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg> Lanjut Episode ${lwEp}</button></div><div class="cw-badge">Terakhir</div></div>`;
      }
      if(pop.length)h+=secHtml('Lagi Populer',pop,'populer',1);
      if(nw.length)h+=secHtml('Drama Terbaru',nw,'new',1);
      if(rec.length)h+=`<div class="sec"><div class="sec-hd"><h2 class="sec-tt">Rekomendasi</h2></div><div class="grid">${rec.map(cardHtml).join('')}</div></div>`;
      h+=`<div class="home-footer">Dramaku v2.0 · 9 Platform · Dibuat dengan cinta<br>Semua konten milik platform masing-masing</div>`;
      box.innerHTML=h||errHtml();loaded.home=1;
    }catch(e){box.innerHTML=errHtml()}
  }else if(t!=='home'){
    const tabNames={populer:'Paling Populer',new:'Paling Baru',t4:'',t5:'',t6:'',t7:''};
    const activeTab=document.querySelector(`.tab[data-t="${t}"]`);
    const secTitle=activeTab?activeTab.textContent.trim():tabNames[t]||'';
    if(pg[t]===1)box.innerHTML=`<div class="sec"><div class="sec-hd"><h2 class="sec-tt">${secTitle}</h2></div><div class="grid" id="g-${t}"></div></div><div id="trg-${t}"></div>`;
    const g=$('#g-'+t);if(pg[t]===1&&g)g.innerHTML=skelHtml(9,1);
    try{
      let ep,qp;
      if(P==='dramanova'){ep=t==='populer'?'/discovery':'/recommend';qp=t==='populer'?`?size=10&page=${pg[t]}`:`?page=${pg[t]}&size=10`}
      else if(P==='flickreels'){ep=t==='populer'?'/populer':'/new';qp=t==='populer'?'':`?page=${pg[t]}`}
      else if(P==='reelshort'){ep=t==='populer'?'/populer':'/new';qp=t==='populer'?`?page=${pg[t]}&limit=20&period=0&rule=0`:`?page=${pg[t]}&limit=20`}
      else if(P==='netshort'){ep=t==='populer'?'/populer':'/new';qp=''}
      else if(P==='dramabox'){
        const dbMap={home:'/home',populer:'/populer',new:'/new',t4:'/rank',t5:'/category?category=cina'};
        ep=dbMap[t]||'/home';qp=(t==='t4'?'?lang=in':t==='t5'?'&page='+pg[t]+'&lang=in':'?page='+pg[t]+'&lang=in');
      }
      else if(P==='goodshort'){ep=t==='populer'?'/populer':'/new';qp=t==='populer'?`?page=${pg[t]}`:`?page=${pg[t]}&channelId=563`}
      else if(P==='drakor'){const dkMap={home:'/home/korea',populer:'/trending',new:'/terbaru',t4:'/home/china',t5:'/ongoing',t6:'/category'};ep=dkMap[t]||'/home/korea';qp=t==='populer'?`?page=${pg[t]}&limit=30&days=30`:(t==='new'||t==='t5'?`?page=${pg[t]}&limit=30`:(t==='t6'?`?category_name=Comedy&page=${pg[t]}&limit=30&sort=LATEST`:`?page=${pg[t]}&limit=30&sort=LATEST`))}
      else if(P==='moviebox'){
        const mbMap={home:'/indonesia',populer:'/global',new:'/horror',t4:'/asia',t5:'/series/anime',t6:'/series/cdrama',t7:'/series/reality'};
        ep=mbMap[t]||'/indonesia';qp=`?page=${pg[t]}&perPage=10`;
      }
      else{ep=t==='populer'?'/populer':'/new';qp=`?page=${pg[t]}&lang=id`}
      const d=await cachedJson(base+ep+qp,180000);const items=flat(d.data);
      if(pg[t]===1&&g)g.innerHTML='';
      if(items.length){if(g)g.insertAdjacentHTML('beforeend',items.map(cardHtml).join(''));pg[t]++;if(d.has_more===false||items.length<8||(P==='dramanova'&&t==='populer')||(P==='flickreels'&&t==='populer'))more[t]=0}else more[t]=0;
    }catch(e){if(pg[t]===1&&g)g.innerHTML=errHtml()}
  }
  busy[t]=0;
}


function spotlightHtml(items){
  const pool=(items||[]).filter(d=>d&&d.drama_id&&d.thumb_url);
  if(!pool.length)return '';
  const pick=pool[(new Date().getDate()+pool.length)%pool.length];
  const img=fixImg(pick.thumb_url||''),id=String(pick.drama_id||''),nm=pick.drama_name||'Pilihan Dramaku',desc=pick.description||'Pilihan tontonan yang lagi cocok buat kamu hari ini.';
  const pl=pick._p||platCache[id]||P,ep=pick.episode_count||'',sid=jsStr(id),si=jsStr(img),r=ratingFor(id||nm);
  const tag=(Array.isArray(pick.tags)?pick.tags:[]).map(t=>typeof t==='object'?(t.name||t.title||''):t).filter(Boolean)[0]||platformLabel(pl);
  return`<div class="spotlight-wrap"><section class="spotlight-card" onclick="openDet('${sid}','${si}')" aria-label="Spotlight ${esc(nm)}"><img class="spot-bg" src="${esc(img)}" alt="" loading="lazy" decoding="async"><div class="spot-poster"><img src="${esc(img)}" alt="${esc(nm)}" loading="lazy" decoding="async"></div><div class="spot-info"><div class="spot-kicker"><span class="live-dot"></span> Spotlight Hari Ini</div><div class="spot-title">${esc(nm)}</div><div class="spot-desc">${esc(desc)}</div><div class="spot-meta"><span class="spot-pill">⭐ ${r}</span>${ep?`<span class="spot-pill">${esc(ep)} Ep</span>`:''}<span class="spot-pill">${esc(tag)}</span></div><div class="spot-actions"><button class="spot-play" onclick="event.stopPropagation();openDet('${sid}','${si}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Tonton</button><button class="spot-more" onclick="event.stopPropagation();randomPick()">Coba Lain</button></div></div></section></div>`;
}
function moodHtml(){
  return`<div class="mood-wrap"><div class="mood-row"><button class="mood-card" style="--mood:rgba(239,68,68,.20)" onclick="go('populer')"><span class="mood-ico">🔥</span><span class="mood-title">Lagi Hot</span><span class="mood-sub">Trending</span></button><button class="mood-card" style="--mood:rgba(59,130,246,.20)" onclick="go('new')"><span class="mood-ico">✨</span><span class="mood-title">Baru Rilis</span><span class="mood-sub">Update</span></button><button class="mood-card" style="--mood:rgba(245,158,11,.20)" onclick="randomPick()"><span class="mood-ico">🎲</span><span class="mood-title">Acak Aja</span><span class="mood-sub">Surprise</span></button><button class="mood-card" style="--mood:rgba(16,185,129,.22)" onclick="go('fav')"><span class="mood-ico">🔖</span><span class="mood-title">Favorit</span><span class="mood-sub">Koleksi</span></button></div></div>`;
}
function cardHtml(d){
  const img=fixImg(d.thumb_url||''),nm=d.drama_name||'',ep=d.episode_count||'',id=String(d.drama_id||''),vw=d.watch_value||'',isFree=d.free===true;
  const r=ratingFor(id||nm),pl=platCache[id]||d._p||P,si=jsStr(img),sid=jsStr(id);
  return`<article class="card" role="button" tabindex="0" onclick="openDet('${sid}','${si}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDet('${sid}','${si}')}" aria-label="Buka ${esc(nm)}"><div class="card-img"><img src="${esc(img)}" alt="${esc(nm)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.style.display='none'"/>${ep&&ep!=='0'&&ep!==0?`<div class="badge-ep">${esc(ep)} Ep</div>`:''}${isFree?'<div class="badge-free">FREE</div>':''}${vw&&vw!=='0'?`<div class="badge-views">${esc(fmtV(vw))}</div>`:''}<div class="badge-plat">${esc(platformLabel(pl))}</div></div><div class="card-body"><div class="card-name">${esc(nm)}</div><div class="card-rating"><svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z"/></svg> ${r}</div></div></article>`;
}
function fmtV(v){if(!v)return'';const n=parseInt(v);if(isNaN(n))return v;if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return v}
function secHtml(title,items,tab,scroll){
  const cards=items.map(cardHtml).join('');
  return`<div class="sec"><div class="sec-hd"><h2 class="sec-tt">${title}</h2><div class="sec-more" onclick="go('${tab}')">Semua <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></div></div>${scroll?`<div class="scroll-w"><div class="scroll-r">${cards}</div></div>`:`<div class="grid">${cards}</div>`}</div>`;
}
function skelHtml(n,f){let s='';for(let i=0;i<n;i++)s+=`<div class="skel-card"><div class="skel skel-img"></div><div class="skel-body"><div class="skel skel-t"></div><div class="skel skel-t2"></div><div class="skel skel-pill"></div></div></div>`;return f?s:`<div class="home-loading"><div class="skel-hero"><div class="skel skel-hero-icon"></div><div class="skel-hero-lines"><div class="skel skel-line big"></div><div class="skel skel-line"></div><div class="skel skel-line short"></div></div></div><div class="sec"><div class="sec-hd"><div class="skel skel-sec-title"></div><div class="skel skel-sec-more"></div></div><div class="grid">${s}</div></div></div>`}
function detailLoadingHtml(img=''){const poster=fixImg(img||'');return`<div class="detail-loading">${poster?`<img class="dl-bg" src="${esc(poster)}" alt=""/>`:''}<div class="dl-card"><div class="skel dl-poster"></div><div class="dl-copy"><div class="skel dl-title"></div><div class="skel dl-line"></div><div class="skel dl-line short"></div><div class="dl-actions"><div class="skel dl-btn"></div><div class="skel dl-round"></div><div class="skel dl-round"></div></div></div></div><div class="load-spin"><div class="spinner"></div></div></div>`}
function errHtml(){return`<div class="empty-state"><svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg><p>Gagal memuat data</p><p class="empty-sub">Periksa koneksi internet kamu</p><button class="retry" onclick="retry()">Coba Lagi</button></div>`}
function emptyHtml(msg,sub){return`<div class="empty-state"><svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M12 12h2v2h-2zm0-6h2v4h-2z"/></svg><p>${esc(msg)}</p>${sub?`<p class="empty-sub">${esc(sub)}</p>`:''}</div>`}
function retry(){pg[curTab]=1;more[curTab]=1;delete loaded[curTab];$('#v-'+curTab).innerHTML='';loadTab(curTab)}

/* Lanjut nonton — buka detail lalu langsung play */
function getDetailUrl(dp,id){
  if(dp==='dramabox')return API[dp]+`/detail?bookId=${id}&lang=in`;
  if(dp==='goodshort')return API[dp]+`/detail?bookId=${id}`;
  if(dp==='moviebox')return API[dp]+`/detail?subjectId=${id}`;
  if(dp==='drakor')return API[dp]+`/detail?id=${id}`;
  const nl=dp==='flickreels'||dp==='dramanova'||dp==='reelshort'||dp==='netshort';
  return API[dp]+`/detail?id=${id}`+(nl?'':'&lang=id');
}

async function resumeWatch(id,img,plat,ep){
  curEps=[];
  if(img)thumbCache[id]=fixImg(img);if(plat)platCache[id]=plat;closeSearch();
  $('#detOv').classList.add('on');$('#detBody').innerHTML=detailLoadingHtml(img);document.body.style.overflow='hidden';
  const dp=plat||platCache[id]||P;
  try{
    const d=await cachedJson(getDetailUrl(dp,id),600000);if(dp==='drakor'?!d?.info:!d?.data)throw 0;
    let dd=dp==='drakor'?d.info:d.data;
    // GoodShort: data.book + data.list
    if(dp==='goodshort'&&d.data.book){dd={...d.data.book,drama_id:d.data.book.bookId,drama_name:d.data.book.bookName,description:d.data.book.introduction,episode_count:d.data.book.chapterCount,thumb_url:d.data.book.cover,tags:d.data.book.labels||[],watch_value:d.data.book.viewCountDisplay||''};curEps=d.data.list||[]}
    if(dp==='moviebox'){dd={drama_id:d.data.subjectId,drama_name:d.data.title,description:d.data.description||"",episode_count:d.data.subjectType===2?d.data.resourceDetectors?.[0]?.totalEpisode||1:1,thumb_url:d.data.cover?.url||"",tags:d.data.genre?d.data.genre.split(", "):[],watch_value:d.data.imdbRatingValue?"IMDb "+d.data.imdbRatingValue:"",_subjectType:d.data.subjectType};curEps=[]}
    if(dp==='drakor'&&d.info){const info=d.info,eps=d.episodes?.data||[];dd={...info,drama_id:info.id,drama_name:info.title,description:cleanText(info.meta_sinopsis||info.shoot||info.content||info.meta_description||''),episode_count:eps.length||info.meta_episode||0,thumb_url:info.image,tags:info.category?String(info.category).split(',').map(x=>x.trim()).filter(Boolean):[],watch_value:info.hits||'',_subjectType:2};curEps=eps}
    curDrama=dd;curDrama._p=dp;curDrama._thumb=fixImg(dd.thumb_url||dd.cover||dd.bookCover||thumbCache[id]||'');
    if(!curEps.length)curEps=dd.video_list||dd.episode_list||dd.episodes||dd.chapterList||[];
    renderDet(dd);setTimeout(()=>play(id,ep),300);
  }catch(e){$('#detBody').innerHTML=`<div style="padding-top:100px">${errHtml()}</div>`}
}

async function openDet(id,img){
  curEps=[];
  if(img)thumbCache[id]=fixImg(img);closeSearch();
  $('#detOv').classList.add('on');$('#detBody').innerHTML=detailLoadingHtml(img);document.body.style.overflow='hidden';
  const dp=platCache[id]||P;
  try{
    const d=await cachedJson(getDetailUrl(dp,id),600000);if(dp==='drakor'?!d?.info:!d?.data)throw 0;
    let dd=dp==='drakor'?d.info:d.data;
    if(dp==='goodshort'&&d.data.book){dd={...d.data.book,drama_id:d.data.book.bookId,drama_name:d.data.book.bookName,description:d.data.book.introduction,episode_count:d.data.book.chapterCount,thumb_url:d.data.book.cover,tags:d.data.book.labels||[],watch_value:d.data.book.viewCountDisplay||''};curEps=d.data.list||[]}
    if(dp==='moviebox'){dd={drama_id:d.data.subjectId,drama_name:d.data.title,description:d.data.description||"",episode_count:d.data.subjectType===2?d.data.resourceDetectors?.[0]?.totalEpisode||1:1,thumb_url:d.data.cover?.url||"",tags:d.data.genre?d.data.genre.split(", "):[],watch_value:d.data.imdbRatingValue?"IMDb "+d.data.imdbRatingValue:"",_subjectType:d.data.subjectType};curEps=[]}
    if(dp==='drakor'&&d.info){const info=d.info,eps=d.episodes?.data||[];dd={...info,drama_id:info.id,drama_name:info.title,description:cleanText(info.meta_sinopsis||info.shoot||info.content||info.meta_description||''),episode_count:eps.length||info.meta_episode||0,thumb_url:info.image,tags:info.category?String(info.category).split(',').map(x=>x.trim()).filter(Boolean):[],watch_value:info.hits||'',_subjectType:2};curEps=eps}
    curDrama=dd;curDrama._p=dp;curDrama._thumb=fixImg(dd.thumb_url||dd.cover||dd.bookCover||thumbCache[id]||'');
    if(dd.thumb_url||dd.cover||dd.bookCover)thumbCache[id]=curDrama._thumb;
    if(!curEps.length)curEps=dd.video_list||dd.episode_list||dd.episodes||dd.chapterList||[];renderDet(dd);
  }catch(e){$('#detBody').innerHTML=`<div style="padding-top:100px">${errHtml()}</div>`}
}
function getHistoryItem(id){return getHistory().find(x=>String(x.id)===String(id))||null}
function normalizedTags(d){return (Array.isArray(d?.tags)?d.tags:[]).map(t=>String(typeof t==='object'?(t.name||t.title||''):t).toLowerCase()).filter(Boolean)}
function getSimilarItems(d){const id=String(d?.drama_id||''),tags=normalizedTags(d),dp=d?._p||platCache[id]||P;let arr=allItems.filter(x=>String(x.drama_id)!==id);arr=arr.map(x=>{const xp=x._p||platCache[x.drama_id]||P,xt=normalizedTags(x);let score=xp===dp?2:0;score+=xt.filter(t=>tags.some(a=>a&&t.includes(a)||a.includes(t))).length*3;return{x,score}}).filter(o=>o.score>0).sort((a,b)=>b.score-a.score).map(o=>o.x);if(arr.length<6)arr=[...arr,...allItems.filter(x=>String(x.drama_id)!==id&&(x._p||platCache[x.drama_id]||P)===dp&&!arr.includes(x))];return arr.slice(0,10)}
function similarHtml(d){const items=getSimilarItems(d);if(!items.length)return'';return`<div class="similar-sec"><h3 class="detail-sec-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z"/></svg>Mirip dengan ini</h3><div class="scroll-w"><div class="scroll-r">${items.map(cardHtml).join('')}</div></div></div>`}
function infoTile(label,value,icon){return`<div class="info-tile">${icon||''}<b>${esc(value||'-')}</b><span>${esc(label)}</span></div>`}
function renderDet(d){
  if(d&&d.drama_id){d._p=d._p||platCache[d.drama_id]||P;d.thumb_url=d.thumb_url||d._thumb||thumbCache[d.drama_id];rememberItems([d])}
  const ec=parseInt(d.episode_count||curEps.length||0)||0,total=Math.max(ec,1),did=jsStr(d.drama_id||'');
  const tagArr=Array.isArray(d.tags)?d.tags:(d.tags?[String(d.tags)]:['Drama']);
  const tags=tagArr.slice(0,5).map(t=>`<span class="d-tag">${esc(typeof t==='object'?(t.name||t.title||'Drama'):t)}</span>`).join('');
  const desc=String(d.description||'Belum ada sinopsis untuk judul ini.');
  const short=desc.length>170?desc.slice(0,170)+'...':desc;
  let eps='';for(let i=1;i<=total;i++)eps+=`<button class="ep-btn" onclick="play('${did}',${i})">${i}</button>`;
  const poster=d._thumb||fixImg(d.thumb_url||'')||thumbCache[d.drama_id]||'',r=ratingFor(d.drama_id||d.drama_name),favOn=isFav(d.drama_id);
  const hist=getHistoryItem(d.drama_id),lastEp=parseInt(hist?.ep)||1,lastPct=Math.max(0,Math.min(100,parseInt(hist?.pct||0)||0));
  const resumeBlock=hist?`<div class="detail-panel resume-panel" onclick="play('${did}',${lastEp})"><div class="resume-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div><div class="resume-copy"><div class="resume-kicker">Lanjutkan tontonan</div><div class="resume-title">Episode ${lastEp}${lastPct?` · ${lastPct}%`:''}</div><div class="resume-sub">${hist.dur?`Terakhir di ${fmtTime(hist.pos||0)} / ${fmtTime(hist.dur||0)}`:'Mulai dari episode terakhir yang kamu buka'}</div>${lastPct?`<div class="resume-bar"><span style="width:${lastPct}%"></span></div>`:''}</div></div>`:'';
  const w=d.watch_value?fmtV(d.watch_value):'',wLabel=w?(String(w).toLowerCase().includes('imdb')?w:w+' views'):'';
  const status=total>1?'Serial':'Film';
  const platform=platformLabel(d._p||P);
  $('#detBody').innerHTML=`<div class="d-hero"><img src="${esc(poster)}" onerror="this.style.display='none'"/><div class="d-hero-grad"></div><button class="d-back" onclick="closeDet()" aria-label="Kembali"><svg width="17" height="17" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M14 8.5H4M8.5 14l-4.5-5.5L8.5 3"/></svg></button></div>
  <div class="d-info"><div class="d-poster"><img src="${esc(poster)}" alt="${esc(d.drama_name||'Poster')}" onerror="this.onerror=null;this.style.background='var(--bg3)'"/></div><div class="d-meta"><h1 class="d-title">${esc(d.drama_name||'Tanpa Judul')}</h1><div class="d-tags">${tags}</div><div class="d-stats"><span class="d-rating"><svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z"/></svg> ${r}</span><span>${total} Episode</span>${wLabel?`<span>${esc(wLabel)}</span>`:''}<span>${esc(platform)}</span></div></div></div>
  <div class="d-actions">
    <button class="play-all-btn" style="flex:1" onclick="play('${did}',${hist?lastEp:1})"><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg> ${hist?'Lanjut Ep '+lastEp:'Mulai Tonton'}</button>
    <button class="start-over-btn" onclick="play('${did}',1)" aria-label="Mulai dari awal"><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V2L7 7l5 5V8c3.31 0 6 2.69 6 6a6 6 0 01-9.33 4.98l-1.42 1.42A8 8 0 1012 5z"/></svg></button>
    <button class="fav-btn ${favOn?'on':''}" style="background:${favOn?'var(--accent)':'var(--bg3)'}" onclick="toggleFavBtn(this)" aria-label="Simpan favorit"><svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg></button>
    <button class="share-btn" onclick="shareDrama()" aria-label="Bagikan"><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg></button>
  </div>
  ${resumeBlock}
  <div class="detail-panel"><div class="info-grid">${infoTile('Platform',platform,'<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>')}${infoTile('Episode',total+' Ep','<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v12H4z"/></svg>')}${infoTile('Rating',r,'<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z"/></svg>')}${infoTile('Tipe',status,'<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>')}</div></div>
  <div class="d-desc"><span id="dTxt">${esc(short)}</span>${desc.length>170?` <span class="more" onclick="togDesc()">Selengkapnya</span>`:''}</div>
  <div class="ep-sec"><div class="ep-sec-tt">Daftar Episode</div><div class="ep-grid">${eps}</div></div>
  ${similarHtml(d)}
  <div class="d-footer">Powered by <a href="#">Dramaku</a> &middot; Semua hak cipta milik pemiliknya</div>`;
}
let descOn=0;
function togDesc(){descOn=!descOn;const el=$('#dTxt'),tg=el.nextElementSibling,desc=String(curDrama?.description||'');if(descOn){el.textContent=desc;tg.textContent=' Sembunyikan'}else{el.textContent=desc.slice(0,150)+'...';tg.textContent=' Selengkapnya'}}
function closeDet(){$('#detOv').classList.remove('on');document.body.style.overflow='';curDrama=null;descOn=0}

async function play(did,ep){
  closeEpModal();setNativePlayback(true);$('#plOv').classList.add('on');applyFitMode();$('#plName').textContent=curDrama?.drama_name||'';$('#plEp').textContent='Episode '+ep;
  if(curDrama)saveHistory(curDrama,ep);
  curPE=ep;const cont=$('#plCont');cont.innerHTML='';const total=curDrama?.episode_count||curEps.length||ep;
  const ps=Math.max(1,ep-2);for(let i=ps;i<ep;i++)cont.insertAdjacentHTML('beforeend',slideHtml(did,i));
  for(let i=ep;i<ep+Math.min(3,total-ep+1);i++)cont.insertAdjacentHTML('beforeend',slideHtml(did,i));
  loadVid(did,ep);
  requestAnimationFrame(()=>{const t=cont.querySelector(`.v-slide[data-ep="${ep}"]`);if(t)t.scrollIntoView({behavior:'instant'})});
  cont.onscroll=debounce(()=>{
    const slides=cont.querySelectorAll('.v-slide');let active=null;
    slides.forEach(s=>{const r=s.getBoundingClientRect();if(r.top>=-80&&r.top<window.innerHeight/2)active=s});
    if(!active)return;const ae=+active.dataset.ep;$('#plEp').textContent='Episode '+ae;curPE=ae;showUI();
    if(curDrama)saveHistory(curDrama,ae);
    cont.querySelectorAll('video').forEach(v=>{if(v.closest('.v-slide')===active)v.play().catch(()=>{});else v.pause()});
    if(!active.dataset.ld)loadVid(did,ae);
    const last=slides[slides.length-1],le=+last.dataset.ep;
    if(ae>=le-1&&le<total)for(let i=le+1;i<=Math.min(le+2,total);i++)cont.insertAdjacentHTML('beforeend',slideHtml(did,i));
    const first=slides[0],fe=+first.dataset.ep;
    if(ae<=fe+1&&fe>1)for(let i=fe-1;i>=Math.max(1,fe-2);i--)cont.insertAdjacentHTML('afterbegin',slideHtml(did,i));
  },120);
}
function flashGesture(slide,text,side='center'){
  let el=slide.querySelector('.gesture-flash');
  if(!el){el=document.createElement('div');el.className='gesture-flash';slide.appendChild(el)}
  el.className='gesture-flash '+side;el.textContent=text;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
  clearTimeout(el._tm);el._tm=setTimeout(()=>el.classList.remove('show'),650);
}
function showSpeedBadge(slide,on){let el=slide.querySelector('.speed-badge');if(!el){el=document.createElement('div');el.className='speed-badge';el.textContent='2x';slide.appendChild(el)}el.classList.toggle('show',!!on)}
function seekBy(vid,slide,delta){if(!vid.duration||!isFinite(vid.duration))return;const next=Math.max(0,Math.min(vid.duration,vid.currentTime+delta));try{vid.currentTime=next}catch(e){}const p=slide.querySelector('.v-prog-bar');if(p)p.style.width=(next/vid.duration*100)+'%';flashGesture(slide,(delta>0?'+':'')+delta+' detik',delta>0?'right':'left')}
function slideHtml(did,ep){
  const nm=esc(curDrama?.drama_name||''),ds=esc(curDrama?.description||'');
  return`<div class="v-slide" data-ep="${ep}" data-did="${esc(did)}"><div class="v-loading"><div class="spinner"></div><span style="color:var(--text3);font-size:10px">Episode ${ep}</span></div>
  <div class="v-info"><div class="ep-lbl">Episode ${ep}</div><div class="ep-nm">${nm}</div><div class="ep-ds">${ds}</div></div>
  <div class="v-actions"><div class="v-act"><button onclick="this.classList.toggle('liked')" aria-label="Suka"><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/></svg></button><span>Suka</span></div>
  <div class="v-act"><button onclick="openEpModal()" aria-label="Daftar episode"><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg></button><span>Episode</span></div>
  <div class="v-act"><button onclick="toggleFitMode()" aria-label="Ubah ukuran video"><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg></button><span class="fit-label">${fitMode==='contain'?'Asli':'Full'}</span></div>
  <div class="v-act"><button onclick="reportEpisode(this)" aria-label="Laporkan episode"><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M14.4 6l-.24-1.2A1 1 0 0013.18 4H5v17h2v-7h5.6l.24 1.2a1 1 0 00.98.8H20V6h-5.6z"/></svg></button><span class="report-dot">Lapor</span></div></div>
  <div class="dbl-heart" id="heart-${ep}"><svg width="80" height="80" viewBox="0 0 24 24" fill="var(--accent)"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/></svg></div>
  <div class="v-prog"><div class="v-prog-bar" id="prg-${ep}"></div></div></div>`;
}
async function loadVid(did,ep){
  const slide=$(`.v-slide[data-ep="${ep}"][data-did="${did}"]`);if(!slide||slide.dataset.ld)return;slide.dataset.ld='1';
  const loader=slide.querySelector('.v-loading');
  let url=null,isHLS=false,subUrl=null;const dp=curDrama?._p||platCache[did]||P;
  if(dp==='freereels'){try{const d=await fetch(API.freereels+`/stream?dramaId=${did}&episode=${ep}&lang=id`).then(r=>r.json());if(d?.data){let raw=d.data.h264_m3u8||d.data.m3u8_url||d.data.video_url;if(raw){url='https://proxy.sonzaixlab.workers.dev/proxy?url='+encodeURIComponent(raw);isHLS=true};if(d.data.subtitles?.length){const st=d.data.subtitles.find(s=>s.language==='id-ID'||s.language?.startsWith('id'))||d.data.subtitles[0];if(st?.url)subUrl=st.url}}}catch(e){}}
  else if(dp==='flickreels'){try{const d=await fetch(API.flickreels+`/stream?id=${did}&ep=${ep}`).then(r=>r.json());if(d?.data?.hls_url){url=d.data.hls_url;isHLS=true}}catch(e){}}
  else if(dp==='reelshort'){try{const d=await fetch(API.reelshort+`/stream?id=${did}&episode_no=${ep}`).then(r=>r.json());if(d?.data){const vl=d.data.videoList||[];const pick=vl.find(v=>v.encode==='H264'&&v.dpi===720)||vl.find(v=>v.encode==='H264')||vl[0];if(pick?.playUrl){url=pick.playUrl;isHLS=true}else if(d.data.play_url){url=d.data.play_url;isHLS=true}}}catch(e){}}
  else if(dp==='drakor'){
    try{const epData=(curEps||[]).find(e=>Number(e.episode_number)===Number(ep))||(curEps||[])[ep-1];const sid=epData?.streaming;if(sid){const d=await fetch(API.drakor+`/stream?streaming=${sid}`).then(r=>r.json());url=(Settings.get().dataSaver?(d['480p']||d['360p']||d['720p']):(d['720p']||d['480p']||d['360p']));isHLS=!!url}}catch(e){}
  }else if(dp==='moviebox'){
    try{const st=curDrama?._subjectType||1;let d,mvUrl='',mvSub='';
      if(st===2){d=await fetch(API.moviebox+`/download-series?subjectId=${did}&se=1&resolution=${Settings.get().dataSaver?480:720}`).then(r=>r.json());if(d?.data?.episodes?.length){const epd=d.data.episodes.find(e=>e.ep===ep)||d.data.episodes[0];if(epd?.resourceLink)mvUrl=epd.resourceLink;if(epd?.subtitle?.url)mvSub=epd.subtitle.url}}
      else{d=await fetch(API.moviebox+`/download-movie?subjectId=${did}&resolution=${Settings.get().dataSaver?480:720}`).then(r=>r.json());if(d?.data?.files?.length){const f=d.data.files.find(f=>f.codecName==='h264')||d.data.files[0];if(f?.resourceLink)mvUrl=f.resourceLink};if(d?.data?.subtitle?.url)mvSub=d.data.subtitle.url}
      if(mvUrl){
        // Coba native player (ExoPlayer di APK) - support HEVC
        if(typeof NativePlayer!=='undefined'&&NativePlayer.play){NativePlayer.play(mvUrl,mvSub||'',curDrama?.drama_name||'');if(loader)loader.innerHTML='<p style="color:var(--accent);font-size:11px">Membuka player...</p>';return}
        // Fallback: browser video element (hanya h264)
        url=mvUrl;subUrl=mvSub;
      }
    }catch(e){}
  }else if(dp==='goodshort'){
    try{
      // GoodShort stream returns all episodes. Cache it.
      if(!window._gsCache||window._gsCache.id!==did){const d=await fetch(API.goodshort+`/stream?bookId=${did}`).then(r=>r.json());if(d?.data?.downloadList)window._gsCache={id:did,list:d.data.downloadList}}
      if(window._gsCache?.list){const epData=window._gsCache.list[ep-1];if(epData?.multiVideos?.length){const mv=epData.multiVideos.find(v=>v.type===(Settings.get().dataSaver?'480p':'720p'))||epData.multiVideos.find(v=>v.type==='720p')||epData.multiVideos[0];if(mv?.filePath){url=mv.filePath;isHLS=true}}}
    }catch(e){}
  }else if(dp==='dramabox'){
    try{const d=await fetch(API.dramabox+`/stream?bookId=${did}&chapterIndex=${ep-1}&lang=in`).then(r=>r.json());if(d?.data){url=d.data.videoUrl||null;if(!url&&d.data.qualities?.length){const q=d.data.qualities.find(q=>q.quality===720)||d.data.qualities[0];if(q)url=q.videoPath}}}catch(e){}
  }else if(dp==='netshort'){
    try{const d=await fetch(API.netshort+`/streamv2?id=${did}&ep=${ep}`).then(r=>r.json());if(d?.data){url=d.data.play_url||null;if(!url&&d.data.streams?.length){const s=d.data.streams.find(s=>s.encode==='H264')||d.data.streams[0];if(s)url=s.url}}}catch(e){}
  }else if(dp==='dramanova'){try{const d=await fetch(API.dramanova+`/stream?id=${did}&ep=${ep}`).then(r=>r.json());if(d?.data?.play){url=d.data.play.video_url||d.data.play.backup_url||null;if(!url&&d.data.play.qualities?.length){const q=d.data.play.qualities.find(q=>q.codec==='h264')||d.data.play.qualities[0];url=q.main_url||q.backup_url}};if(d?.data?.info?.subtitle_tracks?.length){const st=d.data.info.subtitle_tracks.find(s=>s.language==='in'||s.language==='id')||d.data.info.subtitle_tracks[0];if(st?.label)subUrl=st.label}}catch(e){}}
  else{try{const d=await fetch(API.melolo+`/streamv2?id=${did}&ep=${ep}`).then(r=>r.json());if(d?.url&&d.playable!==false)url=d.url}catch(e){}
    if(!url){try{const d=await fetch(API.melolo+`/stream?id=${did}&ep=${ep}`).then(r=>r.json());if(d?.qualities?.length){const q=d.qualities.find(q=>q.codec==='h264')||d.qualities[d.qualities.length-1];if(q)url=q.url}}catch(e){}}}
  if(!url){if(loader){loader.style.display='flex';loader.innerHTML='<p style="color:var(--text3);font-size:11px">Video belum tersedia</p>'}return}
  const vid=document.createElement('video');
  vid.setAttribute('playsinline','');vid.setAttribute('webkit-playsinline','');vid.setAttribute('preload','auto');
  if(isHLS&&typeof Hls!=='undefined'&&Hls.isSupported()){const hls=new Hls({maxBufferLength:30,enableWorker:true});hls.loadSource(url);hls.attachMedia(vid);hls.on(Hls.Events.ERROR,(e,d)=>{if(d.fatal&&loader){loader.style.display='flex';loader.innerHTML='<p style="color:var(--text3);font-size:11px">Gagal memutar</p>'}});slide._hls=hls}
  else if(isHLS&&vid.canPlayType('application/vnd.apple.mpegurl')){vid.src=url}else{vid.src=url}
  if(subUrl)loadSub(vid,subUrl);
  vid.addEventListener('loadedmetadata',()=>{const pr=getWatchProgress(did,ep);if(pr&&pr.pos>8&&vid.duration&&pr.pos<vid.duration-8){try{vid.currentTime=pr.pos}catch(e){}}});
  vid.addEventListener('loadeddata',()=>{if(loader)loader.style.display='none';if(+slide.dataset.ep===curPE){vid.play().catch(()=>{});scheduleHideUI()}});
  vid.addEventListener('timeupdate',()=>{const p=$('#prg-'+ep);if(p&&vid.duration)p.style.width=(vid.currentTime/vid.duration*100)+'%';if(vid.duration&&Date.now()-(vid._lastSave||0)>2200){saveWatchProgress(did,ep,vid.currentTime,vid.duration);vid._lastSave=Date.now()}});
  bindSeekBar(slide,vid,did,ep);
  vid.addEventListener('ended',()=>{clearWatchProgress(did,ep);const ns=slide.nextElementSibling;if(Settings.get().autoNext&&ns)ns.scrollIntoView({behavior:'smooth'})});
  vid.addEventListener('error',()=>{if(loader){loader.style.display='flex';loader.innerHTML='<p style="color:var(--text3);font-size:11px">'+(dp==='moviebox'?'Format HEVC - buka di Samsung Internet':'Gagal memutar')+'</p>'}});
  // Tap controls: single tap play/pause, double tap left/right seek, double tap center like, long press 2x speed.
  let lastTap=0,suppressClickUntil=0,longPressTimer=null,speedHold=false;
  vid.addEventListener('pointerdown',()=>{
    clearTimeout(longPressTimer);speedHold=false;
    longPressTimer=setTimeout(()=>{speedHold=true;suppressClickUntil=Date.now()+700;try{vid.playbackRate=2}catch(_){}showSpeedBadge(slide,true);flashGesture(slide,'Tahan 2x','center');if(vid.paused)vid.play().catch(()=>{})},520);
  });
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>vid.addEventListener(ev,()=>{clearTimeout(longPressTimer);if(speedHold){try{vid.playbackRate=1}catch(_){}showSpeedBadge(slide,false);speedHold=false;suppressClickUntil=Date.now()+450}}));
  vid.addEventListener('click',e=>{
    e.preventDefault();if(Date.now()<suppressClickUntil)return;const now=Date.now();
    if(now-lastTap<300){const r=slide.getBoundingClientRect(),x=(e.clientX-r.left)/Math.max(1,r.width);if(x<.42)seekBy(vid,slide,-10);else if(x>.58)seekBy(vid,slide,10);else{const heart=$('#heart-'+slide.dataset.ep);if(heart){heart.classList.remove('pop');void heart.offsetWidth;heart.classList.add('pop')}const likeBtn=slide.querySelector('.v-act button');if(likeBtn&&!likeBtn.classList.contains('liked'))likeBtn.classList.add('liked');flashGesture(slide,'Suka','center')}haptic('light');lastTap=0;return}
    lastTap=now;
    setTimeout(()=>{if(Date.now()-lastTap<300||Date.now()<suppressClickUntil)return;const icon=slide.querySelector('.pause-icon')||mkPause(slide);if(vid.paused){vid.play().catch(()=>{});icon.innerHTML='<svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>';icon.classList.add('show');setTimeout(()=>icon.classList.remove('show'),400);scheduleHideUI()}else{if($('#plOv').classList.contains('p-ui-hidden')){showUI();return}vid.pause();icon.innerHTML='<svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';icon.classList.add('show');showUI()}},300);
  });
  slide.insertBefore(vid,slide.firstChild);
}
async function loadSub(vid,srtUrl){try{const r=await fetch('https://proxy.sonzaixlab.workers.dev/proxy?url='+encodeURIComponent(srtUrl));if(!r.ok)return;const srt=await r.text();let vtt='WEBVTT\n\n'+srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g,'$1.$2');const b=new Blob([vtt],{type:'text/vtt'});const t=document.createElement('track');t.kind='subtitles';t.label='Indonesia';t.srclang='id';t.src=URL.createObjectURL(b);t.default=true;vid.appendChild(t);vid.textTracks[0].mode='showing'}catch(e){}}
function mkPause(s){const d=document.createElement('div');d.className='pause-icon';s.appendChild(d);return d}
let uiTimer=null;
function showUI(){$('#plOv').classList.remove('p-ui-hidden');const v=$('#plOv').querySelector(`.v-slide[data-ep="${curPE}"] video`);if(v&&!v.paused)scheduleHideUI()}
function hideUI(){$('#plOv').classList.add('p-ui-hidden')}
function scheduleHideUI(){clearTimeout(uiTimer);uiTimer=setTimeout(hideUI,3000)}
function nextEp(){const c=$('#plCont'),cur=c.querySelector(`.v-slide[data-ep="${curPE}"]`);if(cur?.nextElementSibling)cur.nextElementSibling.scrollIntoView({behavior:'smooth'})}
function closePl(){setNativePlayback(false);clearTimeout(uiTimer);closeEpModal();const ov=$('#plOv');ov.classList.remove('on','p-ui-hidden');ov.querySelectorAll('.v-slide').forEach(s=>{if(s._hls){s._hls.destroy();s._hls=null}});ov.querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load()});$('#plCont').innerHTML=''}

function openEpModal(){
  showUI();clearTimeout(uiTimer);const total=curDrama?.episode_count||curEps.length||0;
  const poster=curDrama?._thumb||thumbCache[curDrama?.drama_id]||'';
  $('#epModPoster').src=poster;$('#epModTitle').textContent=curDrama?.drama_name||'';$('#epModSub').textContent=total+' Episode';
  const rs=30,rc=Math.ceil(total/rs);let rh='';
  for(let i=0;i<rc;i++){const s=i*rs+1,e=Math.min((i+1)*rs,total);rh+=`<button class="ep-m-range${i===0?' on':''}" onclick="switchEpRange(${i},${total})" data-ri="${i}">${s}-${e}</button>`}
  $('#epModRanges').innerHTML=rh;renderEpRange(0,total);$('#epBd').classList.add('on');requestAnimationFrame(()=>$('#epMod').classList.add('on'));
}
function renderEpRange(ri,total){const rs=30,s=ri*rs+1,e=Math.min((ri+1)*rs,total);let h='';for(let i=s;i<=e;i++){const p=i===curPE;h+=`<button class="ep-m-btn${p?' on':''}" onclick="playFromModal(${i})">${p?'<svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>':i}</button>`}$('#epModGrid').innerHTML=h}
function switchEpRange(i,t){$$('.ep-m-range').forEach(e=>e.classList.toggle('on',+e.dataset.ri===i));renderEpRange(i,t)}
function playFromModal(ep){closeEpModal();const did=curDrama?.drama_id;if(!did)return;const cont=$('#plCont');cont.querySelectorAll('.v-slide').forEach(s=>{if(s._hls){s._hls.destroy();s._hls=null}});cont.querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load()});cont.innerHTML='';curPE=ep;$('#plEp').textContent='Episode '+ep;const total=curDrama?.episode_count||curEps.length||ep;const ps=Math.max(1,ep-2);for(let i=ps;i<ep;i++)cont.insertAdjacentHTML('beforeend',slideHtml(did,i));for(let i=ep;i<ep+Math.min(3,total-ep+1);i++)cont.insertAdjacentHTML('beforeend',slideHtml(did,i));loadVid(did,ep);requestAnimationFrame(()=>{const t=cont.querySelector(`.v-slide[data-ep="${ep}"]`);if(t)t.scrollIntoView({behavior:'instant'})})}
function closeEpModal(){$('#epMod').classList.remove('on');$('#epBd').classList.remove('on')}

function openSearch(){$('#sOv').classList.add('on');renderSearchTools();setTimeout(()=>{$('#sInp').focus();$('#sInp').select()},150)}
function closeSearch(){$('#sOv').classList.remove('on');$('#sInp').value='';lastSearchResults=[];lastSearchQuery='';searchFilter='all';$('#sRes').innerHTML=searchEmptyHtml();renderSearchTools()}
function debSearch(){clearTimeout(sto);sto=setTimeout(doSearch,350)}
async function doSearch(){
  const q=$('#sInp').value.trim(),box=$('#sRes');
  if(!q){lastSearchResults=[];lastSearchQuery='';searchFilter='all';renderSearchTools();box.innerHTML=searchEmptyHtml();return}
  const seq=++searchSeq;lastSearchQuery=q;searchFilter='all';saveRecentSearch(q);renderSearchTools();
  box.innerHTML=`<div class="grid">${skelHtml(6,1)}</div>`;
  try{const eq=encodeURIComponent(q);
    const[r1,r2,r3,r4,r5,r6,r7,r8,r9,r10]=await Promise.allSettled([
      cachedJson(API.melolo+`/search?q=${eq}&page=1&lang=id`,120000),
      cachedJson(API.freereels+`/search?q=${eq}&page=1&lang=id`,120000),
      cachedJson(API.flickreels+`/search?q=${eq}`,120000),
      cachedJson(API.dramanova+`/search?q=${eq}&page=1&size=10`,120000),
      cachedJson(API.reelshort+`/search?q=${eq}&page=1&limit=10`,120000),
      cachedJson(API.netshort+`/search?query=${eq}&page=1`,120000),
      cachedJson(API.dramabox+`/search?q=${eq}&page=1&lang=in`,120000),
      cachedJson(API.goodshort+`/search?q=${eq}&page=1`,120000),
      cachedJson(API.moviebox+`/search?q=${eq}&page=1&perPage=10`,120000),
      cachedJson(API.drakor+`/search?q=${eq}&page=1&limit=30&type=1&order=1`,120000),
    ]);
    if(seq!==searchSeq)return;
    const tag=(r,p)=>{if(!platformEnabled(p))return[];const items=r.status==='fulfilled'?flat(r.value.data):[];items.forEach(d=>{if(d.drama_id){platCache[d.drama_id]=p;d._p=p}});return items};
    const seen=new Set();
    const a=[...tag(r1,'melolo'),...tag(r2,'freereels'),...tag(r3,'flickreels'),...tag(r4,'dramanova'),...tag(r5,'reelshort'),...tag(r6,'netshort'),...tag(r7,'dramabox'),...tag(r8,'goodshort'),...tag(r9,'moviebox'),...tag(r10,'drakor')].filter(d=>{const k=(d._p||'')+'-'+(d.drama_id||d.drama_name);if(seen.has(k))return false;seen.add(k);return true});
    lastSearchResults=a;renderSearchResults(a,q);
    if(!a.length)box.innerHTML=emptyHtml('Tidak ditemukan untuk "'+q+'"','Coba kata kunci lain');
  }catch(e){if(seq===searchSeq)box.innerHTML='<div class="s-empty">Gagal mencari</div>'}
}

window.addEventListener('scroll',()=>{
  // Infinite scroll
  if(curTab!=='home'&&curTab!=='history'&&curTab!=='fav'){const trg=$('#trg-'+curTab);if(trg&&trg.getBoundingClientRect().top<window.innerHeight+300)loadTab(curTab)}
  // Scroll to top button
  const btn=$('#scrollTop');if(btn){if(window.scrollY>400)btn.classList.add('show');else btn.classList.remove('show')}
});
function debounce(fn,ms){let t;return function(...a){clearTimeout(t);t=setTimeout(()=>fn.apply(this,a),ms)}}
/* ===== WATCH PROGRESS (localStorage) ===== */
function progressKey(id,ep){return 'dk_prog_'+id+'_'+ep}
function getWatchProgress(id,ep){try{return JSON.parse(localStorage.getItem(progressKey(id,ep))||'null')}catch(e){return null}}
function clearWatchProgress(id,ep){try{localStorage.removeItem(progressKey(id,ep))}catch(e){}}
function fmtTime(sec){sec=Math.max(0,Math.floor(+sec||0));const m=Math.floor(sec/60),s=sec%60;return m+':'+String(s).padStart(2,'0')}
function saveWatchProgress(id,ep,pos,dur){
  if(!id||!ep||!dur||!isFinite(dur))return;
  const pct=Math.max(0,Math.min(100,Math.round((pos/dur)*100)));
  const data={pos:Math.floor(pos),dur:Math.floor(dur),pct,updated:Date.now()};
  try{localStorage.setItem(progressKey(id,ep),JSON.stringify(data))}catch(e){}
  try{let h=getHistory();const i=h.findIndex(x=>x.id===id);if(i>=0&&Number(h[i].ep)===Number(ep)){h[i]={...h[i],pos:data.pos,dur:data.dur,pct:data.pct,time:Date.now()};localStorage.setItem('dk_history',JSON.stringify(h))}}catch(e){}
}

/* ===== HISTORY (localStorage) ===== */
function getHistory(){try{return JSON.parse(localStorage.getItem('dk_history')||'[]')}catch(e){return[]}}
function saveHistory(drama,ep){
  let h=getHistory();h=h.filter(x=>x.id!==drama.drama_id);
  const pr=getWatchProgress(drama.drama_id,ep)||{};
  h.unshift({id:drama.drama_id,name:drama.drama_name,thumb:drama._thumb||thumbCache[drama.drama_id]||'',ep:ep,plat:drama._p||P,time:Date.now(),pos:pr.pos||0,dur:pr.dur||0,pct:pr.pct||0});
  if(h.length>50)h=h.slice(0,50);
  localStorage.setItem('dk_history',JSON.stringify(h));
}
function renderHistory(){
  const box=$('#v-history'),h=getHistory();
  if(!h.length){box.innerHTML=emptyHtml('Belum ada riwayat tontonan','Drama yang kamu tonton akan muncul di sini');return}
  box.innerHTML=`<div class="sec"><div class="sec-hd"><h2 class="sec-tt">Riwayat Tontonan</h2><div class="sec-more" onclick="clearAllHistory()">Hapus</div></div><div class="grid">${h.map(d=>{
    const thumb=fixImg(d.thumb||'');platCache[d.id]=d.plat;thumbCache[d.id]=thumb;
    const pct=Math.max(0,Math.min(100,parseInt(d.pct||0)||0)),prog=pct?`<div class="card-progress"><span style="width:${pct}%"></span></div>`:'';
    return`<article class="card" role="button" tabindex="0" onclick="openDet('${jsStr(d.id)}','${jsStr(thumb)}')"><div class="card-img"><img src="${esc(thumb)}" alt="${esc(d.name)}" loading="lazy" decoding="async" onerror="this.style.display='none'"/><div class="badge-ep" style="background:var(--accent);color:#fff">Ep ${parseInt(d.ep)||1}</div><div class="badge-plat">${esc(platformLabel(d.plat))}</div>${prog}</div><div class="card-body"><div class="card-name">${esc(d.name)}</div><div class="card-rating" style="color:var(--text3);background:rgba(255,255,255,.055)">${pct?`Progress ${pct}%`:`Lanjut Ep ${parseInt(d.ep)||1}`}</div></div></article>`;
  }).join('')}</div></div>`;
}

/* ===== FAVORITES (localStorage) ===== */
function getFavs(){try{return JSON.parse(localStorage.getItem('dk_favs')||'[]')}catch(e){return[]}}
function toggleFav(drama){
  let f=getFavs();const idx=f.findIndex(x=>x.id===drama.drama_id);
  if(idx>=0){f.splice(idx,1)}else{f.unshift({id:drama.drama_id,name:drama.drama_name,thumb:drama._thumb||thumbCache[drama.drama_id]||'',plat:drama._p||P,ep:drama.episode_count||0})}
  localStorage.setItem('dk_favs',JSON.stringify(f));return idx<0;
}
function isFav(id){return getFavs().some(x=>x.id===id)}
function toggleFavBtn(btn){if(!curDrama)return;const on=toggleFav(curDrama);btn.classList.toggle('on',on);btn.style.background=on?'var(--accent)':'var(--bg3)';toast(on?'Ditambahkan ke favorit':'Dihapus dari favorit')}
function renderFav(){
  const box=$('#v-fav'),f=getFavs();
  if(!f.length){box.innerHTML=emptyHtml('Belum ada drama favorit','Tap bookmark di halaman detail untuk menyimpan');return}
  box.innerHTML=`<div class="sec"><div class="sec-hd"><h2 class="sec-tt">Drama Favorit</h2></div><div class="grid">${f.map(d=>{
    const thumb=fixImg(d.thumb||'');platCache[d.id]=d.plat;thumbCache[d.id]=thumb;
    return`<article class="card" role="button" tabindex="0" onclick="openDet('${jsStr(d.id)}','${jsStr(thumb)}')"><div class="card-img"><img src="${esc(thumb)}" alt="${esc(d.name)}" loading="lazy" decoding="async" onerror="this.style.display='none'"/>${d.ep?`<div class="badge-ep">${parseInt(d.ep)||0} Ep</div>`:''}<div class="badge-plat">${esc(platformLabel(d.plat))}</div></div><div class="card-body"><div class="card-name">${esc(d.name)}</div><div class="card-rating"><svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z"/></svg> ${ratingFor(d.id)}</div></div></article>`;
  }).join('')}</div></div>`;
}
function profileMiniCard(d,type='history'){
  const thumb=fixImg(d.thumb||''),ep=parseInt(d.ep)||1,pct=Math.max(0,Math.min(100,parseInt(d.pct||0)||0));
  if(d.id){platCache[d.id]=d.plat;thumbCache[d.id]=thumb}
  return`<article class="profile-mini" onclick="openDet('${jsStr(d.id)}','${jsStr(thumb)}')"><div class="profile-mini-img"><img src="${esc(thumb)}" alt="${esc(d.name)}" loading="lazy" decoding="async" onerror="this.style.display='none'"/>${pct?`<div class="profile-mini-progress"><span style="width:${pct}%"></span></div>`:''}</div><div class="profile-mini-copy"><b>${esc(d.name||'Tanpa Judul')}</b><span>${type==='history'?`Episode ${ep}${pct?` · ${pct}%`:''}`:(d.ep?`${d.ep} Episode`:'Favorit')}</span></div></article>`
}
function renderProfile(){
  const box=$('#v-profile'),h=getHistory(),f=getFavs(),errs=ErrorLog.list();
  const last=h[0],apiCount=Object.keys(localStorage).filter(k=>k.startsWith('dk_api_')).length;
  const watched=h.length,fav=f.length,progress=h.filter(x=>x.pct>0).length;
  const lastBlock=last?`<div class="profile-resume" onclick="resumeWatch('${jsStr(last.id)}','${jsStr(last.thumb)}','${jsStr(last.plat)}',${parseInt(last.ep)||1})"><div class="resume-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div><div class="resume-copy"><div class="resume-kicker">Terakhir ditonton</div><div class="resume-title">${esc(last.name)}</div><div class="resume-sub">Lanjut Episode ${parseInt(last.ep)||1}${last.pct?` · ${last.pct}%`:''}</div>${last.pct?`<div class="resume-bar"><span style="width:${Math.max(0,Math.min(100,parseInt(last.pct)||0))}%"></span></div>`:''}</div></div>`:'';
  const historyRows=h.slice(0,5).map(d=>profileMiniCard(d,'history')).join('');
  const favRows=f.slice(0,5).map(d=>profileMiniCard(d,'fav')).join('');
  box.innerHTML=`<div class="profile-page"><section class="profile-hero"><div class="profile-avatar">${brandSvg(42)}</div><div class="profile-hero-copy"><div class="profile-kicker">Dramaku Profile</div><h1>Saya</h1><p>Kontrol tontonan, koleksi, cache, dan diagnostik aplikasi.</p></div></section><div class="profile-stats"><div><b>${watched}</b><span>Ditonton</span></div><div><b>${fav}</b><span>Favorit</span></div><div><b>${progress}</b><span>Progress</span></div><div><b>${errs.length}</b><span>Error</span></div></div>${lastBlock}<section class="profile-actions"><button onclick="go('fav')">🔖<span>Favorit</span></button><button onclick="go('history')">🕘<span>Riwayat</span></button><button onclick="go('settings')">⚙️<span>Setelan</span></button><button onclick="reloadRemoteConfig()">☁️<span>Config</span></button></section><div class="profile-grid"><section class="profile-section"><div class="profile-section-head"><h3>Lanjut nonton</h3><button onclick="go('history')">Semua</button></div>${historyRows||'<div class="profile-empty">Belum ada riwayat tontonan.</div>'}</section><section class="profile-section"><div class="profile-section-head"><h3>Koleksi favorit</h3><button onclick="go('fav')">Semua</button></div>${favRows||'<div class="profile-empty">Belum ada favorit.</div>'}</section></div><section class="profile-section profile-tools"><div class="profile-section-head"><h3>Tools cepat</h3></div><button onclick="clearApiCache()"><span>Bersihkan cache API</span><b>${apiCount} item</b></button><button onclick="copyErrorLogs()"><span>Salin log error</span><b>${errs.length} log</b></button><button onclick="localStorage.removeItem('dk_onboard_done');showOnboarding(true)"><span>Tampilkan onboarding</span><b>Buka</b></button><button onclick="showUpdatePrompt(true)"><span>Cek update APK</span><b>v${APP_VERSION}</b></button><button onclick="showAbout()"><span>Tentang & Disclaimer</span><b>Buka</b></button></section></div>`;
}

/* ===== RANDOM PICK ===== */
async function randomPick(){
  const platforms=['melolo','freereels','flickreels','dramanova','reelshort','netshort','dramabox','goodshort','moviebox','drakor'].filter(platformEnabled);
  const rp=platforms[Math.floor(Math.random()*platforms.length)];
  const base=API[rp];
  try{
    const pg=Math.floor(Math.random()*3)+1;
    let url=base+'/home?page='+pg;
    if(rp==='moviebox')url=base+'/indonesia?page='+pg+'&perPage=10';
    else if(rp==='drakor')url=base+'/home/korea?page='+pg+'&limit=30&sort=LATEST';
    else if(rp==='flickreels'||rp==='dramanova'||rp==='netshort'||rp==='goodshort')url=base+'/home';
    else if(rp==='dramabox')url=base+'/home?page='+pg+'&lang=in';
    else url=base+'/home?page='+pg+'&lang=id';
    const d=await cachedJson(url,180000);
    const items=flat(d.data);
    if(items.length){
      const pick=items[Math.floor(Math.random()*items.length)];
      if(pick.drama_id){platCache[pick.drama_id]=rp;openDet(pick.drama_id,pick.thumb_url)}
    }
  }catch(e){}
}

/* ===== SHARE ===== */
function shareDrama(){
  if(!curDrama)return;
  const text=`Nonton "${curDrama.drama_name}" di Dramaku!`;
  if(nativeShare('Dramaku',text,location.href))return;
  if(navigator.share){navigator.share({title:'Dramaku',text,url:location.href}).catch(()=>{})}
  else{navigator.clipboard?.writeText(text+' '+location.href);toast('Link drama disalin')}
}

document.addEventListener('visibilitychange',()=>{if(document.hidden){$('#plOv')?.querySelectorAll('video').forEach(v=>v.pause())}});
window.addEventListener('online',()=>toast('Koneksi kembali online'));
window.addEventListener('offline',()=>toast('Kamu sedang offline'));
if(typeof navigator!=='undefined'&&!navigator.onLine)setTimeout(()=>toast('Kamu sedang offline'),1200);
async function boot(){
  await loadRemoteConfig();
  const savedPlatform=(()=>{try{return localStorage.getItem('dk_platform')}catch(e){return null}})();
  const startP=(savedPlatform&&API[savedPlatform]&&platformEnabled(savedPlatform))?savedPlatform:firstEnabledPlatform();
  if(startP!==P)setPlatform(startP);else loadTab('home');
  updatePlatformAvailability();
  setTimeout(()=>showOnboarding(),1200);
}
boot();
