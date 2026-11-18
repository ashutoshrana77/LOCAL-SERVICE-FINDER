import crypto from 'node:crypto';
import express from 'express';
import { getDb } from '../db.ts';
import {
  AuthenticatedRequest,
  hashPassword,
  requireAuth,
  signToken,
  UserRole,
  verifyPassword,
} from '../security.ts';
import {
  ApiError,
  isNonEmptyString,
  isValidEmail,
  isValidIndianPhone,
  isValidPincode,
} from '../validation.ts';

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  'Delhi NCR': { lat: 28.6139, lng: 77.209 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
};

export function createAuthRouter(): express.Router {
  const router = express.Router();

  router.post('/register', (req, res, next) => {
    try {
      const db = getDb();
      const {
        fullName,
        email,
        password,
        phone,
        role = 'CUSTOMER',
        city = 'Bengaluru',
        area = '',
        businessName,
        categoryId,
        pincode,
        description,
      } = req.body ?? {};

      const errors: Record<string, string> = {};
      if (!isNonEmptyString(fullName, 2, 100)) errors.fullName = 'Full name must be at least 2 characters.';
      if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';
      if (!isNonEmptyString(password, 6, 128)) errors.password = 'Password must be at least 6 characters.';
      if (!isValidIndianPhone(phone)) errors.phone = 'Enter a valid 10-digit Indian mobile number.';

      const normalizedRole: UserRole = role === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER';
      if (role !== undefined && role !== 'CUSTOMER' && role !== 'PROVIDER') {
        errors.role = 'Self-registration supports Customer or Provider accounts only.';
      }

      if (normalizedRole === 'PROVIDER') {
        if (!isNonEmptyString(businessName, 2, 120)) errors.businessName = 'Business name is required.';
        if (!categoryId || !Number.isFinite(Number(categoryId))) errors.categoryId = 'Select a primary service category.';
        if (!isValidPincode(pincode)) errors.pincode = 'Enter a valid 6-digit Indian pincode.';
      }

      if (Object.keys(errors).length > 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', errors);
      }

      const cleanEmail = email.trim().toLowerCase();
      const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(cleanEmail);
      if (existing) {
        throw new ApiError(409, 'EMAIL_EXISTS', 'An account with this email already exists.', {
          email: 'Email is already registered.',
        });
      }

      const passwordHash = hashPassword(password);
      const userRes = db
        .prepare(
          `INSERT INTO users (full_name, email, password_hash, phone, city, area, role)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          fullName.trim(),
          cleanEmail,
          passwordHash,
          phone.trim(),
          typeof city === 'string' && city.trim() ? city.trim() : 'Bengaluru',
          typeof area === 'string' ? area.trim() : '',
          normalizedRole,
        );

      const userId = Number(userRes.lastInsertRowid);
      let providerId: number | null = null;

      if (normalizedRole === 'PROVIDER') {
        const cat = db.prepare(`SELECT id FROM service_categories WHERE id = ?`).get(Number(categoryId));
        if (!cat) {
          throw new ApiError(400, 'INVALID_CATEGORY', 'Selected service category does not exist.');
        }
        const cityName = typeof city === 'string' && city.trim() ? city.trim() : 'Bengaluru';
        const coords = CITY_COORDS[cityName] ?? CITY_COORDS.Bengaluru;
        const areaName = typeof area === 'string' && area.trim() ? area.trim() : 'Central';
        const provDesc =
          typeof description === 'string' && description.trim().length >= 10
            ? description.trim()
            : `Local ${cityName} service specialist serving ${areaName} and nearby neighborhoods.`;

        const provRes = db
          .prepare(
            `INSERT INTO providers (
              user_id, business_name, owner_name, primary_category_id, description,
              city, area, pincode, latitude, longitude, service_areas_json,
              verified, verification_status, response_time, response_minutes, years_experience,
              cover_image_url, gallery_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'PENDING', 'Within 30 mins', 30, 1, '', '[]')`,
          )
          .run(
            userId,
            businessName.trim(),
            fullName.trim(),
            Number(categoryId),
            provDesc,
            cityName,
            areaName,
            String(pincode).trim(),
            coords.lat,
            coords.lng,
            JSON.stringify([areaName]),
          );
        providerId = Number(provRes.lastInsertRowid);

        const defaultSlots = JSON.stringify(['09:00 - 11:00', '11:30 - 13:30', '14:30 - 16:30', '17:00 - 19:00']);
        const insertAvail = db.prepare(
          `INSERT INTO availability (provider_id, day_of_week, start_time, end_time, is_available, slots_json)
           VALUES (?, ?, '09:00', '19:00', ?, ?)`,
        );
        for (let d = 0; d <= 6; d++) {
          insertAvail.run(providerId, d, d === 0 ? 0 : 1, defaultSlots);
        }

        // Notify Admin about new pending provider
        const admins = db.prepare(`SELECT id FROM users WHERE role = 'ADMIN'`).all() as Array<{ id: number }>;
        const insertNotif = db.prepare(
          `INSERT INTO notifications (user_id, title, body, link_url) VALUES (?, ?, ?, ?)`,
        );
        admins.forEach((a) => {
          insertNotif.run(
            a.id,
            `New Provider Verification — ${businessName.trim()}`,
            `${fullName.trim()} registered in ${cityName} (${String(pincode).trim()}) and awaits verification.`,
            '/admin-dashboard.html?tab=verifications',
          );
        });
      }

      const token = signToken({
        sub: userId,
        email: cleanEmail,
        role: normalizedRole,
        fullName: fullName.trim(),
      });

      res.status(201).json({
        token,
        user: {
          id: userId,
          fullName: fullName.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          city: typeof city === 'string' ? city.trim() : 'Bengaluru',
          area: typeof area === 'string' ? area.trim() : '',
          role: normalizedRole,
          providerId,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', (req, res, next) => {
    try {
      const db = getDb();
      const { email, password } = req.body ?? {};
      if (!isValidEmail(email) || !isNonEmptyString(password, 1, 128)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Enter a valid email and password.');
      }

      const user = db
        .prepare(`SELECT * FROM users WHERE email = ?`)
        .get(email.trim().toLowerCase()) as Record<string, unknown> | undefined;

      if (!user || !verifyPassword(password, String(user.password_hash))) {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
      }

      if (Number(user.active) !== 1) {
        throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended by an administrator.');
      }

      const providerRow = db
        .prepare(`SELECT id, business_name, verified, verification_status FROM providers WHERE user_id = ?`)
        .get(Number(user.id)) as Record<string, unknown> | undefined;

      const token = signToken({
        sub: Number(user.id),
        email: String(user.email),
        role: user.role as UserRole,
        fullName: String(user.full_name),
      });

      res.json({
        token,
        user: {
          id: Number(user.id),
          fullName: String(user.full_name),
          email: String(user.email),
          phone: String(user.phone),
          city: String(user.city ?? ''),
          area: String(user.area ?? ''),
          role: user.role as UserRole,
          providerId: providerRow ? Number(providerRow.id) : null,
          businessName: providerRow ? String(providerRow.business_name) : null,
          verified: providerRow ? Number(providerRow.verified) === 1 : false,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const user = db
        .prepare(`SELECT id, full_name, email, phone, city, area, role, active, created_at FROM users WHERE id = ?`)
        .get(req.user!.sub) as Record<string, unknown> | undefined;

      if (!user) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User account not found.');
      }

      const providerRow = db
        .prepare(`SELECT id, business_name, verified, verification_status FROM providers WHERE user_id = ?`)
        .get(Number(user.id)) as Record<string, unknown> | undefined;

      const unreadNotifications = Number(
        (db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0`).get(Number(user.id)) as {
          c: number;
        }).c,
      );

      res.json({
        id: Number(user.id),
        fullName: String(user.full_name),
        email: String(user.email),
        phone: String(user.phone),
        city: String(user.city ?? ''),
        area: String(user.area ?? ''),
        role: user.role,
        createdAt: String(user.created_at),
        providerId: providerRow ? Number(providerRow.id) : null,
        businessName: providerRow ? String(providerRow.business_name) : null,
        verified: providerRow ? Number(providerRow.verified) === 1 : false,
        unreadNotifications,
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/profile', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const db = getDb();
      const { fullName, phone, city, area } = req.body ?? {};
      const errors: Record<string, string> = {};
      if (!isNonEmptyString(fullName, 2, 100)) errors.fullName = 'Full name must be at least 2 characters.';
      if (!isValidIndianPhone(phone)) errors.phone = 'Enter a valid 10-digit Indian mobile number.';
      if (Object.keys(errors).length > 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Please check your profile inputs.', errors);
      }

      db.prepare(`UPDATE users SET full_name = ?, phone = ?, city = ?, area = ? WHERE id = ?`).run(
        fullName.trim(),
        phone.trim(),
        typeof city === 'string' ? city.trim() : 'Bengaluru',
        typeof area === 'string' ? area.trim() : '',
        req.user!.sub,
      );

      res.json({ message: 'Profile updated successfully.' });
    } catch (err) {
      next(err);
    }
  });

  router.post('/forgot-password', (req, res, next) => {
    try {
      const db = getDb();
      const { email } = req.body ?? {};
      if (!isValidEmail(email)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Enter a valid email address.');
      }

      const cleanEmail = email.trim().toLowerCase();
      const user = db.prepare(`SELECT id FROM users WHERE email = ?`).get(cleanEmail);

      let resetToken: string | undefined;
      if (user) {
        resetToken = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        db.prepare(`INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)`).run(
          cleanEmail,
          resetToken,
          expiresAt,
        );
      }

      res.json({
        message: 'If an account matches that email, password reset instructions have been generated.',
        resetTokenPreview: resetToken ?? null,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/reset-password', (req, res, next) => {
    try {
      const db = getDb();
      const { token, newPassword } = req.body ?? {};
      if (!isNonEmptyString(token, 10, 128) || !isNonEmptyString(newPassword, 6, 128)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Valid reset token and password (min 6 characters) are required.');
      }

      const resetRow = db
        .prepare(`SELECT * FROM password_resets WHERE token = ? AND used = 0`)
        .get(token.trim()) as Record<string, unknown> | undefined;

      if (!resetRow || new Date(String(resetRow.expires_at)).getTime() < Date.now()) {
        throw new ApiError(400, 'INVALID_RESET_TOKEN', 'Reset token is invalid or has expired.');
      }

      const newHash = hashPassword(newPassword);
      db.prepare(`UPDATE users SET password_hash = ? WHERE email = ?`).run(newHash, String(resetRow.email));
      db.prepare(`UPDATE password_resets SET used = 1 WHERE id = ?`).run(Number(resetRow.id));

      res.json({ message: 'Password updated. You can now log in with your new password.' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
