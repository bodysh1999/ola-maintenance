/**
 * نصوص صفحات الموقع الداخلية: المشروع، الخدمات، الوظائف، النماذج.
 * عدّل الخدمات من هنا (المفتاح key يُحفظ مع طلب العميل).
 */
import type { Locale } from './types';

export const SERVICE_KEYS = [
  'design_build', 'construction', 'supervision', 'consulting',
  'property_management', 'marketing', 'feasibility', 'inspection',
] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];

const ar = {
  form: {
    name: 'الاسم الكامل', phone: 'رقم الجوال', email: 'البريد الإلكتروني', city: 'المدينة', date: 'التاريخ المفضل',
    time: 'الوقت المفضل', message: 'ملاحظات أو تفاصيل إضافية', optional: 'اختياري',
    times: ['صباحًا', 'ظهرًا', 'مساءً'], submit: 'إرسال الطلب', sending: 'جارٍ الإرسال…',
    consent: 'بإرسال الطلب توافق على تواصل فريق علا التميز معك بخصوصه.',
    done: 'تم استلام طلبك', doneRef: 'رقم الطلب', doneBody: 'سيتواصل معك الفريق المختص في أقرب وقت. احتفظ برقم الطلب للمتابعة.',
    another: 'إرسال طلب آخر', phoneHint: '05xxxxxxxx',
  },
  project: {
    back: 'كل المشاريع', overview: 'عن المشروع', location: 'الموقع', openMaps: 'افتح في خرائط Google', visitHours: 'أوقات الزيارة',
    address: 'العنوان', units: 'الوحدات المتاحة', unitsBody: 'الأسعار شاملة قيمة الوحدة وقد تتغير — يؤكدها فريق المبيعات عند الحجز.',
    noUnits: 'لا توجد وحدات معروضة حاليًا — اطلب زيارة أو تواصل مع المبيعات لمعرفة المتاح.',
    unit: 'وحدة', floor: 'الدور', area: 'المساحة', bedrooms: 'غرف', bathrooms: 'دورات مياه', price: 'السعر', sar: 'ر.س', m2: 'م²',
    from: 'تبدأ من', available: 'متاحة', reserved: 'محجوزة', book: 'احجز وحدتك', bookThis: 'احجز هذه الوحدة',
    bookTitle: 'طلب حجز وحدة', bookBody: 'اختر الوحدة وأرسل بياناتك، وسيتواصل معك موظف المبيعات لتأكيد الحجز وإجراءاته.',
    chooseUnit: 'الوحدة', visitTitle: 'طلب زيارة المشروع', visitBody: 'حدد اليوم والوقت المناسبين لك، وسيؤكد فريق المبيعات الموعد ويستقبلك في الموقع.',
    visitCta: 'احجز زيارة', stage: 'المرحلة', delivery: 'سنة التسليم', soldOut: 'هذا المشروع مباع بالكامل — يسعدنا عرض مشاريعنا الحالية عليك.',
    interest: 'سجّل اهتمامك', interestBody: 'المشروع في مرحلة الإنشاء — سجّل اهتمامك ليتواصل معك فريق المبيعات عند فتح الحجز.',
  },
  projectsPage: { title: 'مشاريعنا', body: 'مشاريع سكنية في جدة بتصميم حديث وتنفيذ منضبط — من مرحلة الإنشاء حتى التسليم وخدمة ما بعد البيع.' },
  services: {
    title: 'خدماتنا',
    body: 'خبرة أكثر من عشرين عامًا في التطوير العقاري نضعها بين يديك — من الفكرة والتصميم إلى التنفيذ والإشراف والتشغيل.',
    main: 'الخدمات الرئيسية', more: 'خدمات عقارية أخرى', request: 'اطلب الخدمة', choose: 'الخدمة المطلوبة',
    formTitle: 'اطلب خدمة', formBody: 'أخبرنا عن مشروعك وسيتواصل معك مختص لترتيب زيارة أو اجتماع ودراسة الاحتياج.',
    process: 'كيف نعمل', steps: [
      ['استقبال الطلب', 'نتعرف على احتياجك وموقع مشروعك'],
      ['المعاينة والدراسة', 'زيارة الموقع ومراجعة المخططات والمتطلبات'],
      ['العرض الفني والمالي', 'نطاق عمل واضح وجدول زمني وتكلفة'],
      ['التنفيذ والتسليم', 'متابعة دورية وتقارير حتى التسليم'],
    ],
    items: {
      design_build: { title: 'التصميم والتنفيذ', short: 'من المخطط إلى المفتاح', body: 'تصميم معماري وداخلي متكامل وتنفيذه تحت إدارة واحدة — يقلل التعارض بين المصمم والمنفذ ويختصر الوقت والتكلفة.', bullets: ['التصميم المعماري والإنشائي', 'التصميم الداخلي والتشطيبات', 'استخراج التراخيص بالتنسيق مع المكاتب المعتمدة', 'التنفيذ وتسليم المفتاح'] },
      construction: { title: 'البناء وتنفيذ المشاريع', short: 'مقاولات سكنية وتجارية', body: 'تنفيذ مشاريع سكنية وتجارية بفرق ومقاولين معتمدين، مع ضبط الجودة والجدول الزمني والميزانية.', bullets: ['الهيكل الإنشائي (العظم)', 'التشطيبات الكاملة', 'أعمال الكهرباء والسباكة والتكييف', 'إدارة المقاولين والموردين'] },
      supervision: { title: 'الإشراف على البناء الشخصي', short: 'لمن يبني بيته بنفسه', body: 'نكون عينك في الموقع: مهندسون يتابعون المقاول ويتحققون من مطابقة التنفيذ للمخططات والمواصفات في كل مرحلة.', bullets: ['زيارات ميدانية مجدولة', 'استلام المراحل (الحفر، الصبات، التمديدات)', 'فحص جودة المواد', 'تقارير مصورة دورية للمالك'] },
      consulting: { title: 'الاستشارات العقارية والهندسية', short: 'قرار مدروس قبل أن تبدأ', body: 'استشارات في اختيار الأرض والمنتج المناسب والتصميم والتكاليف — مبنية على خبرة عملية في السوق المحلي.', bullets: ['تقييم الأرض والموقع', 'اختيار المنتج العقاري الأنسب', 'مراجعة المخططات والعقود', 'تقدير التكاليف والجدوى المبدئية'] },
      property_management: { title: 'إدارة الأملاك والمرافق', short: 'تشغيل وصيانة بعد التسليم', body: 'إدارة العمائر السكنية واتحادات الملاك: الصيانة الدورية والنظافة والأمن وتحصيل رسوم الخدمات.', bullets: ['عقود صيانة وقائية', 'إدارة اتحاد الملاك', 'متابعة المستأجرين'] },
      marketing: { title: 'التسويق والوساطة العقارية', short: 'بيع وتأجير وحداتك', body: 'تسويق الوحدات والمشاريع عبر فريق مبيعات مرخّص وقنوات رقمية، من التسعير حتى الإفراغ.', bullets: ['دراسة التسعير', 'حملات تسويقية', 'إدارة العروض حتى الإفراغ'] },
      feasibility: { title: 'دراسات الجدوى والتطوير', short: 'للمستثمر وملاك الأراضي', body: 'دراسات سوق وجدوى مالية لتطوير الأراضي أو الدخول في شراكات تطوير مع الشركة.', bullets: ['دراسة السوق والطلب', 'النموذج المالي', 'شراكات تطوير الأراضي'] },
      inspection: { title: 'فحص الوحدات قبل الاستلام', short: 'اطمئن قبل أن توقّع', body: 'فحص هندسي للوحدة قبل الاستلام أو الشراء: التشطيبات والتمديدات والعزل، مع تقرير مفصل بالملاحظات.', bullets: ['فحص الكهرباء والسباكة', 'كشف التسربات والرطوبة', 'تقرير مصوّر بالملاحظات'] },
    } satisfies Record<ServiceKey, { title: string; short: string; body: string; bullets: string[] }>,
  },
  careers: {
    title: 'انضم إلى فريق علا', body: 'نبحث عن أشخاص يشاركوننا الشغف بالجودة والإتقان. قدّم على الوظائف المتاحة أو سجّل في برنامج التدريب.',
    why: 'لماذا علا التميز؟', whyItems: [
      ['مشاريع حقيقية', 'تعمل على مشاريع سكنية قائمة من التصميم حتى التسليم'],
      ['بيئة تعلم', 'فرق خبيرة تشاركك المعرفة يوميًا'],
      ['نمو مهني', 'مسارات واضحة للتطور داخل الشركة'],
    ],
    openings: 'الوظائف المتاحة', noOpenings: 'لا توجد وظائف معلنة حاليًا — يمكنك إرسال طلب عام وسنتواصل معك عند توفر فرصة مناسبة.',
    apply: 'قدّم الآن', training: 'برنامج التدريب', trainingBody: 'تدريب تعاوني وصيفي لطلاب الجامعات والخريجين الجدد في المشاريع والهندسة والمبيعات والإدارة.',
    trainingCta: 'سجّل في التدريب', formJob: 'طلب توظيف', formTraining: 'طلب تدريب', tabJob: 'توظيف', tabTraining: 'تدريب',
    position: 'الوظيفة', general: 'طلب عام (أي وظيفة مناسبة)', education: 'المؤهل', educationOpts: ['ثانوي', 'دبلوم', 'بكالوريوس', 'ماجستير', 'دكتوراه', 'طالب جامعي'],
    major: 'التخصص', university: 'الجامعة / الجهة التعليمية', experience: 'سنوات الخبرة', linkedin: 'رابط LinkedIn',
    cv: 'السيرة الذاتية', cvHint: 'PDF أو Word — حتى 5MB', cvChoose: 'اختر ملفًا', note: 'نبذة عنك',
    from: 'تاريخ بداية التدريب', to: 'تاريخ نهاية التدريب', uploading: 'جارٍ رفع الملف…', cvError: 'تعذر رفع الملف — تأكد أنه PDF أو Word وأقل من 5MB',
    employment: { full_time: 'دوام كامل', part_time: 'دوام جزئي', contract: 'عقد', training: 'تدريب' },
    requirements: 'المتطلبات',
  },
  teasers: {
    servicesTitle: 'أكثر من تطوير', servicesBody: 'نقدّم خبرتنا لعملائنا خارج مشاريعنا أيضًا: التصميم والتنفيذ، البناء، الإشراف على البناء الشخصي والاستشارات.',
    allServices: 'كل الخدمات', careersTitle: 'ابنِ مستقبلك معنا', careersBody: 'وظائف وبرامج تدريب في المشاريع والهندسة والمبيعات وخدمة العملاء.', careersCta: 'الوظائف والتدريب',
  },
};

const en: typeof ar = {
  form: {
    name: 'Full name', phone: 'Mobile number', email: 'Email', city: 'City', date: 'Preferred date',
    time: 'Preferred time', message: 'Notes or details', optional: 'optional',
    times: ['Morning', 'Afternoon', 'Evening'], submit: 'Send request', sending: 'Sending…',
    consent: 'By sending this request you agree that the Ola team may contact you about it.',
    done: 'Request received', doneRef: 'Reference', doneBody: 'The relevant team will contact you shortly. Keep the reference for follow-up.',
    another: 'Send another request', phoneHint: '05xxxxxxxx',
  },
  project: {
    back: 'All projects', overview: 'About the project', location: 'Location', openMaps: 'Open in Google Maps', visitHours: 'Visiting hours',
    address: 'Address', units: 'Available units', unitsBody: 'Prices are indicative and are confirmed by the sales team at booking.',
    noUnits: 'No units are listed right now — book a visit or contact sales for availability.',
    unit: 'Unit', floor: 'Floor', area: 'Area', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms', price: 'Price', sar: 'SAR', m2: 'm²',
    from: 'From', available: 'Available', reserved: 'Reserved', book: 'Book your unit', bookThis: 'Book this unit',
    bookTitle: 'Unit booking request', bookBody: 'Choose a unit and send your details — a sales officer will contact you to confirm the booking.',
    chooseUnit: 'Unit', visitTitle: 'Request a site visit', visitBody: 'Pick a day and time that suits you; our sales team will confirm and meet you on site.',
    visitCta: 'Book a visit', stage: 'Stage', delivery: 'Delivery year', soldOut: 'This project is sold out — we would be happy to show you our current projects.',
    interest: 'Register interest', interestBody: 'This project is under construction — register your interest and sales will contact you when booking opens.',
  },
  projectsPage: { title: 'Our projects', body: 'Residential projects in Jeddah with modern design and disciplined execution — from construction to handover and after-sales.' },
  services: {
    title: 'Our services',
    body: 'Over twenty years of real-estate development experience at your service — from idea and design to construction, supervision and operation.',
    main: 'Core services', more: 'More real-estate services', request: 'Request service', choose: 'Service needed',
    formTitle: 'Request a service', formBody: 'Tell us about your project and a specialist will contact you to arrange a visit or meeting.',
    process: 'How we work', steps: [
      ['Request', 'We learn about your needs and site'],
      ['Site visit & study', 'Visit, review drawings and requirements'],
      ['Technical & financial offer', 'Clear scope, timeline and cost'],
      ['Delivery', 'Regular follow-up and reports until handover'],
    ],
    items: {
      design_build: { title: 'Design & build', short: 'From drawing to keys', body: 'Integrated architectural and interior design delivered under one roof — fewer conflicts between designer and contractor, less time and cost.', bullets: ['Architectural & structural design', 'Interior design & finishes', 'Permits with licensed offices', 'Construction and key handover'] },
      construction: { title: 'Construction & project delivery', short: 'Residential & commercial', body: 'Residential and commercial construction with vetted teams and contractors, controlling quality, schedule and budget.', bullets: ['Structural works', 'Full finishing', 'MEP works', 'Contractor & supplier management'] },
      supervision: { title: 'Supervision of private builds', short: 'For people building their own home', body: 'Our engineers are your eyes on site — following the contractor and checking every stage against drawings and specifications.', bullets: ['Scheduled site visits', 'Stage inspections (excavation, pours, MEP)', 'Material quality checks', 'Regular photo reports'] },
      consulting: { title: 'Real-estate & engineering consulting', short: 'Decide well before you start', body: 'Advice on land selection, product fit, design and costs — based on hands-on local market experience.', bullets: ['Land & site assessment', 'Choosing the right product', 'Drawing & contract review', 'Cost and initial feasibility'] },
      property_management: { title: 'Property & facility management', short: 'Operation after handover', body: 'Managing residential buildings and owners associations: preventive maintenance, cleaning, security and service charges.', bullets: ['Preventive maintenance contracts', 'Owners association management', 'Tenant follow-up'] },
      marketing: { title: 'Marketing & brokerage', short: 'Sell or lease your units', body: 'Marketing units and projects through a licensed sales team and digital channels, from pricing to title transfer.', bullets: ['Pricing study', 'Marketing campaigns', 'Offer management to transfer'] },
      feasibility: { title: 'Feasibility & development studies', short: 'For investors & landowners', body: 'Market and financial feasibility for developing land or partnering with us on a development.', bullets: ['Market & demand study', 'Financial model', 'Land development partnerships'] },
      inspection: { title: 'Pre-handover inspection', short: 'Peace of mind before you sign', body: 'Engineering inspection before handover or purchase: finishes, MEP and insulation, with a detailed report.', bullets: ['Electrical & plumbing checks', 'Leak and damp detection', 'Photo report'] },
    },
  },
  careers: {
    title: 'Join the Ola team', body: 'We look for people who share our passion for quality. Apply for open roles or join our training programme.',
    why: 'Why Ola?', whyItems: [
      ['Real projects', 'Work on live residential projects from design to handover'],
      ['Learning culture', 'Experienced teams who share knowledge every day'],
      ['Career growth', 'Clear paths to grow within the company'],
    ],
    openings: 'Open positions', noOpenings: 'No positions are advertised right now — send a general application and we will contact you when a suitable role opens.',
    apply: 'Apply now', training: 'Training programme', trainingBody: 'Co-op and summer training for university students and fresh graduates in projects, engineering, sales and administration.',
    trainingCta: 'Apply for training', formJob: 'Job application', formTraining: 'Training application', tabJob: 'Job', tabTraining: 'Training',
    position: 'Position', general: 'General application (any suitable role)', education: 'Education', educationOpts: ['High school', 'Diploma', "Bachelor's", "Master's", 'PhD', 'University student'],
    major: 'Major', university: 'University / institution', experience: 'Years of experience', linkedin: 'LinkedIn URL',
    cv: 'CV', cvHint: 'PDF or Word — up to 5MB', cvChoose: 'Choose file', note: 'About you',
    from: 'Training start date', to: 'Training end date', uploading: 'Uploading file…', cvError: 'Could not upload — make sure it is PDF or Word under 5MB',
    employment: { full_time: 'Full time', part_time: 'Part time', contract: 'Contract', training: 'Training' },
    requirements: 'Requirements',
  },
  teasers: {
    servicesTitle: 'More than development', servicesBody: 'We offer our expertise beyond our own projects: design & build, construction, supervision of private builds and consulting.',
    allServices: 'All services', careersTitle: 'Build your future with us', careersBody: 'Jobs and training in projects, engineering, sales and customer care.', careersCta: 'Jobs & training',
  },
};

export const pagesContent = (l: Locale) => (l === 'en' ? en : ar);
export type PagesContent = typeof ar;
