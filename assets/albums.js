import * as THREE from 'three';

const works = window.PORTFOLIO.projects;
const projects = [...works, window.PORTFOLIO.pendingAlbum];
const categories = window.PORTFOLIO.categories;
const categoryLabel = id => categories.find(category => category.id === id)?.label;
const emptyCategories = categories.filter(c=>!works.some(work=>work.collections.includes(c.id)));
const $ = selector => document.querySelector(selector);
const canvas = $('#albums'), stage = $('#stage'), root = $('#collection');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = THREE.MathUtils.clamp;
const smooth = x => { x = clamp(x,0,1); return x*x*x*(x*(x*6-15)+10); };
const mod = (n,m) => ((n%m)+m)%m;
// Each finished work has one sleeve; future slots fill the rest of the moving rail.
const spacing = .82, count = Math.max(25,works.length+emptyCategories.length*2+4), total = spacing * count;
const autoScrollSpeed = .18;
const railSlope = .115;
const baseRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.23,-.88,0));
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
let offset = (works.length-1)*spacing/2, selected = 0, hovered = null, active = null, progress = 0, state = 'browse';
let category = null, focusLayout = null, categoryMotion = null, categorySpread = 0;
let overStage = false, userPaused = reduce.matches, keyboardHold = false, resumeAt = 0;
let pointerDown = null, lastMove = null, suppressedClick = 0, velocity = 0, visible = true;
let snapshot = null, raf = 0, lastTime = 0, returnKeyboardFocus = false;
const rigs = [], covers = [];
let previewHover=false, discSlide=1.3, enterProgress=0, flight=null, returnHoldUntil=0, navigating=false;
const artImage=new Image();artImage.src='assets/art/refraction.webp';
const [,playerTexture]=await Promise.all([artImage.decode(),new THREE.TextureLoader().loadAsync('assets/art/player.webp')]);playerTexture.colorSpace=THREE.SRGBColorSpace;
const player=new THREE.Mesh(new THREE.PlaneGeometry(4.25,5.05),new THREE.MeshBasicMaterial({map:playerTexture,transparent:true,depthWrite:false}));scene.add(player);player.visible=false;
// The spindle is authored at pixel (571, 564) in the 1145 x 1374 player artwork.
const playerSpindle=new THREE.Vector3((571/1145-.5)*4.25,(.5-564/1374)*5.05,0);
const targetBackground = new THREE.Color('#080808');
const currentBackground = new THREE.Color('#080808');
const silver = new THREE.MeshStandardMaterial({color:'#b8c4cc',metalness:.72,roughness:.3});
const black = new THREE.MeshStandardMaterial({color:'#171a1b',roughness:.48,metalness:.25});
// All front layers follow one depth, including the invisible interaction surface.
const sleeveDepth=.12, sleeveFront=sleeveDepth/2;
const coverGeometry=new THREE.PlaneGeometry(2.552,2.552);
const sleevePanelGeometry=new THREE.PlaneGeometry(2.564,2.564);
const caseHitGeometry=new THREE.PlaneGeometry(2.6,2.6);
const caseHitMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
// The light cards only supply reflections; the stage and its lighting stay unchanged.
function caseEnvironment(){
 const studio=new THREE.Scene();studio.background=new THREE.Color('#1b1a18');
 for(const [position,scale,color] of [
  [[-4,5,4],[3,7],'#f5f3ed'],[[5,1,2],[2,6],'#d1cec7'],[[0,-4,3],[5,1],'#76736f']
 ]){
  const card=new THREE.Mesh(new THREE.PlaneGeometry(...scale),new THREE.MeshBasicMaterial({color}));
  card.position.set(...position);card.lookAt(0,0,0);studio.add(card);
 }
 const generator=new THREE.PMREMGenerator(renderer),target=generator.fromScene(studio,.025);
 generator.dispose();studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return target.texture;
}
const caseReflections=caseEnvironment();
function frameGeometry(size,edge,depth){
 const h=size/2,i=h-edge,shape=new THREE.Shape();
 shape.moveTo(-h,-h);shape.lineTo(h,-h);shape.lineTo(h,h);shape.lineTo(-h,h);shape.closePath();
 const hole=new THREE.Path();hole.moveTo(-i,-i);hole.lineTo(-i,i);hole.lineTo(i,i);hole.lineTo(i,-i);hole.closePath();shape.holes.push(hole);
 const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:1});geometry.translate(0,0,-depth/2);return geometry;
}
function shellGeometry(){
 // One continuous shell: a printed top is a material on the wall, not a second
 // coplanar mesh. Front/back lips and all thickness faces share their boundaries.
 const geometry=frameGeometry(2.6,.018,sleeveDepth);
 const position=geometry.attributes.position,normal=geometry.attributes.normal,uv=geometry.attributes.uv;
 geometry.clearGroups();
 let groupStart=0,previous=-1;
 for(let i=0;i<position.count;i+=3){
  const nx=normal.getX(i),ny=normal.getY(i),nz=normal.getZ(i);
  const top=ny>.5&&position.getY(i)>1.299;
  const right=nx>.5&&position.getX(i)>1.299;
  const material=nz>.5?0:nz<-.5?1:top?2:right?3:4;
  if(material!==previous){
   if(previous!==-1)geometry.addGroup(groupStart,i-groupStart,previous);
   groupStart=i;previous=material;
  }
  if(top||right)for(let j=i;j<i+3;j++){
   const x=position.getX(j),y=position.getY(j),z=position.getZ(j);
   uv.setXY(j,top?(x+1.3)/2.6:.5-z/sleeveDepth,top?.5-z/sleeveDepth:(y+1.3)/2.6);
  }
 }
 geometry.addGroup(groupStart,position.count-groupStart,previous);return geometry;
}
const sleeveShellGeometry=shellGeometry();
function printTexture(canvas){
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return texture;
}
function spineTexture(project){
 const c=document.createElement('canvas');c.width=128;c.height=3072;const ctx=c.getContext('2d');
 ctx.fillStyle=project.sleeveColor||project.color;ctx.fillRect(0,0,c.width,c.height);
 const edge=ctx.createLinearGradient(0,0,128,0);
 for(const [at,color] of [[0,'#ffffff60'],[.035,'#ffffff25'],[.11,'#ffffff00'],[.70,'#ffffff00'],[.94,'#00000018'],[.985,'#ffffff40'],[1,'#ffffff10']])edge.addColorStop(at,color);
 ctx.fillStyle=edge;ctx.fillRect(0,0,c.width,c.height);
 ctx.save();ctx.translate(64,1536);ctx.rotate(Math.PI/2);
 ctx.textAlign='left';ctx.textBaseline='middle';ctx.font='72px Arial';
 ctx.fillStyle=project.sleeveInk||'#e5e4de';
 const text=project.spineTitle||project.title.toUpperCase(),tracking=34;
 let cursor=-(ctx.measureText(text).width+(text.length-1)*tracking)/2;
 for(const letter of text){ctx.fillText(letter,cursor,0);cursor+=ctx.measureText(letter).width+tracking;}ctx.restore();
 return printTexture(c);
}
function topTexture(project){
 const c=document.createElement('canvas');c.width=1024;c.height=64;const ctx=c.getContext('2d');
 ctx.fillStyle=project.sleeveTopColor||project.sleeveColor||project.color;ctx.fillRect(0,0,c.width,c.height);
 // A very soft reflection across the depth, without a universal blue top face.
 const sheen=ctx.createLinearGradient(0,0,0,64);
 for(const [at,color] of [[0,'#ffffff50'],[.06,'#ffffff14'],[.2,'#ffffff00'],[.55,'#ffffff0a'],[.88,'#ffffff28'],[.95,'#0000001c'],[1,'#ffffff30']])sheen.addColorStop(at,color);
 ctx.fillStyle=sheen;ctx.fillRect(0,0,c.width,c.height);return printTexture(c);
}
const shellMaterials=projects.map(p=>{
 const tone=new THREE.Color(p.sleeveColor||p.color),dim=p.pending?'#515151':'#ffffff';
 return {
  rim:new THREE.MeshPhysicalMaterial({color:tone.clone().lerp(new THREE.Color('#d1cec6'),.28).multiplyScalar(p.pending?.10:.48),roughness:.32,metalness:0,clearcoat:.8,clearcoatRoughness:.23,envMap:caseReflections,envMapIntensity:.35}),
  side:new THREE.MeshBasicMaterial({color:tone.clone().multiplyScalar(p.pending?.085:.80),toneMapped:false}),
  spine:new THREE.MeshBasicMaterial({map:spineTexture(p),color:dim,toneMapped:false}),
  top:new THREE.MeshBasicMaterial({map:topTexture(p),color:dim,toneMapped:false}),
  glass:new THREE.MeshPhysicalMaterial({color:'#aaa8a3',roughness:.20,metalness:0,clearcoat:.8,clearcoatRoughness:.19,envMap:caseReflections,envMapIntensity:.65,transparent:true,opacity:p.pending?.012:.035,depthWrite:false}),
  back:new THREE.MeshBasicMaterial({color:tone.clone().multiplyScalar(p.pending?.07:.55),toneMapped:false})
 };
});
// Decode each cover before showing the collection, so no sample artwork flashes.
const coverImages = await Promise.all(projects.map(async project => {
 if (!project.cover) return null;
 const image = new Image(); image.src = project.cover;
 try { await image.decode(); return image; }
 catch { console.warn('Cover unavailable:', project.cover); return null; }
}));
function coverTexture(project,index){
 const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');
 const strip=132,accent=project.labelColor||project.color;
 ctx.fillStyle=project.color;ctx.fillRect(0,0,1024,1024);
 const image=coverImages[index];
 if(image){
  const crop=project.coverCrop||{},size=Math.min(image.naturalWidth,image.naturalHeight)/(crop.zoom||1);
  const x=(image.naturalWidth-size)*(crop.x??.5),y=(image.naturalHeight-size)*(crop.y??.5);
  const imageWidth=size*(1024-strip)/1024;
  ctx.drawImage(image,x+(size-imageWidth)/2,y,imageWidth,size,strip,0,1024-strip,1024);
 }else{
  ctx.fillStyle=project.foil;ctx.font='48px Arial';ctx.fillText(project.chinese,65,160,890);
 }
 // One reusable printed obi, kept inside the clear shell rather than floating above it.
 ctx.fillStyle='#eeefeb';ctx.fillRect(0,0,strip,1024);
 ctx.fillStyle='#333c40';ctx.font='600 14px Arial';ctx.fillText('IHSUSHI',20,33);
 ctx.fillStyle='#787e80';ctx.font='10px Arial';ctx.fillText('COLLECTION',20,51);
 ctx.fillStyle='#333c40';ctx.font='54px Georgia';ctx.fillText(project.pending?'—':String(index+1).padStart(2,'0'),19,122);
 ctx.fillStyle='#a8afb0';ctx.fillRect(20,147,92,1);
 ctx.save();ctx.translate(50,192);ctx.rotate(Math.PI/2);
 ctx.fillStyle='#29343b';ctx.font='24px Arial';ctx.fillText(project.pending?'TO BE CONTINUED':project.title.toUpperCase(),0,0,405);
 ctx.fillStyle='#787e80';ctx.font='10px Arial';ctx.fillText('IHSUSHI  /  PORTFOLIO',0,23);ctx.restore();
 ctx.fillStyle='#adb2b2';ctx.fillRect(20,663,92,1);
 ctx.fillStyle='#565e61';ctx.font='10px Arial';ctx.fillText(project.pending?'IN PROGRESS':'SELECTED WORK',20,688);
 ctx.fillText('SIDE A',20,708);
 // Small editorial rules and registration marks give the strip a printed rhythm.
 ctx.fillStyle='#aab0b0';for(const [y,length] of [[743,81],[751,66],[759,74],[783,41]])ctx.fillRect(20,y,length,1);
 ctx.fillStyle='#4a555b';ctx.fillRect(20,818,15,2);ctx.fillRect(20,818,2,15);ctx.fillRect(97,818,15,2);ctx.fillRect(110,818,2,15);
 ctx.fillStyle=accent;ctx.fillRect(12,873,108,139);
 ctx.fillStyle='#f2f1eb';ctx.font='12px Arial';ctx.fillText(project.pending?'NEXT':String(index+1).padStart(2,'0')+' / 04',23,985);
 ctx.fillStyle='#00000013';ctx.fillRect(strip-1,0,1,1024);
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
projects.forEach((p,i)=>covers.push(new THREE.MeshBasicMaterial({map:coverTexture(p,i),color:p.pending?'#515151':'#ffffff',toneMapped:false})));
function mesh(geo,mat,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;}
function makeCase(index){
 const group=new THREE.Group();scene.add(group);group.quaternion.copy(baseRotation);
 const projectIndex=index<works.length?index:works.length,p=projects[projectIndex];
 const sleeve=new THREE.Group();group.add(sleeve);
 const materials=shellMaterials[projectIndex];
 mesh(sleevePanelGeometry,materials.back,sleeve,0,0,-sleeveFront);
 mesh(sleeveShellGeometry,[materials.rim,materials.back,materials.top,materials.spine,materials.side],sleeve);
 mesh(coverGeometry,covers[projectIndex],sleeve,0,0,sleeveFront-.009);
 mesh(coverGeometry,materials.glass,sleeve,0,0,sleeveFront-.005);
 // Decorations never intercept a click: only this silhouette and the disc are hit targets.
 const caseHit=mesh(caseHitGeometry,caseHitMaterial,sleeve,0,0,sleeveFront+.002);
 const record=new THREE.Group();group.add(record);
 const disc=mesh(new THREE.RingGeometry(.105,1.2,128),discMaterials[projectIndex],record,0,0,0);
 const pos=disc.geometry.attributes.position,uv=disc.geometry.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)/2.4+.5,pos.getY(i)/2.4+.5);
 disc.name='disc';mesh(new THREE.TorusGeometry(1.194,.006,6,128),silver,record,0,0,0);
 mesh(new THREE.TorusGeometry(.105,.009,6,48),silver,record,0,0,.001);
 const discHit=mesh(new THREE.CircleGeometry(1.2,64),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),record,0,0,.002);
 // Reserve two honest previews for each category that has no published work yet.
 const pendingCategory=emptyCategories[Math.floor((index-works.length)/2)]?.id;
 const collections=p.pending?(pendingCategory?[pendingCategory]:[]):p.collections;
 const rig={group,sleeve,record,disc,discHit,caseHit,index,projectIndex,collections,x:0};
 group.traverse(o=>{o.userData.slot=index;});rigs.push(rig);return rig;
}
for(let i=0;i<count;i++)makeCase(i);
function positionX(i){return mod(i*spacing-offset+total/2,total)-total/2;}
function setState(next){state=next;root.dataset.state=next;$('#browse-footer').inert=next!=='browse';}
function select(index,announce=false){selected=index;const p=projects[rigs[index].projectIndex];if(announce)$('#status').textContent='已选择 '+p.chinese;}
function collectionURL(params={}){
 const query=new URLSearchParams(params);if(category)query.set('category',category);query.set('v',window.PORTFOLIO.revision);return location.pathname+'?'+query;
}
function updateCategoryNavigation(){
 root.dataset.category=category||'all';
 document.querySelectorAll('#category-nav button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===category)));
 const catalogQuery=new URLSearchParams({v:window.PORTFOLIO.revision});if(category)catalogQuery.set('category',category);
 $('.masthead>a:last-child').href='catalog.html?'+catalogQuery;
}
function chooseCategory(id,instant=false){
 if(state!=='browse')return;
 category=categories.some(c=>c.id===id)?id:null;hovered=null;lastMove=null;velocity=0;returnHoldUntil=0;keyboardHold=false;$('#hover-label').hidden=true;
 if(category){
  const members=rigs.filter(r=>r.collections.includes(category));
  const anchor=members.reduce((sum,r)=>sum+r.index*spacing,0)/members.length;
  // Nonadjacent works can share a category: gather them once, retaining rail order.
  const outsiders=rigs.filter(r=>!members.includes(r)).map(r=>({index:r.index,relative:mod(r.index*spacing-anchor+total/2,total)-total/2}));
  const outsideRanks=new Map();
  for(const side of [-1,1])outsiders.filter(r=>(r.relative<0?-1:1)===side).sort((a,b)=>Math.abs(a.relative)-Math.abs(b.relative)).forEach((r,rank)=>outsideRanks.set(r.index,{side,rank}));
  focusLayout={members,anchor,outsideRanks};
  const distance=mod(anchor-offset+total/2,total)-total/2;
  categoryMotion=instant?null:{start:offset,end:offset+distance,elapsed:0};
  if(instant){offset+=distance;categorySpread=1;}
  select(members[0].index);
 }else{categoryMotion=null;resumeAt=performance.now()+600;}
 updateCategoryNavigation();history.replaceState(null,'',collectionURL());
 const quantity=works.filter(work=>work.collections.includes(category)).length;
 $('#status').textContent=category?categoryLabel(category)+'分类已居中，自动滚动已暂停。'+(quantity?quantity+' 个作品。':'内容待更新。')+'再次点击当前分类可退出。':(userPaused?'已返回全部专辑，自动滚动仍暂停':'已恢复全部专辑流动');
}
function browsePosition(r){
 const x=positionX(r.index);let arranged=x;
 if(focusLayout&&categorySpread>.001){
  const members=focusLayout.members,rank=members.indexOf(r);
  const focusSpacing=Math.min(1.5,(worldWidth-2.2)/Math.max(members.length,1));
  const halfSpan=(members.length-1)*focusSpacing/2;
  const relative=mod(r.index*spacing-focusLayout.anchor+total/2,total)-total/2;
  const outside=focusLayout.outsideRanks.get(r.index);
  const destination=rank>=0?(rank-(members.length-1)/2)*focusSpacing:outside.side*(halfSpan+spacing+1.7+outside.rank*spacing);
  arranged+=(destination-relative)*categorySpread;
 }
 const pick=r.index===hovered;
 let hoverShift=0;
 if(hovered!==null){
  const shift=positionX(r.index)>=positionX(hovered)-.001?1.32:0;
  // In a focused group, open the hover gap evenly so it remains centered.
  hoverShift=shift-(category?.66:0);
 }
 return new THREE.Vector3(arranged+hoverShift+(pick?.08:0),arranged*railSlope+(pick?.12:0),pick?.42:0);
}
function remember(){try{sessionStorage.setItem('folio-case',JSON.stringify({offset,slot:active.index,id:projects[active.projectIndex].id,category}));}catch{}}
function fillPreview(project){
 const section=categoryLabel(active.collections.includes(category)?category:active.collections[0]);
 $('#preview-category').textContent=project.pending?(section?section+' / 待更新':'COMING SOON'):[section,project.category,project.format].filter(Boolean).join(' / ');$('#preview-title').textContent=project.pending&&section?section+' · 待更新':project.chinese;$('#preview-chinese').textContent=project.title;$('#preview-meta').textContent=project.pending?'待更新':(project.date||'');$('#preview-summary').textContent=project.summary;
 const entry=$('#enter-project');entry.hidden=!!project.pending;
 if(project.pending)entry.removeAttribute('href');else{const query=new URLSearchParams({id:project.id,from:'album',transition:'1',v:window.PORTFOLIO.revision});if(category)query.set('category',category);entry.href='project.html?'+query;}
 $('.disc-hint').textContent=project.pending?'这张唱片还在制作中，内容待更新。':'悬停专辑，抽出更多唱片';
}
function open(index,instant=false){
 if(state!=='browse')return;
 if(category&&!rigs[index].collections.includes(category))chooseCategory(rigs[index].collections[0]);
 active=rigs[index];select(index);velocity=0;hovered=null;previewHover=false;discSlide=1.3;returnHoldUntil=0;$('#hover-label').hidden=true;
 snapshot=rigs.map(r=>({position:r.group.position.clone(),quaternion:r.group.quaternion.clone(),scale:r.group.scale.x}));
 progress=instant?1:0;setState(instant?'open':'opening');
 fillPreview(projects[active.projectIndex]);$('#preview').hidden=false;
 const bg=new THREE.Color(projects[active.projectIndex].color);bg.multiplyScalar(.055);targetBackground.copy(bg);
 root.style.setProperty('--accent',projects[active.projectIndex].foil);
 history.replaceState(null,'',collectionURL({open:projects[active.projectIndex].id}));remember();
 if(instant)$('#close-case').focus({preventScroll:true});
}
function close(keyboard=false){returnKeyboardFocus=keyboard;if(state!=='open'&&state!=='opening')return;setState('closing');targetBackground.set('#080808');$('#close-case').blur();history.replaceState(null,'',collectionURL());}
function enter(){
 if(state!=='open')return;
 if(projects[active.projectIndex].pending){$('#status').textContent='这张唱片尚未更新，暂时没有作品详情。';return;}
 remember();enterProgress=0;previewHover=false;navigating=false;
 scene.updateMatrixWorld(true);scene.attach(active.record);
 flight={position:active.record.position.clone(),quaternion:active.record.quaternion.clone(),scale:active.record.scale.x,sleeve:active.group.position.clone()};
 player.visible=true;player.position.set(worldWidth,0,1);setState('playing');$('#preview').inert=true;
 $('#player-caption').hidden=false;$('#player-title').textContent=projects[active.projectIndex].title;
 history.replaceState(null,'',collectionURL({return:projects[active.projectIndex].id}));
}
function restoreCollection(id){
 const pi=projects.findIndex(p=>p.id===id);if(pi<0)return;
 if(active&&active.record.parent!==active.group){active.group.add(active.record);active.record.position.set(0,0,0);active.record.quaternion.identity();active.record.scale.setScalar(1);}
 let slot=pi;try{const saved=JSON.parse(sessionStorage.getItem('folio-case'));if(saved?.id===id&&Number.isInteger(saved.slot)&&saved.slot>=0&&saved.slot<count&&rigs[saved.slot].projectIndex===pi&&Number.isFinite(saved.offset)){offset=saved.offset;slot=saved.slot;}}catch{}
 if(category&&focusLayout){offset=focusLayout.anchor;categoryMotion=null;categorySpread=1;}else offset+=positionX(slot);
 active=null;flight=null;progress=0;enterProgress=0;navigating=false;setState('browse');
 player.visible=false;$('#preview').hidden=true;$('#preview').inert=false;$('#player-caption').hidden=true;$('#transition-veil').style.opacity=0;stage.style.opacity=1;
 targetBackground.set('#080808');currentBackground.copy(targetBackground);root.style.setProperty('--bg','#080808');
 hovered=slot;select(slot);resumeAt=performance.now()+3200;returnHoldUntil=resumeAt;velocity=0;overStage=false;keyboardHold=false;
 rigs.forEach(r=>{r.x=positionX(r.index);r.group.position.copy(browsePosition(r));r.group.quaternion.copy(baseRotation);r.group.scale.setScalar(1);r.record.position.set(0,0,0);r.record.rotation.set(0,0,0);});
}

function navigate(direction){if(state!=='browse')return;let next;if(category){const members=focusLayout.members;const rank=members.findIndex(r=>r.index===selected);next=members[mod(rank+direction,members.length)].index;}else{const nearest=rigs.reduce((a,b)=>Math.abs(positionX(a.index))<Math.abs(positionX(b.index))?a:b);next=mod(nearest.index+direction,count);offset+=positionX(next);}select(next,true);hovered=next;resumeAt=performance.now()+3200;returnHoldUntil=resumeAt;}
categories.forEach(c=>{const button=document.createElement('button');button.type='button';button.textContent=c.label;button.dataset.category=c.id;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>chooseCategory(category===c.id?null:c.id));$('#category-nav').append(button);});
$('#close-case').onclick=e=>close(e.detail===0);
$('#enter-project').onclick=e=>{e.preventDefault();enter();};
function pointerAt(e){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);}
function hitCase(e){pointerAt(e);const hits=ray.intersectObjects(rigs.flatMap(r=>[r.caseHit,r.discHit]),false);return hits[0]?.object.userData.slot??null;}
function discIsExposed(){const hits=ray.intersectObjects([active.caseHit,active.discHit],false);return hits[0]?.object===active.discHit;}
function label(e,index){if(index===null){$('#hover-label').hidden=true;return;}const p=projects[rigs[index].projectIndex];const el=$('#hover-label');el.textContent=p.chinese+' / '+p.category;el.hidden=false;el.style.left=Math.min(e.clientX+16,innerWidth-250)+'px';el.style.top=Math.min(e.clientY+18,innerHeight-70)+'px';}
canvas.addEventListener('pointerenter',()=>{overStage=true;});
canvas.addEventListener('pointerleave',()=>{overStage=false;previewHover=false;if(state==='browse'){if(performance.now()>=returnHoldUntil)hovered=null;label(null,null);resumeAt=Math.max(resumeAt,performance.now()+650);}canvas.style.cursor='default';});
canvas.addEventListener('pointermove',e=>{
 if(pointerDown){const dx=e.clientX-pointerDown.x;if(Math.abs(dx)>7){pointerDown.dragged=true;if(category)chooseCategory(null);offset=pointerDown.offset-dx/width*worldWidth;hovered=null;suppressedClick=performance.now()+300;return;}}
 if(state==='browse'&&e.pointerType!=='touch'){
  const hit=hitCase(e);
  // Only repick on actual pointer movement; animated displacement never changes selection by itself.
  if(!lastMove||Math.hypot(e.clientX-lastMove.x,e.clientY-lastMove.y)>5){hovered=hit;lastMove={x:e.clientX,y:e.clientY};if(hit!==null)select(hit);}
  label(e,hovered);canvas.style.cursor=hovered===null?'grab':'pointer';
 }else if(state==='open'){pointerAt(e);previewHover=ray.intersectObjects([active.caseHit,active.discHit],false).length>0;canvas.style.cursor=!projects[active.projectIndex].pending&&discIsExposed()?'pointer':'default';}
});
canvas.addEventListener('pointerdown',e=>{if(state!=='browse'||e.button!==0)return;pointerDown={x:e.clientX,offset,dragged:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointerup',e=>{if(pointerDown?.dragged){resumeAt=performance.now()+1000;suppressedClick=performance.now()+300;}pointerDown=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(e.pointerType==='touch')overStage=false;});
canvas.addEventListener('pointercancel',()=>{pointerDown=null;hovered=null;overStage=false;resumeAt=performance.now()+800;});
canvas.addEventListener('click',e=>{if(performance.now()<suppressedClick)return;if(state==='browse'){const hit=hitCase(e);if(hit!==null)open(hit);}else if(state==='open'){pointerAt(e);if(discIsExposed())enter();}});
canvas.addEventListener('wheel',e=>{if(state!=='browse'||e.ctrlKey)return;e.preventDefault();if(category)return;offset+=clamp((Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*.003,-1,1);hovered=null;resumeAt=performance.now()+900;},{passive:false});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(state==='playing')restoreCollection(projects[active.projectIndex].id);else if(state==='browse'&&category)chooseCategory(null);else close(true);return;}if(e.target.closest('a,button'))return;if(state==='browse'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();navigate(e.key==='ArrowRight'?1:-1);}if(e.key==='Enter'){e.preventDefault();state==='browse'?open(selected):enter();}if(e.code==='Space'&&state==='browse'){e.preventDefault();userPaused=!userPaused;keyboardHold=false;updateCategoryNavigation();$('#status').textContent=userPaused?'自动轮播已暂停':(category?'当前分类保持停留，退出分类后继续轮播':'自动轮播已恢复');}});
canvas.addEventListener('focus',()=>{keyboardHold=canvas.matches(':focus-visible');});canvas.addEventListener('blur',()=>{keyboardHold=false;});
function resize(){width=stage.clientWidth;height=stage.clientHeight;worldWidth=Math.max(clamp(width/91,6.2,17),state==='browse'?3.8*width/height:0);const h=worldWidth*height/width;camera.left=-worldWidth/2;camera.right=worldWidth/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();renderer.setSize(width,height,false);}
new ResizeObserver(resize).observe(stage);resize();
function layout(dt,time){
 if(state==='browse'){
  if(returnHoldUntil&&time>returnHoldUntil){returnHoldUntil=0;if(!overStage)hovered=null;}
  const scrolling=!category&&!userPaused&&!overStage&&!pointerDown&&!keyboardHold&&time>resumeAt;
  velocity=THREE.MathUtils.damp(velocity,scrolling?autoScrollSpeed:0,7,dt);offset=mod(offset+velocity*dt,total);
  if(categoryMotion){categoryMotion.elapsed+=dt;const t=reduce.matches?1:Math.min(1,categoryMotion.elapsed/1.15);offset=THREE.MathUtils.lerp(categoryMotion.start,categoryMotion.end,smooth(t));if(t===1)categoryMotion=null;}
  categorySpread=THREE.MathUtils.damp(categorySpread,category?1:0,reduce.matches?100:7,dt);
  rigs.forEach(r=>{const x=positionX(r.index);const target=browsePosition(r);
   if(Math.abs(r.x-x)>total/2)r.group.position.copy(target);else r.group.position.lerp(target,1-Math.exp(-dt*10));r.x=x;r.group.quaternion.slerp(baseRotation,1-Math.exp(-dt*10));r.group.scale.setScalar(1);r.record.position.set(0,0,0);
  });
  if(hovered===null){const candidates=category?focusLayout.members:rigs;const nearest=candidates.reduce((a,b)=>Math.abs(positionX(a.index))<Math.abs(positionX(b.index))?a:b);if(selected!==nearest.index)select(nearest.index);}
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
  if(state==='closing'&&progress===0){setState('browse');$('#preview').hidden=true;active=null;snapshot=null;hovered=null;resumeAt=time+1100;if(returnKeyboardFocus)canvas.focus({preventScroll:true});else keyboardHold=false;}
 }
 currentBackground.lerp(targetBackground,1-Math.exp(-dt*3.8));root.style.setProperty('--bg','#'+currentBackground.getHexString());
}
function frame(time){raf=0;if(!visible)return;const dt=Math.min((time-lastTime)/1000||.016,.045);lastTime=time;layout(dt,time);renderer.render(scene,camera);raf=requestAnimationFrame(frame);}
function run(){if(!raf){lastTime=performance.now();raf=requestAnimationFrame(frame);}}
document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(!visible){cancelAnimationFrame(raf);raf=0;}else run();});
window.addEventListener('pageshow',e=>{if(e.persisted&&state==='playing'&&active)restoreCollection(projects[active.projectIndex].id);visible=!document.hidden;run();});
reduce.addEventListener('change',e=>{if(e.matches)userPaused=true;updateCategoryNavigation();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();visible=false;cancelAnimationFrame(raf);$('#fallback').hidden=false;});
rigs.forEach(r=>{r.x=positionX(r.index);r.group.position.copy(browsePosition(r));});
$('#collection-range').textContent='THE RECORD COLLECTION / 01—'+String(works.length).padStart(2,'0');
select(0);updateCategoryNavigation();
const initialQuery=new URLSearchParams(location.search),returnId=initialQuery.get('return');
if(categories.some(c=>c.id===initialQuery.get('category')))chooseCategory(initialQuery.get('category'),true);
if(category)rigs.forEach(r=>{r.x=positionX(r.index);r.group.position.copy(browsePosition(r));});
if(returnId)restoreCollection(returnId);
$('#loading').hidden=true;$('#fallback').hidden=true;document.body.dataset.ready='true';run();
