import * as THREE from './vendor/three.module.min.js';

// The interface is drawn into a texture and composited on the SAME WebGL canvas.
// No visible DOM buttons, headings, dialogs, or paper overlays.
export function createVaultUI(renderer,onAction) {
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);scene.add(plane);
  const surface=renderer.domElement;surface.tabIndex=0;surface.setAttribute('role','application');
  let width=1,height=1,dpr=1,mode='locked',elapsed=0,buttons=[],hover=-1,focus=-1,lastKey='',fontVersion=0;
  const letterText='A note, just for you. Dear friend, Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. With warm regards, The Vault.';
  const fade=(a,b,t)=>Math.max(0,Math.min(1,(t-a)/(b-a)));
  function text(value,x,y,font,color,align='center') {ctx.font=font;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(value,x,y);}
  function button(label,action,x,y,w,h=48,secondary=false) {
    const index=buttons.length;buttons.push({label,action,x,y,w,h});
    ctx.fillStyle=secondary?'rgba(8,8,13,.8)':'#5b1fa6';
    ctx.beginPath();ctx.roundRect(x,y,w,h,3);ctx.fill();
    ctx.strokeStyle=focus===index?'#ead8ff':secondary?'#ffffff30':'#c79ce970';ctx.lineWidth=focus===index?2:1;ctx.stroke();
    text(label,x+w/2,y+h/2,`600 ${secondary?11:12}px Manrope, Arial`,'#f6efff');
  }
  function draw() {
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);buttons=[];
    const mobile=width<720,pad=mobile?24:Math.max(40,width*.083),top=mobile?32:42;
    // Soft canvas scrims replace the previous CSS overlays.
    const scrimOpacity=mode==='locked'?1:mode==='opening'?1-fade(5.7,6.5,elapsed):0;
    if(scrimOpacity>0){
      ctx.globalAlpha=scrimOpacity;
      const topScrim=ctx.createLinearGradient(0,0,0,height*.24);topScrim.addColorStop(0,'rgba(5,5,9,.8)');topScrim.addColorStop(1,'rgba(5,5,9,0)');ctx.fillStyle=topScrim;ctx.fillRect(0,0,width,height*.24);
      const bottomScrim=ctx.createLinearGradient(0,height*.8,0,height);bottomScrim.addColorStop(0,'rgba(5,5,9,0)');bottomScrim.addColorStop(1,'rgba(5,5,9,.8)');ctx.fillStyle=bottomScrim;ctx.fillRect(0,height*.8,width,height*.2);ctx.globalAlpha=1;
    }
    ctx.fillStyle='#a478df';ctx.beginPath();ctx.moveTo(pad,top-8);ctx.lineTo(pad+8,top);ctx.lineTo(pad,top+8);ctx.lineTo(pad-8,top);ctx.closePath();ctx.fill();
    text('T H E  V A U L T',pad+20,top,'700 11px Manrope, Arial','#f5f2f8','left');
    if(!mobile)text('•  A PRIVATE INVITATION',width-pad,top,'500 9px Manrope, Arial','#bdb4c8','right');
    const heroOpacity=mode==='locked'?1:mode==='opening'?1-fade(5.7,6.5,elapsed):mode==='closed'?1:0;
    if(heroOpacity>0) {
      ctx.globalAlpha=heroOpacity;
      const size=mobile?Math.min(40,width*.098):Math.min(64,width*.045);
      const heroY=mobile?100:116;
      text(mode==='closed'?'A little something.':'Some things are worth',width/2,heroY,`500 ${size}px "Cormorant Garamond", Georgia`,'#f4f1f5');
      text(mode==='closed'?'Just for you.':'keeping safe.',width/2,heroY+size*.93,`italic 500 ${size}px "Cormorant Garamond", Georgia`,'#be96ee');
      ctx.globalAlpha=1;
    }
    if(mode==='locked') {
      button('Open the vault  ↗','open',width/2-102,height-139,204,51);
      text('An invitation, kept just for you.',width/2,height-66,'11px Manrope, Arial','#a39bab');
    } else if(mode==='opening'&&elapsed<5.5) {
      text(elapsed<2.3?'Releasing the locking mechanism…':'Your invitation awaits…',width/2,height-94,'12px Manrope, Arial','#c9b8df');
    } else if(mode==='reading') {
      const letterHeight=Math.min(740,height*.76,(width-36)*1500/1024);
      button('Keep this moment  ↗','close',width/2-105,Math.min(height-88,(height+letterHeight)/2+18),210,44);
    } else if(mode==='closed') {
      button('Read the letter again  ↗','read',width/2-115,height-139,230,51);
    }
    if(mode!=='locked')button('↻  Replay','reset',width-105,height-47,85,29,true);
    text('EST. 2026  /  PRIVATE COLLECTION',mobile?24:pad,height-26,'8px Manrope, Arial','#817a89','left');
    if(!mobile&&mode==='locked')text('CRAFTED TO BE DISCOVERED',width-pad,height-26,'8px Manrope, Arial','#817a89','right');
    texture.needsUpdate=true;
  }
  function resize(w,h){width=w;height=h;dpr=Math.min(renderer.getPixelRatio(),2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);lastKey='';}
  function render(nextMode,time) {
    mode=nextMode;elapsed=time;
    const key=[mode,Math.round(fade(5.7,6.5,time)*25),time<2.3,hover,focus,width,height,fontVersion].join(':');
    if(key!==lastKey) {
      if(mode!==surface.dataset.phase){focus=-1;hover=-1;surface.dataset.phase=mode;surface.setAttribute('aria-label',mode==='reading'?`${letterText} Press Enter to close or Escape to return.`:mode==='locked'?'The Vault. Press Enter to open the vault.':mode==='closed'?'Invitation closed. Press Enter to read again.':'The vault is opening. An envelope will fly out and release a letter. Press Escape to replay.');}
      draw();lastKey=key;
    }
    const autoClear=renderer.autoClear;renderer.autoClear=false;renderer.clearDepth();renderer.render(scene,camera);renderer.autoClear=autoClear;
  }
  function hit(event){const rect=surface.getBoundingClientRect(),x=(event.clientX-rect.left)*width/rect.width,y=(event.clientY-rect.top)*height/rect.height;return buttons.findIndex(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);}
  function pointer(event){hover=hit(event);surface.style.cursor=hover>=0?'pointer':'default';}
  function click(event){const index=hit(event);if(index>=0){surface.focus({preventScroll:true});onAction(buttons[index].action);}}
  function keyboard(event) {
    if(event.key==='Escape'){event.preventDefault();onAction(mode==='reading'?'close':'reset');return;}
    if(['Tab','ArrowRight','ArrowLeft'].includes(event.key)){event.preventDefault();focus=(focus+(event.shiftKey||event.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length;lastKey='';}
    if(event.key==='Enter'||event.key===' '){event.preventDefault();const chosen=buttons[focus>=0?focus:0];if(chosen)onAction(chosen.action);}
  }
  function leave(){hover=-1;surface.style.cursor='default';}
  surface.addEventListener('pointermove',pointer);surface.addEventListener('pointerleave',leave);surface.addEventListener('click',click);surface.addEventListener('keydown',keyboard);
  Promise.all([document.fonts.load('500 64px "Cormorant Garamond"'),document.fonts.load('italic 500 64px "Cormorant Garamond"'),document.fonts.load('600 12px Manrope')]).then(()=>{fontVersion++;}).catch(()=>{});
  return {resize,render,dispose(){surface.removeEventListener('pointermove',pointer);surface.removeEventListener('pointerleave',leave);surface.removeEventListener('click',click);surface.removeEventListener('keydown',keyboard);texture.dispose();material.dispose();plane.geometry.dispose();}};
}
