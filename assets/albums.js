import * as THREE from 'three';

const works = window.PORTFOLIO.projects;
const projects = [...works, window.PORTFOLIO.pendingAlbum];
const $ = selector => document.querySelector(selector);
const canvas = $('#albums'), stage = $('#stage'), root = $('#collection');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = THREE.MathUtils.clamp;
const smooth = x => { x = clamp(x,0,1); return x*x*x*(x*(x*6-15)+10); };
const mod = (n,m) => ((n%m)+m)%m;
// Each finished work has one sleeve; future slots fill the rest of the moving rail.
const spacing = .82, count = 25, total = spacing * count;
const autoScrollSpeed = .18;
const baseRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.32,-.78,-.04));
const openRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-.035,-.08,0));
const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
renderer.setClearColor(0,0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-8,8,3,-3,.1,100);
camera.position.set(0,0,20);
scene.add(new THREE.HemisphereLight(0xffffff,0x596479,2.5));
const key = new THREE.DirectionalLight(0xfff2dd,3.2);key.position.set(-3,7,10);scene.add(key);
const rim = new THREE.DirectionalLight(0xbacde6,2.3);rim.position.set(5,2,4);scene.add(rim);
const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
let width = 1, height = 1, worldWidth = 14;
let offset = 0, selected = 0, hovered = null, active = null, progress = 0, state = 'browse';
let overStage = false, userPaused = reduce.matches, keyboardHold = false, resumeAt = 0;
let pointerDown = null, lastMove = null, suppressedClick = 0, velocity = 0, visible = true;
let snapshot = null, raf = 0, lastTime = 0, returnKeyboardFocus = false;
const rigs = [], covers = [];
let previewHover=false, discSlide=1.3, enterProgress=0, flight=null, returnHoldUntil=0, navigating=false;
const artImage=new Image();artImage.src='assets/art/refraction.png';await artImage.decode();
const playerTexture=await new THREE.TextureLoader().loadAsync('assets/art/player.png');playerTexture.colorSpace=THREE.SRGBColorSpace;
const player=new THREE.Mesh(new THREE.PlaneGeometry(4.25,5.05),new THREE.MeshBasicMaterial({map:playerTexture,transparent:true,depthWrite:false}));scene.add(player);player.visible=false;
// The spindle is authored at pixel (571, 564) in the 1145 x 1374 player artwork.
const playerSpindle=new THREE.Vector3((571/1145-.5)*4.25,(.5-564/1374)*5.05,0);
const targetBackground = new THREE.Color('#080808');
const currentBackground = new THREE.Color('#080808');
const silver = new THREE.MeshStandardMaterial({color:'#b8c4cc',metalness:.72,roughness:.3});
const black = new THREE.MeshStandardMaterial({color:'#171a1b',roughness:.48,metalness:.25});
const coverGeometry=new THREE.PlaneGeometry(2.6,2.6);
const sleeveDepth=.16, sleeveWall=.018;
const sleevePanelGeometry=new THREE.BoxGeometry(2.6,2.6,sleeveWall);
const sleeveEdgeGeometry=new THREE.BoxGeometry(2.6,sleeveWall,sleeveDepth-sleeveWall*2);
const sleeveSpineGeometry=new THREE.BoxGeometry(sleeveWall,2.6-sleeveWall*2,sleeveDepth-sleeveWall*2);
// Decode each cover before showing the collection, so no sample artwork flashes.
const coverImages = await Promise.all(projects.map(async project => {
 if (!project.cover) return null;
 const image = new Image(); image.src = project.cover;
 try { await image.decode(); return image; }
 catch { console.warn('Cover unavailable:', project.cover); return null; }
}));
function coverTexture(project,index){
 const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');
 ctx.fillStyle=project.color;ctx.fillRect(0,0,1024,1024);
 const image=coverImages[index];
 if(image){
  const crop=project.coverCrop||{},size=Math.min(image.naturalWidth,image.naturalHeight)/(crop.zoom||1);
  const x=(image.naturalWidth-size)*(crop.x??.5),y=(image.naturalHeight-size)*(crop.y??.5);
  ctx.drawImage(image,x,y,size,size,0,0,1024,1024);
 }else{
  ctx.fillStyle=project.foil;ctx.font='48px Arial';ctx.fillText(project.chinese,65,160,890);
 }
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
 return tex;
}
function discTexture(project,index){
 const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');
 if(project.pending){
  ctx.fillStyle='#dfdfda';ctx.fillRect(0,0,1024,1024);ctx.strokeStyle='#b5b7b4';ctx.lineWidth=2;
  for(const r of [72,110,488]){ctx.beginPath();ctx.arc(512,512,r,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#28322b';ctx.textAlign='center';ctx.font='52px "Microsoft YaHei",sans-serif';ctx.fillText('待更新',760,510);ctx.font='13px Arial';ctx.fillText('COMING SOON',760,544);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return {texture,kind:'blank'};
 }
 const kind=project.discType||['iridescent','transparent','vinyl'][index%3];
 const g=ctx.createConicGradient(.4,512,512);
 const colors=kind==='vinyl'?['#070b0f','#30353b','#0c1119','#202732','#05080c']:kind==='transparent'?[project.color,'#94c6c5',project.color,'#72a8bb',project.color]:['#8fe5d6','#3e69a9','#927abc','#d2c7a0','#2a457a','#8fe5d6'];
 colors.forEach((color,i)=>g.addColorStop(i/(colors.length-1),color));ctx.fillStyle=g;ctx.fillRect(0,0,1024,1024);
 if(kind==='iridescent'){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.65;ctx.drawImage(artImage,0,0,1024,1024);ctx.restore();}
 ctx.strokeStyle=kind==='vinyl'?'#bacbdf24':'#ffffff24';ctx.lineWidth=kind==='vinyl'?.9:.6;
 for(let r=130;r<505;r+=kind==='vinyl'?2.3:2.9){ctx.beginPath();ctx.arc(512,512,r,0,Math.PI*2);ctx.stroke();}
 ctx.fillStyle=kind==='vinyl'?project.color:'#11202d';ctx.beginPath();ctx.arc(512,512,125,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#eceae2';ctx.textAlign='center';ctx.font='23px Georgia';ctx.fillText(project.title,512,475,205);ctx.font='12px Arial';ctx.fillText('IHSUSHI / '+String(index+1).padStart(2,'0'),512,570);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return {texture:t,kind};
}
const discMaterials=projects.map((p,i)=>{const d=discTexture(p,i);return new THREE.MeshBasicMaterial({map:d.texture,transparent:d.kind==='transparent',opacity:d.kind==='transparent'?.72:1,side:THREE.DoubleSide});});
projects.forEach((p,i)=>covers.push(new THREE.MeshStandardMaterial({map:coverTexture(p,i),color:p.pending?'#515151':'#ffffff',roughness:.65,metalness:.04})));
function mesh(geo,mat,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;}
function makeCase(index){
 const group=new THREE.Group();scene.add(group);group.quaternion.copy(baseRotation);
 const projectIndex=index<works.length?index:works.length,p=projects[projectIndex];
 const sleeve=new THREE.Group();group.add(sleeve);
 const edgeColor=new THREE.Color(p.color);if(p.pending)edgeColor.multiplyScalar(.16);
 const edgeMaterial=new THREE.MeshStandardMaterial({color:edgeColor,roughness:.72,metalness:0});
 // Two panels enclose the record; the right side stays open for extraction.
 const panelZ=(sleeveDepth-sleeveWall)/2;
 mesh(sleevePanelGeometry,edgeMaterial,sleeve,0,0,panelZ);
 mesh(sleevePanelGeometry,edgeMaterial,sleeve,0,0,-panelZ);
 mesh(sleeveEdgeGeometry,edgeMaterial,sleeve,0,1.3-sleeveWall/2,0);
 mesh(sleeveEdgeGeometry,edgeMaterial,sleeve,0,-1.3+sleeveWall/2,0);
 mesh(sleeveSpineGeometry,edgeMaterial,sleeve,-1.3+sleeveWall/2,0,0);
 mesh(coverGeometry,covers[projectIndex],sleeve,0,0,sleeveDepth/2+.002);
 const record=new THREE.Group();group.add(record);
 const disc=mesh(new THREE.RingGeometry(.105,1.2,128),discMaterials[projectIndex],record,0,0,0);
 const pos=disc.geometry.attributes.position,uv=disc.geometry.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)/2.4+.5,pos.getY(i)/2.4+.5);
 disc.name='disc';mesh(new THREE.TorusGeometry(1.194,.006,6,128),silver,record,0,0,0);
 mesh(new THREE.TorusGeometry(.105,.009,6,48),silver,record,0,0,.001);
 const discHit=mesh(new THREE.CircleGeometry(1.2,64),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),record,0,0,.002);
 const rig={group,sleeve,record,disc,discHit,index,projectIndex,x:0};
 group.traverse(o=>{o.userData.slot=index;});rigs.push(rig);return rig;
}
for(let i=0;i<count;i++)makeCase(i);
function positionX(i){return mod(i*spacing-offset+total/2,total)-total/2;}
function setState(next){state=next;root.dataset.state=next;$('#browse-footer').inert=next!=='browse';}
function select(index,announce=false){selected=index;const p=projects[rigs[index].projectIndex];$('#selection-title').textContent=p.shortTitle||p.chinese;$('#selection-note').textContent=p.pending?'更多作品，敬请期待':p.category+' · '+p.format;$('#counter').textContent=p.pending?'待续':String(rigs[index].projectIndex+1).padStart(2,'0')+' / '+String(works.length).padStart(2,'0');document.querySelectorAll('.project-index button').forEach((b,i)=>b.setAttribute('aria-current',String(i===rigs[index].projectIndex)));if(announce)$('#status').textContent='已选择 '+p.chinese;}
function remember(){try{sessionStorage.setItem('folio-case',JSON.stringify({offset,slot:active.index,id:projects[active.projectIndex].id}));}catch{}}
function fillPreview(project){
 $('#preview-category').textContent=project.pending?'COMING SOON':project.category+' / '+project.format;$('#preview-title').textContent=project.chinese;$('#preview-chinese').textContent=project.title;$('#preview-meta').textContent=project.pending?'待更新':(project.date||'');$('#preview-summary').textContent=project.summary;
 const entry=$('#enter-project');entry.hidden=!!project.pending;
 if(project.pending)entry.removeAttribute('href');else entry.href='project.html?id='+encodeURIComponent(project.id)+'&from=album&transition=1&v='+encodeURIComponent(window.PORTFOLIO.revision);
 $('.disc-hint').textContent=project.pending?'这张唱片还在制作中，内容待更新。':'悬停专辑，抽出更多唱片';
}
function open(index,instant=false){
 if(state!=='browse')return;
 active=rigs[index];select(index);velocity=0;hovered=null;previewHover=false;discSlide=1.3;returnHoldUntil=0;$('#hover-label').hidden=true;
 snapshot=rigs.map(r=>({position:r.group.position.clone(),quaternion:r.group.quaternion.clone(),scale:r.group.scale.x}));
 progress=instant?1:0;setState(instant?'open':'opening');
 fillPreview(projects[active.projectIndex]);$('#preview').hidden=false;
 const bg=new THREE.Color(projects[active.projectIndex].color);bg.multiplyScalar(.055);targetBackground.copy(bg);
 root.style.setProperty('--accent',projects[active.projectIndex].foil);
 history.replaceState(null,'','?open='+encodeURIComponent(projects[active.projectIndex].id)+'&v='+window.PORTFOLIO.revision);remember();
 if(instant)$('#close-case').focus({preventScroll:true});
}
function close(keyboard=false){returnKeyboardFocus=keyboard;if(state!=='open'&&state!=='opening')return;setState('closing');targetBackground.set('#080808');$('#close-case').blur();history.replaceState(null,'',location.pathname+'?v='+window.PORTFOLIO.revision);}
function enter(){
 if(state!=='open')return;
 if(projects[active.projectIndex].pending){$('#status').textContent='这张唱片尚未更新，暂时没有作品详情。';return;}
 remember();enterProgress=0;previewHover=false;navigating=false;
 scene.updateMatrixWorld(true);scene.attach(active.record);
 flight={position:active.record.position.clone(),quaternion:active.record.quaternion.clone(),scale:active.record.scale.x,sleeve:active.group.position.clone()};
 player.visible=true;player.position.set(worldWidth,0,1);setState('playing');$('#preview').inert=true;
 $('#player-caption').hidden=false;$('#player-title').textContent=projects[active.projectIndex].title;
 history.replaceState(null,'','?return='+encodeURIComponent(projects[active.projectIndex].id)+'&v='+window.PORTFOLIO.revision);
}
function restoreCollection(id){
 const pi=projects.findIndex(p=>p.id===id);if(pi<0)return;
 if(active&&active.record.parent!==active.group){active.group.add(active.record);active.record.position.set(0,0,0);active.record.quaternion.identity();active.record.scale.setScalar(1);}
 let slot=pi;try{const saved=JSON.parse(sessionStorage.getItem('folio-case'));if(saved?.id===id&&Number.isInteger(saved.slot)&&saved.slot>=0&&saved.slot<count&&rigs[saved.slot].projectIndex===pi&&Number.isFinite(saved.offset)){offset=saved.offset;slot=saved.slot;}}catch{}
 offset+=positionX(slot);active=null;flight=null;progress=0;enterProgress=0;navigating=false;setState('browse');
 player.visible=false;$('#preview').hidden=true;$('#preview').inert=false;$('#player-caption').hidden=true;$('#transition-veil').style.opacity=0;stage.style.opacity=1;
 targetBackground.set('#080808');currentBackground.copy(targetBackground);root.style.setProperty('--bg','#080808');
 hovered=slot;select(slot);resumeAt=performance.now()+3200;returnHoldUntil=resumeAt;velocity=0;overStage=false;keyboardHold=false;
 rigs.forEach(r=>{r.x=positionX(r.index);r.group.position.set(r.x+(positionX(r.index)>=positionX(slot)-.001?1.32:0),r.x*.19+(r.index===slot?.14:0),r.index===slot?.42:0);r.group.quaternion.copy(baseRotation);r.group.scale.setScalar(1);r.record.position.set(0,0,0);r.record.rotation.set(0,0,0);});
}

function navigate(direction){if(state!=='browse')return;const nearest=rigs.reduce((a,b)=>Math.abs(positionX(a.index))<Math.abs(positionX(b.index))?a:b);const next=mod(nearest.index+direction,count);offset+=positionX(next);select(next,true);hovered=next;resumeAt=performance.now()+3200;returnHoldUntil=resumeAt;}
function updatePlayback(){$('#toggle-play').textContent=userPaused?'▶ 继续轮播':'Ⅱ 暂停轮播';$('#toggle-play').setAttribute('aria-pressed',String(userPaused));$('#toggle-play').setAttribute('aria-label',userPaused?'继续自动轮播':'暂停自动轮播');}
works.forEach((p,i)=>{const b=document.createElement('button');b.textContent=String(i+1).padStart(2,'0');b.setAttribute('aria-label','选择 '+p.chinese);b.onclick=()=>{if(state!=='browse')return;const candidates=rigs.filter(r=>r.projectIndex===i);const candidate=candidates.reduce((a,b)=>Math.abs(positionX(a.index))<Math.abs(positionX(b.index))?a:b);offset+=positionX(candidate.index);select(candidate.index,true);hovered=candidate.index;resumeAt=performance.now()+3200;returnHoldUntil=resumeAt;};$('#project-index').append(b);});
$('#previous').onclick=()=>navigate(-1);$('#next').onclick=()=>navigate(1);$('#open-selected').onclick=()=>open(selected);$('#close-case').onclick=e=>close(e.detail===0);
$('#toggle-play').onclick=()=>{userPaused=!userPaused;hovered=null;keyboardHold=false;updatePlayback();};
$('#enter-project').onclick=e=>{e.preventDefault();enter();};
function pointerAt(e){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);}
function hitCase(e){pointerAt(e);const hits=ray.intersectObjects(rigs.map(r=>r.group),true);return hits.find(h=>h.object.visible)?.object.userData.slot??null;}
function discIsExposed(){const hits=ray.intersectObject(active.group,true);return hits.length>0&&(hits[0].object===active.discHit||hits[0].object===active.disc);}
function label(e,index){if(index===null){$('#hover-label').hidden=true;return;}const p=projects[rigs[index].projectIndex];const el=$('#hover-label');el.textContent=p.chinese+' / '+p.category;el.hidden=false;el.style.left=Math.min(e.clientX+16,innerWidth-250)+'px';el.style.top=Math.min(e.clientY+18,innerHeight-70)+'px';}
canvas.addEventListener('pointerenter',()=>{overStage=true;});
canvas.addEventListener('pointerleave',()=>{overStage=false;previewHover=false;if(state==='browse'){if(performance.now()>=returnHoldUntil)hovered=null;label(null,null);resumeAt=Math.max(resumeAt,performance.now()+650);}canvas.style.cursor='default';});
canvas.addEventListener('pointermove',e=>{
 if(pointerDown){const dx=e.clientX-pointerDown.x;if(Math.abs(dx)>7){pointerDown.dragged=true;offset=pointerDown.offset-dx/width*worldWidth;hovered=null;suppressedClick=performance.now()+300;return;}}
 if(state==='browse'&&e.pointerType!=='touch'){
  const hit=hitCase(e);
  // Only repick on actual pointer movement; animated displacement never changes selection by itself.
  if(!lastMove||Math.hypot(e.clientX-lastMove.x,e.clientY-lastMove.y)>5){hovered=hit;lastMove={x:e.clientX,y:e.clientY};if(hit!==null)select(hit);}
  label(e,hovered);canvas.style.cursor=hovered===null?'grab':'pointer';
 }else if(state==='open'){pointerAt(e);previewHover=ray.intersectObject(active.group,true).length>0;canvas.style.cursor=!projects[active.projectIndex].pending&&discIsExposed()?'pointer':'default';}
});
canvas.addEventListener('pointerdown',e=>{if(state!=='browse'||e.button!==0)return;pointerDown={x:e.clientX,offset,dragged:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointerup',e=>{if(pointerDown?.dragged){resumeAt=performance.now()+1000;suppressedClick=performance.now()+300;}pointerDown=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(e.pointerType==='touch')overStage=false;});
canvas.addEventListener('pointercancel',()=>{pointerDown=null;hovered=null;overStage=false;resumeAt=performance.now()+800;});
canvas.addEventListener('click',e=>{if(performance.now()<suppressedClick)return;if(state==='browse'){const hit=hitCase(e);if(hit!==null)open(hit);}else if(state==='open'){pointerAt(e);if(discIsExposed())enter();}});
canvas.addEventListener('wheel',e=>{if(state!=='browse'||e.ctrlKey)return;e.preventDefault();offset+=clamp((Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*.003,-1,1);hovered=null;resumeAt=performance.now()+900;},{passive:false});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(state==='playing')restoreCollection(projects[active.projectIndex].id);else close(true);return;}if(e.target.closest('a,button'))return;if(state==='browse'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();navigate(e.key==='ArrowRight'?1:-1);}if(e.key==='Enter'){e.preventDefault();state==='browse'?open(selected):enter();}});
$('#browse-footer').addEventListener('focusin',()=>{keyboardHold=true;});$('#browse-footer').addEventListener('focusout',e=>{if(!$('#browse-footer').contains(e.relatedTarget))keyboardHold=false;});
function resize(){width=stage.clientWidth;height=stage.clientHeight;worldWidth=clamp(width/91,6.2,17);const h=worldWidth*height/width;camera.left=-worldWidth/2;camera.right=worldWidth/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();renderer.setSize(width,height,false);}
new ResizeObserver(resize).observe(stage);resize();
function layout(dt,time){
 if(state==='browse'){
  if(returnHoldUntil&&time>returnHoldUntil){returnHoldUntil=0;if(!overStage)hovered=null;}
  const scrolling=!userPaused&&!overStage&&!pointerDown&&!keyboardHold&&time>resumeAt;
  velocity=THREE.MathUtils.damp(velocity,scrolling?autoScrollSpeed:0,7,dt);offset=mod(offset+velocity*dt,total);
  const hoverX=hovered===null?Infinity:positionX(hovered);
  rigs.forEach(r=>{const x=positionX(r.index);const shift=hovered!==null&&x>=hoverX-.001?1.32:0;const pick=r.index===hovered;const target=new THREE.Vector3(x+shift+(pick?.08:0),x*.19+(pick?.14:0),pick?.42:0);
   if(Math.abs(r.x-x)>total/2)r.group.position.copy(target);else r.group.position.lerp(target,1-Math.exp(-dt*10));r.x=x;r.group.quaternion.slerp(baseRotation,1-Math.exp(-dt*10));r.group.scale.setScalar(1);r.record.position.set(0,0,0);
  });
  if(hovered===null){const nearest=rigs.reduce((a,b)=>Math.abs(positionX(a.index))<Math.abs(positionX(b.index))?a:b);if(selected!==nearest.index)select(nearest.index);}
 }else if(state==='playing'){
  enterProgress=Math.min(1,enterProgress+dt/(reduce.matches?.12:2.25));const t=enterProgress;
  const extract=smooth(t/.38),install=smooth((t-.40)/.28),machine=smooth((t-.18)/.44);
  const mobile=width<801;const machineScale=mobile?.86:1;
  player.scale.setScalar(machineScale);player.position.set((1-machine)*(worldWidth+4),0,1);
  active.group.position.copy(flight.sleeve);active.group.position.x-=(worldWidth+7)*smooth(t/.45);
  const floating=new THREE.Vector3(0,.8,4),mounted=player.localToWorld(playerSpindle.clone());
  mounted.z+=2;
  active.record.position.copy(flight.position).lerp(floating,extract).lerp(mounted,install);
  active.record.quaternion.copy(flight.quaternion).slerp(new THREE.Quaternion(),extract);
  active.record.scale.setScalar(THREE.MathUtils.lerp(flight.scale,1.35*machineScale,extract));
  active.record.rotation.z=smooth((t-.65)/.35)*Math.PI*1.6;
  const fade=smooth((t-.88)/.12);$('#transition-veil').style.opacity=fade;
  if(t===1&&!navigating){navigating=true;try{sessionStorage.setItem('folio-transition-bg','#'+targetBackground.getHexString());}catch{}location.href=$('#enter-project').href;}
 }else{
  if(state==='opening')progress=Math.min(1,progress+dt/(reduce.matches?.05:1.45));
  if(state==='closing')progress=Math.max(0,progress-dt/(reduce.matches?.05:1.3));
  const move=smooth(progress/.64), reveal=smooth((progress-.30)/.70);
  discSlide=THREE.MathUtils.damp(discSlide,state==='open'&&previewHover?1.92:1.3,8,dt);
  const mobile=width<801;
  const destination=new THREE.Vector3(mobile?-.70:-worldWidth*.18,mobile?-.3:.65,2);
  rigs.forEach((r,i)=>{
   const s=snapshot[i];
   if(r===active){r.group.position.copy(s.position).lerp(destination,move);r.group.quaternion.copy(s.quaternion).slerp(openRotation,move);r.group.scale.setScalar(THREE.MathUtils.lerp(s.scale,mobile?1.10:1.65,move));r.record.position.x=discSlide*reveal;}
   else{const direction=s.position.x<snapshot[active.index].position.x?-1:1;r.group.position.copy(s.position);r.group.position.x+=direction*(worldWidth+4)*smooth(progress/.7);}
  });
  if(state==='opening'&&progress===1){setState('open');$('#close-case').focus({preventScroll:true});$('#status').textContent=projects[active.projectIndex].pending?'专辑已展开。这张唱片的内容待更新。':'专辑已展开。点击唱片，进入作品。';}
  if(state==='closing'&&progress===0){setState('browse');$('#preview').hidden=true;active=null;snapshot=null;hovered=null;resumeAt=time+1100;if(returnKeyboardFocus)$('#open-selected').focus({preventScroll:true});else keyboardHold=false;}
 }
 currentBackground.lerp(targetBackground,1-Math.exp(-dt*3.8));root.style.setProperty('--bg','#'+currentBackground.getHexString());
}
function frame(time){raf=0;if(!visible)return;const dt=Math.min((time-lastTime)/1000||.016,.045);lastTime=time;layout(dt,time);renderer.render(scene,camera);raf=requestAnimationFrame(frame);}
function run(){if(!raf){lastTime=performance.now();raf=requestAnimationFrame(frame);}}
document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(!visible){cancelAnimationFrame(raf);raf=0;}else run();});
window.addEventListener('pageshow',e=>{if(e.persisted&&state==='playing'&&active)restoreCollection(projects[active.projectIndex].id);visible=!document.hidden;run();});
reduce.addEventListener('change',e=>{if(e.matches)userPaused=true;updatePlayback();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();visible=false;cancelAnimationFrame(raf);$('#fallback').hidden=false;});
rigs.forEach(r=>{r.x=positionX(r.index);r.group.position.set(r.x,r.x*.19,0);});
$('#collection-range').textContent='THE RECORD COLLECTION / 01—'+String(works.length).padStart(2,'0');
select(0);updatePlayback();
const returnId=new URLSearchParams(location.search).get('return');
if(returnId)restoreCollection(returnId);
$('#loading').hidden=true;$('#fallback').hidden=true;document.body.dataset.ready='true';run();
