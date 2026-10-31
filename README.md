# 燕园备考 · 六校模拟与口试

Public six-school practice and shared-materials website, with account-private learning records. Site identity is preserved; audience is opened only after owner-scoped authorization is deployed. Version 2.1 adds school-specific mixed papers, personal presets, quick error analysis, photographed essay drafts, local OCR and version-preserved critique imports. Six school tracks and oral practice remain available. No records are sent to the separate 双线·保送备考 site.

## School and source boundaries

The tracks are PKU Japanese, SJTU SPEIT French, Tsinghua Japanese, RUC Japanese (English/Group I preparation), BFSU Japanese and ZJU German (zero-start preparation). Public 2026 admission requirements are the historical baseline for 2027 preparation, not a declaration of 2027 policy. `content/build_multischool.py` records each school’s policy source, separately from user-reported formats and authored training choices. Admissions pages do not establish all task types or their exact durations.

The uploaded PKU-labelled scans identify themselves as 2026 外语类保送笔试预测题. Preserve the uploads without certifying them as official past papers. Original Chinese A uses Lu Xun’s 在酒楼上 and Akutagawa’s 鼻子 in Lu Xun’s 1923 translation. Author, translator, excerpt markers and public-domain sources remain attached. Archived AI-text Chinese A remains available only for old bookmarks and practice records.

## Material and generation

- Original bank: Chinese 25, math 20, English 50 questions; original PDFs and source files retain their URLs.
- Supplement: 20 mathematics and 30 English language-knowledge questions.
- Oral bank: 97 tasks, including five public-domain English readings (Bacon, Mill and Thoreau), sixteen interpreting tasks in eight matched Chinese/English pairs, twelve speeches, forty country-study questions and twenty-four school-specific interview tasks.
- New generation draws from finite curated banks. It does not call a language-model service or claim unlimited novel questions. School subject choices and oral recipes differ, while shared foundational material is identified honestly. Other school written formats still require real sample papers for finer calibration.
- Whole reading/cloze units stay attached to their complete question sets. An oral SPEIT session avoids using the same text in both translation directions. Quota failures are explicit. New short written packets normalise to 100 points; these are training scores and time limits, not official school exam formats.

## Runtime and durable data

This is now a Vinext Worker with D1 binding `DB`; native Sites provisions the database and applies the committed schema migration. Static material is authored under `public/`. `dist/` is generated build output. The source manifest keeps the existing `project_id` and removes the former static-only declaration.

`/api/archive` stores immutable generated packet snapshots, oral answers/reflections/manual rubric scores, written attempts, and optional legacy-backup copies. It uses revision-based conditional updates to prevent concurrent overwrites. Every archive query and attachment read requires a trusted Sites visitor identity and filters by owner_id. Site service access alone does not supply a user identity or authorize private records. API writes reject cross-site origins, malformed fields and oversized bodies.

New packets and explicit saved attempts are cloud-backed. Unsubmitted drafts live only in page memory, labelled unsaved. Export/import provides portable packet backups. Browser practice state uses a separate local key per Site visitor ID; the legacy key is migrated only for the verified original owner; its explicit backup action writes a separate D1 copy. Voice recognition/recording and automatic AI speech assessment are not implemented or advertised; users paste transcripts or write notes and use a clearly labelled self/teacher rubric.

## Build and checks

Use the Sites skill’s install, managed preview, build, source-helper and private publish workflow.

- `python content/build_multischool.py` builds `public/schools.json`.
- `python scripts/prepare_bank.py` regenerates the original bank into `public/`.
- `node scripts/verify_hub.mjs` checks school composition, whole-passage selection, uniqueness, interpreting pair separation, weighted totals, failures, and preview-compatible IDs.
- `node scripts/verify_app.mjs` checks original grading, backup validation and version-preserved Chinese records.
- `python scripts/verify_bank.py` checks original bank structure and independently computed mathematics.
- `npm run db:generate` generates schema migrations. Applied migrations are immutable; add new migrations for future changes.
- Build using the Sites `build-site.mjs` helper. Local migrations use the documented Wrangler command and `.wrangler/state`.

Browser QA covers school routing, SPEIT session generation and persistence, timed source masking, oral notes and manual total, refresh/reopen recovery, written generation and grading, JSON export/import, English reading provenance and legacy access. Local QA records are not seeded into the production database.

## Version 2.1 study workflows

The six-school English workbench uses `public/workflows.json`: fourteen complete reading units, eighty grammar fills, three clozes, two paragraph-ordering tasks, sixteen translation units and six writing prompts, with the existing language-knowledge bank. School defaults and difficulty labels are training designs; only the SPEIT format is explicitly based on the user's supplied structure. Reading topics and levels, count limits, timing and duplicate exclusions are visible before generation. One-line requests use a finite parser; unsupported wording is shown for explicit acknowledgement rather than silently applied. Presets, reviewed configurations and generated snapshots are separate records.

Quick errors accept entries such as `3B、8D、12A`. Records preserve the original question, necessary passage, selected option, current reference, evidence and practice methods. Correct reported options do not become errors. All unreported questions remain unknown. Redo attempts are separate from the first report; rule-based variants are labelled honestly. Objective and actual manual subjective scores are kept separate; incomplete subjective work never receives a fabricated total.

Essay images are stored in private R2 binding `BUCKET`, with D1 metadata from migration 0001. JPEG/PNG/WebP uploads are limited to 8 MB each and twelve images per draft. Run `node scripts/prepare-ocr.mjs` before every build to reproduce self-hosted Tesseract.js worker, WASM cores and English/Chinese data from the pinned lockfile. `public/ocr/` is generated and ignored in git. The browser performs recognition with no model key, third-party CDN or rejected plugin. OCR is fallible, particularly on handwriting; users must compare images and preserve actual original errors. Unreadable text stays marked and cannot receive a complete score.

Semantic essay critique is completed in the current ChatGPT conversation and imported through a portable JSON workflow. Every sentence, all six dimensions, original-source SHA-256 and arithmetic totals are validated. First critiques and originals remain immutable; later reviews are appended, and revised drafts become new records. The UI does not claim automatic AI semantic assessment. An optional user-scoped Site MCP route supports the same archive contract; no installation is required for the copy/export/import workflow. No OpenAI Developers plugin or API credential is used.

Additional checks: `node scripts/verify_workflows.mjs` covers 90 school configurations, mixed grading, intact units, deduplication and strict error parsing. `node --experimental-strip-types scripts/verify_reviews.mjs` covers source fingerprints, full-sentence coverage, scoring arithmetic, incomplete reviews and first-review preservation.

`node scripts/verify_ui_flows.mjs` covers anonymous grading, failed saves, delayed requests, edits during essay saves, manual-score invalidation, answer-backup restoration and school/subject templates. It runs controllers with isolated request and DOM fixtures; it does not replace browser interaction checks. JSON paper backups now include written answers, manual scores and elapsed time; older paper-only backups remain supported. Decorative captions and duplicate explanatory text have been removed, with optional difficulty and source details collapsed and essential labels made readable.

OCR preparation also writes uncompressed models under `public/ocr/data/` to avoid `.gz` content-encoding handling in local previews. The UI checks model downloads before starting recognition, supports cancellation during image loading and recognition, and keeps the original transcription on failure or cancellation. Navigation becomes interactive after startup handlers are ready. Form textareas and narrow-screen assembly rows use the full available width.

## Version 3.0 independent reference bands

`difficulty-engine.js` and `difficulty-ui.js` replace the global written difficulty selector with per-section rows for English, mathematics and Chinese. Rows may repeat a section at different reference bands. Each row selects exact labelled stock; the explicit mixed option is the only cross-band selection. Specific-band rows reserve material before mixed rows, preventing greedy mixed draws from consuming scarce requested bands. Insufficient stock prevents generation instead of lowering the selected band. Whole reading/cloze units and paired Chinese readings stay intact.

`content/build_difficulty.py` generates `public/difficulty.json` from reviewed source-specific assignments. Every unit has a stable identity, reference band, provisional status and rationale. Exam labels indicate reference task demands rather than official equivalence or a universal ranking. TEM-8-plus, competition 1/2 and graduate Chinese remain empty until representative material can substantiate the classification. Existing objective mathematics cannot substitute for competition proofs.

The studio displays counts before and after duplicate exclusions, exposes classification rationales, saves independent-band presets and migrates older presets without silently translating the old global level. PKU defaults keep three complete five-question readings and 2/1/3 objective weights when the full 50-question structure is selected; custom packets clearly normalise to 100 training points. Difficulty snapshots and per-question provenance persist with each generated packet. Existing papers, records, private audience and oral practice are preserved.

`node scripts/verify_difficulty.mjs` checks all school/subject defaults, exact per-section selection, independence of reading/cloze, mixed allocation, no silent fallback, prior-answer exclusions, intact paired Chinese materials, PKU weights and legacy preset migration. Browser QA verifies independent tiers, cloud presets, packet refresh, per-question explanations and explicit empty high-tier states.


## Version 4.0 public sources, private learning records

Visitors can browse schools, assemble papers, practise and export without signing in. ChatGPT sign-in is required for cloud records, private presets, quick errors, photographed essays and public contributions. Shared materials use separate D1 tables and R2 object prefixes; private archive records and essay attachments never feed the public catalog. Contributors choose a public alias, source, rights basis, section, reference band and rationale, then explicitly confirm publication. PDFs/DOCX/TXT/JPG/PNG are downloadable attachments, not automatically extracted questions. Structured questions are validated and become selectable stock. Each individual-question section counts questions; passage tasks stay intact. Difficulty labels from contributors say “上传者自标，未审核”.

The session endpoint reports only authentication state, Site-scoped user ID and the original-owner migration flag. Trusted oai-authenticated-user-id and email come from Sites dispatch; the application never accepts a caller-supplied body owner ID. Archive, study-state, attachments, essay review and personal MCP tools all enforce ownership. Every new record stores owner_id. Migration 0002 only adds schema; historical NULL-owner records remain readable only when the authenticated email matches the secret LEGACY_OWNER_EMAIL, provisioned from the Site's verified owner before public release. New updates claim those historical records for the stable Site identity. The secret must not be blank, copied into client code, or changed to another visitor. No data backfill or automatic publication of private records is performed.

Public contributors can edit or withdraw only their own materials, using optimistic revisions. Withdrawal removes current material and its attachments from public endpoints and future assembly. Previously exported files and saved packet snapshots remain intact. Published revisions use distinct source IDs, so changing shared answers does not change saved papers. Anonymous shared reads expose neither email nor owner ID. New shared uploads: six files per material, 8MB per file, 30 uploads/day; new publications: 20/day per signed-in account. Shared attachments force download, nosniff and sandbox headers. Text and question rendering escapes user input.

Run node scripts/verify_multiuser.mjs to test the built Worker in isolated Miniflare with in-memory D1/R2 and synthetic A/B/anonymous/original-owner identities. It checks private reads/writes, attachment ownership, essay/review references, MCP isolation, legacy access, learning-index separation, share consent, source validation, public catalog assembly, revisions, file visibility and withdrawal. It never sends test headers or test records to production. Browser checks cover anonymous assembly, exports and personal login gates.
