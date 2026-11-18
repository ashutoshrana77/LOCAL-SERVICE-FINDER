import express from 'express';
import { calculateProfileCompleteness, getDb } from '../db.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../security.ts';
import { ApiError, isNonEmptyString, isValidPincode } from '../validation.ts';

function getProviderForUser(userId: number) {
  const db = getDb();
  const provider = db
    .prepare(
      `SELECT p.*, sc.name as category_name
       FROM providers p
       JOIN service_categories sc ON sc.id = p.primary_category_id
       WHERE p.user_id = ?`,
    )
    .get(userId) as Record<string, unknown> | undefined;

  if (!provider) {
    throw new ApiError(404, 'PROVIDER_PROFILE_NOT_FOUND', 'No provider profile is linked to this account.');
  }
  return provider;
}

export function createProviderRouter(): express.Router {
  const router = express.Router();

  router.get('/provider/dashboard', requireAuth, requireRole('PROVIDER', 'ADMIN'), (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const provider = getProviderForUser(req.user!.sub);
      const providerId = Number(provider.id);

      const bookings = db
        .prepare(
          `SELECT b.*, u.full_name as customer_name, u.phone as customer_phone, ps.title as service_title
           FROM bookings b
           JOIN users u ON u.id = b.customer_id
           JOIN provider_services ps ON ps.id = b.service_id
           WHERE b.provider_id = ?
           ORDER BY b.scheduled_date DESC, b.id DESC`,
        )
        .all(providerId)
        .map((b) => ({
          id: Number(b.id),
          referenceCode: String(b.reference_code),
          customerId: Number(b.customer_id),
          customerName: String(b.customer_name),
          customerPhone: String(b.customer_phone),
          serviceTitle: String(b.service_title),
          scheduledDate: String(b.scheduled_date),
          timeSlot: String(b.time_slot),
          propertyType: String(b.property_type),
          addressArea: String(b.address_area),
          description: String(b.description),
          quotedPrice: Number(b.quoted_price),
          status: String(b.status),
          createdAt: String(b.created_at),
        }));

      const quotes = db
        .prepare(
          `SELECT qr.*, u.full_name as customer_name, ps.title as service_title
           FROM quote_requests qr
           JOIN users u ON u.id = qr.customer_id
           LEFT JOIN provider_services ps ON ps.id = qr.service_id
           WHERE qr.provider_id = ?
           ORDER BY qr.created_at DESC`,
        )
        .all(providerId)
        .map((q) => ({
          id: Number(q.id),
          customerId: Number(q.customer_id),
          customerName: String(q.customer_name),
          serviceTitle: q.service_title ? String(q.service_title) : 'Custom Service Estimate',
          preferredDate: String(q.preferred_date),
          propertyType: String(q.property_type),
          addressArea: String(q.address_area),
          description: String(q.description),
          estimatedBudget: Number(q.estimated_budget),
          status: String(q.status),
          quotedAmount: q.quoted_amount ? Number(q.quoted_amount) : null,
          providerNote: String(q.provider_note || ''),
          createdAt: String(q.created_at),
        }));

      const services = db
        .prepare(
          `SELECT ps.*, sc.name as category_name
           FROM provider_services ps
           JOIN service_categories sc ON sc.id = ps.category_id
           WHERE ps.provider_id = ? AND ps.active = 1
           ORDER BY ps.id ASC`,
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

      const profileViews = Number(provider.profile_views);
      const totalBookings = bookings.length;
      const totalQuotes = quotes.length;
      const completedJobs = bookings.filter((b) => b.status === 'COMPLETED').length;
      const pendingActions = bookings.filter((b) => b.status === 'PENDING').length + quotes.filter((q) => q.status === 'PENDING').length;
      const conversionRate = profileViews > 0 ? Math.round(((totalBookings + totalQuotes) / profileViews) * 1000) / 10 : 0;

      res.json({
        profile: {
          id: providerId,
          businessName: String(provider.business_name),
          ownerName: String(provider.owner_name),
          categoryId: Number(provider.primary_category_id),
          categoryName: String(provider.category_name),
          description: String(provider.description),
          city: String(provider.city),
          area: String(provider.area),
          pincode: String(provider.pincode),
          serviceAreas: JSON.parse(String(provider.service_areas_json || '[]')),
          verified: Number(provider.verified) === 1,
          verificationStatus: String(provider.verification_status),
          averageRating: Number(provider.average_rating),
          reviewCount: Number(provider.review_count),
          responseTime: String(provider.response_time),
          responseMinutes: Number(provider.response_minutes),
          yearsExperience: Number(provider.years_experience),
        },
        stats: {
          profileViews,
          totalBookings,
          totalQuotes,
          completedJobs,
          pendingActions,
          conversionRate,
          averageRating: Number(provider.average_rating),
          reviewCount: Number(provider.review_count),
          profileCompleteness: calculateProfileCompleteness(db, providerId),
        },
        bookings,
        quotes,
        services,
        availability,
        reviews,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/bookings/provider', requireAuth, requireRole('PROVIDER', 'ADMIN'), (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const provider = getProviderForUser(req.user!.sub);
      const rows = db
        .prepare(
          `SELECT b.*, u.full_name as customer_name, ps.title as service_title
           FROM bookings b
           JOIN users u ON u.id = b.customer_id
           JOIN provider_services ps ON ps.id = b.service_id
           WHERE b.provider_id = ?
           ORDER BY b.scheduled_date DESC`,
        )
        .all(Number(provider.id));
      res.json({ bookings: rows });
    } catch (err) {
      next(err);
    }
  });

  router.put('/provider/profile', requireAuth, requireRole('PROVIDER', 'ADMIN'), (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const provider = getProviderForUser(req.user!.sub);
      const { businessName, description, city, area, pincode, serviceAreas, responseMinutes, yearsExperience } =
        req.body ?? {};

      const errors: Record<string, string> = {};
      if (!isNonEmptyString(businessName, 2, 120)) errors.businessName = 'Business name is required.';
      if (!isNonEmptyString(description, 20, 1200)) errors.description = 'Description must be at least 20 characters.';
      if (!isNonEmptyString(city, 2, 80)) errors.city = 'City is required.';
      if (!isNonEmptyString(area, 2, 80)) errors.area = 'Area is required.';
      if (!isValidPincode(pincode)) errors.pincode = 'Valid 6-digit Indian pincode is required.';

      if (Object.keys(errors).length > 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Please review business profile fields.', errors);
      }

      const respMin = Math.max(5, Math.min(240, Number(responseMinutes) || 30));
      const respLabel = respMin < 60 ? `Within ${respMin} mins` : `Within ${Math.round(respMin / 60)} hr`;
      const areasList = Array.isArray(serviceAreas)
        ? serviceAreas.map((s) => String(s).trim()).filter(Boolean)
        : String(serviceAreas || area)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

      db.prepare(
        `UPDATE providers
         SET business_name = ?, description = ?, city = ?, area = ?, pincode = ?,
             service_areas_json = ?, response_minutes = ?, response_time = ?, years_experience = ?
         WHERE id = ?`,
      ).run(
        businessName.trim(),
        description.trim(),
        city.trim(),
        area.trim(),
        String(pincode).trim(),
        JSON.stringify(areasList),
        respMin,
        respLabel,
        Math.max(1, Math.min(50, Number(yearsExperience) || 5)),
        Number(provider.id),
      );

      res.json({ message: 'Business profile updated.' });
    } catch (err) {
      next(err);
    }
  });

  router.post('/provider/services', requireAuth, requireRole('PROVIDER', 'ADMIN'), (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const provider = getProviderForUser(req.user!.sub);
      const { title, description, basePrice, priceUnit, durationMinutes, categoryId } = req.body ?? {};

      const errors: Record<string, string> = {};
      if (!isNonEmptyString(title, 3, 120)) errors.title = 'Service title is required.';
      if (!isNonEmptyString(description, 8, 500)) errors.description = 'Service description is required.';
      if (!Number.isFinite(Number(basePrice)) || Number(basePrice) < 50) errors.basePrice = 'Base price must be at least ₹50.';

      if (Object.keys(errors).length > 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Please verify service fields.', errors);
      }

      const catId = categoryId ? Number(categoryId) : Number(provider.primary_category_id);
      const resInsert = db
        .prepare(
          `INSERT INTO provider_services (provider_id, category_id, title, description, base_price, price_unit, duration_minutes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          Number(provider.id),
          catId,
          title.trim(),
          description.trim(),
          Math.round(Number(basePrice)),
          isNonEmptyString(priceUnit, 2, 40) ? priceUnit.trim() : 'per visit',
          Math.max(15, Math.min(720, Number(durationMinutes) || 60)),
        );

      res.status(201).json({ id: Number(resInsert.lastInsertRowid), message: 'Service added to rate card.' });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/provider/services/:serviceId', requireAuth, requireRole('PROVIDER', 'ADMIN'), (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const provider = getProviderForUser(req.user!.sub);
      const serviceId = Number(req.params.serviceId);

      const resUpd = db
        .prepare(`UPDATE provider_services SET active = 0 WHERE id = ? AND provider_id = ?`)
        .run(serviceId, Number(provider.id));

      if (Number(resUpd.changes) === 0) {
        throw new ApiError(404, 'SERVICE_NOT_FOUND', 'Service not found.');
      }
      res.json({ message: 'Service removed from active rate card.' });
    } catch (err) {
      next(err);
    }
  });

  router.put('/provider/availability', requireAuth, requireRole('PROVIDER', 'ADMIN'), (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const provider = getProviderForUser(req.user!.sub);
      const { schedule } = req.body ?? {};
      if (!Array.isArray(schedule)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Schedule array is required.');
      }

      const upsert = db.prepare(
        `INSERT INTO availability (provider_id, day_of_week, start_time, end_time, is_available, slots_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider_id, day_of_week) DO UPDATE SET
           start_time = excluded.start_time,
           end_time = excluded.end_time,
           is_available = excluded.is_available,
           slots_json = excluded.slots_json`,
      );

      for (const item of schedule) {
        const dow = Number(item.dayOfWeek);
        if (!Number.isInteger(dow) || dow < 0 || dow > 6) continue;
        const slots = Array.isArray(item.slots) && item.slots.length > 0
          ? item.slots.map((s: unknown) => String(s))
          : ['09:00 - 11:00', '11:30 - 13:30', '14:30 - 16:30', '17:00 - 19:00'];
        upsert.run(
          Number(provider.id),
          dow,
          typeof item.startTime === 'string' ? item.startTime : '09:00',
          typeof item.endTime === 'string' ? item.endTime : '19:00',
          item.isAvailable ? 1 : 0,
          JSON.stringify(slots),
        );
      }

      res.json({ message: 'Weekly availability updated.' });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/quote-requests/:id', requireAuth, requireRole('PROVIDER', 'ADMIN'), (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const provider = getProviderForUser(req.user!.sub);
      const quoteId = Number(req.params.id);
      const { status, quotedAmount, providerNote } = req.body ?? {};

      if (!['QUOTED', 'DECLINED', 'ACCEPTED'].includes(status)) {
        throw new ApiError(400, 'INVALID_STATUS', 'Provide a valid quote status (QUOTED, ACCEPTED, DECLINED).');
      }

      const quote = db
        .prepare(`SELECT * FROM quote_requests WHERE id = ? AND provider_id = ?`)
        .get(quoteId, Number(provider.id)) as Record<string, unknown> | undefined;
      if (!quote) throw new ApiError(404, 'QUOTE_NOT_FOUND', 'Quote request not found.');

      const existingQuoted =
        quote.quoted_amount !== null && quote.quoted_amount !== undefined ? Number(quote.quoted_amount) : null;
      const cleanAmount = quotedAmount ? Math.round(Number(quotedAmount)) : existingQuoted;
      if (status === 'QUOTED' && (!cleanAmount || Number(cleanAmount) < 50)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Enter a valid quoted INR amount.');
      }

      db.prepare(
        `UPDATE quote_requests
         SET status = ?, quoted_amount = ?, provider_note = ?, updated_at = datetime('now')
         WHERE id = ?`,
      ).run(status, cleanAmount, typeof providerNote === 'string' ? providerNote.trim() : '', quoteId);

      db.prepare(`INSERT INTO notifications (user_id, title, body, link_url) VALUES (?, ?, ?, ?)`).run(
        Number(quote.customer_id),
        `Quote ${status} — ${provider.business_name}`,
        status === 'QUOTED'
          ? `Estimated quote: ₹${cleanAmount}. ${typeof providerNote === 'string' ? providerNote.trim() : ''}`
          : `${provider.business_name} updated your quote request to ${status}.`,
        '/customer-dashboard.html?tab=quotes',
      );

      res.json({ message: 'Quote request updated.', status });
    } catch (err) {
      next(err);
    }
  });

  router.post('/reviews/:reviewId/reply', requireAuth, requireRole('PROVIDER', 'ADMIN'), (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const provider = getProviderForUser(req.user!.sub);
      const reviewId = Number(req.params.reviewId);
      const { reply } = req.body ?? {};

      if (!isNonEmptyString(reply, 4, 600)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Reply must be at least 4 characters.');
      }

      const review = db
        .prepare(`SELECT * FROM reviews WHERE id = ? AND provider_id = ?`)
        .get(reviewId, Number(provider.id));
      if (!review) throw new ApiError(404, 'REVIEW_NOT_FOUND', 'Review not found.');

      db.prepare(`UPDATE reviews SET provider_reply = ?, replied_at = datetime('now') WHERE id = ?`).run(
        reply.trim(),
        reviewId,
      );

      res.json({ message: 'Reply published.', reply: reply.trim() });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
