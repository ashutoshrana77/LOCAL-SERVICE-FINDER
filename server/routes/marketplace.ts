import express from 'express';
import { getDb } from '../db.ts';
import { AuthenticatedRequest, optionalAuth } from '../security.ts';
import { ApiError, parsePositiveInt } from '../validation.ts';

const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  pune: { lat: 18.5204, lng: 73.8567 },
  delhi: { lat: 28.6139, lng: 77.209 },
  'delhi ncr': { lat: 28.6139, lng: 77.209 },
  gurgaon: { lat: 28.4595, lng: 77.0266 },
  noida: { lat: 28.5355, lng: 77.391 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  chennai: { lat: 13.0827, lng: 80.2707 },
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function createMarketplaceRouter(): express.Router {
  const router = express.Router();

  router.get('/services', (_req, res) => {
    const db = getDb();
    const categories = db
      .prepare(
        `SELECT sc.*,
          (SELECT COUNT(*) FROM providers p WHERE p.primary_category_id = sc.id) as provider_count
         FROM service_categories sc
         ORDER BY sc.sort_order ASC`,
      )
      .all()
      .map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        slug: String(row.slug),
        icon: String(row.icon),
        description: String(row.description),
        providerCount: Number(row.provider_count),
      }));

    const cities = db
      .prepare(`SELECT city, COUNT(*) as count FROM providers GROUP BY city ORDER BY count DESC`)
      .all()
      .map((r) => ({ city: String(r.city), count: Number(r.count) }));

    res.json({ categories, cities });
  });

  router.get('/providers', optionalAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : '';
    const location = typeof req.query.location === 'string' ? req.query.location.trim().toLowerCase() : '';
    const minRating = Number(req.query.minRating || 0);
    const minPrice = Number(req.query.minPrice || 0);
    const maxPrice = Number(req.query.maxPrice || 0);
    const availability = typeof req.query.availability === 'string' ? req.query.availability.trim().toLowerCase() : '';
    const verifiedOnly = req.query.verifiedOnly === 'true' || req.query.verifiedOnly === '1';
    const radiusKm = Number(req.query.radiusKm || 0);
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'relevance';
    const page = parsePositiveInt(req.query.page, 1, 1, 100);
    const limit = parsePositiveInt(req.query.limit, 10, 1, 50);

    const rows = db
      .prepare(
        `SELECT p.*, sc.name as category_name, sc.slug as category_slug,
          u.phone as contact_phone,
          COALESCE((SELECT MIN(ps.base_price) FROM provider_services ps WHERE ps.provider_id = p.id AND ps.active = 1), 0) as starting_price,
          (SELECT COUNT(*) FROM provider_services ps WHERE ps.provider_id = p.id AND ps.active = 1) as service_count
         FROM providers p
         JOIN service_categories sc ON sc.id = p.primary_category_id
         JOIN users u ON u.id = p.user_id
         WHERE u.active = 1`,
      )
      .all() as Array<Record<string, unknown>>;

    const availRows = db
      .prepare(`SELECT provider_id, day_of_week, is_available FROM availability`)
      .all() as Array<{ provider_id: number; day_of_week: number; is_available: number }>;

    const availMap = new Map<number, Set<number>>();
    for (const ar of availRows) {
      if (Number(ar.is_available) === 1) {
        const pid = Number(ar.provider_id);
        if (!availMap.has(pid)) availMap.set(pid, new Set());
        availMap.get(pid)!.add(Number(ar.day_of_week));
      }
    }

    const favSet = new Set<number>();
    if (req.user) {
      const favs = db
        .prepare(`SELECT provider_id FROM favorites WHERE customer_id = ?`)
        .all(req.user.sub) as Array<{ provider_id: number }>;
      favs.forEach((f) => favSet.add(Number(f.provider_id)));
    }

    const todayDow = new Date().getDay();
    const centerCoord = location ? CITY_CENTERS[location] : undefined;

    let filtered = rows
      .map((row) => {
        const pid = Number(row.id);
        const days = availMap.get(pid) ?? new Set<number>();
        const serviceAreas: string[] = JSON.parse(String(row.service_areas_json || '[]'));
        const gallery: string[] = JSON.parse(String(row.gallery_json || '[]'));
        const distKm = centerCoord
          ? Math.round(haversineKm(centerCoord.lat, centerCoord.lng, Number(row.latitude), Number(row.longitude)) * 10) / 10
          : null;

        return {
          id: pid,
          businessName: String(row.business_name),
          ownerName: String(row.owner_name),
          categoryName: String(row.category_name),
          categorySlug: String(row.category_slug),
          description: String(row.description),
          city: String(row.city),
          area: String(row.area),
          pincode: String(row.pincode),
          serviceAreas,
          verified: Number(row.verified) === 1,
          verificationStatus: String(row.verification_status),
          averageRating: Number(row.average_rating),
          reviewCount: Number(row.review_count),
          responseTime: String(row.response_time),
          responseMinutes: Number(row.response_minutes),
          yearsExperience: Number(row.years_experience),
          startingPrice: Number(row.starting_price),
          serviceCount: Number(row.service_count),
          coverImageUrl: String(row.cover_image_url || ''),
          gallery,
          distanceKm: distKm,
          isFavorited: favSet.has(pid),
          availableToday: days.has(todayDow),
          availableWeekend: days.has(0) || days.has(6),
          availableWeek: days.size > 0,
        };
      })
      .filter((p) => {
        if (category && p.categorySlug !== category && p.categoryName.toLowerCase() !== category) {
          return false;
        }
        if (verifiedOnly && !p.verified) {
          return false;
        }
        if (minRating > 0 && p.averageRating < minRating) {
          return false;
        }
        if (minPrice > 0 && p.startingPrice < minPrice) {
          return false;
        }
        if (maxPrice > 0 && p.startingPrice > maxPrice) {
          return false;
        }
        if (availability === 'today' && !p.availableToday) return false;
        if (availability === 'weekends' && !p.availableWeekend) return false;
        if (availability === 'week' && !p.availableWeek) return false;

        if (location) {
          const matchesText =
            p.city.toLowerCase().includes(location) ||
            p.area.toLowerCase().includes(location) ||
            p.pincode.toLowerCase().includes(location) ||
            p.serviceAreas.some((sa) => sa.toLowerCase().includes(location));

          if (radiusKm > 0 && p.distanceKm !== null) {
            if (p.distanceKm > radiusKm && !matchesText) return false;
          } else if (!matchesText) {
            return false;
          }
        }

        if (q) {
          const hay = `${p.businessName} ${p.ownerName} ${p.categoryName} ${p.description} ${p.city} ${p.area} ${p.pincode} ${p.serviceAreas.join(' ')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }

        return true;
      });

    filtered.sort((a, b) => {
      if (sort === 'rating') {
        return b.averageRating - a.averageRating || b.reviewCount - a.reviewCount;
      }
      if (sort === 'price_asc') {
        return (a.startingPrice || 999999) - (b.startingPrice || 999999);
      }
      if (sort === 'price_desc') {
        return b.startingPrice - a.startingPrice;
      }
      if (sort === 'response_time') {
        return a.responseMinutes - b.responseMinutes;
      }
      // Relevance: verified first, then rating * log(reviews + 2)
      const scoreA = (a.verified ? 2 : 0) + a.averageRating + Math.log10(a.reviewCount + 1);
      const scoreB = (b.verified ? 2 : 0) + b.averageRating + Math.log10(b.reviewCount + 1);
      return scoreB - scoreA;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const items = filtered.slice(offset, offset + limit);

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
      },
    });
  });

  router.get('/providers/:id', optionalAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const providerId = Number(req.params.id);
      if (!Number.isFinite(providerId) || providerId <= 0) {
        throw new ApiError(400, 'INVALID_ID', 'Invalid provider ID.');
      }

      const row = db
        .prepare(
          `SELECT p.*, sc.name as category_name, sc.slug as category_slug,
            u.phone as contact_phone, u.email as contact_email
           FROM providers p
           JOIN service_categories sc ON sc.id = p.primary_category_id
           JOIN users u ON u.id = p.user_id
           WHERE p.id = ? AND u.active = 1`,
        )
        .get(providerId) as Record<string, unknown> | undefined;

      if (!row) {
        throw new ApiError(404, 'PROVIDER_NOT_FOUND', 'Service provider not found.');
      }

      db.prepare(`UPDATE providers SET profile_views = profile_views + 1 WHERE id = ?`).run(providerId);

      const services = db
        .prepare(
          `SELECT ps.*, sc.name as category_name
           FROM provider_services ps
           JOIN service_categories sc ON sc.id = ps.category_id
           WHERE ps.provider_id = ? AND ps.active = 1
           ORDER BY ps.base_price ASC`,
        )
        .all(providerId)
        .map((s) => ({
          id: Number(s.id),
          categoryId: Number(s.category_id),
          categoryName: String(s.category_name),
          title: String(s.title),
          description: String(s.description),
          basePrice: Number(s.base_price),
          priceUnit: String(s.price_unit),
          durationMinutes: Number(s.duration_minutes),
        }));

      const availability = db
        .prepare(`SELECT * FROM availability WHERE provider_id = ? ORDER BY day_of_week ASC`)
        .all(providerId)
        .map((a) => ({
          dayOfWeek: Number(a.day_of_week),
          startTime: String(a.start_time),
          endTime: String(a.end_time),
          isAvailable: Number(a.is_available) === 1,
          slots: JSON.parse(String(a.slots_json || '[]')) as string[],
        }));

      const reviews = db
        .prepare(
          `SELECT r.*, u.full_name as customer_name
           FROM reviews r
           JOIN users u ON u.id = r.customer_id
           WHERE r.provider_id = ? AND r.moderation_status = 'VISIBLE'
           ORDER BY r.created_at DESC`,
        )
        .all(providerId)
        .map((r) => ({
          id: Number(r.id),
          rating: Number(r.rating),
          comment: String(r.comment),
          providerReply: String(r.provider_reply || ''),
          repliedAt: String(r.replied_at || ''),
          customerFirstName: String(r.customer_name).split(' ')[0],
          createdAt: String(r.created_at),
        }));

      const similarProviders = db
        .prepare(
          `SELECT p.id, p.business_name, p.area, p.city, p.average_rating, p.review_count,
            p.verified, p.response_time, p.cover_image_url, sc.name as category_name,
            COALESCE((SELECT MIN(ps.base_price) FROM provider_services ps WHERE ps.provider_id = p.id AND ps.active = 1), 0) as starting_price
           FROM providers p
           JOIN service_categories sc ON sc.id = p.primary_category_id
           JOIN users u ON u.id = p.user_id
           WHERE p.id != ? AND u.active = 1 AND (p.primary_category_id = ? OR p.city = ?)
           ORDER BY (p.primary_category_id = ?) DESC, p.verified DESC, p.average_rating DESC
           LIMIT 3`,
        )
        .all(providerId, Number(row.primary_category_id), String(row.city), Number(row.primary_category_id))
        .map((sp) => ({
          id: Number(sp.id),
          businessName: String(sp.business_name),
          categoryName: String(sp.category_name),
          area: String(sp.area),
          city: String(sp.city),
          averageRating: Number(sp.average_rating),
          reviewCount: Number(sp.review_count),
          verified: Number(sp.verified) === 1,
          responseTime: String(sp.response_time),
          startingPrice: Number(sp.starting_price),
          coverImageUrl: String(sp.cover_image_url || ''),
        }));

      let isFavorited = false;
      if (req.user) {
        const fav = db
          .prepare(`SELECT id FROM favorites WHERE customer_id = ? AND provider_id = ?`)
          .get(req.user.sub, providerId);
        isFavorited = Boolean(fav);
      }

      res.json({
        id: Number(row.id),
        userId: Number(row.user_id),
        businessName: String(row.business_name),
        ownerName: String(row.owner_name),
        categoryId: Number(row.primary_category_id),
        categoryName: String(row.category_name),
        categorySlug: String(row.category_slug),
        description: String(row.description),
        city: String(row.city),
        area: String(row.area),
        pincode: String(row.pincode),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        serviceAreas: JSON.parse(String(row.service_areas_json || '[]')),
        verified: Number(row.verified) === 1,
        verificationStatus: String(row.verification_status),
        averageRating: Number(row.average_rating),
        reviewCount: Number(row.review_count),
        responseTime: String(row.response_time),
        yearsExperience: Number(row.years_experience),
        contactPhone: String(row.contact_phone),
        coverImageUrl: String(row.cover_image_url || ''),
        gallery: JSON.parse(String(row.gallery_json || '[]')),
        isFavorited,
        services,
        availability,
        reviews,
        similarProviders,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/reviews/provider/:providerId', (req, res, next) => {
    try {
      const db = getDb();
      const providerId = Number(req.params.providerId);
      if (!Number.isFinite(providerId) || providerId <= 0) {
        throw new ApiError(400, 'INVALID_ID', 'Invalid provider ID.');
      }

      const reviews = db
        .prepare(
          `SELECT r.*, u.full_name as customer_name
           FROM reviews r
           JOIN users u ON u.id = r.customer_id
           WHERE r.provider_id = ? AND r.moderation_status = 'VISIBLE'
           ORDER BY r.created_at DESC`,
        )
        .all(providerId)
        .map((r) => ({
          id: Number(r.id),
          rating: Number(r.rating),
          comment: String(r.comment),
          providerReply: String(r.provider_reply || ''),
          repliedAt: String(r.replied_at || ''),
          customerFirstName: String(r.customer_name).split(' ')[0],
          createdAt: String(r.created_at),
        }));

      res.json({ reviews });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
