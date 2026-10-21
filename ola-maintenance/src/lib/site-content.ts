/**
 * محتوى موقع الشركة — مأخوذ من الموقع الرسمي ola-altamayuz.com
 * (النصوص والصور والإحصائيات). عدّل هنا لتغيير محتوى الصفحة الرئيسية.
 */
import type { Locale } from './types';

const CDN = 'https://files.cdn-files-a.com/uploads/7515788';

export const SITE_ASSETS = {
  heroVideo: 'https://cdn-media.f-static.net/uploads/7515788/normal_694243866e02d.mp4',
  heroPoster: `${CDN}/normal_694243866e02d-thumbnail.jpg`,
  about: `${CDN}/2000_694014b4967de.jpg`,
  afterSales: `${CDN}/2000_gi-69429d7b8e80b.jpg`,
  vision: `${CDN}/800_gi-69412352b0746.jpg`,
  mission: `${CDN}/800_gi-69412e488226a.jpg`,
  values: `${CDN}/800_gi-694131c5b56d8.jpg`,
  partners: [
    `${CDN}/400_filter_nobg_687ca5dd9730b.png`,
    `${CDN}/400_filter_nobg_687ca88dafc02.png`,
    `${CDN}/400_filter_nobg_687ca8455d32d.png`,
    `${CDN}/400_filter_nobg_687ca6bc390ff.png`,
    `${CDN}/400_filter_nobg_695e511b9b218.png`,
    `${CDN}/400_filter_nobg_695e515aa0c24.png`,
  ],
};

export type SiteProject = { id?: string; name_ar: string; name_en: string | null; image_url: string | null; sales_status: 'sold' | 'selling' | 'construction'; city?: string | null; district?: string | null };

/** Used when the projects table can't be read publicly (before running migration 5) */
export const FALLBACK_PROJECTS: SiteProject[] = [
  { name_ar: 'عُلا 25', name_en: 'Ola 25', sales_status: 'construction', image_url: `${CDN}/800_693fe11dc857d.jpg` },
  { name_ar: 'عُلا 24', name_en: 'Ola 24', sales_status: 'construction', image_url: `${CDN}/800_693fe1cf770a2.png` },
  { name_ar: 'عُلا 23', name_en: 'Ola 23', sales_status: 'construction', image_url: `${CDN}/800_693fe02562daf.jpg` },
  { name_ar: 'عُلا 22', name_en: 'Ola 22', sales_status: 'construction', image_url: `${CDN}/800_698a2dd4e35c6.jpg` },
  { name_ar: 'عُلا 21', name_en: 'Ola 21', sales_status: 'selling', image_url: `${CDN}/800_6914f1c01fbad.jpg` },
  { name_ar: 'عُلا 20', name_en: 'Ola 20', sales_status: 'sold', image_url: `${CDN}/800_693fe29a196be.jpg` },
  { name_ar: 'عُلا 17', name_en: 'Ola 17', sales_status: 'sold', image_url: `${CDN}/800_6941347e1ea48.jpg` },
];

const ar = {
  nav: { home: 'الرئيسية', about: 'عن علا', projects: 'المشاريع', services: 'الخدمات', careers: 'الوظائف', afterSales: 'ما بعد البيع', contact: 'تواصل معنا', portal: 'بوابة الملاك', dashboard: 'لوحتي', city: 'جدة، المملكة العربية السعودية', bookVisit: 'احجز زيارة' },
  hero: {
    eyebrow: 'تأسست عام ١٤٢٤هـ',
    title: 'عُلا التميّز',
    subtitle: 'منذ أكثر من 20 عامًا نُكرّس بصمتنا في مشروعات سكنية وتجارية متوازنة — بجودة دقيقة وتخطيط رشيد.',
    cta1: 'استعرض المشاريع',
    cta2: 'خدمات ما بعد البيع',
  },
  about: {
    eyebrow: 'من نحن',
    title: 'منذ أكثر من 20 عامًا…',
    body: 'تُكرّس علا التميز بصمتها في مشروعات سكنية وتجارية متوازنة. نحتكم إلى جودة دقيقة وتخطيط رشيد يبني شراكات راسخة، ونواصل التقدّم بوعيٍ سوقي يعكس حداثة التصميم وانضباط التنفيذ.',
    badge: 'شركة تطوير عقاري وطنية',
  },
  stats: [
    { to: 50, suffix: '+', label: 'مشروع' },
    { to: 750, suffix: '+', label: 'وحدة سكنية' },
    { to: 60000, suffix: '+', label: 'م² إجمالي المساحات المطورة' },
    { to: 120000, suffix: '+', label: 'م² إجمالي مسطحات البناء' },
    { to: 3750, suffix: '+', label: 'مستفيد' },
  ],
  projects: {
    eyebrow: 'محفظتنا',
    title: 'المشاريع',
    all: 'الكل',
    stage: { construction: 'مرحلة الإنشاء', selling: 'مرحلة البيع', sold: 'مباع' },
    details: 'تفاصيل المشروع', viewAll: 'كل المشاريع',
  },
  identity: {
    eyebrow: 'هويتنا',
    vision: { title: 'الرؤية', body: 'أن تكون علا التميز من أبرز الكيانات في التطوير والاستثمار العقاري؛ نُقدّم منتجات عمرانية موثوقة ترتكز على الابتكار والجودة وتُسهم في الارتقاء بتجربة السكن والعمل.' },
    mission: { title: 'الرسالة', body: 'نطوّر مشاريع عقارية مستدامة تجمع بين التخطيط المدروس والتنفيذ المنضبط والشراكات الموثوقة، لنوفّر حلولًا عقارية ذات قيمة حقيقية، ونُعزّز الثقة طويلة الأمد مع عملائنا ومُستثمرينا.' },
    values: {
      title: 'القيم',
      items: [
        ['الجودة والإتقان', 'عناية بالتفاصيل من الفكرة حتى التسليم.'],
        ['الالتزام', 'وضوح في الوعود ودقة في المواعيد.'],
        ['الابتكار', 'حلول تصميمية وإدارية تواكب احتياجات اليوم.'],
        ['الشفافية', 'تواصل صادق ومعلومات دقيقة.'],
        ['الثقة والشراكات', 'علاقات طويلة الأمد تبني نجاحًا متبادلًا.'],
      ],
    },
  },
  afterSales: {
    eyebrow: 'بعد الاستلام',
    title: 'خدمة ما بعد البيع',
    body: 'تلتزم علا التميز بتقديم خدمة ما بعد البيع بروح احترافية تعكس جودة مشاريعها، إذ نوفر قناة موحّدة للتواصل والاعتناء باحتياجات العملاء، ونضمن متابعة فعّالة للطلبات حتى إغلاقها بما يحقق رضا المستفيدين ويحافظ على قيمة الأصول.',
    body2: 'وتشمل الخدمة نطاق الضمان المتفق عليه، مع توفير حلول داعمة لما بعد الضمان وفق معايير واضحة تعزّز الثقة والاستدامة.',
    steps: [
      ['سجّل الدخول', 'بالحساب الذي تفعّله لك الشركة بعد الاستلام'],
      ['ارفع طلبك', 'نوع العطل ومكانه مع الصور أو الفيديو'],
      ['تابع التنفيذ', 'موعد الزيارة والفني وكل مرحلة لحظة بلحظة'],
      ['قيّم الخدمة', 'أكّد الإنجاز وشاركنا رأيك'],
    ],
    cta: 'الدخول إلى بوابة ما بعد البيع',
    cta2: 'لم يُفعّل حسابك؟ تواصل معنا',
  },
  featured: {
    label: 'متاح للبيع الآن', units: 'الوحدات والأسعار', visit: 'احجز زيارة للمشروع',
    body: 'وحدات سكنية بتصميم حديث وتنفيذ منضبط — تواصل مع فريق المبيعات لمعرفة المساحات المتاحة.',
    cta: 'استفسر عبر واتساب',
    message: 'السلام عليكم، أرغب بالاستفسار عن مشروع',
  },
  inquire: 'استفسر',
  faq: {
    title: 'أسئلة عن خدمة ما بعد البيع',
    items: [
      ['كيف أحصل على حساب في البوابة؟', 'تُفعّل الشركة حسابك بعد استلام وحدتك والتحقق من ملكيتها، ويصلك بريد الدخول وكلمة مرور مؤقتة تغيّرها عند أول دخول.'],
      ['ما الذي يشمله ضمان وحدتي؟', 'لكل وحدة سجل ضمان مستقل يوضح البنود المشمولة والمستثناة ومدة كل ضمان، وتجده في صفحتك داخل البوابة.'],
      ['ماذا لو كان العطل خارج الضمان؟', 'يصلك عرض سعر واضح داخل البوابة، ولا تبدأ الأعمال إلا بعد موافقتك عليه.'],
      ['هل أعرف موعد زيارة الفني؟', 'نعم، يظهر الموعد واسم الفني في صفحة الطلب، ويصلك إشعار عند تأكيده أو تغييره.'],
      ['ماذا لو عادت المشكلة بعد الإصلاح؟', 'يمكنك إعادة فتح الطلب من صفحته مباشرة خلال المدة المحددة، وسيُراجع من جديد.'],
    ],
  },
  partners: { eyebrow: 'نفخر بهم', title: 'شركاء النجاح', body: 'نعتز بثقة شركائنا ونجاحنا المشترك في كل مشروع' },
  contact: {
    eyebrow: 'نسعد بخدمتك',
    title: 'تواصل معنا',
    body: 'يسعدنا تواصلكم مع شركة علا التميز للاستثمار والتسويق العقاري. فريقنا جاهز للإجابة عن استفساراتكم وتقديم كل ما يلزم من دعم ومعلومات حول مشاريعنا وخدماتنا.',
    phone: 'الرقم الموحد', email: 'البريد الإلكتروني', whatsapp: 'واتساب', whatsappCta: 'ابدأ المحادثة', call: 'اتصل الآن', write: 'راسلنا',
  },
  footer: { rights: 'جميع الحقوق محفوظة', quick: 'روابط سريعة', follow: 'تابعنا' },
};

const en: typeof ar = {
  nav: { home: 'Home', about: 'About', projects: 'Projects', services: 'Services', careers: 'Careers', afterSales: 'After-sales', contact: 'Contact', portal: 'Owner portal', dashboard: 'My dashboard', city: 'Jeddah, Saudi Arabia', bookVisit: 'Book a visit' },
  hero: {
    eyebrow: 'Established 1424 AH',
    title: 'Ola Al-Tamayuz',
    subtitle: 'For more than 20 years we have shaped balanced residential and commercial developments — with precise quality and sound planning.',
    cta1: 'Explore projects',
    cta2: 'After-sales service',
  },
  about: {
    eyebrow: 'Who we are',
    title: 'More than 20 years…',
    body: 'Ola Al-Tamayuz leaves its mark on balanced residential and commercial projects. We are guided by precise quality and sound planning that builds lasting partnerships, and we keep moving forward with market awareness that reflects modern design and disciplined execution.',
    badge: 'A national real estate developer',
  },
  stats: [
    { to: 50, suffix: '+', label: 'projects' },
    { to: 750, suffix: '+', label: 'homes' },
    { to: 60000, suffix: '+', label: 'm² developed land' },
    { to: 120000, suffix: '+', label: 'm² built-up area' },
    { to: 3750, suffix: '+', label: 'residents' },
  ],
  projects: { eyebrow: 'Our portfolio', title: 'Projects', all: 'All', stage: { construction: 'Under construction', selling: 'Now selling', sold: 'Sold out' }, details: 'Project details', viewAll: 'All projects' },
  identity: {
    eyebrow: 'Our identity',
    vision: { title: 'Vision', body: 'To be one of the leading names in real estate development and investment, delivering trusted urban products built on innovation and quality that elevate how people live and work.' },
    mission: { title: 'Mission', body: 'We develop sustainable projects that combine thoughtful planning, disciplined execution and trusted partnerships — delivering real value and long-term trust for our clients and investors.' },
    values: {
      title: 'Values',
      items: [
        ['Quality', 'Care for detail from concept to handover.'],
        ['Commitment', 'Clear promises and punctual delivery.'],
        ['Innovation', 'Design and management solutions for today.'],
        ['Transparency', 'Honest communication and accurate information.'],
        ['Trust & partnership', 'Long-term relationships that build shared success.'],
      ],
    },
  },
  afterSales: {
    eyebrow: 'After handover',
    title: 'After-sales service',
    body: 'Ola Al-Tamayuz delivers after-sales service with the same professionalism as its projects: one channel to reach us and look after your needs, with every request followed through to closure — protecting resident satisfaction and the value of your home.',
    body2: 'The service covers the agreed warranty scope, with clear post-warranty options that build trust and sustainability.',
    steps: [
      ['Sign in', 'with the account the company activates after handover'],
      ['Report an issue', 'type, location, photos or video'],
      ['Track progress', 'visit time, technician and every stage'],
      ['Rate the service', 'confirm completion and share feedback'],
    ],
    cta: 'Enter the after-sales portal',
    cta2: 'Account not active? Contact us',
  },
  featured: {
    label: 'Now selling', units: 'Units & prices', visit: 'Book a site visit',
    body: 'Modern homes with disciplined execution — contact our sales team for available sizes.',
    cta: 'Ask on WhatsApp',
    message: 'Hello, I would like to ask about project',
  },
  inquire: 'Inquire',
  faq: {
    title: 'After-sales questions',
    items: [
      ['How do I get a portal account?', 'The company activates your account after handover and ownership verification. You receive your login email and a temporary password to change at first sign-in.'],
      ['What does my warranty cover?', 'Each unit has its own warranty record listing covered and excluded items and each period — you will find it on your page in the portal.'],
      ['What if the issue is out of warranty?', 'You receive a clear quotation in the portal, and work only starts after you approve it.'],
      ['Will I know when the technician comes?', 'Yes — the visit time and technician name appear on the request page, and you are notified when it is confirmed or changed.'],
      ['What if the problem comes back?', 'You can reopen the request from its page within the allowed period and it will be reviewed again.'],
    ],
  },
  partners: { eyebrow: 'Proud to work with', title: 'Partners of success', body: 'Proud of the trust and shared success with our partners' },
  contact: {
    eyebrow: 'Here to help',
    title: 'Contact us',
    body: 'We are happy to hear from you. Our team is ready to answer your questions and share everything you need about our projects and services.',
    phone: 'Unified number', email: 'Email', whatsapp: 'WhatsApp', whatsappCta: 'Start chat', call: 'Call now', write: 'Write to us',
  },
  footer: { rights: 'All rights reserved', quick: 'Quick links', follow: 'Follow us' },
};

export const siteContent = (l: Locale) => (l === 'en' ? en : ar);
export type SiteContent = typeof ar;

/** WhatsApp link with a prefilled message (falls back to the contact section) */
export function waLink(phone: string | null | undefined, text: string) {
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : '#contact';
}
