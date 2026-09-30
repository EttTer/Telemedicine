import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
const db = new PGlite()
let checks = 0
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++ }
const sql = async q => (await db.query(q)).rows
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const quote = n => `'${uuid(n)}'`
const role = async (name, user = '') => {
  await db.exec(`reset role; set role ${name};`)
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user])
}
const denied = async q => {
  let error
  try { await db.exec(q) } catch (e) { error = e }
  assert.equal(error?.code, '42501', `Expected permission denial: ${q}`); checks++
}
try {
  await db.exec(await readFile(new URL('./restoration_fixture.sql', import.meta.url), 'utf8'))
  await db.exec(`
    insert into auth.users values (${quote(1)}), (${quote(2)}), (${quote(3)}), (${quote(4)}), (${quote(5)});
    insert into practices(id,name) values (${quote(11)},'Test A'), (${quote(12)},'Test B');
    insert into staff(id,practice_id,role,first_name,last_name) values
      (${quote(1)},${quote(11)},'doctor','Test','A'),
      (${quote(2)},${quote(12)},'doctor','Test','B'),
      (${quote(3)},${quote(11)},'admin','Test','Admin'),
      (${quote(4)},${quote(11)},'nurse','Test','Nurse');
  `)
  for (const [c,p,u] of [[21,11,1],[22,12,2]]) {
    await db.exec(`
      insert into consultations(id,practice_id,created_by,doctor_id,scheduled_for,consultation_type,identity_verification_method)
        values (${quote(c)},${quote(p)},${quote(u)},${quote(u)},now(),'Test','Test');
      insert into patients(consultation_id,first_name,last_name,date_of_birth) values (${quote(c)},'Synthetic','Patient','2000-01-01');
      insert into identity_verifications(consultation_id,method) values (${quote(c)},'Test');
      insert into recording_consents(consultation_id,consent_given) values (${quote(c)},false);
      insert into waiting_room_sessions(consultation_id) values (${quote(c)});
      insert into document_upload_requests(consultation_id,requested_by,expires_at) values (${quote(c)},${quote(u)},now()+interval '1 hour');
      insert into uploaded_documents(consultation_id,file_name,file_type,file_size,storage_path,context)
        values (${quote(c)},'synthetic.pdf','application/pdf',10,'test/file','waiting_room');
      insert into consultation_summaries(consultation_id,doctor_id) values (${quote(c)},${quote(u)});
      insert into consultation_tokens(consultation_id,token_hash,expires_at) values (${quote(c)},'synthetic-${c}',now()+interval '1 hour');
      insert into video_sessions(consultation_id) values (${quote(c)});
      insert into whereby_meetings(consultation_id,room_url,host_room_url,expiry)
        values (${quote(c)},'https://test.whereby.com/guest','https://test.whereby.com/host',now()+interval '1 hour');
      insert into audit_logs(practice_id,consultation_id,actor_role,action) values (${quote(p)},${quote(c)},'system','test');
    `)
  }
  await role('authenticated', uuid(1))
  let recursiveError
  try { await sql('select * from staff') } catch (e) { recursiveError = e }
  check(recursiveError?.code, '42P17', 'Reproduce original recursive policy failure')
  await db.exec('reset role')
  // Confirm that the migration also clears column-level grants.
  await db.exec('grant select (host_room_url) on whereby_meetings to authenticated')
  const files = await readdir(new URL('../migrations/', import.meta.url))
  const filename = files.find(f => f.endsWith('_restore_practice_read_access.sql'))
  assert.ok(filename)
  const migration = await readFile(new URL(`../migrations/${filename}`, import.meta.url), 'utf8')
  await db.exec(migration)
  const children = ['patients','identity_verifications','recording_consents','waiting_room_sessions','document_upload_requests','uploaded_documents','consultation_summaries']
  for (const [u,c,p] of [[1,21,11],[2,22,12],[4,21,11]]) {
    await role('authenticated', uuid(u))
    check(await sql('select id from staff'), [{ id: uuid(u) }], 'Own staff profile only')
    check(await sql('select id from practices'), [{ id: uuid(p) }], 'Own practice only')
    check(await sql('select id from consultations'), [{ id: uuid(c) }], 'Own consultation only')
    for (const t of children) check(await sql(`select consultation_id from ${t}`), [{ consultation_id: uuid(c) }], `${t} is practice scoped`)
    check(await sql('select id from audit_logs'), [], 'Non-admin audit denied')
  }
  await role('authenticated', uuid(3))
  check(await sql('select practice_id from audit_logs'), [{ practice_id: uuid(11) }], 'Admin audit is practice scoped')
  await role('authenticated', uuid(5))
  check(await sql('select id from consultations'), [], 'No profile means no consultation access')
  await role('authenticated')
  check(await sql('select id from staff'), [], 'Missing user ID fails closed')
  const tables = ['staff','practices','consultations',...children,'audit_logs','consultation_tokens','video_sessions','whereby_meetings']
  for (const r of ['anon','authenticated']) {
    await role(r, r === 'authenticated' ? uuid(1) : '')
    for (const t of tables) {
      for (const op of ['INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES']) {
        const rows = await db.query('select has_table_privilege(current_user,$1,$2) as allowed', [`public.${t}`,op])
        check(rows.rows[0].allowed, false, `${r} cannot ${op} ${t}`)
      }
    }
    for (const t of ['consultation_tokens','video_sessions','whereby_meetings']) await denied(`select * from ${t}`)
    await denied('select host_room_url from whereby_meetings')
    await denied('truncate audit_logs')
    await denied(`update staff set practice_id=${quote(12)} where id=${quote(1)}`)
    await denied(`delete from consultations where id=${quote(21)}`)
    await denied(`insert into audit_logs(actor_role,action) values ('system','forged')`)
    if (r === 'anon') for (const t of tables) await denied(`select * from ${t}`)
  }
  await role('service_role')
  check((await sql('select id from consultations')).length, 2, 'Server access preserved')
  check((await sql('select host_room_url from whereby_meetings')).length, 2, 'Server can access room secrets')
  await db.exec('reset role')
  check((await sql('select id from consultations')).length, 2, 'No consultation data lost')
  check((await sql('select id from staff')).length, 4, 'No staff data lost')
  let repeatError
  try { await db.exec(migration) } catch (e) { repeatError = e; await db.exec('rollback') }
  check(Boolean(repeatError?.message.includes('Unexpected policies')), true, 'Unexpected policy drift/repeat fails closed')
  console.log(`${checks} PostgreSQL assertions passed (PGlite, synthetic data; not hosted Supabase).`)
} finally { await db.close() }
