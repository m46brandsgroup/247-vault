import * as THREE from './vendor/three.module.min.js';

// Deterministic, fixed-step gravity and floor collisions keep replay and slow
// devices consistent. Geometry and materials are shared across the whole spill.
export function createTreasure(scene) {
  const floorY = -2.28;
  const root = new THREE.Group();
  root.name = 'vault-treasure';
  scene.add(root);
  const chipPurple = new THREE.MeshPhysicalMaterial({color:'#5b1fa6',metalness:.35,roughness:.27,clearcoat:.65,clearcoatRoughness:.18,envMapIntensity:1.2});
  const chipEdge = new THREE.MeshStandardMaterial({color:'#b78be7',metalness:.65,roughness:.24,envMapIntensity:1.3});
  const amethyst = new THREE.MeshPhysicalMaterial({color:'#782fc1',metalness:.12,roughness:.13,transmission:.18,thickness:.25,ior:1.85,clearcoat:1,clearcoatRoughness:.08,flatShading:true,envMapIntensity:2.2,emissive:'#5b1fa6',emissiveIntensity:.18});
  const paleGem = amethyst.clone();paleGem.color.set('#a165e0');
  const floorMaterial = new THREE.MeshStandardMaterial({color:'#11101a',metalness:.25,roughness:.65,envMap:scene.environment,envMapIntensity:.025});
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(35,24),floorMaterial);
  floor.rotation.x=-Math.PI/2;floor.position.set(0,floorY,6);floor.receiveShadow=true;scene.add(floor);
  const coinGeometry = new THREE.CylinderGeometry(.13,.13,.029,40);
  const rimGeometry = new THREE.TorusGeometry(.108,.006,6,36);
  rimGeometry.rotateX(Math.PI/2);
  const stampGeometry = new THREE.BoxGeometry(.015,.005,.09);
  const profile = [new THREE.Vector2(0,-.15),new THREE.Vector2(.16,.015),new THREE.Vector2(.16,.035),new THREE.Vector2(.085,.115),new THREE.Vector2(0,.115)];
  const gemGeometry = new THREE.LatheGeometry(profile,8).toNonIndexed();gemGeometry.computeVertexNormals();
  const geometries = [coinGeometry,rimGeometry,stampGeometry,gemGeometry,floor.geometry];
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
  const ctx=shadowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(0,0,0,.65)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas);
  const shadowGeometry=new THREE.PlaneGeometry(.48,.48);geometries.push(shadowGeometry);
  const items=[];let seed=817;
  const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  function add(geometry,material,parent,x=0,y=0,z=0) {
    const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  for(let i=0;i<96;i++) {
    const isGem=i%3===0;
    const object=new THREE.Group();root.add(object);object.visible=false;
    const scale=.8+random()*.5;object.scale.setScalar(scale);
    if(isGem) add(gemGeometry,i%2?amethyst:paleGem,object);
    else {
      add(coinGeometry,chipPurple,object);
      for(const sign of [-1,1]) {
        add(rimGeometry,chipEdge,object,0,sign*.017,0);
        // Raised V mint mark on each face.
        add(stampGeometry,chipEdge,object,-.022,sign*.017,0).rotation.y=-.45;
        add(stampGeometry,chipEdge,object,.022,sign*.017,0).rotation.y=.45;
      }
    }
    const shadow=new THREE.Mesh(shadowGeometry,new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,opacity:.4}));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=floorY+.003;shadow.visible=false;root.add(shadow);
    const side=i%2?1:-1;
    const initialPosition=new THREE.Vector3(side*(.12+random()*.48),-.25+random()*.45,-.45+random()*.15);
    const initialVelocity=new THREE.Vector3(side*(.22+random()*.85),.7+random()*1.5,.9+random()*.65);
    const rotation=new THREE.Euler(random()*Math.PI,random()*Math.PI,random()*Math.PI);
    const spin=new THREE.Vector3((random()-.5)*12,(random()-.5)*14,(random()-.5)*12);
    items.push({object,shadow,isGem,initialPosition,initialVelocity,rotation,spin,velocity:new THREE.Vector3(),delay:4.5+i*.022+random()*.12,simulated:0,impacts:0,rest:0,scale,settled:false,settleRotation:new THREE.Quaternion().setFromEuler(new THREE.Euler(0,random()*Math.PI*2,0))});
  }
  function reset() {
    for(const item of items) {
      item.object.visible=item.shadow.visible=false;
      item.object.position.copy(item.initialPosition);item.object.rotation.copy(item.rotation);
      item.velocity.copy(item.initialVelocity);item.simulated=0;item.impacts=0;item.rest=0;item.settled=false;
    }
  }
  reset();
  function step(item,dt) {
    const {object,velocity,spin}=item;
    if(item.settled)return;
    // Collision clearance shrinks as coins settle from an edge onto a face.
    const radius=item.isGem?.15*item.scale:(.13*(1-item.rest)+.019*item.rest)*item.scale;
    velocity.y-=6.8*dt;
    object.position.addScaledVector(velocity,dt);
    if(item.rest===0){object.rotation.x+=spin.x*dt;object.rotation.y+=spin.y*dt;object.rotation.z+=spin.z*dt;}
    if(object.position.y<=floorY+radius) {
      object.position.y=floorY+radius;
      if(velocity.y<-.2){item.impacts++;velocity.y=-velocity.y*(item.isGem?.28:.38);}
      else velocity.y=0;
      const friction=Math.exp(-9*dt);velocity.x*=friction;velocity.z*=friction;
      if(item.impacts>=3||Math.abs(velocity.y)<.35)item.rest=Math.min(1,item.rest+dt*3.5);
    }
    if(item.rest>0) {
      object.quaternion.slerp(item.settleRotation,1-Math.exp(-10*dt));
      velocity.x*=Math.exp(-4*dt);velocity.z*=Math.exp(-4*dt);
      if(item.rest>=1&&velocity.lengthSq()<.015) {
        item.settled=true;object.quaternion.copy(item.settleRotation);
        object.position.y=floorY+(item.isGem?.15:.019)*item.scale;
      }
    }
  }
  function update(elapsed,reduced=false) {
    for(const item of items) {
      const age=(reduced?15:elapsed)-item.delay;
      if(age<0)continue;
      item.object.visible=item.shadow.visible=true;
      const target=Math.min(age,10);
      while(item.simulated+1/120<=target&&!item.settled){step(item,1/120);item.simulated+=1/120;}
      const height=Math.max(0,item.object.position.y-floorY);
      item.shadow.position.x=item.object.position.x;item.shadow.position.z=item.object.position.z;
      item.shadow.material.opacity=.65/(1+height*3);
      item.shadow.scale.setScalar(item.scale*(1+height*.25));
    }
  }
  function dispose() {
    root.removeFromParent();floor.removeFromParent();
    geometries.forEach(g=>g.dispose());[chipPurple,chipEdge,amethyst,paleGem,floorMaterial].forEach(m=>m.dispose());
    items.forEach(item=>item.shadow.material.dispose());shadowTexture.dispose();
  }
  return {update,reset,dispose};
}
