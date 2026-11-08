# Publish a clean GitHub repository

## Existing checkout

The preparation audit found IGDB client credentials in an old commit. The original history is retained locally to preserve ongoing work. **Do not push this checkout's branches or tags.** Removing today's `.env` does not clean historical commits.

Replace the exposed credentials at Twitch before publication. If that history already exists on GitHub, rotation is still necessary; a fresh repository does not erase the earlier remote. Removing credentials from an existing remote's history is a separate coordinated operation.

Unrelated personal documents, old audits/screenshots and scratch artifacts are kept under ignored `.local-only/`. They are excluded by the publication export. Personal library data in the installed app is separate and is not copied into the source.

## Export the reviewed source

```sh
npm run check:publication
npm run export:github
```

The export creates `release/github-source/` using an explicit source allowlist. It includes the app, tests, documentation, synthetic examples and build icon. It excludes `.git`, credentials, local archives, dependencies, generated builds and installers. It refuses to overwrite an existing export, so stale content cannot silently survive. Move a previous export aside before making another.

Use that folder, or extract the supplied source ZIP to a new empty location. Review its README and images. Initialize Git **inside that fresh source folder**:

```sh
git init -b main
git add .
git commit -m "Introduce Gamelog product design portfolio project"
```

Create an empty GitHub repository with your chosen name and visibility, then add its remote URL and push this new `main` branch. Do not reuse or copy the original `.git` folder. Keep your Git author email preference in mind; GitHub supports a private noreply address.

## Repository presentation

Suggested description: **A local-first Windows game library and play journal, exploring collection management, explainable recommendations and a Fluent UI design system.**

Suggested topics: `product-design`, `interaction-design`, `design-system`, `portfolio`, `react`, `typescript`, `electron`, `fluent-ui`.

The README includes production screenshots and links to the case study, token documentation and setup guide. A social preview can use the fictional library screenshot. Add your own portfolio URL in repository settings if desired.

Licensing remains the owner's decision. No open-source license is assumed or added. Keep third-party notices. Enable secret scanning/push protection where available and review the first Actions run. Hosted CI is configured but can only be confirmed after the repository is pushed.
