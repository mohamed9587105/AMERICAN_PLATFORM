# AMERICAN PLATFORM

The official development project for the American Diploma learning platform.
The current foundation contains the Digital SAT Exam Engine V4 Premium UI.

## Official local path

Use one development copy only:

```text
D:\\AMERICAN_PLATFORM
```

Avoid deeply nested Arabic folders because long Windows paths may cause Next.js/Turbopack errors.

## Run locally

```powershell
npm.cmd install
npm.cmd run typecheck
npm.cmd run dev
```

Open `http://localhost:3000`.

## Production validation

```powershell
npm.cmd run check
```

## Git workflow

```powershell
git add .
git commit -m "Describe the completed change"
git push origin main
```

## Current product scope

1. Finish the Digital SAT exam experience.
2. Build results and analytics.
3. Build homework as a separate completed module.
4. Build the remaining modules independently.
5. Connect all modules into the final platform.

## Security

Never commit `.env.local`, API secrets, service-role keys, or private student data.
