# ربط رسائل واتساب و SMS

النظام يرسل رسالة للعميل عند كل تحديث على بلاغه (استلام، تعيين فني، موعد الزيارة، الفني في الطريق، الاكتمال، عرض سعر، تنبيه انتهاء الضمان...).
يحتاج مزود إرسال واحد على الأقل. الإعدادات تُضاف في Vercel → Project → Settings → Environment Variables، ثم Redeploy.

## 1) SMS عبر تقنيات (Taqnyat) — الأسهل للسعودية
| المتغير | القيمة |
|---|---|
| `SMS_PROVIDER` | `taqnyat` |
| `TAQNYAT_TOKEN` | مفتاح الـ API من لوحة تقنيات |
| `TAQNYAT_SENDER` | اسم المرسل المعتمد (مثال: `OLA`) |

بديل: يونيفونك `SMS_PROVIDER=unifonic` + `UNIFONIC_APP_SID` + `UNIFONIC_SENDER`.

## 2) واتساب
**Meta WhatsApp Cloud API (الرسمي):**
| المتغير | القيمة |
|---|---|
| `WHATSAPP_PROVIDER` | `meta` |
| `WHATSAPP_TOKEN` | Permanent access token |
| `WHATSAPP_PHONE_ID` | Phone number ID |
| `WHATSAPP_TEMPLATE` | اسم القالب المعتمد، مثال `ola_update` |
| `WHATSAPP_TEMPLATE_LANG` | `ar` |

القالب (Utility) يحتاج متغير واحد في النص، مثال:
`تحديث من علا التميز: {{1}}`

**أو Twilio:** `WHATSAPP_PROVIDER=twilio` + `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_WHATSAPP_FROM` (مثل `whatsapp:+9665XXXXXXXX`).

## 3) متغيرات عامة
| المتغير | القيمة |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://ola-maintenance.vercel.app` (للروابط داخل الرسائل) |
| `SUPABASE_SERVICE_ROLE_KEY` | موجود مسبقًا |
| `CRON_SECRET` | أي نص عشوائي طويل — للمهمة اليومية (تنبيهات الضمان + إعادة المحاولة) |

## 4) التفعيل
1. لوحة الإدارة → الإعدادات → **قنوات الإشعار الخارجية**: فعّل WhatsApp و/أو SMS، واختر من تصله الرسائل (افتراضيًا: الملاك).
2. نفس الصفحة → **إرسال رسالة تجريبية** إلى جوالك.

للتجربة بدون مزود: `SMS_PROVIDER=log` — الرسائل تظهر في Vercel → Logs بدل الإرسال.
العميل يقدر يوقف الرسائل من بوابته (بطاقة "رسائل واتساب و SMS").
