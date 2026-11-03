import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import './CoordinatePreview.css';
const LocationMiniMap=lazy(()=>import('./LocationMiniMap'));
export default function CoordinatePreview({latitude,longitude}:{latitude:number;longitude:number}){
  const [open,setOpen]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const regionId=useId();
  function cancel(){if(timer.current)clearTimeout(timer.current);timer.current=null;}
  function close(){cancel();setOpen(false);}
  useEffect(()=>()=>cancel(),[]);
  useEffect(()=>{close();},[latitude,longitude]);
  return <span className="coordinate-preview" onMouseEnter={()=>{cancel();timer.current=setTimeout(()=>setOpen(true),250);}} onMouseLeave={close}
    onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))close();}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close();}}}>
    <button className="coordinate-trigger" type="button" aria-label={`Ver localização ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`} aria-expanded={open} aria-controls={regionId}
      onFocus={()=>{cancel();setOpen(true);}} onClick={()=>{cancel();setOpen(true);}}>{latitude.toFixed(5)}, {longitude.toFixed(5)}</button>
    {open&&<span className="coordinate-popover" role="region" aria-label="Localização da ocorrência" id={regionId}>
      <span className="coordinate-heading">Localização da ocorrência<button type="button" aria-label="Fechar prévia do mapa" onClick={close}>×</button></span>
      <Suspense fallback={<span role="status">Carregando mapa…</span>}><LocationMiniMap latitude={latitude} longitude={longitude}/></Suspense>
      <a href={`/?latitude=${latitude}&longitude=${longitude}`} target="_blank" rel="noreferrer">Abrir no mapa principal</a>
    </span>}
  </span>;
}
