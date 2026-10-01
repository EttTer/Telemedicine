import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPatientConsultation } from '@/lib/patient-access';
export const dynamic='force-dynamic';
export default async function PatientInformation({params}:{params:Promise<{token:string}>}) {
 const {token}=await params;const c=await getPatientConsultation(token);if(!c)notFound();const p=c.profile;
 const fields={legal_name:'Poskytovatel',ico:'IČO',address:'Adresa',privacy_contact:'Kontakt pro ochranu osobních údajů',legal_basis_notice:'Účely, právní základy a rozsah zpracování',vendor_notice:'Příjemci, zpracovatelé a případná předávání',retention_notice:'Doby uchování',practitioner_identity_method:'Ověření totožnosti zdravotníka'};
 return <main className="max-w-2xl mx-auto p-6 space-y-4 bg-white rounded-xl"><h1 className="text-2xl font-semibold">Informace ordinace</h1>
 <p>Telefon ordinace: {c.practices?.contact_phone || 'Neuveden — kontaktujte ordinaci známým kontaktem.'}</p>
 {Object.entries(fields).map(([key,label])=><section key={key}><h2 className="font-semibold">{label}</h2><p className="whitespace-pre-wrap">{p[key] || 'Ordinace údaj zatím nedoplnila.'}</p></section>)}
 <p>U správce můžete uplatnit práva na přístup, opravu a další práva podle GDPR v rozsahu, v němž jsou použitelná. Výmaz nebo omezení může být omezen zákonnou povinností vést dokumentaci. Stížnost lze podat Úřadu pro ochranu osobních údajů (uoou.gov.cz).</p>
 <p>Průběh konzultace posuzuje lékař. Pokud nelze bezpečně pokračovat na dálku, domluvte osobní vyšetření. Při akutním ohrožení života volejte 155 nebo 112.</p>
 <Link href={`/consultation/${token}/instructions`} className="block underline">Zpět k poučení</Link><Link href="/information" className="block underline">Obecné informace o aplikaci</Link></main>
}
