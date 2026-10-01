"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { instructionVersion, instructions } from '@/lib/instructions';
import { Button } from '@/components/ui/Button';
export function PatientInstructions({token,context}: {token:string;context:any}) {
 const router=useRouter();const [agreed,setAgreed]=useState(false),[choice,setChoice]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();if(!agreed||!choice)return;setBusy(true);setError('');try{
 const r=await fetch(`/api/patient/${token}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'join',acknowledged:true,care_consent:true,recording_preference:choice,instruction_version:instructionVersion})});const d=await r.json();if(!r.ok)throw new Error(d.error);router.push(`/consultation/${token}/waiting`);
 }catch(e){setError(e instanceof Error?e.message:'Vstup se nezdařil.')}finally{setBusy(false)}}
 return <form onSubmit={submit} className="max-w-2xl mx-auto p-6 space-y-5 bg-white rounded-xl">
 <h1 className="text-2xl font-semibold">Poučení před konzultací</h1>
 <p>Ordinace: {context.profile.legal_name || context.practices?.name || 'Neuvedena'}</p>
 <p>Domluvený lékař: {context.practitioner ? [context.practitioner.title_before,context.practitioner.first_name,context.practitioner.last_name,context.practitioner.title_after].filter(Boolean).join(' ') : 'Zatím neurčen — před konzultací ověřte s ordinací.'}</p>
 {Object.entries(instructions).map(([key,text])=><p key={key}>{text}</p>)}
 <p><strong>Ověření pacienta:</strong> {context.identity_verification_method || 'Způsob domluvte předem s ordinací.'}</p>
 <p><strong>Ověření zdravotníka:</strong> {context.profile.practitioner_identity_method || 'Způsob zatím ordinace nedoplnila. Před předáním zdravotních údajů jej ověřte s ordinací přes její známý kontakt.'}</p>
 <Link href={`/consultation/${token}/information`} className="block underline">Poskytovatel, zpracování údajů a kontakty ordinace</Link>
 <fieldset className="space-y-2"><legend className="font-semibold">Vyjádření k audio/videozáznamu</legend>
 <p className="text-sm">Tato aplikace nenabízí nahrávání. Případné nahrávání jiným nástrojem je nutné řešit zvlášť s ordinací.</p>
 <label className="block"><input type="radio" name="recording" value="declined" checked={choice==='declined'} onChange={()=>setChoice('declined')} /> Nesouhlasím s pořizováním audio/videozáznamu.</label>
 <label className="block"><input type="radio" name="recording" value="not_requested" checked={choice==='not_requested'} onChange={()=>setChoice('not_requested')} /> Pořizování audio/videozáznamu nepožaduji; konzultace proběhne bez něj.</label></fieldset>
 <label className="flex gap-2"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} /><span>Přečetl/a jsem poučení, měl/a jsem možnost se zeptat a souhlasím s poskytnutím této konzultace na dálku. Konkrétní péči se mnou probere lékař.</span></label>
 <p className="text-sm text-neutral-500">Verze poučení {instructionVersion}. Potvrzení a vyjádření k záznamu se uloží s časem potvrzení. Souhlas s péčí není souhlasem se zpracováním osobních údajů.</p>
 {error&&<p role="alert" className="text-danger-700">{error}</p>}<Button type="submit" disabled={!agreed||!choice} isLoading={busy}>Vstoupit do čekárny</Button>
 </form>
}
