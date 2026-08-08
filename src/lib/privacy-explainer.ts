/** In-app trust copy for Settings → How Jarbas uses data (JAR-8). */
export const PRIVACY_EXPLAINER_MARKDOWN = `## The short version

Jarbas is built **local-first**.

What you learn from your screen - capture frames, OCR text, the Learning timeline, insights, opportunities, Ask history, and redaction - stays on **this device**. Cloud is used only when you explicitly create something meant to share with your organization, or for account and organization features that need a signed-in identity.

Private by default. Shared only when you choose.

## How capture works

When Learning is recording, Jarbas captures what is on screen so it can understand how work actually happens.

- **Frames** are stored in your local Jarbas library on this device.
- **OCR text** extracted from those frames is also stored locally.
- That library is what powers Learning, insights, opportunities, and Ask about your work.
- Capture respects your system permissions (screen / accessibility, depending on platform) and your ignore lists.

Jarbas does not stream your screen to a remote always-on cloud store. The working memory of Learning lives with you.

## What stays on this device

- **Screen frames + OCR** - local Jarbas library on this device
- **Learning timeline / activity** - this device
- **Insights and opportunities** - this device
- **Ask provider keys** - this device
- **Local Ask engine** - this device
- **Redaction prefs + history** - this device
- **Ignored apps and URLs** - this device

Everything Learning shows you stays private on this device. Your API keys for Ask never leave this machine as part of a Jarbas sync.

## What can go to the cloud

Cloud is intentional and narrow.

### Organization reports

When you generate a report for your organization, **that report** is stored securely in the cloud so teammates can open it. You will see a clear note in the product: stored securely in the cloud; everything else stays local.

Generating a report does **not** upload your full capture library. The exception is the report itself (and related report payloads you chose to create).

### Account and organization

Sign-in and organization membership live with your account provider so Pricing, seats, and shared reports can work across people.

### Connectors

Connected apps are **read-only** by policy. Jarbas can pull context you authorize from tools you connect. It does not write back through connectors as a default product behavior.

## What is not ready yet

- **Audio / meeting transcription** is still unavailable in Learning.
- The product says so explicitly where it would otherwise be implied - we do not pretend audio is being captured today.

## Privacy controls you already have

### Permissions

Grant or revoke system access for capture in your OS privacy settings. Without the required permissions, Learning cannot record.

### Ignored apps and URLs

Pause capture while focused apps or matching sites are active. Past matching captures can be cleaned up when you save those lists.

### Redaction

Choose a severity tier (or customize categories), preview matches, scrub a date range, or auto-redact when a recording ends. Redaction runs locally against stored capture text. Frames stay; sensitive text is scrubbed. Redaction history stays on this device.

### Local storage

See how much local data you have. Delete a date range, or reset all local Jarbas data on this device (recordings, analysis, Ask setup, and keys). Local wipe does not automatically delete cloud org reports - those are managed from Reports.

### Cloud reports

Open shared reports from Reports, and delete them when your organization no longer needs them.

## Retention at a glance

- **Local library** - you control retention with delete-by-range or full local reset.
- **Cloud reports** - retained for the organization until someone with access removes them.
- **Connectors** - authorization and tokens follow the connected provider and your connection status; content pulled for a task is not a second copy of your whole screen library.

## Why this design

Local capture keeps day-to-day work private and fast. It also keeps the most sensitive surface - continuous screen context - off a remote dataset by default.

Cloud storage unlocks the one thing that has to leave the device to be useful to a team: **shared reports**. That split is deliberate.

**Private by default. Shared only when you choose.**
`;
