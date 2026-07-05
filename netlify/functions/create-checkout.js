exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'STRIPE_SECRET_KEY غير مضبوط في Netlify' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'بيانات غير صحيحة' }) };
  }

  const { items, deliveryName, deliveryPrice } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'السلة فاضية' }) };
  }

  const siteUrl = process.env.URL || `https://${event.headers.host}`;

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', `${siteUrl}/success.html`);
  params.append('cancel_url', `${siteUrl}/index.html`);

  let idx = 0;
  for (const it of items) {
    if (!it.name || !it.price || !it.qty) continue;
    params.append(`line_items[${idx}][price_data][currency]`, 'aed');
    params.append(`line_items[${idx}][price_data][product_data][name]`, it.name);
    params.append(`line_items[${idx}][price_data][unit_amount]`, String(Math.round(it.price * 100)));
    params.append(`line_items[${idx}][quantity]`, String(it.qty));
    idx++;
  }

  if (deliveryPrice) {
    params.append(`line_items[${idx}][price_data][currency]`, 'aed');
    params.append(`line_items[${idx}][price_data][product_data][name]`, `توصيل - ${deliveryName || ''}`);
    params.append(`line_items[${idx}][price_data][unit_amount]`, String(Math.round(deliveryPrice * 100)));
    params.append(`line_items[${idx}][quantity]`, '1');
    idx++;
  }

  if (idx === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'ما فيه أصناف صالحة بالسلة' }) };
  }

  try {
    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const session = await resp.json();
    if (session.error) {
      return { statusCode: 400, body: JSON.stringify({ error: session.error.message }) };
    }
    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
