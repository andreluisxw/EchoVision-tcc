import {useEffect,useRef,useState} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
export default function LocationMiniMap({latitude,longitude}:{latitude:number;longitude:number}){
  const container=useRef<HTMLSpanElement>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{
    if(!container.current)return;
    setError(false);
    let map:maplibregl.Map|undefined;
    let marker:maplibregl.Marker|undefined;
    try{
      map=new maplibregl.Map({container:container.current,style:import.meta.env.VITE_MAP_STYLE_URL||'https://tiles.openfreemap.org/styles/liberty',center:[longitude,latitude],zoom:15,interactive:false,attributionControl:{compact:true}});
      marker=new maplibregl.Marker({color:'#245d3e'}).setLngLat([longitude,latitude]).addTo(map);
      map.on('error',()=>setError(true));
    }catch{setError(true);}
    return()=>{marker?.remove();map?.remove();};
  },[latitude,longitude]);
  return <span className="coordinate-map-wrap"><span style={{display:'block'}} className="coordinate-map" ref={container} role="img" aria-label={`Mapa com marcador em ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}/>{error&&<span className="coordinate-map-error" role="status">Mapa indisponível. Use o link abaixo para abrir a localização.</span>}</span>;
}
