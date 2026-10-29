'use client';
import {useEffect,useRef,useState} from 'react';
import {X,ZoomIn,ZoomOut,Crosshair} from 'lucide-react';

// Square crop with a round preview: drag (or pinch) to move, zoom with the slider or the wheel.
// The result is a 320 px JPEG, the same size the server stores for every avatar.
const OUT=320,MAX_ZOOM=4;
type View={zoom:number;x:number;y:number};

export default function PhotoCrop({source,onDone,onCancel,busy}:{source:Blob;onDone:(image:string)=>void;onCancel:()=>void;busy?:boolean}){
 const [img,setImg]=useState<HTMLImageElement|null>(null);const [error,setError]=useState('');
 const [frame,setFrame]=useState(280);const [view,setView]=useState<View>({zoom:1,x:0,y:0});
 const box=useRef<HTMLDivElement>(null);const pointers=useRef(new Map<number,{x:number;y:number}>());const pinch=useRef(0);

 useEffect(()=>{
  const url=URL.createObjectURL(source);const i=new Image();
  i.onload=()=>setImg(i);i.onerror=()=>setError('Bilden gick inte att öppna. Välj en annan bild.');i.src=url;
  return()=>URL.revokeObjectURL(url);
 },[source]);
 useEffect(()=>{const el=box.current;if(!el)return;const fit=()=>setFrame(el.clientWidth||280);fit();const o=new ResizeObserver(fit);o.observe(el);return()=>o.disconnect();},[]);

 const base=img?frame/Math.min(img.naturalWidth,img.naturalHeight):1;
 // Keep the image covering the whole frame.
 const clamp=(v:View):View=>{if(!img)return v;const s=base*v.zoom,w=img.naturalWidth*s,h=img.naturalHeight*s;return {zoom:v.zoom,x:Math.min(0,Math.max(frame-w,v.x)),y:Math.min(0,Math.max(frame-h,v.y))};};
 const centered=(zoom:number):View=>{if(!img)return {zoom,x:0,y:0};const s=base*zoom;return {zoom,x:(frame-img.naturalWidth*s)/2,y:(frame-img.naturalHeight*s)/2};};
 useEffect(()=>{if(img)setView(centered(1));},[img,frame]); // eslint-disable-line react-hooks/exhaustive-deps
 // Zoom around a point in the frame (the centre unless a pinch or the wheel says otherwise).
 const zoomTo=(zoom:number,px=frame/2,py=frame/2)=>setView(v=>{const z=Math.min(MAX_ZOOM,Math.max(1,zoom)),k=z/v.zoom;return clamp({zoom:z,x:px-(px-v.x)*k,y:py-(py-v.y)*k});});

 const local=(e:{clientX:number;clientY:number})=>{const r=box.current!.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 const down=(e:React.PointerEvent)=>{e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,local(e));pinch.current=0;};
 const move=(e:React.PointerEvent)=>{
  const prev=pointers.current.get(e.pointerId);if(!prev)return;const now=local(e);pointers.current.set(e.pointerId,now);
  const all=[...pointers.current.values()];
  if(all.length===2){const d=Math.hypot(all[0].x-all[1].x,all[0].y-all[1].y);if(pinch.current)zoomTo(view.zoom*d/pinch.current,(all[0].x+all[1].x)/2,(all[0].y+all[1].y)/2);pinch.current=d;return;}
  setView(v=>clamp({...v,x:v.x+now.x-prev.x,y:v.y+now.y-prev.y}));
 };
 const up=(e:React.PointerEvent)=>{pointers.current.delete(e.pointerId);pinch.current=0;};
 useEffect(()=>{const el=box.current;if(!el)return;const wheel=(e:WheelEvent)=>{e.preventDefault();const p=local(e);setView(v=>{const z=Math.min(MAX_ZOOM,Math.max(1,v.zoom*Math.exp(-e.deltaY/400))),k=z/v.zoom;return clamp({zoom:z,x:p.x-(p.x-v.x)*k,y:p.y-(p.y-v.y)*k});});};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);});
 const key=(e:React.KeyboardEvent)=>{const step=e.shiftKey?40:10,d:any={ArrowLeft:[step,0],ArrowRight:[-step,0],ArrowUp:[0,step],ArrowDown:[0,-step]}[e.key];if(d){e.preventDefault();setView(v=>clamp({...v,x:v.x+d[0],y:v.y+d[1]}));}else if(e.key==='+'||e.key==='=')zoomTo(view.zoom*1.1);else if(e.key==='-')zoomTo(view.zoom/1.1);};

 const done=()=>{if(!img)return;const s=base*view.zoom,side=frame/s;const c=document.createElement('canvas');c.width=c.height=OUT;
  c.getContext('2d')!.drawImage(img,-view.x/s,-view.y/s,side,side,0,0,OUT,OUT);onDone(c.toDataURL('image/jpeg',.85));};
 const s=base*view.zoom;
 return <div className="modal-backdrop" onClick={onCancel}><div className="modal photo-crop" role="dialog" aria-modal="true" aria-label="Justera profilbild" onClick={e=>e.stopPropagation()}>
  <button className="close" aria-label="Stäng" onClick={onCancel}><X/></button>
  <div className="eyebrow">PROFILBILD</div><h2>Justera bilden</h2>
  <p className="muted fine">Dra för att flytta. Zooma med reglaget, med två fingrar eller med scrollhjulet.</p>
  <div ref={box} className="crop-frame" tabIndex={0} aria-label="Bildens utsnitt, flytta med piltangenterna" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
   {img&&<img src={img.src} alt="" draggable={false} style={{width:img.naturalWidth*s,height:img.naturalHeight*s,transform:`translate(${view.x}px,${view.y}px)`}}/>}
   {error&&<p className="inline-error">{error}</p>}
  </div>
  <div className="crop-zoom"><button type="button" className="icon-button" aria-label="Zooma ut" onClick={()=>zoomTo(view.zoom/1.2)}><ZoomOut size={18}/></button>
   <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={view.zoom} aria-label="Zoom" onChange={e=>zoomTo(Number(e.target.value))}/>
   <button type="button" className="icon-button" aria-label="Zooma in" onClick={()=>zoomTo(view.zoom*1.2)}><ZoomIn size={18}/></button></div>
  <div className="row between"><button type="button" className="text-button" onClick={()=>setView(centered(view.zoom))}><Crosshair size={14}/>Centrera</button>
   <div className="row"><button type="button" className="secondary small" onClick={onCancel}>Avbryt</button><button type="button" className="primary small" disabled={!img||busy} onClick={done}>Spara bild</button></div></div>
 </div></div>;
}
