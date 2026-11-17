CAPITAL BANK CUSTOMER WEB APP PACKAGE

Files:
- index.html: main entry page (login)
- login.html: standalone login page
- open-account.html: standalone account-opening page
- manifest.webmanifest, service-worker.js, icons/: PWA installation support

Deployment:
Upload every file and folder together to the same Cloudflare Pages site root. Keep the two standalone HTML pages and all assets on the same origin so they share the same browser storage and JsonBin-backed app state. Serve over HTTPS.

Navigation:
The login page's Open an account link opens open-account.html. The account-opening page's Log in link returns to login.html. Existing sign-in, registration, OTP, and dashboard logic is retained in the shared application code.

iPhone/iPad: Safari > Share > Add to Home Screen. Android: Chrome > Install app. Desktop: Chrome/Edge > Install app.

UPDATE NOTES
- Debit alerts: every debit (payments, transfers, wires, card payments, term deposits, travel money, goal top-ups) emails the registered customer email via EmailJS (service_cmwqxq5, template_q83v2nw). If the admin has added a third-party email to the customer's record (field name: alertEmail), the alert is sent to both addresses. Customers cannot add or change this email themselves.
- Hide/Show: the balance block now has a labelled Hide/Show button that masks the balance, monthly chip, pending amount and account number. The choice is remembered on the device.
- Template variables used by template_q83v2nw: to_email, to_name, amount, from_account, date, recipient, reference, balance. Make sure the template's "To email" field is {{to_email}}.
