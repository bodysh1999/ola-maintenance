# بريد الشركة لإيميلات النظام (SMTP)

بدون هذا الإعداد، Supabase يرسل إيميلات استعادة كلمة المرور والتأكيد من بريده الافتراضي،
وبحد منخفض جدًا في الساعة (للتجربة فقط)، وكثير منها يروح للسبام.

## المطلوب من الشركة
بيانات SMTP لبريد مثل `no-reply@<دومين الشركة>`:

| البند | مثال Google Workspace | مثال Microsoft 365 | مثال Zoho |
|---|---|---|---|
| Host | smtp.gmail.com | smtp.office365.com | smtp.zoho.sa |
| Port | 587 | 587 | 587 |
| User | no-reply@company.sa | no-reply@company.sa | no-reply@company.sa |
| Password | App Password | كلمة مرور التطبيق | كلمة مرور التطبيق |

بديل أسهل وأوثق: خدمة إرسال مثل Resend أو Amazon SES أو Brevo (مجانية لحد معيّن)، مع ربط الدومين (SPF/DKIM).

## الإعداد (5 دقائق)
1. Supabase → Project Settings → Authentication → **SMTP Settings** → Enable custom SMTP.
2. عبّي: Sender email، Sender name (`علا التميز`)، Host، Port 587، Username، Password → Save.
3. Authentication → **Rate Limits** → ارفع "Emails sent per hour" (مثلاً 100).
4. Authentication → **URL Configuration** → Site URL = رابط النظام (مثل https://ola-maintenance.vercel.app)
   وأضف `https://ola-maintenance.vercel.app/**` في Redirect URLs.
5. Authentication → **Email Templates** → عدّل رسالة "Reset Password" بالعربي إذا تبغى.
6. جرّب: صفحة الدخول → "نسيت كلمة المرور" بإيميل حقيقي.

## DNS للدومين (عشان ما تروح سبام)
- SPF: سجل TXT يشمل مزوّد البريد.
- DKIM: من لوحة مزوّد البريد.
- DMARC: `v=DMARC1; p=quarantine; rua=mailto:dmarc@company.sa`
