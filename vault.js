import { createVault } from './vault-webgl.js';

const stage=document.querySelector('#stage');
// Loading and error states also render on canvas, never as HTML overlays.
const loading=document.createElement('canvas');loading.className='loading-canvas';loading.tabIndex=0;
loading.setAttribute('aria-label','Preparing your invitation.');stage.append(loading);
const context=loading.getContext('2d');let failed=false;
function paintLoading() {
  const width=stage.clientWidth,height=stage.clientHeight,dpr=Math.min(devicePixelRatio,2);
  loading.width=width*dpr;loading.height=height*dpr;context.setTransform(dpr,0,0,dpr,0,0);
  context.fillStyle='#08090d';context.fillRect(0,0,width,height);context.textAlign='center';
  context.fillStyle='#b68bdd';context.font='italic 42px Georgia';context.fillText('The Vault',width/2,height/2-20);
  context.fillStyle='#b8b0c1';context.font='12px Arial';context.fillText(failed?'Unable to start WebGL. Click to try again.':'Preparing your invitation…',width/2,height/2+24);
}
const observer=new ResizeObserver(paintLoading);observer.observe(stage);paintLoading();
try {
  const vault=await createVault(stage);
  observer.disconnect();loading.remove();
  window.addEventListener('pagehide',()=>vault.dispose(),{once:true});
} catch(error) {
  console.error('Unable to create vault',error);failed=true;paintLoading();
  loading.setAttribute('aria-label','Unable to start WebGL. Press Enter or click to retry.');
  loading.addEventListener('click',()=>location.reload());
  loading.addEventListener('keydown',event=>{if(event.key==='Enter')location.reload();});
}
