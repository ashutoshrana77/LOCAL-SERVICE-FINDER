import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../server.ts';
import { hashPassword, signToken, verifyPassword, verifyToken } from '../server/security.ts';
import { isValidEmail, isValidIndianPhone, isValidPincode } from '../server/validation.ts';

describe('Security & Validation Unit Tests', () => {
  it('hashes and verifies passwords with scrypt', () => {
    const hash = hashPassword('StrongPass@2026');
    assert.equal(verifyPassword('StrongPass@2026', hash), true);
    assert.equal(verifyPassword('WrongPass', hash), false);
  });

  it('signs and verifies HS256 JWT tokens', () => {
    const token = signToken({
      sub: 42,
      email: 'test@example.in',
      role: 'CUSTOMER',
      fullName: 'Test User',
    });
    const decoded = verifyToken(token);
    assert.equal(decoded.sub, 42);
    assert.equal(decoded.role, 'CUSTOMER');
  });

  it('validates Indian phone numbers, pincodes, and emails', () => {
    assert.equal(isValidEmail('ananya.sharma@example.in'), true);
    assert.equal(isValidEmail('bad-email'), false);
    assert.equal(isValidIndianPhone('+91 98450 21409'), true);
    assert.equal(isValidIndianPhone('12345'), false);
    assert.equal(isValidPincode('560038'), true);
    assert.equal(isValidPincode('012345'), false);
  });
});

describe('API Integration Tests', () => {
  let server: http.Server;
  let baseUrl = '';

  before(async () => {
    process.env.NODE_ENV = 'test';
    const app = createApp({ dbPath: ':memory:' });
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  async function api(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: opts.method || 'GET',
      headers: {
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  it('lists 12 seeded categories and filters providers accurately', async () => {
    const svcRes = await api('/services');
    assert.equal(svcRes.status, 200);
    assert.equal(svcRes.data.categories.length, 12);

    const searchRes = await api('/providers?category=plumbing&location=Bengaluru&verifiedOnly=true');
    assert.equal(searchRes.status, 200);
    assert.ok(searchRes.data.items.length >= 2);
    searchRes.data.items.forEach((p: { city: string; verified: boolean }) => {
      assert.equal(p.city, 'Bengaluru');
      assert.equal(p.verified, true);
    });
  });

  it('enforces authentication and role-based access control', async () => {
    const unauth = await api('/bookings/customer');
    assert.equal(unauth.status, 401);

    const custLogin = await api('/auth/login', {
      method: 'POST',
      body: { email: 'ananya.sharma@example.in', password: 'Customer@123' },
    });
    assert.equal(custLogin.status, 200);
    assert.ok(custLogin.data.token);

    const forbiddenAdmin = await api('/admin/overview', { token: custLogin.data.token });
    assert.equal(forbiddenAdmin.status, 403);
  });

  it('supports end-to-end booking creation, provider completion, and review submission', async () => {
    const custLogin = await api('/auth/login', {
      method: 'POST',
      body: { email: 'rohan.mehta@example.in', password: 'Customer@123' },
    });
    const provLogin = await api('/auth/login', {
      method: 'POST',
      body: { email: 'rajesh.plumbing@example.in', password: 'Provider@123' },
    });

    const custToken = custLogin.data.token;
    const provToken = provLogin.data.token;
    const providerId = provLogin.data.user.providerId;

    const providerDetail = await api(`/providers/${providerId}`);
    const serviceId = providerDetail.data.services[0].id;

    // Customer creates booking
    const createRes = await api('/bookings', {
      method: 'POST',
      token: custToken,
      body: {
        providerId,
        serviceId,
        scheduledDate: '2026-12-01',
        timeSlot: '09:00 - 11:00',
        propertyType: 'Apartment',
        addressArea: '12th Main, Indiranagar, Bengaluru',
        pincode: '560038',
        description: 'Bathroom angle valve replacement needed.',
      },
    });
    assert.equal(createRes.status, 201);
    const bookingId = createRes.data.id;

    // Provider accepts and completes booking
    const acceptRes = await api(`/bookings/${bookingId}/status`, {
      method: 'PATCH',
      token: provToken,
      body: { status: 'ACCEPTED' },
    });
    assert.equal(acceptRes.status, 200);

    const completeRes = await api(`/bookings/${bookingId}/status`, {
      method: 'PATCH',
      token: provToken,
      body: { status: 'COMPLETED' },
    });
    assert.equal(completeRes.status, 200);

    // Customer leaves review
    const reviewRes = await api('/reviews', {
      method: 'POST',
      token: custToken,
      body: {
        bookingId,
        rating: 5,
        comment: 'Quick valve swap and tested water pressure thoroughly.',
      },
    });
    assert.equal(reviewRes.status, 201);
  });

  it('allows admin to verify a pending provider', async () => {
    const adminLogin = await api('/auth/login', {
      method: 'POST',
      body: { email: 'admin@localservicefinder.in', password: 'Admin@123' },
    });
    assert.equal(adminLogin.status, 200);

    const overview = await api('/admin/overview', { token: adminLogin.data.token });
    assert.equal(overview.status, 200);
    const pending = overview.data.providers.find((p: { verificationStatus: string }) => p.verificationStatus === 'PENDING');
    assert.ok(pending);

    const verifyRes = await api(`/admin/providers/${pending.id}/verify`, {
      method: 'PATCH',
      token: adminLogin.data.token,
      body: { status: 'VERIFIED' },
    });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.data.verified, true);
  });
});
