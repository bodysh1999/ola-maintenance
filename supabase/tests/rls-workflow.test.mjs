process.on("unhandledRejection", e => { console.error("ERR:", e.message, e.query?.slice(0,120)); process.exit(1); });
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

const dir = new URL('../migrations', import.meta.url).pathname;
const db = new PGlite();

const stub = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text, created_at timestamptz default now());
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated; grant all on storage.objects to authenticated;
`;
await db.exec(stub);
for (const f of fs.readdirSync(dir).sort()) {
  try { await db.exec(fs.readFileSync(path.join(dir, f), 'utf8')); console.log('OK', f); }
  catch (e) { console.error('FAIL', f, e.message, e.position); process.exit(1); }
}

const U = {
  admin: '00000000-0000-0000-0000-00000000000a',
  sup:   '00000000-0000-0000-0000-00000000000b',
  tech:  '00000000-0000-0000-0000-00000000000c',
  own1:  '00000000-0000-0000-0000-00000000000d',
  own2:  '00000000-0000-0000-0000-00000000000e',
};
await db.exec(`
insert into auth.users (id,email,raw_app_meta_data,raw_user_meta_data) values
 ('${U.admin}','a@x','{"role":"admin"}','{"full_name":"مدير"}'),
 ('${U.sup}','s@x','{"role":"supervisor"}','{"full_name":"مشرف"}'),
 ('${U.tech}','t@x','{"role":"technician"}','{"full_name":"فني"}'),
 ('${U.own1}','o1@x','{"role":"owner"}','{"full_name":"مالك1"}'),
 ('${U.own2}','o2@x','{"role":"admin_hack"}','{"full_name":"مالك2","role":"admin"}');
`).catch(async e => {
  // invalid enum in app_meta -> expected error; insert own2 properly
  console.log('expected bad role error:', e.message);
});
await db.exec(`insert into auth.users (id,email,raw_app_meta_data,raw_user_meta_data) values
 ('${U.admin}','a@x','{"role":"admin"}','{"full_name":"مدير"}'),
 ('${U.sup}','s@x','{"role":"supervisor"}','{"full_name":"مشرف"}'),
 ('${U.tech}','t@x','{"role":"technician"}','{"full_name":"فني"}'),
 ('${U.own1}','o1@x','{"role":"owner"}','{"full_name":"مالك1"}'),
 ('${U.own2}','o2@x','{}','{"full_name":"مالك2","role":"admin"}') on conflict do nothing;`);
console.log((await db.query(`select full_name, role from public.profiles order by id`)).rows);

await db.exec(`
insert into public.projects (id,name_ar) values ('10000000-0000-0000-0000-000000000001','مشروع أ');
insert into public.buildings (id,project_id,name,floors_count) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','مبنى 1',4);
insert into public.owners (id,profile_id,full_name,phone,account_status) values
 ('30000000-0000-0000-0000-000000000001','${U.own1}','مالك1','050','active'),
 ('30000000-0000-0000-0000-000000000002','${U.own2}','مالك2','051','active');
insert into public.units (id,building_id,unit_number,owner_id,handover_date) values
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','101','30000000-0000-0000-0000-000000000001','2025-01-01'),
 ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','102','30000000-0000-0000-0000-000000000002','2025-01-01');
insert into public.warranties (unit_id,category,title,start_date,end_date) values
 ('40000000-0000-0000-0000-000000000001','plumbing','ضمان السباكة','2025-01-01','2027-01-01'),
 ('40000000-0000-0000-0000-000000000001','electrical','ضمان الكهرباء','2025-01-01','2026-01-01');
insert into public.technicians (id,profile_id,full_name) values ('50000000-0000-0000-0000-000000000001','${U.tech}','فني');
`);

async function as(uid, sql, params) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`);
  try { return await db.query(sql, params); }
  finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`); }
}
async function expectFail(label, p) {
  try { await p; console.log('!! SHOULD FAIL:', label); process.exitCode = 1; } catch (e) { console.log('ok blocked:', label, '-', e.message.slice(0, 70)); }
}

// owner1 creates request
const r1 = await as(U.own1, `insert into public.maintenance_requests (unit_id, owner_id, category, location_in_unit, description, priority, status)
  values ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001','plumbing','المطبخ','تسريب تحت المغسلة','urgent','completed') returning id, ref_no, status, priority, warranty_state`);
console.log('created', r1.rows[0]);
const rid = r1.rows[0].id;
const r2 = await as(U.own1, `insert into public.maintenance_requests (unit_id, owner_id, category, location_in_unit, description)
  values ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001','electrical','الصالة','انقطاع الكهرباء في الصالة') returning ref_no, warranty_state, warranty_note`);
console.log('electrical', r2.rows[0]);

await expectFail('owner2 inserting on owner1 unit', as(U.own2, `insert into public.maintenance_requests (unit_id, owner_id, category, location_in_unit, description)
  values ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','plumbing','x','يحاول الاختراق')`));
console.log('owner2 sees requests:', (await as(U.own2, `select count(*) from public.maintenance_requests`)).rows[0]);
console.log('owner2 sees units:', (await as(U.own2, `select unit_number from public.units`)).rows);
console.log('owner2 sees owners:', (await as(U.own2, `select full_name from public.owners`)).rows);
console.log('tech sees requests before assign:', (await as(U.tech, `select count(*) from public.maintenance_requests`)).rows[0]);
await expectFail('owner updating status directly', as(U.own1, `update public.maintenance_requests set status='completed' where id=$1`, [rid]));
await expectFail('staff updating status directly', as(U.sup, `update public.maintenance_requests set status='completed' where id=$1`, [rid]));
await expectFail('owner transition', as(U.own1, `select public.transition_request($1,'approved',null)`, [rid]));
await expectFail('invalid transition', as(U.sup, `select public.transition_request($1,'completed',null)`, [rid]));

await as(U.sup, `select public.transition_request($1,'under_review','مراجعة')`, [rid]);
await as(U.sup, `update public.maintenance_requests set priority='high' where id=$1`, [rid]);
await as(U.sup, `select public.transition_request($1,'approved',null)`, [rid]);
const wo = (await as(U.sup, `select public.assign_request($1,'50000000-0000-0000-0000-000000000001','افحص المغسلة','high', now()+interval '1 day', null) as id`, [rid])).rows[0].id;
console.log('status after assign:', (await as(U.own1, `select status, technician_name, visit_at is not null as has_visit from public.request_overview where id=$1`, [rid])).rows[0]);
console.log('tech sees requests now:', (await as(U.tech, `select ref_no, owner_name, owner_phone from public.request_overview`)).rows);
await as(U.sup, `select public.schedule_visit($1, now()+interval '2 day', null, 'تغيير بطلب العميل')`, [rid]);

await as(U.tech, `select public.tech_start_work($1)`, [wo]);
await as(U.tech, `insert into public.work_order_parts (work_order_id,name,quantity,unit_cost) values ($1,'محبس',2,35)`, [wo]);
await as(U.tech, `insert into public.attachments (request_id, work_order_id, kind, storage_path, file_name) values ($1,$2,'before',$3,'a.jpg')`, [rid, wo, rid+'/a.jpg']);
await expectFail('submit without after photo', as(U.tech, `select public.tech_submit_work($1,'تم')`, [wo]));
await expectFail('owner uploading as before', as(U.own1, `insert into public.attachments (request_id, kind, storage_path, file_name) values ($1,'before',$2,'b.jpg')`, [rid, rid+'/b.jpg']));
await as(U.tech, `insert into public.attachments (request_id, work_order_id, kind, storage_path, file_name) values ($1,$2,'after',$3,'c.jpg')`, [rid, wo, rid+'/c.jpg']);
await as(U.tech, `insert into public.request_notes (request_id, body, is_internal) values ($1,'ملاحظة داخلية',true)`, [rid]);
await as(U.tech, `select public.tech_submit_work($1,'تم تغيير المحبس وإيقاف التسريب')`, [wo]);
await as(U.sup, `select public.review_work($1,false,'الصور غير واضحة')`, [wo]);
await as(U.tech, `select public.tech_start_work($1)`, [wo]);
await as(U.tech, `select public.tech_submit_work($1,'تمت الإعادة')`, [wo]);
await as(U.sup, `select public.review_work($1,true,'معتمد')`, [wo]);
await as(U.own1, `select public.owner_rate_request($1,5,'ممتاز')`, [rid]);
await expectFail('double rating', as(U.own1, `select public.owner_rate_request($1,4,'')`, [rid]));
await expectFail('owner2 reopen', as(U.own2, `select public.owner_reopen_request($1,'x')`, [rid]));
console.log('owner notes visible:', (await as(U.own1, `select count(*) from public.request_notes`)).rows[0]);
console.log('timeline:', (await as(U.own1, `select action, from_status, to_status, actor_name, note from public.activity_logs where request_id=$1 order by created_at`, [rid])).rows.map(r => `${r.action} ${r.from_status ?? ''}->${r.to_status ?? ''} by ${r.actor_name ?? '-'} ${r.note ?? ''}`));
console.log('owner notifications:', (await as(U.own1, `select type from public.notifications order by created_at`)).rows.map(r => r.type).join(', '));
console.log('tech notifications:', (await as(U.tech, `select type from public.notifications order by created_at`)).rows.map(r => r.type).join(', '));
console.log('sup notifications:', (await as(U.sup, `select type from public.notifications order by created_at`)).rows.map(r => r.type).join(', '));
await expectFail('owner reading outbox', as(U.own1, `select * from public.notification_outbox`));
await expectFail('notification insert', as(U.own1, `insert into public.notifications (user_id,type) values ($1,'x')`, [U.own2]));
await as(U.own1, `update public.notifications set read_at=now()`);

// quote flow on electrical (out of warranty)
const rid2 = (await db.query(`select id from public.maintenance_requests where category='electrical'`)).rows[0].id;
await as(U.sup, `select public.create_quote($1, 450, 'استبدال قاطع')`, [rid2]);
await expectFail('assign while quote pending', as(U.sup, `select public.assign_request($1,'50000000-0000-0000-0000-000000000001')`, [rid2]));
const q = (await as(U.own1, `select id from public.quotes where request_id=$1`, [rid2])).rows[0].id;
await expectFail('owner2 respond quote', as(U.own2, `select public.respond_quote($1,true)`, [q]));
await as(U.own1, `select public.respond_quote($1,true)`, [q]);
console.log('after quote:', (await db.query(`select status, is_paid from public.maintenance_requests where id=$1`, [rid2])).rows[0]);
await as(U.own1, `select public.owner_reopen_request($1,'رجع التسريب')`, [rid]);
console.log('reopened:', (await db.query(`select status, reopen_count, completed_at from public.maintenance_requests where id=$1`, [rid])).rows[0]);

// storage
await as(U.own1, `insert into storage.objects (bucket_id,name,owner_id) values ('attachments',$1,$2)`, [rid+'/x.jpg', U.own1]);
await expectFail('owner2 upload to owner1 request folder', as(U.own2, `insert into storage.objects (bucket_id,name,owner_id) values ('attachments',$1,$2)`, [rid+'/y.jpg', U.own2]));
console.log('owner2 sees objects:', (await as(U.own2, `select count(*) from storage.objects where bucket_id='attachments'`)).rows[0]);

const rep = (await as(U.admin, `select public.report_summary(current_date - 30, current_date) as r`)).rows[0].r;
console.log('report kpis', rep.kpis, 'techs', rep.technicians, 'byproj', rep.by_project);
await expectFail('owner report', as(U.own1, `select public.report_summary(current_date - 30, current_date)`));
await expectFail('owner update settings', as(U.own1, `update public.company_settings set name_ar='x'`).then(r => { if (r.affectedRows === 0) throw new Error('0 rows'); }));
await as(U.admin, `update public.company_settings set primary_color='#123456'`);
await expectFail('profile role escalation', as(U.own1, `update public.profiles set role='admin' where id=$1`, [U.own1]));
console.log('anon settings:', (await (async () => { await db.exec('set role anon'); const r = await db.query('select name_ar from public.company_settings'); await db.exec('reset role'); return r.rows; })()));
await expectFail('anon read units', (async () => { await db.exec('set role anon'); try { return await db.query('select * from public.units'); } finally { await db.exec('reset role'); } })());
console.log('DONE');
// public website: anon may list project names/images, nothing else
await (async () => {
  await db.exec('set role anon');
  try {
    const r = await db.query('select name_ar, image_url, sales_status from public.projects');
    console.log('anon projects list:', r.rows.length >= 1 ? 'ok' : '!! SHOULD SEE PROJECTS');
  } finally { await db.exec('reset role'); }
})();
await expectFail('anon read project created_by', (async () => { await db.exec('set role anon'); try { return await db.query('select created_at from public.projects'); } finally { await db.exec('reset role'); } })());
await expectFail('anon read owners', (async () => { await db.exec('set role anon'); try { return await db.query('select * from public.owners'); } finally { await db.exec('reset role'); } })());
