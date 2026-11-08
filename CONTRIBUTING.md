# Contributing

Use Node.js 24 LTS, run `npm ci`, and develop with `npm run dev:web` or `npm run dev` on Windows. Use your own local credentials; copy the blank `.env.example` if you need online features. The fictional example library requires no credentials.

Before submitting changes, run:

```sh
npm run check
npm run build
npm run test:ui:production
npm run check:publication
```

On Windows, also run `npm run test:desktop` for desktop, storage or theme changes. Browser tests use isolated storage and mocked providers. Do not use a real library or live credentials as a fixture.

Follow the existing screen/component/service/repository boundaries. Validate untrusted data before writes. Preserve notes, sessions and other personal fields when refreshing catalog metadata. Append database migrations rather than rewriting existing versions. Use shared controls, semantic tokens and feedback patterns.

Describe the user-visible change, relevant states, validation and remaining limits. UI changes should include screenshots with fictional data, keyboard behavior and narrow-window checks. Never attach personal backups, account identifiers, credentials or machine-specific paths.

The repository currently grants no open-source license. Discuss licensing and contribution terms with the owner before contributing code intended for redistribution.
