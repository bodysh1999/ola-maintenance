// Tests for migrations 6–7: public leads/booking/applications, sales & HR access
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const dir = new URL('../migrations', import.meta.url).pathname;
const db = new PGlite();
await db.exec(`
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
grant usage on schema storage to anon, authenticated; grant all on storage.objects to anon, authenticated;
`);
for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(`${dir}/${f}`, 'utf8'));
let failed = 0;
const U = { admin: 'a0000000-0000-0000-0000-000000000001', sales: 'a0000000-0000-0000-0000-000000000002', hr: 'a0000000-0000-0000-0000-000000000003', owner: 'a0000000-0000-0000-0000-000000000004' };
await db.exec(`insert into auth.users (id,email,raw_app_meta_data) values
 ('${U.admin}','a@x','{"role":"admin"}'),('${U.sales}','s@x','{"role":"sales"}'),('${U.hr}','h@x','{"role":"hr"}'),('${U.owner}','o@x','{"role":"owner"}');
 insert into projects (id,name_ar,sales_status,map_query) values ('10000000-0000-0000-0000-000000000001','عُلا 21','selling','21.5,39.2');
 insert into buildings (id,project_id,name) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','A');
 insert into owners (id,profile_id,full_name,phone,account_status) values ('30000000-0000-0000-0000-000000000001','${U.owner}','o','050','active');
 insert into units (id,building_id,unit_number,price,sale_status,owner_id) values
  ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','101',950000,'available',null),
  ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','102',990000,'sold','30000000-0000-0000-0000-000000000001');`);
const as = async (uid, sql, params) => {
  await db.exec(uid ? `set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
  try { return await db.query(sql, params); } finally { await db.exec(`reset role;`); }
};
const ok = (label, cond) => { console.log(cond ? 'ok' : '!! FAIL', label); if (!cond) failed++; };
const fails = async (label, p) => { try { await p; console.log('!! SHOULD FAIL', label); failed++; } catch (e) { console.log('ok blocked:', label, '-', e.message.slice(0, 60)); } };

const pub = await as(null, `select u.unit_number, u.price, u.sale_status from units u`);
ok('anon sees only available units', pub.rows.length === 1 && pub.rows[0].unit_number === '101');
await fails('anon reads unit owner', as(null, `select owner_id from units`));
ok('anon sees project location', (await as(null, `select map_query from projects`)).rows[0].map_query === '21.5,39.2');

const v = await as(null, `select public.submit_lead('visit','محمد','0551234567','10000000-0000-0000-0000-000000000001',null,null,null,null,current_date+1,'مساءً','') r`);
ok('visit lead ref ' + v.rows[0].r, /^LD-\d\d-\d{5}$/.test(v.rows[0].r));
const b = await as(null, `select public.submit_lead('booking','سارة','+966551234568',null,'40000000-0000-0000-0000-000000000001') r`);
ok('booking lead', !!b.rows[0].r);
await fails('book sold unit', as(null, `select public.submit_lead('booking','x y','0551234569',null,'40000000-0000-0000-0000-000000000002')`));
await fails('bad phone', as(null, `select public.submit_lead('visit','x y','12345')`));
await fails('service without service', as(null, `select public.submit_lead('service','x y','0551234560')`));
ok('service lead', !!(await as(null, `select public.submit_lead('service','خالد','0551234560',null,null,'design_build') r`)).rows[0].r);
for (let i = 0; i < 5; i++) await as(null, `select public.submit_lead('inquiry','x y','0559999999')`);
await fails('rate limit', as(null, `select public.submit_lead('inquiry','x y','0559999999')`));
await fails('anon reads leads', as(null, `select * from leads`));
ok('owner sees no leads', (await as(U.owner, `select count(*) c from leads`)).rows[0].c === 0);
ok('hr sees no leads', (await as(U.hr, `select count(*) c from leads`)).rows[0].c === 0);
ok('sales sees leads', (await as(U.sales, `select count(*) c from leads`)).rows[0].c >= 3);
const bk = (await as(U.sales, `select project_id from leads where kind='booking'`)).rows[0];
ok('booking linked to project', bk.project_id === '10000000-0000-0000-0000-000000000001');
await as(U.sales, `update leads set status='contacted', internal_notes='اتصلت' where kind='visit'`);
await fails('sales edits lead name', as(U.sales, `update leads set full_name='x'`));
await as(U.sales, `update units set sale_status='reserved' where id='40000000-0000-0000-0000-000000000001'`);
ok('sales reserved unit', (await db.query(`select sale_status from units where unit_number='101'`)).rows[0].sale_status === 'reserved');
ok('sales notified', (await as(U.sales, `select count(*) c from notifications where type='lead_new'`)).rows[0].c >= 3);
ok('admin notified', (await as(U.admin, `select count(*) c from notifications where type='lead_new'`)).rows[0].c >= 3);

// careers
const op = (await as(null, `select id from job_openings where is_open`)).rows;
ok('anon sees open jobs', op.length === 1);
const cv = 'applications/0b6c6f9e-5d2c-4c1a-9b3a-2a1d1e0f9c11.pdf';
await as(null, `insert into storage.objects (bucket_id,name) values ('cvs','${cv}')`);
await fails('anon uploads odd path', as(null, `insert into storage.objects (bucket_id,name) values ('cvs','x/../evil.exe')`));
ok('anon cannot list cvs', (await as(null, `select count(*) c from storage.objects where bucket_id='cvs'`)).rows[0].c === 0);
ok('hr can read cvs', (await as(U.hr, `select count(*) c from storage.objects where bucket_id='cvs'`)).rows[0].c === 1);
ok('sales cannot read cvs', (await as(U.sales, `select count(*) c from storage.objects where bucket_id='cvs'`)).rows[0].c === 0);
const app = await as(null, `select public.submit_application('job','نورة','0551112223','n@x.com',$1,'جدة','بكالوريوس','هندسة مدنية','جامعة الملك عبدالعزيز',4,null,$2,null) r`, [op[0].id, cv]);
ok('application ref ' + app.rows[0].r, /^HR-\d\d-\d{5}$/.test(app.rows[0].r));
ok('training application', !!(await as(null, `select public.submit_application('training','ريم','0551112224','r@x.com',null,null,null,null,null,null,null,null,null,current_date+30,current_date+90) r`)).rows[0].r);
await fails('javascript: linkedin link', as(null, `select public.submit_application('job','x y','0551112226','js@x.com',null,null,null,null,null,null,'javascript:alert(1)',null,null)`), 'INVALID_URL');
ok('https linkedin accepted', !!(await as(null, `select public.submit_application('training','سارة','0551112227','s@x.com',null,null,null,null,null,null,'https://www.linkedin.com/in/sara',null,null,current_date+30,current_date+90) r`)).rows[0].r);
await db.exec(`delete from notifications where type='application_new' and created_at = (select max(created_at) from notifications where type='application_new'); delete from job_applications where email='s@x.com'`);
await fails('bad cv path',as(null, `select public.submit_application('job','x y','0551112225','x@x.com',null,null,null,null,null,null,null,'../../etc/passwd')`));
await fails('anon reads applications', as(null, `select * from job_applications`));
ok('sales sees no applications', (await as(U.sales, `select count(*) c from job_applications`)).rows[0].c === 0);
ok('hr sees applications', (await as(U.hr, `select count(*) c from job_applications`)).rows[0].c === 2);
await as(U.hr, `insert into job_openings (title) values ('محاسب')`);
await fails('sales creates opening', as(U.sales, `insert into job_openings (title) values ('x')`));
ok('hr notified', (await as(U.hr, `select count(*) c from notifications where type='application_new'`)).rows[0].c === 2);
console.log(failed ? `FAILED: ${failed}` : 'ALL PASSED');
process.exitCode = failed ? 1 : 0;
await fails('sales changes unit owner', as(U.sales, `update units set owner_id='30000000-0000-0000-0000-000000000001' where unit_number='101'`));
ok('sales sees team', (await as(U.sales, `select count(*) c from profiles`)).rows[0].c === 3);
ok('owner sees only self', (await as(U.owner, `select count(*) c from profiles`)).rows[0].c === 1);
if (failed) { console.log(`FAILED: ${failed}`); process.exitCode = 1; }
