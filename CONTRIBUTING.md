# Contributing

Thanks for taking a look at HabiStride. This is a small, dependency-free project, and contributions are welcome.

## Development

```bash
npm start       # local static server at http://localhost:4173
npm test        # unit tests
```

No install step is needed because the app has no runtime or test dependencies.

## Guidelines

- Keep the app dependency-free unless there is a strong reason to add a tool.
- Preserve the local-first/privacy model.
- Keep user data migration-safe: bump `schemaVersion` and accept older backup versions when changing the data shape.
- Prefer semantic HTML and keyboard-accessible controls.
- Write tests for scheduling, date arithmetic, validation, and statistics changes.
- Use the existing CSS token system rather than hard-coded colours.
- Keep copy concise and in English.

## Pull requests

1. Describe the problem and the approach.
2. Include tests where behaviour changes.
3. Verify the app at desktop and mobile widths.
4. Keep unrelated formatting changes out of the PR.

## Reporting bugs

Please include:

- browser and operating system;
- steps to reproduce;
- expected and actual behaviour;
- a screenshot or console error if relevant;
- whether the issue happens with a fresh local state (you can use Settings → Clear data and reload).

Please do not include personal habit data in public issues.
