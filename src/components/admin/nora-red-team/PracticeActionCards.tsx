import React,{useState,useRef,useEffect} from 'react';
import dynamic from 'next/dynamic';
import {SEEDED_EXERCISES} from '../../../api/firebase/mentaltraining/exerciseLibraryService';
const Player=dynamic(()=>import('../../mentaltraining/ExercisePlayer').then(m=>m.ExercisePlayer),{ssr:false});
export default function PracticeActionCards({actions,onComplete}:{actions:{id:string;type:string;label:string;exerciseId?:string}[];onComplete:(text:string)=>void}){
 const [selected,setSelected]=useState<string|null>(null),[done,setDone]=useState<string[]>([]);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(selected)dialog.current?.showModal();},[selected]);
 const exercise=SEEDED_EXERCISES.find(e=>e.id===selected);
 return <div>{actions.filter(a=>a.type==='practice').map(a=>SEEDED_EXERCISES.some(e=>e.id===a.id&&e.isActive)&&<button key={a.id} onClick={()=>setSelected(a.id)}>{done.includes(a.id)?'Practice again':a.label}</button>)}{exercise&&<dialog ref={dialog} onCancel={()=>setSelected(null)} aria-modal="true" aria-label={exercise.name} style={{position:'fixed',inset:0,zIndex:1000,background:'#080b10',overflow:'auto',width:'100vw',height:'100vh',maxWidth:'100vw',maxHeight:'100vh',padding:0,border:0}}><Player exercise={exercise} previewMode onClose={()=>setSelected(null)} onComplete={()=>{setDone([...done,exercise.id]);setSelected(null);onComplete(`Completed practice preview: ${exercise.name}. Athlete completion was not saved.`);}}/></dialog>}</div>;
}
