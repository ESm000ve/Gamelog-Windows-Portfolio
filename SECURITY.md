# Security and privacy

Gamelog is a local desktop/development app. It is not an authenticated public API service.

- Supply your own credentials through local environment variables or the packaged app's per-user `.env`.
- Never place secrets in `VITE_PUBLIC_` variables, source code, screenshots, logs, issues or backups.
- API keys belong to the local server. Do not add key inputs that store values in the renderer or IndexedDB.
- Personal records stay in IndexedDB, but explicit AI actions can send the selected input to Gemini. The interface explains each action's scope.
- Exported backups can include private notes. Share only after reviewing their contents.
- Run `npm run check:publication` before publishing. Pattern checks are a safeguard, not proof that every possible secret is absent.

If a credential is exposed, revoke or rotate it at the provider first. Deleting a file or creating a clean repository does not invalidate an exposed key. Review historical repositories and releases separately.

Report a vulnerability through the repository's private vulnerability reporting feature if enabled. Otherwise contact the owner privately through a published contact method. Do not put credentials or sensitive reproductions in a public issue. No security-response SLA is promised for this portfolio project.
