import * as THREE from './vendor/three.module.min.js';
import { createTreasure } from './vault-treasure.js';
import { HDRLoader } from './vendor/HDRLoader.js';
import { createVaultReveal } from './vault-reveal.js';
import { createVaultUI } from './vault-ui.js';
import { EffectComposer } from './vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/addons/postprocessing/OutputPass.js';

// Local CC0 PBR steel maps and a captured HDR studio environment.
export async function createVault(stage) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const textureLoader = new THREE.TextureLoader();
  const [albedo, normal, roughness, metalness, hdr] = await Promise.all([
    ...['Color','NormalGL','Roughness','Metalness'].map(map => textureLoader.loadAsync(new URL(`./assets/metal/Metal012_2K-JPG_${map}.jpg`, import.meta.url).href)),
    new HDRLoader().loadAsync(new URL('./assets/hdr/studio_small_09_2k.hdr', import.meta.url).href)
  ]);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x08090c, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'vault-canvas';
  stage.prepend(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 60);
  const model = new THREE.Group(); scene.add(model);

  // PMREM filters the HDR radiance at different roughness levels for PBR IBL.
  const pmrem = new THREE.PMREMGenerator(renderer);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const environment = pmrem.fromEquirectangular(hdr);
  scene.environment = environment.texture;
  scene.environmentRotation.set(0, 1.45, 0);
  scene.environmentIntensity = .24;
  hdr.dispose(); pmrem.dispose();
  const pbrTextures = [albedo, normal, roughness, metalness];
  albedo.colorSpace = THREE.SRGBColorSpace;
  // Scalar and normal maps stay in linear data space, never sRGB.
  for (const texture of pbrTextures) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  const steelMaps = {envMap:environment.texture,envMapRotation:new THREE.Euler(0,2.0,0),map:albedo,normalMap:normal,roughnessMap:roughness,metalnessMap:metalness,metalness:1};
  const metal = new THREE.MeshPhysicalMaterial({...steelMaps,color:'#d8dce2',roughness:.78,normalScale:new THREE.Vector2(.23,.23),anisotropy:.35,envMapIntensity:.48});
  const chrome = new THREE.MeshPhysicalMaterial({...steelMaps,color:'#f2f4f8',roughness:.30,normalScale:new THREE.Vector2(.055,.055),anisotropy:.2,envMapIntensity:.60});
  const darkMetal = new THREE.MeshPhysicalMaterial({...steelMaps,color:'#a3aab4',roughness:.92,normalScale:new THREE.Vector2(.18,.18),envMapIntensity:.38});
  // Preserve measured roughness variation while setting the manufactured finish.
  // The source is highly polished; the large door uses a satin finish.
  function setFinish(material, base, variation) {
    material.onBeforeCompile = shader => {
      shader.uniforms.finishBase = {value:base};
      shader.uniforms.finishVariation = {value:variation};
      shader.fragmentShader = 'uniform float finishBase; uniform float finishVariation;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = clamp(finishBase + finishVariation * roughnessFactor, 0.04, 1.0);');
    };
    material.customProgramCacheKey = () => 'vault-steel-finish';
  }
  setFinish(metal, .36, .55);
  setFinish(chrome, .13, .55);
  setFinish(darkMetal, .42, .65);
  // Satin silver for the rods: retain PBR shading without violet color spill.
  const rodSteel = new THREE.MeshPhysicalMaterial({...steelMaps,color:'#e0e2e5',roughness:.8,normalScale:new THREE.Vector2(.07,.07),envMapIntensity:.65});
  setFinish(rodSteel, .38, .45);
  const rodFinish = rodSteel.onBeforeCompile;
  rodSteel.onBeforeCompile = shader => {
    rodFinish(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
      'outgoingLight = vec3(dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)));\n#include <opaque_fragment>');
  };
  rodSteel.customProgramCacheKey = () => 'vault-neutral-steel-rods';

  const black = new THREE.MeshStandardMaterial({color:'#080a0f',metalness:.35,roughness:.55});
  const purple = new THREE.MeshStandardMaterial({color:'#5b1fa6',metalness:.65,roughness:.23});
  const led = new THREE.MeshStandardMaterial({color:'#5b1fa6',emissive:'#5b1fa6',emissiveIntensity:2.3,metalness:.2,roughness:.3});
  const innerLed = led.clone(); innerLed.emissiveIntensity=.35;
  const mesh = (geo,mat,parent=model,x=0,y=0,z=0) => {
    const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  };
  function disc(radius,depth,mat,parent,x,y,z,segments=96) {
    const m=mesh(new THREE.CylinderGeometry(radius,radius,depth,segments),mat,parent,x,y,z);m.rotation.x=Math.PI/2;return m;
  }
  function ring(inner,outer,depth,mat,parent,x=0,y=0,z=0) {
    const shape=new THREE.Shape();shape.absarc(0,0,outer,0,Math.PI*2,false);
    const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);
    return mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.012,bevelThickness:.012,curveSegments:80}),mat,parent,x,y,z);
  }
  function torus(radius,tube,mat,parent,x=0,y=0,z=0) {
    return mesh(new THREE.TorusGeometry(radius,tube,12,96),mat,parent,x,y,z);
  }
  function bar(a,b,r,mat,parent) {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);
    const m=mesh(new THREE.CylinderGeometry(r,r,direction.length(),16),mat,parent);
    m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return m;
  }
  function label(text,w,h,parent,x,y,z,color='#9da4b1',size=45) {
    const c=document.createElement('canvas');c.width=1024;c.height=128;
    const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`500 ${size}px Arial`;
    const measured=ctx.measureText(text).width;ctx.font=`500 ${Math.min(108,size*860/measured)}px Arial`;ctx.fillText(text,512,64);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    return mesh(new THREE.PlaneGeometry(w,h),material,parent,x,y,z);
  }

  // Recessed wall and a real tunnel behind the door.
  const wallShape=new THREE.Shape();wallShape.moveTo(-14,-8);wallShape.lineTo(14,-8);wallShape.lineTo(14,8);wallShape.lineTo(-14,8);wallShape.closePath();
  const wallHole=new THREE.Path();wallHole.absarc(0,0,1.79,0,Math.PI*2,true);wallShape.holes.push(wallHole);
  mesh(new THREE.ExtrudeGeometry(wallShape,{depth:.22,bevelEnabled:false,curveSegments:80}),new THREE.MeshStandardMaterial({color:'#10121a',metalness:.35,roughness:.72}),model,0,0,-.36);
  [-3.3,3.3].forEach(x=>mesh(new THREE.BoxGeometry(.014,15,.01),black,model,x,0,-.12));
  ring(1.72,2.02,.14,darkMetal,model,0,0,-.1);
  ring(1.73,1.94,.12,metal,model,0,0,.02);
  torus(1.97,.018,chrome,model,0,0,.05);
  torus(1.76,.023,chrome,model,0,0,.18);
  torus(1.724,.012,led,model,0,0,.08);
  ring(1.66,1.73,1.4,darkMetal,model,0,0,-1.4);
  torus(1.65,.018,innerLed,model,0,0,-1.18);
  disc(1.67,.08,black,model,0,0,-1.48);
  label('P R I V A T E   C O L L E C T I O N',1.3,.16,model,0,.72,-1.42,'#8f67c0',38);
  for(let i=0;i<24;i++) {
    const a=i*Math.PI/12,x=Math.cos(a)*1.855,y=Math.sin(a)*1.855;
    disc(.029,.015,chrome,model,x,y,.165,6);
    mesh(new THREE.BoxGeometry(.021,.004,.003),black,model,x,y,.176).rotation.z=a;
  }
  // Hinge pivot is on the left edge. Every door component rotates with it.
  const hinge=new THREE.Group();hinge.position.set(-1.66,0,.19);model.add(hinge);
  const door=new THREE.Group();door.position.x=1.66;hinge.add(door);
  disc(1.655,.28,darkMetal,door,0,0,0);
  disc(1.635,.07,chrome,door,0,0,.13);
  disc(1.605,.055,metal,door,0,0,.18);
  torus(1.60,.017,chrome,door,0,0,.214);
  ring(1.41,1.49,.024,darkMetal,door,0,0,.212);
  disc(1.395,.045,metal,door,0,0,.237);
  torus(1.38,.009,chrome,door,0,0,.265);
  torus(.73,.014,darkMetal,door,0,0,.267);
  // Layered rear armour, gasket and mechanical linkage stay solid when open.
  torus(1.585,.026,black,door,0,0,-.155);
  ring(1.43,1.57,.055,darkMetal,door,0,0,-.23);
  disc(1.60,.035,rodSteel,door,0,0,-.16);
  torus(1.48,.025,chrome,door,0,0,-.185);
  disc(.43,.08,darkMetal,door,0,0,-.21);
  disc(.22,.10,chrome,door,0,0,-.25);
  torus(.46,.018,chrome,door,0,0,-.26);
  for(let i=0;i<16;i++) {
    const a=i*Math.PI/8;
    disc(.035,.024,chrome,door,Math.cos(a)*1.49,Math.sin(a)*1.49,-.252,6);
  }
  const bolts=[];
  for(let i=0;i<8;i++) {
    const a=(i+.5)*Math.PI/4;
    const assembly=new THREE.Group();assembly.rotation.z=a;door.add(assembly);
    mesh(new THREE.BoxGeometry(.28,.15,.13),darkMetal,assembly,1.39,0,.26);
    const bolt=bar([1.39,0,.27],[1.77,0,.27],.062,rodSteel,assembly);bolts.push(bolt);
    mesh(new THREE.BoxGeometry(.69,.064,.055),rodSteel,assembly,.99,0,.28);
    mesh(new THREE.BoxGeometry(.25,.15,.11),darkMetal,assembly,1.29,0,-.25);
    bar([.33,0,-.29],[1.42,0,-.29],.045,rodSteel,assembly);
    disc(.075,.05,chrome,assembly,1.3,0,-.33,32);
    disc(.045,.025,chrome,door,Math.cos(a)*1.53,Math.sin(a)*1.53,.245,6);
  }
  for(let i=0;i<40;i++) {
    const a=i*Math.PI/20;
    const tick=mesh(new THREE.BoxGeometry(i%5===0?.006:.003,i%5===0?.055:.025,.003),chrome,door,Math.sin(a)*.81,Math.cos(a)*.81,.272);tick.rotation.z=-a;
  }
  label('V  A  U  L  T',.72,.11,door,0,.98,.275,'#b7bdc9',45);
  label('Nº 001   /   PRECISION ENGINEERED',.95,.085,door,0,-1.02,.275,'#9ba1ad',31);
  disc(.47,.1,black,door,0,0,.3);disc(.32,.12,chrome,door,0,0,.36);
  const wheel=new THREE.Group();wheel.position.z=.51;door.add(wheel);
  torus(.58,.052,chrome,wheel);
  for(let i=0;i<3;i++) {
    const a=i*Math.PI*2/3+Math.PI/2;
    bar([0,0,0],[Math.cos(a)*.58,Math.sin(a)*.58,0],.044,rodSteel,wheel);
    const grip=mesh(new THREE.SphereGeometry(.064,20,12),chrome,wheel,Math.cos(a)*.58,Math.sin(a)*.58,0);grip.scale.z=.6;
  }
  disc(.18,.12,chrome,wheel,0,0,.015);disc(.125,.014,purple,wheel,0,0,.082);
  label('V',.14,.10,wheel,0,0,.093,'#eadbff',86);
  [-.91,.91].forEach(y=>{
    mesh(new THREE.BoxGeometry(.32,.28,.28),darkMetal,model,-1.7,y,.13);
    const h=mesh(new THREE.CylinderGeometry(.105,.105,.5,32),chrome,model,-1.66,y,.25);
    [-.20,.20].forEach(dy=>torus(.107,.012,darkMetal,model,-1.66,y+dy,.25).rotation.x=Math.PI/2);
    mesh(new THREE.BoxGeometry(.23,.19,.12),metal,door,-1.52,y,.12);
  });

  scene.add(new THREE.AmbientLight('#afb9d9',.06));
  function spot(color,intensity,x,y,z,target,angle) {
    const light=new THREE.SpotLight(color,intensity,30,angle,.65,1.4);light.position.set(x,y,z);light.target.position.set(...target);scene.add(light,light.target);return light;
  }
  const key=spot('#eff3ff',45,-3.5,5,6,[0,0,0],.65);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.0002;key.shadow.normalBias=.025;key.shadow.radius=4;
  spot('#bdb5ee',18,4,1,4,[0,0,0],.7);
  spot('#ffffff',24,0,5,-.3,[0,0,0],.7);
  // Neutral softbox lights the rear steel as it swings toward the viewer.
  spot('#f4f1eb',23,-4.5,3.5,5,[-2,0,1.5],.85);
  const innerLight=new THREE.PointLight('#7940c2',0,5,1.3);innerLight.position.set(0,.3,-.65);scene.add(innerLight);
  const bounce=new THREE.PointLight('#5b1fa6',3,7,1.6);bounce.position.set(2,-1,2);scene.add(bounce);

  const treasure = createTreasure(scene);
  const reveal = createVaultReveal(scene,camera,stage,Math.min(8,renderer.capabilities.getMaxAnisotropy()));
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene,camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1,1), .65, .6, .22);
  // Bloom only the violet energy, keeping steel highlights and paper crisp.
  bloom.materialHighPassFilter.fragmentShader = bloom.materialHighPassFilter.fragmentShader.replace(
    'float v = luminance( texel.xyz );',
    'float v = max(0.0, min(texel.r, texel.b) - texel.g * 1.2); texel.rgb = vec3(.38, .065, 1.0) * v;'
  );
  const outputPass = new OutputPass();
  composer.addPass(renderPass);composer.addPass(bloom);composer.addPass(outputPass);

  let cameraRestZ=7.1;
  let width=0,height=0,raf=0,disposed=false,started=null,opening=0,wheelAngle=0,boltPull=0;
  let presentation='auto',paperPlayback=null;
  const ui=createVaultUI(renderer,action);
  function action(type) {
    if(type==='open'&&started===null){unlock();return;}
    if(type==='reset'){reset();return;}
    if(type==='close'&&started!==null) {
      presentation='closing';paperPlayback={from:14,to:8.2,start:performance.now(),duration:reduced?1:1500};
    }
    if(type==='read'&&presentation==='closed') {
      presentation='reopening';paperPlayback={from:8.2,to:14,start:performance.now(),duration:reduced?1:4200};
    }
  }
  const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
  function resize() {
    width=stage.clientWidth;height=stage.clientHeight;renderer.setSize(width,height,false);composer.setSize(width,height);ui.resize(width,height);
    camera.aspect=width/height;
    cameraRestZ=Math.max(7.1,1.97/(Math.tan(THREE.MathUtils.degToRad(19))*camera.aspect));
    camera.position.set(.85,.48,cameraRestZ+opening*1.25);
    camera.lookAt(0,0,0);camera.updateProjectionMatrix();
  }
  const observer=new ResizeObserver(resize);observer.observe(stage);resize();
  function render(now) {
    if(disposed)return;
    let uiMode='locked',elapsed=0;
    if(started!==null) {
      const t=reduced?15:(now-started)/1000;elapsed=t;
      wheelAngle=-Math.PI*1.5*ease(t/1.8);
      boltPull=ease((t-1.3)/.85);
      opening=ease((t-2.3)/3.1);
      // A small dolly back gives the thick swinging door natural perspective.
      camera.position.z=cameraRestZ+opening*1.25;
      camera.lookAt(0,0,0);camera.updateMatrixWorld();
      treasure.update(t,reduced);
      let paperTime=presentation==='closed'?8.2:t;
      if(paperPlayback) {
        const progress=Math.min(1,(now-paperPlayback.start)/paperPlayback.duration);
        paperTime=THREE.MathUtils.lerp(paperPlayback.from,paperPlayback.to,ease(progress));
        if(progress>=1){presentation=presentation==='closing'?'closed':'reading';paperPlayback=null;}
      } else if(presentation==='reading')paperTime=14;
      reveal.update(paperTime,opening,reduced,t);
      uiMode=presentation==='closed'?'closed':presentation==='reading'||(presentation==='auto'&&t>=13.8)?'reading':'opening';
      stage.dataset.phase=uiMode==='opening'?(paperTime<6.4?'opening':paperTime<8.8?'envelope-flight':paperTime<9.6?'flap-opening':paperTime<11.05?'letter-emerging':'letter-unfolding'):uiMode;
    } else {
      // A smooth reverse for replay, with the hinge returning before the bolts extend.
      opening*=reduced?0:.88;wheelAngle*=reduced?0:.88;
      if(opening<.025)boltPull*=reduced?0:.84;
    }
    if(started===null){camera.position.z=cameraRestZ+opening*1.25;camera.lookAt(0,0,0);camera.updateMatrixWorld();}
    hinge.rotation.y=-opening*2.08;wheel.rotation.z=wheelAngle;
    bolts.forEach(b=>b.position.x=1.58-boltPull*.25);
    innerLight.intensity=opening*3.5;innerLed.emissiveIntensity=.35+opening*2.4;
    composer.render();
    ui.render(uiMode,elapsed);
    raf=requestAnimationFrame(render);
  }
  composer.render();ui.render('locked',0);
  stage.dataset.phase='locked';
  stage.classList.add('webgl-ready');raf=requestAnimationFrame(render);
  const unlock=()=>{treasure.reset();reveal.reset();presentation='auto';paperPlayback=null;started=performance.now();};
  const reset=()=>{started=null;presentation='auto';paperPlayback=null;stage.dataset.phase='locked';treasure.reset();reveal.reset();};
  window.addEventListener('vault:unlock',unlock);window.addEventListener('vault:reset',reset);
  function visibility(){if(document.hidden){cancelAnimationFrame(raf);}else{cancelAnimationFrame(raf);raf=requestAnimationFrame(render);}}
  document.addEventListener('visibilitychange',visibility);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(raf);stage.classList.remove('webgl-ready');});
  canvas.addEventListener('webglcontextrestored',()=>{stage.classList.add('webgl-ready');cancelAnimationFrame(raf);raf=requestAnimationFrame(render);});
  return {canvas,open:unlock,reset,dispose(){ui.dispose();reveal.dispose();bloom.dispose();outputPass.dispose();composer.dispose();treasure.dispose();disposed=true;cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener('vault:unlock',unlock);window.removeEventListener('vault:reset',reset);document.removeEventListener('visibilitychange',visibility);scene.traverse(o=>{o.geometry?.dispose();});[metal,chrome,rodSteel,darkMetal,black,purple,led,innerLed].forEach(m=>m.dispose());pbrTextures.forEach(texture=>texture.dispose());environment.dispose();renderer.dispose();canvas.remove();}};
}
