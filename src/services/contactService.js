import { COMPANY_EMAIL } from '../data/homeData';

const getContactToEmail = () =>
  String(import.meta.env.VITE_CONTACT_TO_EMAIL || COMPANY_EMAIL).trim() || COMPANY_EMAIL;

/**
 * Gửi lời nhắn form liên hệ → support@waterbus.top (FormSubmit).
 * Lần đầu: FormSubmit gửi mail Activate tới hộp support — cần xác nhận.
 * Đổi email nhận: VITE_CONTACT_TO_EMAIL
 * Khi BE có POST /api/contact: VITE_CONTACT_USE_API=true
 */
export const sendContactMessage = async ({ fullName, email, subject = '', message }) => {
  const name = String(fullName || '').trim();
  const fromEmail = String(email || '').trim();
  const topic = String(subject || '').trim() || `Liên hệ từ ${name}`;
  const bodyText = String(message || '').trim();

  if (import.meta.env.VITE_CONTACT_USE_API === 'true') {
    const { postContactMessage } = await import('../api/contactApi');
    return postContactMessage({
      fullName: name,
      email: fromEmail,
      subject: topic,
      message: bodyText,
    });
  }

  const form = new FormData();
  form.append('name', name);
  form.append('email', fromEmail);
  form.append('_replyto', fromEmail);
  form.append('subject', topic);
  form.append('_subject', `[Waterbus] ${topic}`);
  form.append('message', bodyText);
  form.append('_template', 'table');
  form.append('_captcha', 'false');

  const to = getContactToEmail();
  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.message || 'Không gửi được email liên hệ.');
    err.response = { status: response.status, data };
    throw err;
  }
  return data;
};

export const getContactSupportEmail = getContactToEmail;
