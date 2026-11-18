import { apiFetch } from './api.js';
import { dashboardUrlForRole, setSession } from './auth.js';
import { closeModal, escapeHtml, initChrome, openModal, showToast } from './ui.js';

initChrome('');

const params = new URLSearchParams(window.location.search);
const redirectUrl = params.get('redirect');

// Login Page
const loginForm = document.getElementById('login-form');
if (loginForm) {
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  const errEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit-btn');

  document.querySelectorAll('.fill-demo-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      emailInput.value = btn.dataset.email;
      passInput.value = btn.dataset.pass;
      errEl.style.display = 'none';
    });
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: {
          email: emailInput.value.trim(),
          password: passInput.value,
        },
      });
      setSession(data.token, data.user);
      window.location.href = redirectUrl || dashboardUrlForRole(data.user.role);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In';
    }
  });

  document.getElementById('forgot-password-btn')?.addEventListener('click', () => {
    openModal({
      title: 'Reset Your Password',
      contentHtml: `
        <form id="forgot-form" style="display:flex;flex-direction:column;gap:14px;">
          <div class="form-group">
            <label for="fp-email" class="form-label">Registered Email</label>
            <input id="fp-email" type="email" class="input" placeholder="you@example.in" required />
          </div>
          <div id="fp-result" style="display:none;" class="alert-banner alert-success"></div>
          <button type="submit" class="btn btn-primary btn-sm">Generate Reset Token</button>
        </form>
        <div class="hairline-divider"></div>
        <form id="reset-form" style="display:flex;flex-direction:column;gap:12px;">
          <div class="form-group">
            <label for="rp-token" class="form-label">Reset Token</label>
            <input id="rp-token" type="text" class="input mono" placeholder="Paste token above" required />
          </div>
          <div class="form-group">
            <label for="rp-pass" class="form-label">New Password</label>
            <input id="rp-pass" type="password" class="input" placeholder="Min 6 characters" required />
          </div>
          <div id="rp-error" class="alert-banner alert-error" style="display:none;"></div>
          <button type="submit" class="btn btn-secondary btn-sm">Update Password</button>
        </form>
      `,
      onMount: (bodyEl) => {
        const fpForm = bodyEl.querySelector('#forgot-form');
        const fpResult = bodyEl.querySelector('#fp-result');
        const rpToken = bodyEl.querySelector('#rp-token');
        const rpForm = bodyEl.querySelector('#reset-form');
        const rpError = bodyEl.querySelector('#rp-error');

        fpForm.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const res = await apiFetch('/auth/forgot-password', {
            method: 'POST',
            body: { email: bodyEl.querySelector('#fp-email').value.trim() },
          });
          fpResult.style.display = 'block';
          fpResult.innerHTML = `${escapeHtml(res.message)}${
            res.resetTokenPreview
              ? `<div class="mono" style="margin-top:6px;font-size:0.75rem;">Dev Preview Token: ${escapeHtml(res.resetTokenPreview)}</div>`
              : ''
          }`;
          if (res.resetTokenPreview) rpToken.value = res.resetTokenPreview;
        });

        rpForm.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          rpError.style.display = 'none';
          try {
            await apiFetch('/auth/reset-password', {
              method: 'POST',
              body: {
                token: rpToken.value.trim(),
                newPassword: bodyEl.querySelector('#rp-pass').value,
              },
            });
            closeModal();
            showToast('Password updated. You may now log in.');
          } catch (err) {
            rpError.textContent = err.message;
            rpError.style.display = 'block';
          }
        });
      },
    });
  });
}

// Register Page
const registerForm = document.getElementById('register-form');
if (registerForm) {
  const roleInput = document.getElementById('reg-role');
  const providerFields = document.getElementById('provider-extra-fields');
  const categorySelect = document.getElementById('reg-category');
  const errEl = document.getElementById('register-error');
  const submitBtn = document.getElementById('register-submit-btn');

  function setRoleTab(role) {
    const cleanRole = role === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER';
    roleInput.value = cleanRole;
    document.querySelectorAll('[data-role-tab]').forEach((b) => {
      b.classList.toggle('active', b.dataset.roleTab === cleanRole);
    });
    providerFields.style.display = cleanRole === 'PROVIDER' ? 'flex' : 'none';
  }

  document.querySelectorAll('[data-role-tab]').forEach((btn) => {
    btn.addEventListener('click', () => setRoleTab(btn.dataset.roleTab));
  });

  if (params.get('role') === 'PROVIDER') {
    setRoleTab('PROVIDER');
  }

  apiFetch('/services')
    .then((data) => {
      (data.categories || []).forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        categorySelect.appendChild(opt);
      });
    })
    .catch(() => {});

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      const payload = {
        role: roleInput.value,
        fullName: document.getElementById('reg-name').value.trim(),
        phone: document.getElementById('reg-phone').value.trim(),
        email: document.getElementById('reg-email').value.trim(),
        city: document.getElementById('reg-city').value,
        area: document.getElementById('reg-area').value.trim(),
        password: document.getElementById('reg-password').value,
      };

      if (payload.role === 'PROVIDER') {
        payload.businessName = document.getElementById('reg-business').value.trim();
        payload.categoryId = Number(categorySelect.value);
        payload.pincode = document.getElementById('reg-pincode').value.trim();
        payload.description = document.getElementById('reg-description').value.trim();
      }

      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: payload,
      });

      setSession(data.token, data.user);
      window.location.href = dashboardUrlForRole(data.user.role);
    } catch (err) {
      const detailMsg = err.details ? Object.values(err.details).join(' ') : '';
      errEl.textContent = detailMsg || err.message;
      errEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });
}
