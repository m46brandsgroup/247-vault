import * as THREE from './vendor/three.module.min.js';

const smooth = (a,b,t) => {
  const v=THREE.MathUtils.clamp((t-a)/(b-a),0,1);
  return v*v*v*(v*(v*6-15)+10);
};

export function createVaultReveal(scene,camera,stage,anisotropy=1) {
  const glowUniforms={time:{value:0},energy:{value:0},tint:{value:new THREE.Color('#7932db')}};
  const glowMaterial=new THREE.ShaderMaterial({
    uniforms:glowUniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`
      varying vec2 vUv; uniform float time; uniform float energy; uniform vec3 tint;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        vec2 p=vUv*2.0-1.0;float r=length(p);
        float cloud=noise(p*3.4+vec2(time*.08,-time*.12))*.6+noise(p*7.0-time*.09)*.4;
        float edge=1.0-smoothstep(.25,1.0,r);
        float core=exp(-r*r*5.5);
        // Soft, domain-warped ribbons share the cavity light's hue and falloff.
        float angle=atan(p.y,p.x);
        float waveRadius=.53+.075*sin(angle*3.0+time*.28)+.045*sin(angle*5.0-time*.19);
        float ribbon=exp(-pow((r-waveRadius)/.065,2.0));
        float veil=exp(-pow((r-waveRadius-.12)/.14,2.0));
        float drift=.6+.4*sin(angle*2.0-time*.34);
        cloud+=ribbon*drift*.65+veil*.18;
        vec3 color=tint*(1.1+cloud*1.7)+vec3(.35,.12,.7)*core*.7;
        gl_FragColor=vec4(color*energy,edge*(.28+cloud*.25));
      }`
  });
  const glowGeometry=new THREE.PlaneGeometry(3.15,3.15);
  const glowLayers=[];
  // These sources sit behind the steel door and are physically occluded by it.
  for(const z of [-1.32,-.87,-.36]) {
    const glow=new THREE.Mesh(glowGeometry,glowMaterial);glow.position.set(0,0,z);scene.add(glow);glowLayers.push(glow);
  }
  const beamMaterial=new THREE.ShaderMaterial({
    uniforms:glowUniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 vUv; varying vec3 vNormal; varying vec3 vView;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;uniform vec3 tint;uniform float energy;uniform float time;
      void main(){float rim=pow(abs(dot(normalize(vNormal),normalize(vView))),1.7);float endFade=sin(vUv.y*3.14159);float rays=.75+.25*sin(vUv.x*48.0+time*.1);gl_FragColor=vec4(tint*1.7*energy,endFade*endFade*rim*rays*.045);}`
  });
  const beamGeometry=new THREE.CylinderGeometry(.9,1.9,2.9,64,1,true);
  const beam=new THREE.Mesh(beamGeometry,beamMaterial);beam.rotation.x=Math.PI/2;beam.position.z=1.12;scene.add(beam);

  // A wide translucent veil curls behind the letter, beyond the vault rim.
  const veilMaterial=new THREE.ShaderMaterial({
    uniforms:glowUniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:glowMaterial.vertexShader,
    fragmentShader:`varying vec2 vUv;uniform float time;uniform float energy;uniform vec3 tint;
      void main(){vec2 p=vUv*2.0-1.0;float a=atan(p.y,p.x);float r=length(p);
        float curve=.69+.07*sin(a*3.0-time*.21)+.04*sin(a*5.0+time*.13);
        float silk=exp(-pow((r-curve)/.065,2.0))*.32+exp(-pow((r-curve+.08)/.17,2.0))*.2;
        float fade=(1.0-smoothstep(.8,1.0,r))*(.55+.45*sin(a*2.0+time*.25));
        gl_FragColor=vec4(tint*1.8,silk*fade*energy);}`
  });
  const veilGeometry=new THREE.PlaneGeometry(8.8,5.6);
  const veil=new THREE.Mesh(veilGeometry,veilMaterial);veil.position.z=.2;scene.add(veil);

  // Real tri-fold paper: three thin meshes, two independent crease pivots.
  const paperRoot=new THREE.Group();paperRoot.name='flying-letter';paperRoot.visible=false;scene.add(paperRoot);
  const sheetWidth=1.7, panelHeight=.8;
  const atlas=document.createElement('canvas');atlas.width=2048;atlas.height=3000;
  const ctx=atlas.getContext('2d');
  // Draw at double resolution while preserving the letter layout.
  ctx.scale(2,2);
  ctx.fillStyle='#f5eedf';ctx.fillRect(0,0,1024,1500);
  let seed=19;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  for(let i=0;i<70000;i++){ctx.fillStyle=`rgba(105,81,45,${random()*.045})`;ctx.fillRect(random()*1024,random()*1500,1,1);}
  ctx.fillStyle='#000000';ctx.font='18px Arial';ctx.fillText('P R I V A T E   C O R R E S P O N D E N C E',95,95);
  ctx.textAlign='right';ctx.fillText('Nº 001',929,95);ctx.textAlign='left';
  ctx.strokeStyle='#c8b9ab';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(95,130);ctx.lineTo(929,130);ctx.stroke();
  ctx.beginPath();ctx.arc(512,225,41,0,Math.PI*2);ctx.strokeStyle='#8261a0';ctx.stroke();
  ctx.textAlign='center';ctx.font='italic 46px Georgia';ctx.fillStyle='#000000';ctx.fillText('V',512,242);
  ctx.textAlign='left';ctx.fillStyle='#000000';ctx.font='italic 61px Georgia';ctx.fillText('A note, just for you.',95,375);
  ctx.font='44px Arial';
  let y=485;
  function paragraph(text) {
    let line='';for(const word of text.split(' ')){const test=line+word+' ';if(ctx.measureText(test).width>820&&line){ctx.fillText(line,95,y);y+=58;line=word+' ';}else line=test;}
    ctx.fillText(line,95,y);y+=84;
  }
  paragraph('Dear friend,');
  paragraph('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.');
  paragraph('Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.');
  ctx.font='30px Georgia';ctx.fillText('With warm regards,',95,1325);ctx.font='italic 55px Georgia';ctx.fillText('The Vault',95,1400);
  // Fine crease shadows remain visible when the paper is fully flat.
  for(const crease of [500,1000]) {
    const gradient=ctx.createLinearGradient(0,crease-7,0,crease+7);gradient.addColorStop(0,'rgba(100,75,40,0)');gradient.addColorStop(.5,'rgba(100,75,40,.12)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,crease-7,1024,14);
  }
  const blank=new THREE.MeshStandardMaterial({color:'#eee3ce',roughness:.92,metalness:0});
  const backCanvas=document.createElement('canvas');backCanvas.width=1024;backCanvas.height=480;
  const backContext=backCanvas.getContext('2d');backContext.fillStyle='#eee3ce';backContext.fillRect(0,0,1024,480);
  backContext.strokeStyle='#bca98b';backContext.lineWidth=2;backContext.strokeRect(28,28,968,424);
  backContext.textAlign='center';backContext.fillStyle='#755287';backContext.font='16px Arial';backContext.fillText('P R I V A T E   C O R R E S P O N D E N C E',512,100);
  backContext.beginPath();backContext.arc(512,235,60,0,Math.PI*2);backContext.fillStyle='#5b1fa6';backContext.fill();
  backContext.fillStyle='#f4eadd';backContext.font='italic 64px Georgia';backContext.fillText('V',512,258);
  backContext.fillStyle='#755287';backContext.font='18px Georgia';backContext.fillText('A note, just for you.',512,370);
  const backTexture=new THREE.CanvasTexture(backCanvas);backTexture.colorSpace=THREE.SRGBColorSpace;backTexture.center.set(.5,.5);backTexture.rotation=Math.PI;
  const printedBack=new THREE.MeshStandardMaterial({map:backTexture,roughness:.9,metalness:0});
  const paperMaterials=[blank,printedBack],textures=[backTexture];
  const paperGeometry=new THREE.BoxGeometry(sheetWidth,panelHeight,.006,1,1,1);
  function panel(index,parent,y) {
    const texture=new THREE.CanvasTexture(atlas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=anisotropy;texture.repeat.set(1,1/3);texture.offset.set(0,(2-index)/3);textures.push(texture);
    const printed=new THREE.MeshStandardMaterial({map:texture,color:'#ffffff',roughness:1,metalness:0,envMapIntensity:0});paperMaterials.push(printed);
    const mesh=new THREE.Mesh(paperGeometry,[blank,blank,blank,blank,printed,printedBack]);mesh.position.y=y;mesh.layers.set(2);parent.add(mesh);return mesh;
  }
  panel(1,paperRoot,0);
  const upper=new THREE.Group();upper.position.set(0,panelHeight/2,.012);paperRoot.add(upper);panel(0,upper,panelHeight/2);
  const lower=new THREE.Group();lower.position.set(0,-panelHeight/2,.023);paperRoot.add(lower);panel(2,lower,-panelHeight/2);
  camera.layers.enable(2);
  const paperLight=new THREE.DirectionalLight('#fff4e2',2.2);paperLight.layers.set(2);scene.add(paperLight,paperLight.target);
  const paperFill=new THREE.AmbientLight('#f4edff',.65);paperFill.layers.set(2);scene.add(paperFill);
  // A separate, hollow envelope. Front pockets occlude the letter until it
  // physically slides up through the open top. The flap has its own hinge.
  const envelopeRoot=new THREE.Group();envelopeRoot.name='flying-envelope';envelopeRoot.visible=false;scene.add(envelopeRoot);
  const envelopeMaterials=[],envelopeGeometries=[];
  const envelopePaper=new THREE.MeshStandardMaterial({color:'#e9dcc5',roughness:.82,metalness:0,side:THREE.DoubleSide});
  const envelopeLining=new THREE.MeshStandardMaterial({color:'#8e7999',roughness:.94,side:THREE.DoubleSide});
  const envelopeFront=new THREE.MeshStandardMaterial({color:'#f2e8d7',roughness:.88,side:THREE.DoubleSide});
  const wax=new THREE.MeshPhysicalMaterial({color:'#5b1fa6',roughness:.3,metalness:.15,clearcoat:.7});
  envelopeMaterials.push(envelopePaper,envelopeLining,envelopeFront,wax);
  function envelopeMesh(geometry,material,parent=envelopeRoot,x=0,y=0,z=0){envelopeGeometries.push(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.layers.set(2);parent.add(mesh);return mesh;}
  function triangle(points,material,parent=envelopeRoot,z=.06){const shape=new THREE.Shape();shape.moveTo(...points[0]);points.slice(1).forEach(p=>shape.lineTo(...p));shape.closePath();return envelopeMesh(new THREE.ShapeGeometry(shape),material,parent,0,0,z);}
  const ew=2.08,eh=1.24;
  envelopeMesh(new THREE.BoxGeometry(ew,eh,.018),envelopePaper,envelopeRoot,0,0,-.055);
  envelopeMesh(new THREE.PlaneGeometry(ew-.04,eh-.04),envelopeLining,envelopeRoot,0,0,-.043);
  triangle([[-ew/2,-eh/2],[-ew/2,eh/2],[.08,-.06]],envelopePaper);
  triangle([[ew/2,eh/2],[ew/2,-eh/2],[-.08,-.06]],envelopePaper);
  triangle([[-ew/2,-eh/2],[ew/2,-eh/2],[0,.12]],envelopeFront,envelopeRoot,.066);
  // Thin seams catch light around the envelope's crossed pocket folds.
  const seamMaterial=new THREE.LineBasicMaterial({color:'#b9a98d',transparent:true,opacity:.65});envelopeMaterials.push(seamMaterial);
  for(const points of [[[-ew/2,eh/2,.069],[0,-.08,.069],[ew/2,eh/2,.069]],[[-ew/2,-eh/2,.07],[0,.12,.07],[ew/2,-eh/2,.07]]]){
    const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));envelopeGeometries.push(geometry);const line=new THREE.Line(geometry,seamMaterial);line.layers.set(2);envelopeRoot.add(line);
  }
  const flap=new THREE.Group();flap.position.set(0,eh/2,.078);envelopeRoot.add(flap);
  triangle([[-ew/2,0],[ew/2,0],[0,-.77]],envelopeFront,flap,0);
  const seal=envelopeMesh(new THREE.CylinderGeometry(.145,.145,.025,48),wax,flap,0,-.69,.02);seal.rotation.x=Math.PI/2;
  const sealCanvas=document.createElement('canvas');sealCanvas.width=sealCanvas.height=128;const sealContext=sealCanvas.getContext('2d');sealContext.fillStyle='#ead7bb';sealContext.textAlign='center';sealContext.textBaseline='middle';sealContext.font='italic 82px Georgia';sealContext.fillText('V',64,67);
  const sealTexture=new THREE.CanvasTexture(sealCanvas);sealTexture.colorSpace=THREE.SRGBColorSpace;textures.push(sealTexture);
  const sealMarkMaterial=new THREE.MeshBasicMaterial({map:sealTexture,transparent:true,depthWrite:false});envelopeMaterials.push(sealMarkMaterial);
  const sealMark=envelopeMesh(new THREE.PlaneGeometry(.19,.19),sealMarkMaterial,flap,0,-.69,.036);
  const dimMaterial=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    uniforms:{reveal:{value:0}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec2 vUv;uniform float reveal;
      void main(){
        vec2 p=(vUv-.5)*vec2(2.1,1.7);
        float center=1.0-smoothstep(.22,1.08,length(p));
        float shadow=mix(.18,.94,center);
        gl_FragColor=vec4(.008,.006,.014,shadow*reveal);
      }`
  });
  const dimGeometry=new THREE.PlaneGeometry(1,1),dim=new THREE.Mesh(dimGeometry,dimMaterial);dim.renderOrder=4;scene.add(dim);
  const flightStart=new THREE.Vector3(0,-.12,-.8),flightEnd=new THREE.Vector3(),paperEnd=new THREE.Vector3(),extracted=new THREE.Vector3(),faceCamera=new THREE.Quaternion(),twist=new THREE.Quaternion();
  function update(time,opening,reduced=false,ambientTime=time) {
    const released=smooth(.02,.55,opening);
    glowUniforms.time.value=reduced?0:ambientTime;
    glowUniforms.energy.value=released*(1.1-.5*smooth(8.8,13.6,ambientTime));
    beam.visible=opening>.08;veil.visible=opening>.08;
    envelopeRoot.visible=time>=6.4&&time<12.8;
    paperRoot.visible=time>=8.8;
    dimMaterial.uniforms.reveal.value=smooth(11.8,13.6,time);
    dim.visible=time>=11.8;
    const aspect=camera.aspect,tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    dim.position.set(0,0,-5.4).applyQuaternion(camera.quaternion).add(camera.position);dim.quaternion.copy(camera.quaternion);dim.scale.set(2*tangent*5.4*aspect,2*tangent*5.4,1);
    if(time<6.4)return;
    const flight=smooth(6.4,8.2,time),slide=smooth(9.6,10.95,time),present=smooth(10.9,12.5,time);
    const envelopeDistance=5.0,envWorldHeight=2*tangent*envelopeDistance;
    const envelopePixels=Math.min(430,stage.clientWidth*.88),envelopeScale=envelopePixels/stage.clientWidth*envWorldHeight*aspect/ew;
    flightEnd.set(0,-.1,-envelopeDistance).applyQuaternion(camera.quaternion).add(camera.position);
    envelopeRoot.position.lerpVectors(flightStart,flightEnd,flight);
    envelopeRoot.position.y+=Math.sin(flight*Math.PI)*.28-slide*.43;
    faceCamera.copy(camera.quaternion);twist.setFromEuler(new THREE.Euler((1-flight)*.22,(1-flight)*-.48,Math.sin(flight*Math.PI)*-.22));
    envelopeRoot.quaternion.copy(faceCamera).multiply(twist);
    envelopeRoot.scale.setScalar(THREE.MathUtils.lerp(.68,envelopeScale,flight));
    flap.rotation.x=-Math.PI*smooth(8.8,9.65,time);
    const sealScale=1-smooth(8.35,8.85,time);seal.scale.setScalar(sealScale);sealMark.scale.setScalar(sealScale);
    const envelopeOpacity=1-smooth(11.6,12.8,time);
    for(const material of envelopeMaterials){material.transparent=true;material.opacity=envelopeOpacity*(material===seamMaterial?.65:1);material.depthWrite=envelopeOpacity>.99;}
    envelopeRoot.updateMatrixWorld(true);
    extracted.set(0,THREE.MathUtils.lerp(-.1,1.12,slide),THREE.MathUtils.lerp(.008,.14,slide)).applyMatrix4(envelopeRoot.matrixWorld);
    const letterHeight=Math.min(740,stage.clientHeight*.76,(stage.clientWidth-36)*1500/1024);
    const letterWidth=letterHeight*1024/1500;
    const distance=4.4,worldHeight=2*tangent*distance;
    const targetWidth=letterWidth/stage.clientWidth*worldHeight*aspect,targetHeight=letterHeight/stage.clientHeight*worldHeight;
    paperEnd.set(0,0,-distance).applyQuaternion(camera.quaternion).add(camera.position);
    paperRoot.position.lerpVectors(extracted,paperEnd,present);
    paperRoot.quaternion.copy(envelopeRoot.quaternion).slerp(faceCamera,present);
    const foldedScale=envelopeRoot.scale.x*.98;
    paperRoot.scale.set(THREE.MathUtils.lerp(foldedScale,targetWidth/sheetWidth,present),THREE.MathUtils.lerp(foldedScale,targetHeight/(panelHeight*3),present),1);
    upper.rotation.x=-Math.PI*(1-smooth(11.05,12.5,time));
    lower.rotation.x=Math.PI*(1-smooth(11.8,13.6,time));
    upper.position.z=.012*(1-smooth(11.05,12.5,time));lower.position.z=.023*(1-smooth(11.8,13.6,time));
    paperLight.position.copy(camera.position).add(new THREE.Vector3(-2,3,1));paperLight.target.position.copy(paperRoot.position);
  }
  function reset(){paperRoot.visible=false;envelopeRoot.visible=false;dim.visible=false;glowUniforms.energy.value=0;beam.visible=false;veil.visible=false;}
  function dispose(){reset();veil.removeFromParent();veilGeometry.dispose();veilMaterial.dispose();envelopeRoot.removeFromParent();dim.removeFromParent();dimGeometry.dispose();dimMaterial.dispose();envelopeGeometries.forEach(g=>g.dispose());envelopeMaterials.forEach(m=>m.dispose());paperRoot.removeFromParent();beam.removeFromParent();glowLayers.forEach(m=>m.removeFromParent());paperLight.removeFromParent();paperLight.target.removeFromParent();paperFill.removeFromParent();[glowGeometry,beamGeometry,paperGeometry].forEach(g=>g.dispose());[glowMaterial,beamMaterial,...paperMaterials].forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
  return {update,reset,dispose};
}
