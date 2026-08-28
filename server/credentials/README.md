# Service account credentials

Put your Google service-account JSON key file in this directory, then point
`server/.env` at it:

```
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=credentials/service-account.json
```

Everything in this folder except this README is gitignored. **Never commit a
key file, paste its contents into chat/email/issues, or copy it into the
`client/` directory** — the browser must never see these credentials.

If a key is ever exposed, delete it immediately in
Google Cloud Console -> IAM & Admin -> Service Accounts -> Keys, and create a
new one. Deleting the key revokes it; the service account itself keeps working.
