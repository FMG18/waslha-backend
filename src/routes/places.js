import { Router } from 'express';

const router = Router();

router.get('/search', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 2) return res.status(400).json({ success: false, message: 'اكتب حرفين على الأقل للبحث' });

    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) return res.status(503).json({ success: false, message: 'خدمة البحث عن العناوين غير مهيأة' });

    const encoded = encodeURIComponent(query);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?limit=8&language=ar&country=sy&access_token=${encodeURIComponent(token)}`;
    const response = await fetch(url);
    if (!response.ok) return res.status(502).json({ success: false, message: 'تعذر الوصول إلى خدمة البحث' });

    const payload = await response.json();
    const features = Array.isArray(payload.features) ? payload.features : [];
    const data = features.map((item) => ({
      id: String(item.id || item.place_name),
      name: String(item.text || item.place_name || '').trim(),
      address: String(item.place_name || item.text || '').trim(),
      coordinates: {
        lat: Number(item.center?.[1]),
        lng: Number(item.center?.[0])
      }
    })).filter((item) => Number.isFinite(item.coordinates.lat) && Number.isFinite(item.coordinates.lng));

    res.json({ success: true, data });
  } catch (error) { next(error); }
});

export default router;
