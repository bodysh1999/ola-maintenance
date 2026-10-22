#!/usr/bin/env node
/**
 * بيانات تجريبية واقعية — DEMO DATA ONLY
 *
 *   DEMO_SEED=yes npm run seed:demo            → create demo data
 *   DEMO_SEED=yes npm run seed:demo -- --purge → remove everything this script created
 *
 * Separation from production:
 *   • refuses to run unless DEMO_SEED=yes
 *   • every demo login uses the @demo.example.com domain, every demo project is tagged [DEMO]
 *   • --purge removes exactly those records (recommended: run demo on a separate Supabase project)
 *
 * The workflow is driven through the real RPCs while signed in as each demo user, so the
 * timeline, notifications and permissions are produced exactly as in production; dates are
 * then back-filled so dashboards show a realistic 60-day history.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DOMAIN = 'demo.example.com';
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo@12345';
const TAG = '[DEMO]';

if (process.env.DEMO_SEED !== 'yes') {
  console.error('✋ Set DEMO_SEED=yes to confirm you are seeding DEMO data (never run against production).');
  process.exit(1);
}
if (!URL || !ANON || !SERVICE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const ok = (res, label) => {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data;
};
const day = 86400000;
const iso = (d) => new Date(d).toISOString();
const dateOnly = (d) => iso(d).slice(0, 10);
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function listDemoUsers() {
  const users = [];
  for (let page = 1; page < 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`)));
    if (data.users.length < 200) break;
  }
  return users;
}

async function purge() {
  console.log('🧹 Removing demo data…');
  const { data: projects } = await admin.from('projects').select('id').like('description', `${TAG}%`);
  const projectIds = (projects ?? []).map((p) => p.id);
  if (projectIds.length) {
    const { data: units } = await admin.from('units').select('id, buildings!inner(project_id)').in('buildings.project_id', projectIds);
    const unitIds = (units ?? []).map((u) => u.id);
    if (unitIds.length) {
      const { data: reqs } = await admin.from('maintenance_requests').select('id').in('unit_id', unitIds);
      const reqIds = (reqs ?? []).map((r) => r.id);
      if (reqIds.length) {
        const { data: files } = await admin.from('attachments').select('storage_path').in('request_id', reqIds);
        if (files?.length) await admin.storage.from('attachments').remove(files.map((f) => f.storage_path));
        ok(await admin.from('maintenance_requests').delete().in('id', reqIds), 'delete requests');
      }
    }
    ok(await admin.from('projects').delete().in('id', projectIds), 'delete projects');
  }
  await admin.from('owners').delete().like('email', `%@${DOMAIN}`);
  await admin.from('contractors').delete().like('email', `%@${DOMAIN}`);
  for (const u of await listDemoUsers()) await admin.auth.admin.deleteUser(u.id); // cascades profiles & technicians
  console.log('✅ Demo data removed.');
}

async function createUser(email, full_name, role, phone) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    app_metadata: { role }, user_metadata: { full_name, phone },
  });
  if (error) throw new Error(`create ${email}: ${error.message}`);
  return data.user.id;
}

/** A supabase client signed in as a demo user (so RLS + RPC role checks apply) */
const sessions = new Map();
async function as(email) {
  if (sessions.has(email)) return sessions.get(email);
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  ok(await c.auth.signInWithPassword({ email, password: PASSWORD }), `sign in ${email}`);
  sessions.set(email, c);
  return c;
}

async function seed() {
  const existing = await listDemoUsers();
  if (existing.length) {
    console.error('Demo data already exists. Run with --purge first.');
    process.exit(1);
  }
  console.log('🌱 Seeding demo data…');

  // ---- staff
  const ADMIN = `admin@${DOMAIN}`;
  const SUP = `supervisor@${DOMAIN}`;
  await createUser(ADMIN, 'م. فيصل العتيبي', 'admin', '0550000001');
  await createUser(SUP, 'سارة الغامدي', 'supervisor', '0550000002');

  // ---- company settings (only fills empty contact fields)
  const { data: s } = await admin.from('company_settings').select('support_phone').eq('id', 1).single();
  if (!s?.support_phone) await admin.from('company_settings').update({ support_phone: '920000000', support_email: `care@${DOMAIN}` }).eq('id', 1);

  // ---- contractors & technicians
  const contractors = ok(await admin.from('contractors').insert([
    { name: 'مؤسسة البرودة المثالية للتكييف', cr_number: '4030000001', contact_name: 'خالد الزهراني', phone: '0551110001', email: `hvac@${DOMAIN}`, specialties: ['hvac', 'appliances'] },
    { name: 'شركة الإتقان للمقاولات', cr_number: '4030000002', contact_name: 'ماجد الحربي', phone: '0551110002', email: `etqan@${DOMAIN}`, specialties: ['tiles', 'painting', 'insulation', 'doors_windows'] },
  ]).select('id, name'), 'contractors');

  const techDefs = [
    { email: `tech.ahmed@${DOMAIN}`, name: 'أحمد السيد', phone: '0552220001', spec: ['electrical', 'appliances', 'other'], contractor: null },
    { email: `tech.yousef@${DOMAIN}`, name: 'يوسف الشهري', phone: '0552220002', spec: ['plumbing', 'insulation', 'other'], contractor: null },
    { email: `tech.imran@${DOMAIN}`, name: 'عمران خان', phone: '0552220003', spec: ['hvac', 'appliances'], contractor: contractors[0].id },
    { email: `tech.hassan@${DOMAIN}`, name: 'حسن المالكي', phone: '0552220004', spec: ['tiles', 'painting', 'doors_windows', 'insulation'], contractor: contractors[1].id },
    { email: `tech.omar@${DOMAIN}`, name: 'عمر باوزير', phone: '0552220005', spec: ['elevators', 'electrical'], contractor: null },
  ];
  const techs = [];
  for (const t of techDefs) {
    const uid = await createUser(t.email, t.name, 'technician', t.phone);
    const row = ok(await admin.from('technicians').insert({ profile_id: uid, full_name: t.name, phone: t.phone, specialties: t.spec, contractor_id: t.contractor }).select('id').single(), 'tech');
    techs.push({ ...t, id: row.id });
  }

  // ---- projects, buildings, units
  const projects = ok(await admin.from('projects').insert([
    { name_ar: 'واحة الشاطئ السكنية', name_en: 'Shati Oasis Residences', city: 'جدة', district: 'الشاطئ', delivery_year: 2024, description: `${TAG} مشروع شقق فاخرة على الكورنيش`,
      image_url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=70' },
    { name_ar: 'فلل الروضة', name_en: 'Al-Rawdah Villas', city: 'جدة', district: 'الروضة', delivery_year: 2025, description: `${TAG} مجمع فلل دوبلكس`,
      image_url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=70' },
  ]).select('id, name_ar'), 'projects');

  const buildings = ok(await admin.from('buildings').insert([
    { project_id: projects[0].id, name: 'A', floors_count: 8 },
    { project_id: projects[0].id, name: 'B', floors_count: 8 },
    { project_id: projects[1].id, name: 'المرحلة 1', floors_count: 2 },
  ]).select('id, project_id, name'), 'buildings');

  // ---- owners (some with accounts)
  const ownerDefs = [
    ['عبدالله الشمري', '0501234561'], ['نورة القحطاني', '0501234562'], ['محمد الدوسري', '0501234563'],
    ['ريم العمري', '0501234564'], ['تركي السبيعي', '0501234565'], ['هند باعشن', '0501234566'],
    ['سلطان الجهني', '0501234567'], ['لمى الحازمي', '0501234568'],
  ];
  const owners = [];
  for (let i = 0; i < ownerDefs.length; i++) {
    const [name, phone] = ownerDefs[i];
    const email = `owner${i + 1}@${DOMAIN}`;
    const withAccount = i < 6;
    const profileId = withAccount ? await createUser(email, name, 'owner', phone) : null;
    const row = ok(await admin.from('owners').insert({
      full_name: name, phone, email, profile_id: profileId, account_status: withAccount ? 'active' : 'pending',
    }).select('id').single(), 'owner');
    owners.push({ id: row.id, email, name, withAccount });
  }

  const now = Date.now();
  const unitRows = [];
  let o = 0;
  for (const b of buildings.slice(0, 2)) {
    for (let floor = 1; floor <= 4; floor++) {
      for (let n = 1; n <= 2; n++) {
        const handover = new Date(now - rnd(120, 700) * day);
        unitRows.push({ building_id: b.id, unit_number: `${b.name}-${floor}0${n}`, floor, unit_type: floor === 4 ? 'penthouse' : 'apartment',
          area_sqm: floor === 4 ? 310 : rnd(140, 210), bedrooms: floor === 4 ? 5 : rnd(3, 4),
          owner_id: o < owners.length * 2 ? owners[o++ % owners.length].id : null, handover_date: dateOnly(handover) });
      }
    }
  }
  for (let v = 1; v <= 6; v++) {
    unitRows.push({ building_id: buildings[2].id, unit_number: `V-${v}`, floor: 0, unit_type: 'villa', area_sqm: rnd(380, 520), bedrooms: 6,
      owner_id: owners[(v + 2) % owners.length].id, handover_date: dateOnly(now - rnd(60, 300) * day) });
  }
  const units = ok(await admin.from('units').insert(unitRows).select('id, owner_id, handover_date'), 'units');

  // ---- standard warranties per handed-over unit
  const W = [
    ['other', 'الضمان الإنشائي (الهيكل)', 10, 'الأساسات والأعمدة والجسور والأسقف الخرسانية', 'التعديلات الإنشائية من المالك'],
    ['insulation', 'ضمان العزل المائي والحراري', 10, 'عزل الأسطح ودورات المياه والخزانات', 'تركيبات المالك على السطح'],
    ['electrical', 'ضمان الأعمال الكهربائية', 2, 'التمديدات واللوحات والقواطع', 'أجهزة المالك وسوء الاستخدام'],
    ['plumbing', 'ضمان أعمال السباكة', 2, 'التمديدات والمحابس والصرف والسخانات', 'الانسداد بسبب سوء الاستخدام'],
    ['hvac', 'ضمان التكييف', 1, 'وحدات التكييف وتمديدات النحاس', 'تنظيف الفلاتر والصيانة الدورية'],
    ['elevators', 'ضمان المصاعد', 2, 'المحرك ولوحات التحكم', 'التحميل الزائد'],
    ['doors_windows', 'ضمان الأبواب والنوافذ', 1, 'المفصلات والأقفال والألمنيوم', 'الكسر الناتج عن الاستخدام'],
    ['tiles', 'ضمان البلاط والسيراميك', 1, 'التشققات والانفصال', 'الكسر بسبب سقوط أجسام'],
    ['painting', 'ضمان الدهانات', 1, 'التقشر والتشقق الطبيعي', 'الاتساخ والخدوش'],
  ];
  const warrantyRows = [];
  for (const u of units) {
    for (const [category, title, years, covered, excluded] of W) {
      const start = new Date(u.handover_date);
      const end = new Date(start); end.setFullYear(end.getFullYear() + years); end.setDate(end.getDate() - 1);
      warrantyRows.push({ unit_id: u.id, category, title, start_date: u.handover_date, end_date: dateOnly(end),
        covered_items: covered, excluded_items: excluded, responsible_party: 'إدارة خدمات ما بعد البيع',
        contractor_id: category === 'hvac' ? contractors[0].id : category === 'tiles' || category === 'painting' ? contractors[1].id : null });
    }
  }
  ok(await admin.from('warranties').insert(warrantyRows), 'warranties');

  // ---- maintenance requests driven through the real workflow
  const scenarios = [
    ['plumbing', 'المطبخ', 'تسريب ماء أسفل مغسلة المطبخ ويزداد عند فتح الماء الحار'],
    ['hvac', 'غرفة النوم الرئيسية', 'المكيف لا يبرد بشكل كافٍ ويصدر صوتًا عاليًا ليلًا'],
    ['electrical', 'الصالة', 'انقطاع متكرر في قاطع الإنارة عند تشغيل المكيف'],
    ['doors_windows', 'المدخل', 'باب المدخل الرئيسي لا يغلق بإحكام والقفل صعب الحركة'],
    ['tiles', 'دورة المياه', 'تشقق في بلاط أرضية دورة المياه بجانب البانيو'],
    ['insulation', 'السطح', 'ظهور بقع رطوبة في سقف الغرفة العلوية بعد الأمطار'],
    ['painting', 'المجلس', 'تقشر الدهان في الجدار المجاور للنافذة'],
    ['appliances', 'المطبخ', 'شفاط المطبخ لا يعمل على السرعة العالية'],
    ['elevators', 'المدخل', 'المصعد يتوقف بين الأدوار أحيانًا ويصدر إنذارًا'],
    ['plumbing', 'دورة المياه', 'ضعف ضغط الماء في الدش والسخان يستغرق وقتًا طويلًا'],
    ['hvac', 'الصالة', 'تسرب ماء من وحدة التكييف الداخلية على الجدار'],
    ['electrical', 'غرفة نوم', 'أفياش الغرفة لا تعمل بعد انقطاع الكهرباء'],
  ];
  // [final stage, days ago]
  const plan = [
    ['completed', 58], ['completed', 52], ['completed', 47], ['completed', 41], ['completed', 37], ['completed', 33],
    ['completed', 29], ['completed', 26], ['completed', 22], ['completed', 18], ['completed', 15], ['completed', 11],
    ['completed', 8], ['rejected', 20], ['pending_approval', 4], ['pending_approval', 3], ['in_progress', 3],
    ['awaiting_parts', 9], ['scheduled', 2], ['scheduled', 1], ['assigned', 2], ['approved', 1], ['under_review', 1],
    ['new', 0], ['new', 0], ['new', 6], ['quote', 5], ['reopened', 13],
  ];

  const supa = await as(SUP);
  const ownedUnits = units.filter((u) => owners.find((x) => x.id === u.owner_id && x.withAccount));
  let created = 0;
  for (let i = 0; i < plan.length; i++) {
    const [stage, ago] = plan[i];
    const unit = ownedUnits[i % ownedUnits.length];
    const owner = owners.find((x) => x.id === unit.owner_id);
    const [category, location, description] = stage === 'quote' ? ['appliances', 'المطبخ', 'طلب تركيب سخان إضافي لغرفة الغسيل'] : scenarios[i % scenarios.length];
    const oc = await as(owner.email);
    const req = ok(await oc.from('maintenance_requests').insert({
      unit_id: unit.id, owner_id: unit.owner_id, category, location_in_unit: location, description,
      preferred_date: dateOnly(now - (ago - 2) * day), preferred_slot: pick(['morning', 'afternoon', 'evening']),
    }).select('id, ref_no').single(), 'request');
    created++;

    const tech = techs.find((t) => t.spec.includes(category)) ?? techs[0];
    const tc = await as(tech.email);
    const rpc = async (client, fn, args) => ok(await client.rpc(fn, args), fn);

    if (stage === 'new') continue;
    if (stage === 'quote') {
      await rpc(supa, 'transition_request', { p_id: req.id, p_to: 'under_review', p_note: 'خارج نطاق الضمان — أعمال إضافية' });
      await rpc(supa, 'create_quote', { p_id: req.id, p_amount: 850, p_description: 'توريد وتركيب سخان 50 لتر مع التمديدات' });
      continue;
    }
    await rpc(supa, 'transition_request', { p_id: req.id, p_to: 'under_review', p_note: null });
    if (stage === 'under_review') continue;
    if (stage === 'rejected') {
      await rpc(supa, 'transition_request', { p_id: req.id, p_to: 'rejected', p_note: 'العطل ناتج عن تعديلات أجراها المالك على التمديدات وغير مشمول بالضمان' });
      continue;
    }
    await rpc(supa, 'transition_request', { p_id: req.id, p_to: 'approved', p_note: null });
    if (stage === 'approved') continue;

    const priority = pick(['medium', 'medium', 'high', 'low', 'urgent']);
    const visit = stage === 'scheduled' ? new Date(now + rnd(1, 3) * day) : new Date(now - Math.max(ago - 1, 0) * day);
    visit.setUTCHours(rnd(6, 13), 0, 0, 0); // 9:00–16:00 Riyadh
    const woId = await rpc(supa, 'assign_request', {
      p_id: req.id, p_technician: tech.id, p_instructions: 'يرجى التواصل مع العميل قبل الزيارة بساعة', p_priority: priority,
      p_starts: stage === 'assigned' ? null : iso(visit), p_ends: null,
    });
    if (stage === 'assigned' || stage === 'scheduled') continue;

    await rpc(tc, 'tech_start_work', { p_wo: woId });
    if (stage === 'awaiting_parts') {
      await rpc(tc, 'tech_awaiting_parts', { p_wo: woId, p_note: 'مطلوب كمبروسر بديل — تم طلبه من الوكيل' });
      continue;
    }
    ok(await tc.from('work_order_parts').insert([
      { work_order_id: woId, name: pick(['محبس زاوية', 'قاطع 20 أمبير', 'فلتر مكيف', 'مفصلة باب', 'سيليكون عازل', 'ريموت مكيف']), quantity: rnd(1, 3), unit_cost: rnd(25, 180) },
    ]), 'parts');
    if (stage === 'in_progress') continue;

    // after photo (a tiny generated PNG) is required before submitting
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const path = `${req.id}/${crypto.randomUUID()}.png`;
    ok(await tc.storage.from('attachments').upload(path, png, { contentType: 'image/png' }), 'upload');
    ok(await tc.from('attachments').insert({ request_id: req.id, work_order_id: woId, kind: 'after', storage_path: path, file_name: 'after.png', mime_type: 'image/png', size_bytes: png.length, uploaded_by: (await tc.auth.getUser()).data.user.id }), 'attachment');
    await rpc(tc, 'tech_submit_work', { p_wo: woId, p_notes: 'تم إصلاح العطل واختبار التشغيل بحضور العميل' });
    if (stage === 'pending_approval') continue;

    await rpc(supa, 'review_work', { p_wo: woId, p_approve: true, p_note: 'تم التحقق من الصور واعتماد الإنجاز' });
    if (stage === 'completed' && Math.random() < 0.85) {
      await rpc(oc, 'owner_rate_request', { p_id: req.id, p_score: pick([5, 5, 5, 4, 4, 3]), p_comment: pick(['خدمة ممتازة وسريعة', 'الفني محترف', null, 'شكرًا لكم']) });
    }
    if (stage === 'reopened') {
      await rpc(oc, 'owner_reopen_request', { p_id: req.id, p_reason: 'عاد التسريب بعد يومين من الإصلاح' });
    }
  }

  // ---- back-fill realistic dates (service role) so charts show history
  const { data: all } = await admin.from('maintenance_requests').select('id, status, created_at').in('unit_id', units.map((u) => u.id)).order('ref_no');
  for (let i = 0; i < (all ?? []).length; i++) {
    const r = all[i];
    const [, ago] = plan[i] ?? [null, 0];
    const created = now - ago * day - rnd(1, 8) * 3600000;
    const responded = created + rnd(1, 20) * 3600000;
    const completed = ['completed', 'reopened'].includes(r.status) || plan[i]?.[0] === 'completed' ? created + rnd(20, 110) * 3600000 : null;
    await admin.from('maintenance_requests').update({
      created_at: iso(created), first_response_at: r.status === 'new' ? null : iso(responded),
      completed_at: r.status === 'completed' ? iso(completed) : null, due_at: iso(created + 120 * 3600000),
    }).eq('id', r.id);
    const { data: logs } = await admin.from('activity_logs').select('id').eq('request_id', r.id).order('created_at');
    const span = (r.status === 'completed' ? completed : Math.min(now, created + ago * day * 0.8)) - created;
    for (let j = 0; j < (logs ?? []).length; j++) {
      await admin.from('activity_logs').update({ created_at: iso(created + (span * j) / Math.max(1, logs.length - 1)) }).eq('id', logs[j].id);
    }
    await admin.from('work_orders').update({ created_at: iso(responded) }).eq('request_id', r.id);
    if (r.status === 'completed') await admin.from('work_orders').update({ submitted_at: iso(completed - 3600000) }).eq('request_id', r.id).eq('status', 'approved');
  }

  console.log(`✅ Done: ${projects.length} projects, ${units.length} units, ${owners.length} owners, ${techs.length} technicians, ${created} requests.`);
  console.log('\nDemo logins (password: ' + PASSWORD + ')');
  console.log(`  Admin        ${ADMIN}`);
  console.log(`  Maintenance  ${SUP}`);
  console.log(`  Technician   ${techDefs[0].email}`);
  console.log(`  Owner        ${owners[0].email}`);
}

(process.argv.includes('--purge') ? purge() : seed()).catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
