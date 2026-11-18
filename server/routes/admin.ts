import express from 'express';
import { getDb, recalculateProviderRating } from '../db.ts';
import { AuthenticatedRequest, requireAuth, requireRole } from '../security.ts';
import { ApiError } from '../validation.ts';

export function createAdminRouter(): express.Router {
  const router = express.Router();

  router.get('/admin/overview', requireAuth, requireRole('ADMIN'), (_req: AuthenticatedRequest, res) => {
    const db = getDb();

    const totals = {
      users: Number((db.prepare(`SELECT COUNT(*) as c FROM users`).get() as { c: number }).c),
      providers: Number((db.prepare(`SELECT COUNT(*) as c FROM providers`).get() as { c: number }).c),
      verifiedProviders: Number((db.prepare(`SELECT COUNT(*) as c FROM providers WHERE verified = 1`).get() as { c: number }).c),
      pendingVerifications: Number(
        (db.prepare(`SELECT COUNT(*) as c FROM providers WHERE verification_status = 'PENDING'`).get() as { c: number }).c,
      ),
      totalBookings: Number((db.prepare(`SELECT COUNT(*) as c FROM bookings`).get() as { c: number }).c),
      completedBookings: Number(
        (db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE status = 'COMPLETED'`).get() as { c: number }).c,
      ),
      totalReviews: Number((db.prepare(`SELECT COUNT(*) as c FROM reviews`).get() as { c: number }).c),
    };

    const providers = db
      .prepare(
        `SELECT p.*, u.email, u.phone, u.active as user_active, sc.name as category_name,
          (SELECT COUNT(*) FROM provider_services ps WHERE ps.provider_id = p.id AND ps.active = 1) as service_count
         FROM providers p
         JOIN users u ON u.id = p.user_id
         JOIN service_categories sc ON sc.id = p.primary_category_id
         ORDER BY (p.verification_status = 'PENDING') DESC, p.created_at DESC`,
      )
      .all()
      .map((p) => ({
        id: Number(p.id),
        userId: Number(p.user_id),
        businessName: String(p.business_name),
        ownerName: String(p.owner_name),
        email: String(p.email),
        phone: String(p.phone),
        categoryName: String(p.category_name),
        city: String(p.city),
        area: String(p.area),
        pincode: String(p.pincode),
        verified: Number(p.verified) === 1,
        verificationStatus: String(p.verification_status),
        averageRating: Number(p.average_rating),
        reviewCount: Number(p.review_count),
        serviceCount: Number(p.service_count),
        userActive: Number(p.user_active) === 1,
        createdAt: String(p.created_at),
      }));

    const reviews = db
      .prepare(
        `SELECT r.*, cu.full_name as customer_name, p.business_name as provider_name
         FROM reviews r
         JOIN users cu ON cu.id = r.customer_id
         JOIN providers p ON p.id = r.provider_id
         ORDER BY r.created_at DESC
         LIMIT 40`,
      )
      .all()
      .map((r) => ({
        id: Number(r.id),
        providerId: Number(r.provider_id),
        providerName: String(r.provider_name),
        customerName: String(r.customer_name),
        rating: Number(r.rating),
        comment: String(r.comment),
        moderationStatus: String(r.moderation_status),
        createdAt: String(r.created_at),
      }));

    const users = db
      .prepare(`SELECT id, full_name, email, phone, city, role, active, created_at FROM users ORDER BY id DESC`)
      .all()
      .map((u) => ({
        id: Number(u.id),
        fullName: String(u.full_name),
        email: String(u.email),
        phone: String(u.phone),
        city: String(u.city || ''),
        role: String(u.role),
        active: Number(u.active) === 1,
        createdAt: String(u.created_at),
      }));

    const recentBookings = db
      .prepare(
        `SELECT b.id, b.reference_code, b.scheduled_date, b.status, b.quoted_price,
          cu.full_name as customer_name, p.business_name as provider_name
         FROM bookings b
         JOIN users cu ON cu.id = b.customer_id
         JOIN providers p ON p.id = b.provider_id
         ORDER BY b.id DESC LIMIT 20`,
      )
      .all()
      .map((b) => ({
        id: Number(b.id),
        referenceCode: String(b.reference_code),
        scheduledDate: String(b.scheduled_date),
        status: String(b.status),
        quotedPrice: Number(b.quoted_price),
        customerName: String(b.customer_name),
        providerName: String(b.provider_name),
      }));

    res.json({ totals, providers, reviews, users, recentBookings });
  });

  router.patch('/admin/providers/:id/verify', requireAuth, requireRole('ADMIN'), (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const providerId = Number(req.params.id);
      const { status } = req.body ?? {};

      if (!['VERIFIED', 'REVOKED', 'PENDING'].includes(status)) {
        throw new ApiError(400, 'INVALID_STATUS', 'Status must be VERIFIED, REVOKED, or PENDING.');
      }

      const provider = db
        .prepare(`SELECT id, user_id, business_name FROM providers WHERE id = ?`)
        .get(providerId) as { id: number; user_id: number; business_name: string } | undefined;
      if (!provider) throw new ApiError(404, 'PROVIDER_NOT_FOUND', 'Provider not found.');

      const verifiedFlag = status === 'VERIFIED' ? 1 : 0;
      db.prepare(`UPDATE providers SET verified = ?, verification_status = ? WHERE id = ?`).run(
        verifiedFlag,
        status,
        providerId,
      );

      db.prepare(`INSERT INTO notifications (user_id, title, body, link_url) VALUES (?, ?, ?, ?)`).run(
        Number(provider.user_id),
        `Verification Status: ${status}`,
        status === 'VERIFIED'
          ? `${provider.business_name} is now marked as Verified on Local Service Finder.`
          : `Your verification status was updated to ${status}.`,
        '/provider-dashboard.html',
      );

      res.json({ id: providerId, verified: verifiedFlag === 1, verificationStatus: status });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/admin/reviews/:id/moderate', requireAuth, requireRole('ADMIN'), (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const reviewId = Number(req.params.id);
      const { moderationStatus } = req.body ?? {};
      if (!['VISIBLE', 'HIDDEN'].includes(moderationStatus)) {
        throw new ApiError(400, 'INVALID_STATUS', 'Moderation status must be VISIBLE or HIDDEN.');
      }

      const review = db
        .prepare(`SELECT id, provider_id FROM reviews WHERE id = ?`)
        .get(reviewId) as { id: number; provider_id: number } | undefined;
      if (!review) throw new ApiError(404, 'REVIEW_NOT_FOUND', 'Review not found.');

      db.prepare(`UPDATE reviews SET moderation_status = ? WHERE id = ?`).run(moderationStatus, reviewId);
      recalculateProviderRating(db, Number(review.provider_id));

      res.json({ id: reviewId, moderationStatus });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/admin/users/:id/status', requireAuth, requireRole('ADMIN'), (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const userId = Number(req.params.id);
      const { active } = req.body ?? {};

      if (userId === req.user!.sub) {
        throw new ApiError(400, 'SELF_ACTION_BLOCKED', 'You cannot suspend your own administrator account.');
      }

      const user = db.prepare(`SELECT id FROM users WHERE id = ?`).get(userId);
      if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');

      db.prepare(`UPDATE users SET active = ? WHERE id = ?`).run(active ? 1 : 0, userId);
      res.json({ id: userId, active: Boolean(active) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
