import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
let checks = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const fail = async (f, message) => {
  await assert.rejects(f, (e) => e.message.includes(message));
  checks++;
};
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hash = (c) => c.repeat(64);
const action = async (fn, args) =>
  (
    await db.query(
      `select public.${fn}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as r`,
      args,
    )
  ).rows[0].r;
const staff = (n, id, a, d = {}) =>
  action("tm_staff_action", [uid(n), id, a, d]);
const record = (n, id, a, d = {}) =>
  action("tm_record_action", [uid(n), id, a, d]);
const patient = (t, s, a, d = {}) =>
  action("tm_patient_action", [hash(t), hash(s), a, d]);
const docs = (t, s, a, d = {}) =>
  action("tm_patient_documents", [hash(t), hash(s), a, d]);
try {
  await db.exec(
    await readFile(
      new URL("./restoration_fixture.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    "create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);",
  );
  await db.exec("create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; grant execute on function auth.jwt() to authenticated,service_role;" );
  const ms = await readdir(new URL("../migrations", import.meta.url));
  for (const suffix of [
    "restore_practice_read_access.sql",
    "consultation_workflow.sql",
    "clinical_workspace.sql",
    "compliance_workflow.sql",
  ]) {
    const f = ms.find((x) => x.endsWith(suffix));
    assert.ok(f);
    await db.exec(
      await readFile(new URL("../migrations/" + f, import.meta.url), "utf8"),
    );
  }
  eq(
    (
      await db.query(
        "select count(*)::int n from storage.buckets where not public",
      )
    ).rows[0].n,
    2,
  );
  await db.exec(
    `insert into auth.users values('${uid(1)}'),('${uid(2)}'),('${uid(3)}');insert into practices(id,name)values('${uid(11)}','A'),('${uid(12)}','B');insert into staff(id,practice_id,role,first_name,last_name)values('${uid(1)}','${uid(11)}','doctor','A','A'),('${uid(2)}','${uid(12)}','doctor','B','B'),('${uid(3)}','${uid(11)}','nurse','C','C');`,
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    await fail(() => record(1, uid(5), "read"), "permission denied");
    await fail(() => docs("a", "b", "status"), "permission denied");
    await db.exec("reset role");
  }
  await db.exec("set role service_role");
  const date = new Date(Date.now() + 5 * 86400000).toISOString();
  const c = (
    await staff(1, null, "create", {
      scheduled_for: date,
      consultation_type: "Synthetic",
      identity_verification_method: "In call",
      token_hash: hash("a"),
    })
  ).id;
  const info = await record(1, c, "read");
  eq(new Date(info.consultation.scheduled_for).toISOString(), date);
  eq(info.summary, null);
  eq(info.revision, 0);
  const token = (
    await db.query(
      "select expires_at from consultation_tokens where consultation_id=$1",
      [c],
    )
  ).rows[0];
  eq(new Date(token.expires_at).getTime(), Date.parse(date) + 86400000);
  await fail(() => record(2, c, "read"), "not_found");
  await fail(
    () => record(2, c, "save", { summary: "X", revision: 0 }),
    "not_found",
  );
  eq((await record(3, c, "read")).can_edit, false);
  await fail(
    () => record(3, c, "save", { summary: "X", revision: 0 }),
    "forbidden",
  );
  eq(
    (await record(1, c, "save", { summary: "During call", revision: 0 }))
      .revision,
    1,
  );
  await fail(
    () => record(1, c, "save", { summary: "stale", revision: 0 }),
    "record_conflict",
  );
  eq((await record(1, c, "read")).summary, "During call");
  await fail(() => docs("a", "b", "check"), "invalid_session");
  await patient("a", "b", "checkin", {
    first_name: "Test",
    last_name: "Patient",
    date_of_birth: "2000-01-01",
    contact_info: "test@example.invalid",
  });
  await fail(() => docs("a", "b", "status"), "invalid_session");
  await patient("a", "b", "join", { acknowledged:true,care_consent:true,recording_preference:"declined",instruction_version:"2026-10-01-v2",instruction_snapshot:{service:"Synthetic instructions"} });
  await patient("a","b","join",{acknowledged:true,care_consent:true,recording_preference:"declined",instruction_version:"2026-10-01-v2",instruction_snapshot:{service:"Synthetic instructions"}});
  eq((await db.query("select count(*)::int n from consultation_acknowledgements where consultation_id=$1",[c])).rows[0].n,1);
  eq((await db.query("select count(*)::int n from audit_logs where consultation_id=$1 and action='patient_care_acknowledged'",[c])).rows[0].n,1);
  eq((await docs("a", "b", "status")).enabled, false);
  await fail(() => docs("a", "b", "check"), "upload_disabled");
  await record(3, c, "request");
  eq((await docs("a", "b", "status")).enabled, true);
  const grant = await docs("a", "b", "check");
  const payload = {
    request_id: grant.request_id,
    file_name: "synthetic.pdf",
    file_type: "application/pdf",
    file_size: 100,
    storage_path: c + "/" + uid(501),
  };
  await fail(
    () =>
      docs("a", "b", "commit", {
        ...payload,
        storage_path: uid(9) + "/" + uid(501),
      }),
    "invalid_file",
  );
  await fail(
    () => docs("a", "b", "commit", { ...payload, file_type: "image/svg+xml" }),
    "invalid_file",
  );
  await fail(
    () => docs("a", "b", "commit", { ...payload, file_size: 3145729 }),
    "invalid_file",
  );
  await docs("a", "b", "commit", payload);
  const ds = await docs("a", "b", "status");
  eq(ds.documents.length, 1);
  eq(ds.documents[0].file_name, "synthetic.pdf");
  eq(JSON.stringify(ds).includes("storage_path"), false);
  eq((await record(1, c, "read")).documents.length, 1);
  const newer = new Date(Date.now() + 7 * 86400000).toISOString();
  await record(3, c, "reschedule", { scheduled_for: newer });
  eq(
    new Date(
      (await record(1, c, "read")).consultation.scheduled_for,
    ).toISOString(),
    newer,
  );
  eq(
    new Date(
      (
        await db.query(
          "select expires_at from patient_sessions where consultation_id=$1",
          [c],
        )
      ).rows[0].expires_at,
    ).getTime(),
    Date.parse(newer) + 86400000,
  );
  await fail(
    () => record(1, c, "reschedule", { scheduled_for: "2000-01-01T00:00:00Z" }),
    "invalid_date",
  );
  await record(1, c, "revoke");
  eq((await docs("a", "b", "status")).enabled, false);
  await fail(() => docs("a", "b", "commit", payload), "upload_disabled");
  await record(1, c, "request");
  await fail(() => docs("a", "b", "commit", payload), "upload_disabled");
  const current = await docs("a", "b", "check");
  for (let i = 1; i < 10; i++)
    await docs("a", "b", "commit", {
      ...payload,
      request_id: current.request_id,
      storage_path: c + "/" + uid(501 + i),
    });
  await fail(() => docs("a", "b", "check"), "upload_limit");
  eq((await docs("a", "b", "status")).documents.length, 10);
  await db.query("update consultations set status='in_progress' where id=$1", [
    c,
  ]);
  eq((await staff(1, c, "room")).meetingId, null);
  await staff(1, c, "end");
  await staff(1, c, "end");
  eq((await record(1, c, "read")).consultation.status, "completed");
  eq((await record(1, c, "read")).upload_enabled, false);
  eq((await docs("a", "b", "status")).enabled, false);
  await fail(() => docs("a", "b", "commit", payload), "upload_disabled");
  eq((await record(1, c, "read")).documents.length, 10);
  eq((await record(1, c, "read")).summary, "During call");
  eq(
    (
      await record(1, c, "save", {
        summary: "Final editable summary",
        revision: 1,
      })
    ).revision,
    2,
  );
  eq((await record(1, c, "read")).summary, "Final editable summary");
  await fail(() => record(1, c, "request"), "invalid_state");
  await fail(
    () => record(1, c, "reschedule", { scheduled_for: newer }),
    "invalid_state",
  );
  const cancel = (
    await staff(1, null, "create", {
      consultation_type: "Cancel",
      identity_verification_method: "In call",
      token_hash: hash("c"),
    })
  ).id;
  await record(3, cancel, "cancel");
  await record(3, cancel, "cancel");
  eq((await record(1, cancel, "read")).consultation.status, "cancelled");
  await fail(
    () =>
      patient("c", "d", "checkin", {
        first_name: "T",
        last_name: "P",
        date_of_birth: "2000-01-01",
        contact_info: "test",
      }),
    "invalid_invitation",
  );
  // Completion requires real evidence and provider metadata; corrections keep the old snapshot.
  await fail(()=>record(1,c,"finalize",{revision:2}),"identity_required");
  await fail(()=>record(3,c,"verify_identity",{verified:true,method:"Synthetic method"}),"forbidden");
  await fail(()=>record(2,c,"verify_identity",{verified:true,method:"Synthetic method"}),"not_found");
  await record(1,c,"verify_identity",{verified:true,method:"Synthetic method"});
  eq((await record(1,c,"read")).identity.verified_by,uid(1));
  await fail(()=>record(1,c,"finalize",{revision:2}),"provider_incomplete");
  await db.exec("reset role");
  await db.query("update staff set role='admin' where id=$1",[uid(1)]);
  await db.exec("set role service_role");
  await action("tm_practice_action",[uid(1),{legal_name:"Synthetic provider",ico:"12345678",address:"Synthetic address"}]);
  await fail(()=>action("tm_practice_action",[uid(3),{legal_name:"evil"}]),"forbidden");
  await record(1,c,"finalize",{revision:2});
  await record(1,c,"finalize",{revision:2}); // idempotent completion
  let finalized=await record(1,c,"read");
  eq(finalized.can_edit,false);eq(finalized.finalization.revision,2);
  eq(finalized.acknowledgement.recording_preference,"declined");
  await fail(()=>record(1,c,"save",{revision:2,summary:"Overwrite"}),"record_finalized");
  await fail(()=>record(1,c,"verify_identity",{verified:false,method:"Synthetic method"}),"record_finalized");
  await fail(()=>record(1,c,"reopen",{revision:2,reason:""}),"invalid_amendment");
  await action("tm_practice_action",[uid(1),{legal_name:"Changed provider",ico:"12345678",address:"New address"}]);
  eq((await record(1,c,"read")).provider.legal_name,"Synthetic provider");
  await record(1,c,"reopen",{revision:2,reason:"Correction of recommendation"});
  await record(1,c,"save",{revision:3,summary:"Corrected recommendation"});
  finalized=await record(1,c,"read");eq(finalized.revision,4);eq(finalized.amendment_reason,"Correction of recommendation");
  eq((await record(1,c,"read_version",{revision:2})).summary,"Final editable summary");
  await fail(()=>record(2,c,"read_version",{revision:2}),"not_found");
  await record(1,c,"finalize",{revision:4});
  eq((await db.query("select count(*)::int n from clinical_record_finalizations where consultation_id=$1",[c])).rows[0].n,2);
  eq((await db.query("select snapshot->>'summary' summary from clinical_record_finalizations where consultation_id=$1 and revision=2",[c])).rows[0].summary,"Final editable summary");
  for (const table of ["clinical_record_versions","clinical_record_finalizations","consultation_acknowledgements"]){
   await fail(()=>db.query(`delete from ${table} where consultation_id=$1`,[c]),"immutable_evidence");
  }
  eq((await db.query("select count(*)::int n from consultation_acknowledgements where consultation_id=$1",[c])).rows[0].n,1);
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid(1)]);
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({aal:"aal1"})]);
  eq((await db.query("select count(*)::int n from consultations")).rows[0].n,0);
  eq((await db.query("select count(*)::int n from patients")).rows[0].n,0);
  await fail(()=>record(1,c,"read"),"permission denied");
  await fail(()=>action("tm_record_action_base",[uid(1),c,"read",{}]),"permission denied");
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({aal:"aal2"})]);
  eq((await db.query("select count(*)::int n from consultations")).rows[0].n,2);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid(2)]);
  eq((await db.query("select count(*)::int n from consultations")).rows[0].n,0);
  console.log(`Compliance PostgreSQL: ${checks} assertions passed`);
} finally {
  await db.close();
}
