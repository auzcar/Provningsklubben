'use client';
import {useEffect,useState} from 'react';
import {Monitor,Sun,Moon} from 'lucide-react';

// Light/dark: follows the phone by default; the choice is remembered on this device only.
type Choice='auto'|'light'|'dark';
const LABEL:Record<Choice,string>={auto:'Tema: som telefonen',light:'Tema: ljust',dark:'Tema: mörkt'};
function apply(choice:Choice){
 const light=choice==='light'||(choice==='auto'&&matchMedia('(prefers-color-scheme: light)').matches);
 document.documentElement.dataset.theme=light?'light':'dark';
 document.querySelector('meta[name=theme-color]')?.setAttribute('content',light?'#efe4cf':'#2a0f14');
}
export default function ThemeToggle(){
 const [choice,setChoice]=useState<Choice>(()=>{try{return (localStorage.getItem('theme') as Choice)||'auto';}catch{return 'auto';}});
 useEffect(()=>{apply(choice);if(choice!=='auto')return;const m=matchMedia('(prefers-color-scheme: light)');const on=()=>apply('auto');m.addEventListener('change',on);return()=>m.removeEventListener('change',on);},[choice]);
 const next=()=>{const c:Choice=choice==='auto'?'light':choice==='light'?'dark':'auto';try{localStorage.setItem('theme',c);}catch{}setChoice(c);};
 const Icon=choice==='auto'?Monitor:choice==='light'?Sun:Moon;
 return <button className="theme-toggle" onClick={next} aria-label={LABEL[choice]+'. Byt tema.'} title={LABEL[choice]}><Icon size={18}/></button>;
}
