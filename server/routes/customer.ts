import express from 'express';
import { getDb, recalculateProviderRating } from '../db.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../security.ts';
import { ApiError, BOOKING_STATUSES, BookingStatus, isNonEmptyString, isValidPincode } from '../validation.ts';

export function createCustomerRouter(): express.Router {
  const router = express.Router();

  // Quote requests
  router.post('/quote-requests', requireAuth, requireRole('CUSTOMER', 'ADMIN'), (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const { providerId, serviceId, preferredDate, propertyType, addressArea, description, estimatedBudget } = req.body ?? {};
      const errors: Record<string, string> = {};

      if (!providerId || !Number.isFinite(Number(providerId))) errors.providerId = 'Select a valid provider.';
      if (!isNonEmptyString(preferredDate, 8, 20)) errors.preferredDate = 'Choose a preferred date.';
      if (!isNonEmptyString(addressArea, 3, 200)) errors.addressArea = 'Enter your locality or address area.';
      if (!isNonEmptyString(description, 10, 1000)) errors.description = 'Describe your requirement (min 10 characters).';

      if (Object.keys(errors).length > 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Please review the quote request fields.', errors);
      }

      const provider = db
        .prepare(`SELECT id, user_id, business_name FROM providers WHERE id = ?`)
        .get(Number(providerId)) as { id: number; user_id: number; business_name: string } | undefined;

      if (!provider) {
        throw new ApiError(404, 'PROVIDER_NOT_FOUND', 'Provider does not exist.');
      }

      const cleanServiceId = serviceId ? Number(serviceId) : null;
      if (cleanServiceId) {
        const svc = db
          .prepare(`SELECT id FROM provider_services WHERE id = ? AND provider_id = ?`)
          .get(cleanServiceId, provider.id);
        if (!svc) throw new ApiError(400, 'INVALID_SERVICE', 'Selected service does not belong to this provider.');
      }

      const budget = Number.isFinite(Number(estimatedBudget)) && Number(estimatedBudget) > 0 ? Math.round(Number(estimatedBudget)) : 0;

      const result = db
        .prepare(
          `INSERT INTO quote_requests (
            customer_id, provider_id, service_id, preferred_date, property_type,
            address_area, description, estimated_budget, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        )
        .run(
          req.user!.sub,
          provider.id,
          cleanServiceId,
          preferredDate.trim(),
          isNonEmptyString(propertyType, 2, 60) ? propertyType.trim() : 'Apartment',
          addressArea.trim(),
          description.trim(),
          budget,
        );

      db.prepare(`INSERT INTO notifications (user_id, title, body, link_url) VALUES (?, ?, ?, ?)`).run(
        Number(provider.user_id),
        `New Quote Request from ${req.user!.fullName}`,
        `${addressArea.trim()} — ${description.trim().slice(0, 90)}`,
        '/provider-dashboard.html?tab=quotes',
      );

      res.status(201).json({
        id: Number(result.lastInsertRowid),
        status: 'PENDING',
        message: `Quote request sent to ${provider.business_name}.`,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/quote-requests/customer', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const quotes = db
      .prepare(
        `SELECT qr.*, p.business_name, p.area as provider_area, p.city as provider_city,
          ps.title as service_title
         FROM quote_requests qr
         JOIN providers p ON p.id = qr.provider_id
         LEFT JOIN provider_services ps ON ps.id = qr.service_id
         WHERE qr.customer_id = ?
         ORDER BY qr.created_at DESC`,
      )
      .all(req.user!.sub)
      .map((q) => ({
        id: Number(q.id),
        providerId: Number(q.provider_id),
        providerName: String(q.business_name),
        providerLocation: `${q.provider_area}, ${q.provider_city}`,
        serviceId: q.service_id ? Number(q.service_id) : null,
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

    res.json({ quotes });
  });

  // Bookings
  router.post('/bookings', requireAuth, requireRole('CUSTOMER', 'ADMIN'), (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const { providerId, serviceId, scheduledDate, timeSlot, propertyType, addressArea, pincode, description } =
        req.body ?? {};
      const errors: Record<string, string> = {};

      if (!providerId || !Number.isFinite(Number(providerId))) errors.providerId = 'Select a provider.';
      if (!serviceId || !Number.isFinite(Number(serviceId))) errors.serviceId = 'Select a service.';
      if (!isNonEmptyString(scheduledDate, 8, 20)) errors.scheduledDate = 'Select a preferred date.';
      if (!isNonEmptyString(timeSlot, 3, 40)) errors.timeSlot = 'Select an available time slot.';
      if (!isNonEmptyString(addressArea, 4, 240)) errors.addressArea = 'Enter your street/area address.';
      if (pincode && !isValidPincode(pincode)) errors.pincode = 'Enter a valid 6-digit Indian pincode.';
      if (!isNonEmptyString(description, 8, 1000)) errors.description = 'Describe the job briefly (min 8 characters).';

      if (Object.keys(errors).length > 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Please complete all required booking details.', errors);
      }

      const provider = db
        .prepare(`SELECT id, user_id, business_name FROM providers WHERE id = ?`)
        .get(Number(providerId)) as { id: number; user_id: number; business_name: string } | undefined;
      if (!provider) {
        throw new ApiError(404, 'PROVIDER_NOT_FOUND', 'Provider not found.');
      }

      const service = db
        .prepare(`SELECT id, title, base_price FROM provider_services WHERE id = ? AND provider_id = ? AND active = 1`)
        .get(Number(serviceId), provider.id) as { id: number; title: string; base_price: number } | undefined;
      if (!service) {
        throw new ApiError(404, 'SERVICE_NOT_FOUND', 'Selected service is unavailable for this provider.');
      }

      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const refCode = `LSF-2026-${randomDigits}`;

      const result = db
        .prepare(
          `INSERT INTO bookings (
            reference_code, customer_id, provider_id, service_id, scheduled_date, time_slot,
            property_type, address_area, pincode, description, quoted_price, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        )
        .run(
          refCode,
          req.user!.sub,
          provider.id,
          service.id,
          scheduledDate.trim(),
          timeSlot.trim(),
          isNonEmptyString(propertyType, 2, 60) ? propertyType.trim() : 'Apartment',
          addressArea.trim(),
          typeof pincode === 'string' ? pincode.trim() : '',
          description.trim(),
          Number(service.base_price),
        );

      const bookingId = Number(result.lastInsertRowid);

      db.prepare(`INSERT INTO notifications (user_id, title, body, link_url) VALUES (?, ?, ?, ?)`).run(
        Number(provider.user_id),
        `New Booking Request — ${refCode}`,
        `${req.user!.fullName} requested ${service.title} on ${scheduledDate.trim()} (${timeSlot.trim()}).`,
        '/provider-dashboard.html?tab=bookings',
      );

      db.prepare(`INSERT INTO notifications (user_id, title, body, link_url) VALUES (?, ?, ?, ?)`).run(
        req.user!.sub,
        `Booking Request Submitted — ${refCode}`,
        `Awaiting confirmation from ${provider.business_name}.`,
        '/customer-dashboard.html?tab=bookings',
      );

      res.status(201).json({
        id: bookingId,
        referenceCode: refCode,
        status: 'PENDING',
        providerName: provider.business_name,
        serviceTitle: service.title,
        scheduledDate: scheduledDate.trim(),
        timeSlot: timeSlot.trim(),
        quotedPrice: Number(service.base_price),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/bookings/customer', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT b.*, p.business_name, p.area as provider_area, p.city as provider_city,
          p.response_time, sc.name as category_name, ps.title as service_title, ps.price_unit,
          r.id as review_id, r.rating as review_rating
         FROM bookings b
         JOIN providers p ON p.id = b.provider_id
         JOIN service_categories sc ON sc.id = p.primary_category_id
         JOIN provider_services ps ON ps.id = b.service_id
         LEFT JOIN reviews r ON r.booking_id = b.id
         WHERE b.customer_id = ?
         ORDER BY b.scheduled_date DESC, b.id DESC`,
      )
      .all(req.user!.sub)
      .map((b) => ({
        id: Number(b.id),
        referenceCode: String(b.reference_code),
        providerId: Number(b.provider_id),
        providerName: String(b.business_name),
        providerLocation: `${b.provider_area}, ${b.provider_city}`,
        categoryName: String(b.category_name),
        serviceId: Number(b.service_id),
        serviceTitle: String(b.service_title),
        priceUnit: String(b.price_unit),
        scheduledDate: String(b.scheduled_date),
        timeSlot: String(b.time_slot),
        propertyType: String(b.property_type),
        addressArea: String(b.address_area),
        pincode: String(b.pincode || ''),
        description: String(b.description),
        quotedPrice: Number(b.quoted_price),
        status: String(b.status),
        cancellationReason: String(b.cancellation_reason || ''),
        hasReview: Boolean(b.review_id),
        reviewRating: b.review_rating ? Number(b.review_rating) : null,
        createdAt: String(b.created_at),
      }));

    res.json({ bookings: rows });
  });

  router.patch('/bookings/:id/status', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const bookingId = Number(req.params.id);
      const { status, scheduledDate, timeSlot, reason } = req.body ?? {};

      if (!Number.isFinite(bookingId) || bookingId <= 0) {
        throw new ApiError(400, 'INVALID_ID', 'Invalid booking ID.');
      }
      if (!BOOKING_STATUSES.includes(status as BookingStatus)) {
        throw new ApiError(400, 'INVALID_STATUS', 'Unsupported booking status.');
      }

      const booking = db
        .prepare(
          `SELECT b.*, p.user_id as provider_user_id, p.business_name, u.full_name as customer_name
           FROM bookings b
           JOIN providers p ON p.id = b.provider_id
           JOIN users u ON u.id = b.customer_id
           WHERE b.id = ?`,
        )
        .get(bookingId) as Record<string, unknown> | undefined;

      if (!booking) {
        throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
      }

      const isCustomerOwner = Number(booking.customer_id) === req.user!.sub;
      const isProviderOwner = Number(booking.provider_user_id) === req.user!.sub;
      const isAdmin = req.user!.role === 'ADMIN';

      if (!isCustomerOwner && !isProviderOwner && !isAdmin) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not authorized to update this booking.');
      }

      if (isCustomerOwner && !isAdmin) {
        if (!['CANCELLED', 'RESCHEDULED'].includes(status)) {
          throw new ApiError(403, 'FORBIDDEN', 'Customers can only cancel or request rescheduling.');
        }
      }

      if (isProviderOwner && !isAdmin) {
        if (!['ACCEPTED', 'REJECTED', 'RESCHEDULED', 'COMPLETED'].includes(status)) {
          throw new ApiError(403, 'FORBIDDEN', 'Providers can accept, reject, reschedule, or complete bookings.');
        }
      }

      const nextDate = isNonEmptyString(scheduledDate, 8, 20) ? scheduledDate.trim() : String(booking.scheduled_date);
      const nextSlot = isNonEmptyString(timeSlot, 3, 40) ? timeSlot.trim() : String(booking.time_slot);
      const nextReason = typeof reason === 'string' ? reason.trim() : '';

      db.prepare(
        `UPDATE bookings
         SET status = ?, scheduled_date = ?, time_slot = ?, cancellation_reason = ?, updated_at = datetime('now')
         WHERE id = ?`,
      ).run(status, nextDate, nextSlot, nextReason, bookingId);

      // Notify the counterparty
      const targetUserId = isProviderOwner ? Number(booking.customer_id) : Number(booking.provider_user_id);
      const targetUrl = isProviderOwner ? '/customer-dashboard.html?tab=bookings' : '/provider-dashboard.html?tab=bookings';
      db.prepare(`INSERT INTO notifications (user_id, title, body, link_url) VALUES (?, ?, ?, ?)`).run(
        targetUserId,
        `Booking ${status} — ${booking.reference_code}`,
        `${isProviderOwner ? booking.business_name : booking.customer_name} marked booking ${booking.reference_code} as ${status}.`,
        targetUrl,
      );

      res.json({
        id: bookingId,
        status,
        scheduledDate: nextDate,
        timeSlot: nextSlot,
        message: `Booking updated to ${status}.`,
      });
    } catch (err) {
      next(err);
    }
  });

  // Reviews
  router.post('/reviews', requireAuth, requireRole('CUSTOMER', 'ADMIN'), (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const { bookingId, rating, comment } = req.body ?? {};
      const numRating = Number(rating);

      if (!bookingId || !Number.isFinite(Number(bookingId))) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Booking ID is required.');
      }
      if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Rating must be an integer between 1 and 5.');
      }
      if (!isNonEmptyString(comment, 8, 800)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Review comment must be at least 8 characters.');
      }

      const booking = db
        .prepare(`SELECT b.*, p.user_id as provider_user_id FROM bookings b JOIN providers p ON p.id = b.provider_id WHERE b.id = ?`)
        .get(Number(bookingId)) as Record<string, unknown> | undefined;

      if (!booking) {
        throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
      }
      if (Number(booking.customer_id) !== req.user!.sub && req.user!.role !== 'ADMIN') {
        throw new ApiError(403, 'FORBIDDEN', 'You can only review your own bookings.');
      }
      if (booking.status !== 'COMPLETED') {
        throw new ApiError(400, 'BOOKING_NOT_COMPLETED', 'Reviews can only be submitted after a booking is completed.');
      }

      const existing = db.prepare(`SELECT id FROM reviews WHERE booking_id = ?`).get(Number(bookingId));
      if (existing) {
        throw new ApiError(409, 'REVIEW_EXISTS', 'You have already reviewed this booking.');
      }

      const insertRes = db
        .prepare(`INSERT INTO reviews (booking_id, customer_id, provider_id, rating, comment) VALUES (?, ?, ?, ?, ?)`)
        .run(Number(bookingId), Number(booking.customer_id), Number(booking.provider_id), numRating, comment.trim());

      recalculateProviderRating(db, Number(booking.provider_id));

      db.prepare(`INSERT INTO notifications (user_id, title, body, link_url) VALUES (?, ?, ?, ?)`).run(
        Number(booking.provider_user_id),
        `New ${numRating}-Star Review Received`,
        comment.trim().slice(0, 90),
        '/provider-dashboard.html?tab=reviews',
      );

      res.status(201).json({
        id: Number(insertRes.lastInsertRowid),
        rating: numRating,
        comment: comment.trim(),
      });
    } catch (err) {
      next(err);
    }
  });

  // Favorites
  router.get('/favorites', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const items = db
      .prepare(
        `SELECT p.id, p.business_name, p.area, p.city, p.average_rating, p.review_count,
          p.verified, p.response_time, p.cover_image_url, sc.name as category_name,
          COALESCE((SELECT MIN(ps.base_price) FROM provider_services ps WHERE ps.provider_id = p.id AND ps.active = 1), 0) as starting_price
         FROM favorites f
         JOIN providers p ON p.id = f.provider_id
         JOIN service_categories sc ON sc.id = p.primary_category_id
         WHERE f.customer_id = ?
         ORDER BY f.created_at DESC`,
      )
      .all(req.user!.sub)
      .map((p) => ({
        id: Number(p.id),
        businessName: String(p.business_name),
        categoryName: String(p.category_name),
        area: String(p.area),
        city: String(p.city),
        averageRating: Number(p.average_rating),
        reviewCount: Number(p.review_count),
        verified: Number(p.verified) === 1,
        responseTime: String(p.response_time),
        startingPrice: Number(p.starting_price),
        coverImageUrl: String(p.cover_image_url || ''),
      }));

    res.json({ favorites: items });
  });

  router.post('/favorites/:providerId', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const providerId = Number(req.params.providerId);
      const provider = db.prepare(`SELECT id FROM providers WHERE id = ?`).get(providerId);
      if (!provider) throw new ApiError(404, 'PROVIDER_NOT_FOUND', 'Provider not found.');

      db.prepare(`INSERT OR IGNORE INTO favorites (customer_id, provider_id) VALUES (?, ?)`).run(
        req.user!.sub,
        providerId,
      );
      res.status(201).json({ favorited: true, providerId });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/favorites/:providerId', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const providerId = Number(req.params.providerId);
      db.prepare(`DELETE FROM favorites WHERE customer_id = ? AND provider_id = ?`).run(req.user!.sub, providerId);
      res.json({ favorited: false, providerId });
    } catch (err) {
      next(err);
    }
  });

  // Messages
  router.get('/messages', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    let rows: Array<Record<string, unknown>>;

    if (req.user!.role === 'PROVIDER') {
      const prov = db.prepare(`SELECT id FROM providers WHERE user_id = ?`).get(req.user!.sub) as
        | { id: number }
        | undefined;
      if (!prov) {
        res.json({ threads: [] });
        return;
      }
      rows = db
        .prepare(
          `SELECT m.*, cu.full_name as customer_name, p.business_name, su.full_name as sender_name, su.role as sender_role,
            b.reference_code
           FROM messages m
           JOIN users cu ON cu.id = m.customer_id
           JOIN providers p ON p.id = m.provider_id
           JOIN users su ON su.id = m.sender_id
           LEFT JOIN bookings b ON b.id = m.booking_id
           WHERE m.provider_id = ?
           ORDER BY m.created_at ASC`,
        )
        .all(prov.id) as Array<Record<string, unknown>>;
    } else {
      rows = db
        .prepare(
          `SELECT m.*, cu.full_name as customer_name, p.business_name, su.full_name as sender_name, su.role as sender_role,
            b.reference_code
           FROM messages m
           JOIN users cu ON cu.id = m.customer_id
           JOIN providers p ON p.id = m.provider_id
           JOIN users su ON su.id = m.sender_id
           LEFT JOIN bookings b ON b.id = m.booking_id
           WHERE m.customer_id = ?
           ORDER BY m.created_at ASC`,
        )
        .all(req.user!.sub) as Array<Record<string, unknown>>;
    }

    const threadMap = new Map<
      string,
      {
        threadKey: string;
        customerId: number;
        customerName: string;
        providerId: number;
        providerName: string;
        bookingId: number | null;
        referenceCode: string | null;
        messages: Array<{
          id: number;
          senderId: number;
          senderName: string;
          senderRole: string;
          body: string;
          createdAt: string;
        }>;
      }
    >();

    for (const r of rows) {
      const key = `${r.customer_id}-${r.provider_id}`;
      if (!threadMap.has(key)) {
        threadMap.set(key, {
          threadKey: key,
          customerId: Number(r.customer_id),
          customerName: String(r.customer_name),
          providerId: Number(r.provider_id),
          providerName: String(r.business_name),
          bookingId: r.booking_id ? Number(r.booking_id) : null,
          referenceCode: r.reference_code ? String(r.reference_code) : null,
          messages: [],
        });
      }
      threadMap.get(key)!.messages.push({
        id: Number(r.id),
        senderId: Number(r.sender_id),
        senderName: String(r.sender_name),
        senderRole: String(r.sender_role),
        body: String(r.body),
        createdAt: String(r.created_at),
      });
    }

    res.json({ threads: Array.from(threadMap.values()) });
  });

  router.post('/messages', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const { providerId, customerId, bookingId, body } = req.body ?? {};
      if (!isNonEmptyString(body, 1, 1000)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Message cannot be empty.');
      }

      let targetProviderId = Number(providerId);
      let targetCustomerId = Number(customerId || req.user!.sub);

      if (req.user!.role === 'PROVIDER') {
        const prov = db.prepare(`SELECT id FROM providers WHERE user_id = ?`).get(req.user!.sub) as
          | { id: number }
          | undefined;
        if (!prov) throw new ApiError(404, 'PROVIDER_NOT_FOUND', 'Provider profile not found.');
        targetProviderId = prov.id;
        if (!customerId || !Number.isFinite(Number(customerId))) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Customer recipient is required.');
        }
      } else {
        targetCustomerId = req.user!.sub;
        if (!providerId || !Number.isFinite(targetProviderId)) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Provider recipient is required.');
        }
      }

      const providerRow = db
        .prepare(`SELECT id, user_id, business_name FROM providers WHERE id = ?`)
        .get(targetProviderId) as { id: number; user_id: number; business_name: string } | undefined;
      if (!providerRow) throw new ApiError(404, 'PROVIDER_NOT_FOUND', 'Provider not found.');

      const result = db
        .prepare(
          `INSERT INTO messages (booking_id, customer_id, provider_id, sender_id, body)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(bookingId ? Number(bookingId) : null, targetCustomerId, targetProviderId, req.user!.sub, body.trim());

      const notifyUserId = req.user!.role === 'PROVIDER' ? targetCustomerId : Number(providerRow.user_id);
      const notifyUrl =
        req.user!.role === 'PROVIDER' ? '/customer-dashboard.html?tab=messages' : '/provider-dashboard.html?tab=messages';

      db.prepare(`INSERT INTO notifications (user_id, title, body, link_url) VALUES (?, ?, ?, ?)`).run(
        notifyUserId,
        `New Message from ${req.user!.fullName}`,
        body.trim().slice(0, 90),
        notifyUrl,
      );

      res.status(201).json({
        id: Number(result.lastInsertRowid),
        body: body.trim(),
        senderId: req.user!.sub,
        senderName: req.user!.fullName,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  // Notifications
  router.get('/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const notifications = db
      .prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 30`)
      .all(req.user!.sub)
      .map((n) => ({
        id: Number(n.id),
        title: String(n.title),
        body: String(n.body),
        linkUrl: String(n.link_url || ''),
        isRead: Number(n.is_read) === 1,
        createdAt: String(n.created_at),
      }));
    res.json({ notifications });
  });

  router.patch('/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(req.user!.sub);
    res.json({ message: 'All notifications marked as read.' });
  });

  router.patch('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).run(
      Number(req.params.id),
      req.user!.sub,
    );
    res.json({ message: 'Notification marked as read.' });
  });

  return router;
}
