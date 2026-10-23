import type { CompanySettings, Locale } from './types';

export type LegalSection = { title: string; body: (string | string[])[] };
type S = CompanySettings & {
  privacy_version?: string; privacy_updated_on?: string; dpo_name?: string | null; dpo_email?: string | null;
  data_hosting_region?: string | null; retention_cv_months?: number; retention_leads_months?: number; retention_notif_days?: number;
};

/** Privacy policy (PDPL arts. 12–13): who we are, what we collect, why, legal basis, sharing, location, retention, rights */
export function privacyPolicy(locale: Locale, s: S): LegalSection[] {
  const name = locale === 'ar' ? s.name_ar : s.name_en;
  const contact = [s.dpo_email || s.support_email, s.support_phone].filter(Boolean).join(' · ');
  const region = s.data_hosting_region || (locale === 'ar' ? 'مزودي خدمات سحابية موثوقين' : 'trusted cloud providers');
  const cv = s.retention_cv_months ?? 24, leads = s.retention_leads_months ?? 24, notif = s.retention_notif_days ?? 365;

  if (locale === 'en') {
    return [
      { title: '1. Who we are', body: [
        `${name} ("the Company") is the controller of the personal data processed through this website and its portals (owners, staff, technicians).`,
        `Data protection contact: ${s.dpo_name ? `${s.dpo_name} — ` : ''}${contact || '—'}.`,
      ] },
      { title: '2. Data we collect', body: [[
        'Visitors: name, mobile, email, city, the project/unit or service you ask about, preferred visit time and your message.',
        'Job and training applicants: contact details, education, experience, LinkedIn link and CV.',
        'Unit owners: name, mobile, email, owned units, unit documents (contract, deed, handover report, drawings), warranties, maintenance requests with photos/videos, appointments, quotations, ratings and messages.',
        'Employees: identity and contact data, job and department, hire date, contract, salary and allowances, ID/residency and bank details, attendance with location at check-in/out, leave and other requests and their attachments.',
        'Technicians and contractors: name, mobile, specialties, photo, assigned tasks and reports.',
        'Technical data: sign-in session and language cookies, and records of changes to sensitive data.',
      ]] },
      { title: '3. Why we use it and on what legal basis', body: [[
        'Answering your booking, visit, service or job request — your consent and taking steps at your request.',
        'Handing over units and providing warranty and after-sales services — performance of the sale contract.',
        'Employment, payroll data, attendance and HR letters — the employment contract and the Labor Law.',
        'Sending request updates by WhatsApp/SMS and marketing new projects — your consent, which you can withdraw at any time.',
        'Security, fraud prevention and auditing changes — our legal obligations and legitimate interest in protecting the data.',
      ]] },
      { title: '4. Who receives it', body: [[
        'Company staff, each according to their role only (sales, after-sales, HR, management).',
        'Technicians and contractors assigned to your request — only what they need to do the work (no contracts or deeds).',
        'Service providers acting on our behalf: cloud hosting, messaging (SMS/WhatsApp) and email providers, bound by contracts.',
        'Government authorities when required by law.',
        'We do not sell personal data.',
      ]] },
      { title: '5. Where it is stored', body: [
        `Data is stored with ${region}. When data is processed outside the Kingdom, this is done according to the Regulation on Personal Data Transfer Outside the Kingdom and with appropriate safeguards.`,
      ] },
      { title: '6. How long we keep it', body: [[
        `Visitor requests: up to ${leads} months unless they become a contract.`,
        `CVs and applications: up to ${cv} months unless you are hired.`,
        `Notifications: ${notif} days.`,
        'Owner, unit, warranty and maintenance records: for the life of the relationship and the warranty, then as required by law.',
        'Employee records: for the employment and the periods required by the Labor Law.',
        'Change (audit) records: 5 years.',
      ]] },
      { title: '7. How we protect it', body: [
        'Encrypted connections, role-based permissions enforced in the database (each user sees only their own data), private files served through short-lived links, partial masking of ID numbers on public verification pages, optional two-step login, and a record of changes to sensitive data.',
      ] },
      { title: '8. Your rights', body: [[
        'To know how your data is processed (this policy).',
        'To get a copy of your data — from "My data & privacy" in the portal, instantly.',
        'To correct incomplete or wrong data.',
        'To request deletion when the data is no longer needed, unless the law requires keeping it.',
        'To withdraw consent at any time, as easily as you gave it.',
        'We answer requests within 30 days. You can also contact us at the details above.',
        'You may file a complaint with the Saudi Data & AI Authority (SDAIA).',
      ]] },
      { title: '9. Cookies', body: ['We only use cookies needed for signing in and remembering your language. We do not use advertising or tracking cookies.'] },
      { title: '10. Changes', body: [`This is version ${s.privacy_version ?? '1.0'}. When we change it materially, we ask you to accept the new version in the portal.`] },
    ];
  }

  return [
    { title: '1. من نحن', body: [
      `${name} ("الشركة") هي الجهة المسؤولة (جهة التحكم) عن البيانات الشخصية التي تُعالج عبر هذا الموقع وبواباته (الملاك، الموظفين، الفنيين).`,
      `التواصل بخصوص حماية البيانات: ${s.dpo_name ? `${s.dpo_name} — ` : ''}${contact || '—'}.`,
    ] },
    { title: '2. البيانات التي نجمعها', body: [[
      'الزوار: الاسم، الجوال، البريد، المدينة، المشروع أو الوحدة أو الخدمة المطلوبة، موعد الزيارة المفضل، ورسالتك.',
      'المتقدمون للتوظيف والتدريب: بيانات التواصل، المؤهل، الخبرة، رابط لينكدإن، والسيرة الذاتية.',
      'ملاك الوحدات: الاسم، الجوال، البريد، الوحدات المملوكة، مستندات الوحدة (العقد، الصك، محضر الاستلام، المخططات)، الضمانات، بلاغات الصيانة وصورها، المواعيد، عروض الأسعار، التقييمات والمحادثات.',
      'الموظفون: بيانات الهوية والتواصل، الوظيفة والقسم، تاريخ المباشرة، العقد، الراتب والبدلات، رقم الهوية أو الإقامة والحساب البنكي، الحضور والانصراف مع الموقع وقت البصمة، الإجازات والطلبات ومرفقاتها.',
      'الفنيون والمقاولون: الاسم، الجوال، التخصصات، الصورة، المهام والتقارير.',
      'بيانات تقنية: ملفات تعريف الارتباط الخاصة بتسجيل الدخول واللغة، وسجل التعديلات على البيانات الحساسة.',
    ]] },
    { title: '3. أغراض المعالجة والأساس النظامي', body: [[
      'الرد على طلب الحجز أو الزيارة أو الخدمة أو التوظيف — بناءً على موافقتك وطلبك.',
      'تسليم الوحدات وتقديم خدمات الضمان وما بعد البيع — تنفيذًا لعقد البيع.',
      'التوظيف والرواتب والحضور وخطابات الموارد البشرية — تنفيذًا لعقد العمل ونظام العمل.',
      'إرسال تحديثات الطلبات عبر واتساب و SMS والتسويق للمشاريع الجديدة — بناءً على موافقتك، ويمكنك سحبها في أي وقت.',
      'الأمان ومنع الاحتيال وتوثيق التعديلات — التزامًا بالأنظمة وحمايةً للبيانات.',
    ]] },
    { title: '4. الجهات التي تستلم البيانات', body: [[
      'موظفو الشركة، كلٌ حسب دوره فقط (المبيعات، خدمات ما بعد البيع، الموارد البشرية، الإدارة).',
      'الفني أو المقاول المكلّف بطلبك — بالقدر اللازم لتنفيذ العمل فقط (دون العقود أو الصكوك).',
      'مزودو خدمات يعملون نيابة عنا: الاستضافة السحابية، ومزودو الرسائل (SMS وواتساب) والبريد، بموجب عقود.',
      'الجهات الحكومية عندما يتطلب النظام ذلك.',
      'لا نبيع البيانات الشخصية.',
    ]] },
    { title: '5. مكان حفظ البيانات', body: [
      `تُحفظ البيانات لدى ${region}. وعند معالجة البيانات خارج المملكة يتم ذلك وفق لائحة نقل البيانات الشخصية إلى خارج المملكة وبالضمانات المناسبة.`,
    ] },
    { title: '6. مدة الاحتفاظ', body: [[
      `طلبات الزوار: حتى ${leads} شهرًا ما لم تتحول إلى عقد.`,
      `السير الذاتية وطلبات التوظيف: حتى ${cv} شهرًا ما لم يتم التوظيف.`,
      `الإشعارات: ${notif} يومًا.`,
      'سجلات الملاك والوحدات والضمانات والصيانة: طوال مدة العلاقة والضمان، ثم وفق ما تتطلبه الأنظمة.',
      'سجلات الموظفين: طوال مدة العمل والمدد التي يتطلبها نظام العمل.',
      'سجل التعديلات: 5 سنوات.',
    ]] },
    { title: '7. حماية البيانات', body: [
      'اتصال مشفّر، وصلاحيات مطبقة على مستوى قاعدة البيانات بحيث يرى كل مستخدم بياناته فقط، وملفات خاصة لا تُفتح إلا بروابط مؤقتة، وإخفاء جزئي لأرقام الهوية في صفحات التحقق العامة، وتحقق بخطوتين، وسجل للتعديلات على البيانات الحساسة.',
    ] },
    { title: '8. حقوقك', body: [[
      'العلم بكيفية معالجة بياناتك (هذه السياسة).',
      'الحصول على نسخة من بياناتك — فورًا من صفحة "بياناتي وخصوصيتي" في البوابة.',
      'تصحيح البيانات الناقصة أو غير الصحيحة.',
      'طلب حذف البيانات عند انتفاء الحاجة إليها، ما لم يُلزمنا النظام بالاحتفاظ بها.',
      'سحب موافقتك في أي وقت وبنفس سهولة منحها.',
      'نرد على الطلبات خلال 30 يومًا، ويمكنك التواصل معنا عبر البيانات أعلاه.',
      'يحق لك تقديم شكوى إلى الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).',
    ]] },
    { title: '9. ملفات تعريف الارتباط', body: ['لا نستخدم إلا ملفات تعريف الارتباط الضرورية لتسجيل الدخول وتذكّر اللغة، ولا نستخدم ملفات إعلانية أو للتتبع.'] },
    { title: '10. التعديلات', body: [`هذا الإصدار ${s.privacy_version ?? '1.0'}. عند أي تعديل جوهري نطلب منك الموافقة على الإصدار الجديد داخل البوابة.`] },
  ];
}

/** Terms of use for the website and portals */
export function termsOfUse(locale: Locale, s: S): LegalSection[] {
  const name = locale === 'ar' ? s.name_ar : s.name_en;
  if (locale === 'en') {
    return [
      { title: '1. Acceptance', body: [`By using this website or its portals you accept these terms and the privacy policy of ${name}.`] },
      { title: '2. Accounts', body: [[
        'Accounts are created by the Company for owners, staff and technicians. Keep your password confidential and change any temporary password.',
        'You are responsible for activity under your account. Tell us immediately about any unauthorized use.',
        'The Company may suspend accounts that are misused or no longer related to it.',
      ]] },
      { title: '3. Maintenance and warranty', body: [[
        'Warranty coverage, periods and exclusions are as stated in each unit’s warranty certificate.',
        'The system’s automatic warranty check is indicative; the after-sales team confirms the final classification.',
        'Work outside warranty is carried out only after you approve a quotation.',
        'Appointments are confirmed by the team; please be available or request another time in the portal.',
      ]] },
      { title: '4. Acceptable use', body: [[
        'Use the portals only for their purpose and provide accurate information.',
        'Do not upload unlawful content or files that are not yours, and do not try to access data that is not yours.',
      ]] },
      { title: '5. Documents and certificates', body: ['Documents and certificates issued electronically by the system can be verified on the Company’s verification page. Prices and availability shown on the website are indicative until a contract is signed.'] },
      { title: '6. Liability', body: ['The Company works to keep the service available and secure, but it may be interrupted for maintenance or reasons beyond its control.'] },
      { title: '7. Governing law', body: ['These terms are governed by the laws of the Kingdom of Saudi Arabia, and the competent Saudi courts have jurisdiction.'] },
    ];
  }
  return [
    { title: '1. القبول', body: [`باستخدامك هذا الموقع أو بواباته فإنك توافق على هذه الشروط وعلى سياسة الخصوصية الخاصة بـ ${name}.`] },
    { title: '2. الحسابات', body: [[
      'تنشئ الشركة الحسابات للملاك والموظفين والفنيين. حافظ على سرية كلمة المرور وغيّر كلمة المرور المؤقتة.',
      'أنت مسؤول عن أي نشاط يتم من خلال حسابك، وأبلغنا فورًا عن أي استخدام غير مصرح به.',
      'يحق للشركة إيقاف الحسابات التي يُساء استخدامها أو لم تعد ذات علاقة بها.',
    ]] },
    { title: '3. الصيانة والضمان', body: [[
      'يسري الضمان ومدده واستثناءاته وفق ما هو مذكور في شهادة الضمان الخاصة بكل وحدة.',
      'الفحص الآلي للضمان في النظام استرشادي، ويؤكد فريق ما بعد البيع التصنيف النهائي.',
      'لا تُنفّذ الأعمال خارج الضمان إلا بعد موافقتك على عرض السعر.',
      'يؤكد الفريق المواعيد، ويُرجى التواجد أو طلب موعد آخر من البوابة.',
    ]] },
    { title: '4. الاستخدام المقبول', body: [[
      'استخدم البوابات للغرض المخصص لها فقط، وقدّم بيانات صحيحة.',
      'لا ترفع محتوى مخالفًا أو ملفات لا تملكها، ولا تحاول الوصول إلى بيانات لا تخصك.',
    ]] },
    { title: '5. المستندات والشهادات', body: ['يمكن التحقق من المستندات والشهادات الصادرة إلكترونيًا من النظام عبر صفحة التحقق في موقع الشركة. الأسعار والتوفر المعروضة في الموقع استرشادية حتى توقيع العقد.'] },
    { title: '6. المسؤولية', body: ['تعمل الشركة على إتاحة الخدمة وأمانها، وقد تتوقف الخدمة مؤقتًا للصيانة أو لأسباب خارجة عن إرادتها.'] },
    { title: '7. النظام الواجب التطبيق', body: ['تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتختص المحاكم السعودية المختصة بأي نزاع.'] },
  ];
}

/** Record of processing activities (PDPL) — shown to the admin and printable */
export function processingRecord(locale: Locale, s: S) {
  const ar = locale === 'ar';
  const cv = s.retention_cv_months ?? 24, leads = s.retention_leads_months ?? 24;
  const rows: [string, string, string, string, string, string][] = ar ? [
    ['طلبات الزوار (حجز، زيارة، خدمات)', 'الاسم، الجوال، البريد، المدينة، الرسالة', 'الرد على الطلب والمبيعات', 'الموافقة', `${leads} شهرًا`, 'فريق المبيعات'],
    ['التوظيف والتدريب', 'بيانات التواصل، المؤهل، الخبرة، السيرة الذاتية', 'فرز المتقدمين والتوظيف', 'الموافقة', `${cv} شهرًا`, 'الموارد البشرية'],
    ['بوابة الملاك والصيانة', 'بيانات المالك، الوحدات، البلاغات، الصور، المواعيد، التقييم', 'خدمات الضمان وما بعد البيع', 'تنفيذ العقد', 'مدة العلاقة والضمان', 'ما بعد البيع، الفنيون والمقاولون'],
    ['ملف الوحدة', 'العقد، الصك، محضر الاستلام، المخططات', 'تمكين المالك من مستنداته', 'تنفيذ العقد', 'مدة الملكية', 'المالك والإدارة فقط'],
    ['الموارد البشرية', 'الهوية، العقد، الراتب، الحساب البنكي، الحضور والموقع، الإجازات ومرفقاتها', 'إدارة العمل والرواتب والخطابات', 'عقد العمل ونظام العمل', 'مدة العمل + المدد النظامية', 'الموارد البشرية، المدير المباشر'],
    ['الإشعارات والرسائل', 'الجوال، البريد، نص التحديث', 'إبلاغ المستخدم بتحديثات طلبه', 'الموافقة / تنفيذ العقد', `${s.retention_notif_days ?? 365} يومًا`, 'مزودو الرسائل'],
    ['سجل التعديلات', 'المستخدم، الوقت، الحقول المعدلة', 'الأمان والمساءلة', 'الالتزام النظامي', '5 سنوات', 'الإدارة فقط'],
  ] : [
    ['Visitor requests (booking, visit, services)', 'Name, mobile, email, city, message', 'Answer the request, sales', 'Consent', `${leads} months`, 'Sales team'],
    ['Jobs and training', 'Contact, education, experience, CV', 'Screening and hiring', 'Consent', `${cv} months`, 'HR'],
    ['Owner portal & maintenance', 'Owner data, units, requests, photos, appointments, ratings', 'Warranty and after-sales', 'Contract', 'Relationship + warranty', 'After-sales, technicians, contractors'],
    ['Unit file', 'Contract, deed, handover report, drawings', 'Give owners their documents', 'Contract', 'Ownership period', 'Owner and management only'],
    ['Human resources', 'ID, contract, salary, bank, attendance with location, leave', 'Employment, payroll, letters', 'Employment contract & Labor Law', 'Employment + legal periods', 'HR, line manager'],
    ['Notifications & messages', 'Mobile, email, update text', 'Tell users about their requests', 'Consent / contract', `${s.retention_notif_days ?? 365} days`, 'Messaging providers'],
    ['Audit log', 'User, time, changed fields', 'Security and accountability', 'Legal obligation', '5 years', 'Management only'],
  ];
  return rows;
}

/** Breach response steps (PDPL: notify SDAIA within 72 hours) */
export function breachPlan(locale: Locale): string[] {
  return locale === 'ar' ? [
    'الاحتواء فورًا: أوقف الحساب أو المفتاح المتأثر، وغيّر كلمات المرور ومفاتيح Supabase/Vercel عند الحاجة.',
    'التقييم: حدّد البيانات المتأثرة وعدد الأشخاص ووقت الحادثة من سجل التعديلات وسجلات الاستضافة.',
    'الإبلاغ: أبلغ الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا) خلال 72 ساعة من العلم بالحادثة عبر منصة حوكمة البيانات، مع وصف الحادثة والبيانات والإجراءات المتخذة.',
    'إشعار أصحاب البيانات المتأثرين دون تأخير إذا كانت الحادثة قد تلحق بهم ضررًا، مع توضيح ما يجب عليهم فعله.',
    'المعالجة: أصلح السبب، وأعد التحقق من الصلاحيات والنسخ الاحتياطية.',
    'التوثيق: سجّل الحادثة والقرارات والتواريخ، واحتفظ بها ضمن سجل الامتثال.',
  ] : [
    'Contain immediately: disable the affected account or key; rotate passwords and Supabase/Vercel keys if needed.',
    'Assess: identify the data, the number of people and the time of the incident from the audit log and hosting logs.',
    'Report to the Saudi Data & AI Authority (SDAIA) within 72 hours of becoming aware, through the National Data Governance Platform, describing the incident, the data and the measures taken.',
    'Notify affected people without delay if the incident may harm them, explaining what they should do.',
    'Fix the cause and re-check permissions and backups.',
    'Document the incident, decisions and dates in the compliance record.',
  ];
}
