# Kores Employee Records

A browser-based **employee data management** application: capture personnel
through a configurable form, store the data locally in IndexedDB, import/export
Excel and CSV files, and generate print-ready employee reports in three layouts.

The reference document is the **New Joining Form** of PEFCO Foundry Division
(Bhosari) — its 40 fields are part of the application out of the box: the data
entry form, the Excel/CSV export, the importer and the reports all carry them
from the first start, and the same field list stays available as a re-appliable
template in *Settings → Field templates*.

**Everything runs in the browser.** There is no backend, no server-side database
and no external API. Employee data and photos never leave the device.

The one optional exception is the *cloud reader* for the passbook photo: when
it is deployed, the photo of a passbook is sent to a serverless function that
reads it with a multimodal model. It is off by default and it only ever
happens after the free, local read of the same photo. See
[Cloud reader](#cloud-reader).

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Quick start](#quick-start)
4. [Project structure](#project-structure)
5. [How the application works](#how-the-application-works)
6. [Deployment](#deployment)
   - [GitHub Pages](#github-pages)
   - [Vercel](#vercel)
   - [Netlify](#netlify)
   - [Render](#render)
7. [The OCR engine](#the-ocr-engine)
8. [Cloud reader](#cloud-reader)
9. [Testing checklist](#testing-checklist)
10. [Browser limitations](#browser-limitations)
11. [Security and privacy](#security-and-privacy)
12. [Troubleshooting](#troubleshooting)

---

## Features

| Area | What it does |
| --- | --- |
| **Dashboard** | Total employees, recently joined employees, category counts — all calculated from the real records, never from sample data. |
| **Add / Edit employee** | Reusable form with automatic Employee ID, joining date, employee name, category, remarks, photo and the fields of the applied template. Validation messages are shown next to the offending field. |
| **Auto-fill from PDF** | Upload a filled joining form as PDF: the values are read in the browser and written into the form. Every value can be corrected or redirected to another field before it is applied. Scanned pages are read with OCR. |
| **Auto-fill from a bank passbook** | Upload the photo of a passbook: the account number, the IFSC code, the bank and the branch are read out of the photo with OCR and written into the bank fields of the form. Every value can be corrected before it is applied. |
| **Photo handling** | JPEG / PNG / WebP upload, resized to the 350 × 450 px photo frame (the overflow is cropped so the photo fills the frame) and compressed to ≈1 MB, previewed before saving, stored as a `Blob` in a separate IndexedDB table, replaceable and deletable. |
| **Employee table** | Free-text search, category and date-range filters, sortable columns, pagination, row selection with select-all, single and bulk delete with confirmation, employee and filtered-result counts, empty state. |
| **Print employee details** | Every row has a print button: the **New Joining Form** of the plant is printed with the values of the employee — the same grid, the same row numbers and the same photo box as the paper form. Several employees are printed one per page, and the read-only employee view has a print button as well. |
| **Import** | `.xlsx` / `.xls` / `.csv` parsing in the browser, worksheet and header detection, reviewable column mapping, per-row validation, preview of valid rows / invalid rows / duplicates / conflicts, downloadable error report, three import strategies, confirmation before committing, transactional write. |
| **Export** | `.xlsx` and `.csv` export of either the filtered or the complete dataset, with typed date and numeric cells, stable column order and readable column widths. |
| **Reports** | Three layouts (Employee list, Employee card, Employee directory), A4 / US Letter, portrait / landscape, configurable title, organisation and footer note, on-screen preview that prints as shown. |
| **Settings** | Application title, organisation, currency, footer note, default paper size and orientation, default category, category management, employee field definitions (text / long text / number / date / select, grouped in sections), field templates, full backup and restore. |
| **Demo sign-in** | Login ID and password gate using the public `public/userauth.txt` file. This is a demo convenience only, not security. |

The quantity / unit price / total amount block of a generic stock system is
**off by default** and can be switched on in *Settings → Application* if the
register is ever used for assets as well.

---

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | React 19 + Vite 7 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 3 + a dedicated print stylesheet |
| Routing | React Router 7 (hash based) |
| Storage | Dexie 4 (IndexedDB) |
| Spreadsheets | SheetJS (`xlsx`) — loaded on demand |
| PDF | PDF.js (`pdfjs-dist`) — loaded on demand, with Tesseract for scanned pages |
| Images | `browser-image-compression` plus a Canvas pass that cuts the 350 × 450 px frame |
| Validation | React Hook Form + Zod |
| Icons | Lucide React |

---

## Quick start

Requirements: **Node.js 20 or newer** (22 LTS recommended) and npm.

```bash
# 1. install the dependencies
npm install

# 2. start the development server on http://localhost:5173
npm run dev

# 3. create a production build in ./dist
npm run build

# 4. preview the production build on http://localhost:4173
npm run preview
```

Additional scripts:

```bash
npm run typecheck   # tsc -b, no emit
```

For local cloud-reader tests, put `GEMINI_API_KEY=...` in the ignored root
`.env` file, then run `npm run build` and `npm start`. The start command loads
that file on Node 22; the key stays on the server and must not use a `VITE_`
prefix. On Render, set `GEMINI_API_KEY` in the service's private Environment
settings instead.

The exact commands used to create the project are:

```bash
npm create vite@latest kores-employee-records -- --template react-ts
cd kores-employee-records
npm install
npm install react-router-dom dexie react-hook-form zod @hookform/resolvers \
            browser-image-compression lucide-react
npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
npm install -D tailwindcss@3 postcss autoprefixer @types/node
npx tailwindcss init -p
```

---

## Project structure

```
kores-employee-records/
├── .github/workflows/deploy-pages.yml   GitHub Pages deployment workflow
├── .env.example                        Example build-time configuration
├── netlify.toml                        Netlify build + header configuration
├── vercel.json                         Vercel build + header configuration
├── render.yaml                         Render blueprint (web service)
├── index.html                          HTML entry point
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.app.json / tsconfig.node.json / tsconfig.server.json
├── vite.config.ts                      Build config, BASE_PATH handling
├── api/ocr.ts                          The cloud reader (Vercel function)
├── netlify/functions/ocr.ts            The cloud reader (Netlify function)
├── server/
│   ├── http.ts                         The HTTP helpers of the service
│   ├── ocr.ts                          The cloud reader (shared, transport free)
│   └── render.ts                       The web service of Render
├── scripts/
│   ├── build-server.mjs                Builds the web service
│   ├── check-cloud-ocr.mjs             Checks the cloud reader
│   └── prepare-tesseract.mjs           Puts the OCR engine into public/
├── public/
│   ├── .nojekyll                       GitHub Pages: serve files verbatim
│   ├── favicon.svg
│   └── tesseract/                      The OCR engine (generated, see below)
└── src/
    ├── main.tsx                        React entry point
    ├── App.tsx                         Providers + routes
    ├── index.css                       Tailwind layers and shared utilities
    ├── types/index.ts                  Domain types, filters, defaults
    ├── db/
    │   ├── db.ts                       Dexie schema and indexes
    │   └── repository.ts               CRUD, search, images, import, settings
    ├── lib/
    │   ├── backup.ts                   Full backup archive (records + images)
    │   ├── cloudOcr.ts                 The browser side of the cloud reader
    │   ├── columns.ts                  Column definitions for tables/exports
    │   ├── cx.ts                       Class name helper
    │   ├── download.ts                 File download helpers
    │   ├── errors.ts                   Error message helpers
    │   ├── excel.ts                    SheetJS import/export (lazy loaded)
    │   ├── fields.ts                   Grouping of the fields by section
    │   ├── format.ts                   Date, number and file name formatting
    │   ├── id.ts                       Record ID / UUID generation
    │   ├── image.ts                    Image validation, frame resize, compression
    │   ├── import.ts                   Import plan builder (pure)
    │   ├── ocr.ts                      OCR of an image (lazy loaded)
    │   ├── ocrQuota.ts                 The counter of the cloud reads
    │   ├── passbook.ts                 Bank details out of the text of a passbook
    │   ├── passbookCloud.ts            The contract of the cloud reader
    │   ├── pdf.ts                      PDF reading and OCR (lazy loaded)
    │   ├── pdfFormat.ts                The standard format of the PDF forms
    │   ├── pdfMapping.ts               PDF label → field matching engine
    │   ├── tesseract.ts                Starting the OCR engine
    │   ├── templates.ts                Field templates (New Joining Form…)
    │   └── validation.ts               Zod schemas and field rules
    ├── hooks/
    │   ├── useImages.ts                Object URL lifecycle for image blobs
    │   └── usePageSizeStyle.ts         Runtime @page rule for the print view
    ├── components/
    │   ├── ImageField.tsx              Photo upload / preview / replace / remove
    │   ├── Layout.tsx                  Shell, navigation, responsive menu
    │   ├── PassbookAutoFill.tsx        Upload a passbook photo and fill the bank fields
    │   ├── PdfAutoFill.tsx             Upload a PDF and fill the form from it
    │   ├── PrintEmployeeDialog.tsx     Print preview of the employee details
    │   ├── RecordDetailsModal.tsx      Read-only employee view
    │   ├── RecordForm.tsx              Shared add/edit form
    │   ├── RecordsContext.tsx          Employee state provider
    │   ├── RecordsTable.tsx            Searchable, sortable, paginated table
    │   ├── SettingsContext.tsx         Settings state provider
    │   └── ui/                         Button, Card, Field, Modal, Toast, …
    ├── pages/
    │   ├── Dashboard.tsx
    │   ├── ImportExportPage.tsx
    │   ├── NotFound.tsx
    │   ├── RecordEditorPage.tsx
    │   ├── RecordsPage.tsx
    │   ├── ReportsPage.tsx
    │   └── SettingsPage.tsx
    ├── reports/
    │   ├── AssetCard.tsx               Layout 2: employee card
    │   ├── EmployeeDetailsSheet.tsx    Print sheet: one employee per page
    │   ├── EmployeeJoiningForm.tsx     The "New Joining Form" of the plant
    │   ├── GridCatalog.tsx             Layout 3: employee directory
    │   ├── ReportDocument.tsx          Shared report shell
    │   ├── SummarySheet.tsx            Layout 1: employee list
    │   └── types.ts
    └── styles/print.css                @media print rules
```

---

## How the application works

### Data model

One record = one employee. A record is a fixed set of core fields plus a
`custom` map that holds the employee fields (the 37 fields of the New Joining
Form by default):

```ts
interface DataRecord {
  id: string;            // internal UUID, never exported
  recordId: string;      // Employee ID, e.g. EMP-0138
  date: string;          // date of joining, YYYY-MM-DD
  title: string;         // employee name
  category: string;      // Casual / Piece Rate
  description: string;   // remarks
  quantity: number | null;      // optional, hidden by default
  unitPrice: number | null;     // optional, hidden by default
  totalAmount: number | null;   // quantity x unitPrice
  hasImage: boolean;             // a photo is attached
  custom: Record<string, FieldValue>;  // the 37 default employee fields
  createdAt: string;
  updatedAt: string;
}
```

The internal names (`DataRecord`, `recordId`, `records` table) stay generic on
purpose: the same storage layer serves a joining form today and a transfer or
exit form later, without a migration.

New fields can be added at runtime in **Settings → Custom fields**; no code change
is required. The form, table, importer, exporter and reports all read the field
definitions from the settings table.

A field definition carries a `key`, a `label`, a `type`
(`text`, `multiline`, `number`, `date`, `select`), an optional list of `options`
for select fields, an optional `section` (used to group the fields in the form,
the employee details and the employee card) and an optional `defaultValue` that
is pre-filled for new employees.

### Field templates

**Settings → Field templates** applies a ready-made set of fields taken from a
standard document, together with the categories and preferences that fit it.
Applying a template replaces the current custom fields; the values already
stored in the records are kept, but a field that is no longer defined is no
longer shown, exported or printed.

The **New Joining Form** is the default: a browser that never configured its
fields already uses the complete field list below, so nothing has to be applied
before the first employee is entered. The template stays available to restore
the list after it was changed.

| Template | Source | Contents |
| --- | --- | --- |
| **New Joining Form** | New Joining Form — PEFCO Foundry Division (Bhosari) | 37 fields in 8 sections: General, Personal Information, Emergency Contact, Bank Details, Previous Employment, Statutory Details, Covid Vaccination, Employment Details. The categories are *Casual* and *Piece Rate*, *Casual* is the default of a new employee, and the quantity and price block is hidden. |

### The fields of one employee record

By default a record carries exactly the 40 fields of the paper form. Three of
them are the built-in fields of the application, the other 37 come from the
default field list:

| # | Field | Where it comes from | Type |
| --- | --- | --- | --- |
| 1 | Employee ID | built-in | text, auto-generated (`EMP-0138`) |
| 2 | Date of Joining | built-in | date |
| 3 | Employee Name | built-in | text, required |
| 4 | Category | built-in | select (Casual, Piece Rate), *Casual* by default |
| 5 | Remarks | built-in | long text |
| 6 | Photo | built-in | image (JPEG / PNG / WebP) |
| 7 | Name of Contractor | General | select (ROHIT ENTERPRISES, KRISS ENTERPRISES) |
| 8 | Name of Unit | General | text, pre-filled `PEFCO FOUNDRY DIVISION (BHOSARI)` |
| 9 | Face ID No. | Personal Information | text |
| 10 | First Name | Personal Information | text, required, derived from the full name |
| 11 | Middle Name | Personal Information | text, derived from the full name |
| 12 | Last Name | Personal Information | text, derived from the full name |
| 13 | Father Name | Personal Information | text |
| 14 | Permanent Address | Personal Information | long text |
| 15 | Temporary Address | Personal Information | long text |
| 16 | Date of Birth | Personal Information | date |
| 17 | Gender | Personal Information | select |
| 18 | Marital Status | Personal Information | select |
| 19 | Blood Group | Personal Information | select |
| 20 | Aadhar Card Number | Personal Information | text |
| 21 | Pan Card Number | Personal Information | text |
| 22 | Education | Personal Information | text |
| 23 | Self Contact no. | Personal Information | text |
| 24 | Emergency Contact Name | Emergency Contact | text |
| 25 | Emergency Contact Mob. No. | Emergency Contact | text |
| 26 | Bank Name | Bank Details | text |
| 27 | Bank Account No. | Bank Details | text |
| 28 | Bank IFSC Code | Bank Details | text |
| 29 | Bank Branch Name | Bank Details | text |
| 30 | Previous Company Name | Previous Employment | text |
| 31 | Total Year of Experience | Previous Employment | number |
| 32 | PF No. | Statutory Details | text |
| 33 | ESIC No. | Statutory Details | text, the printed *Insurance On* is read as this number |
| 34 | UAN No. | Statutory Details | text |
| 35 | Covid 1st Dose Date | Covid Vaccination | date |
| 36 | Covid 2nd Dose Date | Covid Vaccination | date |
| 37 | Covid Vaccine Name | Covid Vaccination | select |
| 38 | Grade | Employment Details | text |
| 39 | Designation | Employment Details | text |
| 40 | Division Name | Employment Details | text |
| 41 | Department Name | Employment Details | text |
| 42 | Sub Dept. Name | Employment Details | text |
| 43 | Section Name | Employment Details | text |

The form shows the sections in that order, the employee details dialog and the
employee card report list every field under the same section heading, and the
Excel/CSV export writes one column per field.

The paper form's **Photo** box is the built-in photo field and the **Category**
of the employment block is the built-in category field, so both are not
repeated as custom fields. The "Name of Unit" is pre-filled with
`PEFCO FOUNDRY DIVISION (BHOSARI)` and the "Name of Contractor" is a drop-down
with the two contractors of the plant.

The category and the contractor are two independent fields: changing the
category does not change the contractor and changing the contractor does not
change the category. Both are chosen by the user, and a record keeps the
values it was saved with — also when it comes from a spreadsheet or a PDF.

The paper form prints the **Insurance On** number instead of the ESIC number,
so the field is read under both names: a PDF or a spreadsheet that carries
*Insurance On* fills the *ESIC No.* field.

The quantity, unit price and total amount block can be switched off at any time
in **Settings → Application**; the employee table, the employee details, the
dashboard and all three report layouts follow that setting.

### Storage

Three Dexie tables in IndexedDB:

- `records` — the employee records, indexed by `recordId`, `date`, `title` and `category`.
- `images` — one compressed `Blob` (photo) per record, keyed by the record's UUID.
- `settings` — categories, custom field definitions and application preferences.

Record and photo writes happen inside a single Dexie transaction, so a record is
never saved without its photo (or the other way round).

### Import workflow

1. The file is parsed in the browser with SheetJS — nothing is uploaded.
2. The first sheet and its header row are detected; you can pick another sheet
   and re-map the columns to application fields.
3. Every row is validated with the same Zod schema the form uses.
4. The preview shows how many rows will be created, updated, rejected, duplicated
   or skipped, and the rejected rows can be downloaded as a CSV error report.
5. You choose a strategy:
   - **Add new employees only** — existing Employee IDs are skipped, never overwritten.
   - **Update existing employees only** — rows without a matching Employee ID are skipped.
   - **Merge new and existing employees** — matching employees are updated, the rest are
     created. An imported cell only overwrites a stored value when the cell is not
     empty, and existing photo attachments are preserved.
6. After confirming, the plan is applied inside one transaction.

Importing a spreadsheet **updates the local browser database**; it does not create
a live connection between the file and the application. Re-importing the same file
after further edits re-applies the file's contents.

### Auto-fill from a PDF

The card **Auto-fill from a PDF** at the top of the add/edit form reads a
filled joining form and writes the values into the form. It is a helper, not a
shortcut: the values are shown in a table first, can be corrected and can be
sent to another field, and only what the user confirms is written into the form
— which is then saved like any other record.

**How the values are found**

1. The PDF is opened with PDF.js in the browser — the file is never uploaded.
2. The text of the page is read with its position and grouped into lines.
3. The label of every field of the form is looked up in that text. Three
   layouts are understood:
   - `First Name: Rahul` — the value follows a colon,
   - `First Name        Rahul` — the value stands next to the label,
   - `First Name` with `Rahul` in the line below — the value stands below the
     label, the way a table of the paper form is printed.
4. The value is converted to the type of the field: a date is read day first
   (`12/05/1994` → `1994-05-12`), a number is read as a number and a drop-down
   value is matched against its options. The formats `01/06/2024`, `1-6-2024`,
   `2024-06-01`, `1st June 2024` and `June 1, 2024` are all understood.
5. The name is read as a whole: the printed **Name of IP** (or *Name of I.P.*)
   fills the *Employee Name* field, and the parts of the name are taken from the
   number of words — one word is the first name, two words are the first and the
   last name, three words are the first, the middle and the last name and every
   further word belongs to the last name. A form that prints the first, middle
   and last name itself always wins.
6. Every value is shown with the label it was found under, the page and the
   field it will be written into. Values that could not be read reliably are
   marked and are **not** written into the form.

**The standard format**

The reference document of the application is the **e-Pehchan card of the
Employees' State Insurance Corporation (ESIC)** — the card an insured person
receives from the employer. Its structure is stored in the application
(`src/lib/pdfFormat.ts`) and every PDF that follows it is read the same way:

| Block of the card | Label of the card | Written into |
| --- | --- | --- |
| *Personal Details* | Name of IP | Employee Name + First / Middle / Last Name |
| *Personal Details* | Insurance No. | ESIC No. |
| *Personal Details* | Date of Birth | Date of Birth |
| *Personal Details* | Gender | Gender |
| *Personal Details* | UAN | UAN No. |
| *Personal Details* | Mobile Number | Self Contact no. |
| *Registration Details* | Marital Status | Marital Status (*Unmarried* → *Single*) |
| *Registration Details* | Present Address | Temporary Address |
| *Registration Details* | Permanent Address | Permanent Address |
| *Current Employer Details* | Name of Employer | Name of Contractor |
| *Current Employer Details* | Date of Appointment | Date of Joining |
| *Family Details* / *Nominee Details* | the tables of the card | *not read* — the form has no field for them |

The card is printed in two columns and prints long labels over two lines
(*Date of* / *Appointment*); both are read. A word that is split over two lines
is joined back together, and the two addresses that stand next to each other
do not mix. The name of the standard format is shown under the file name once
the document was recognised.

**The blocks of the form**
Some labels exist more than once on the form and mean something different every
time. The engine reads the blocks of the form and decides per block:

| Block of the PDF | Label | Written into |
| --- | --- | --- |
| *Current Employer Details* | Date of Appointment | Date of Joining |
| *Previous Employer Details* | Date of Appointment | *not read* — it is about the previous employer |
| *Current Employer Details* | Name of Contractor | Name of Contractor |
| *Previous Employer Details* | Name of Contractor | Previous Company Name |

A block is recognised by its heading — the line that is printed in a bigger
font than the body of the form. A form without any heading is read as if every
label stood in the block it belongs to.

**The address**

An address is printed over several lines and ends with the PIN code. The
engine reads the lines of the address until the line that carries the six digit
PIN code — the value of the field is exactly that text, line breaks included.
A line that starts a new field or a new block ends the address as well, and an
address without a PIN code is marked with a hint, because a line is then
probably missing.

**Scanned forms**

A scan or a photo of the form has no selectable text. The application detects
this and offers to read the page with OCR (Tesseract). The OCR engine is part
of the application, so the whole application works without an internet
connection.

**Limits**

- The photo of the form is not extracted — attach it separately.
- A value is only found when the printed label matches the label of the field.
  Alternative names are defined for every field of the New Joining Form
  (`Contact no.` for *Self Contact no.*, `DOB` for *Date of Birth*, *Insurance
  On* for *ESIC No.*, *Name of IP* for *Employee Name*, *Date of Appointment*
  for *Date of Joining*, *UAN* for *UAN No.*, …).
- A value of a drop-down field is only written when it is one of the allowed
  values, for example *ROHIT ENTERPRISES* or *KRISS ENTERPRISES* for the
  contractor.
- Handwritten forms cannot be read; they have to be typed in.

### Auto-fill from a bank passbook

The card **Auto-fill from a bank passbook** at the top of the add/edit form reads
the bank details out of a photo of a passbook and writes them into the bank
fields of the form. Like the PDF card it is a helper, not a shortcut: the
values are shown in a table first, can be corrected, and only what the user
confirms is written into the form.

**How the values are found**

1. The photo is picked in the browser — JPEG, PNG or WebP. It is never
   uploaded anywhere.
2. The photo is shrunk to at most 1800 pixels on its longest side, so the text
   of the page stays sharp enough to be read.
3. The text is read with OCR (Tesseract). The engine and the English language
   data are part of the application, so the reading works without an internet
   connection.
4. The bank details are picked out of that text (`src/lib/passbook.ts`):

   | Detail of the passbook | Written into |
   | --- | --- |
   | `Account No.`, `A/c No.`, `Account Number` | Bank Account No. |
   | `IFSC Code`, `IFSC` | Bank IFSC Code |
   | the name in the head of the passbook, `Bank Name` | Bank Name |
   | `Branch Name`, `Branch` | Bank Branch Name |

   The OCR often splits a long account number into groups (`5010 0234 5678 90`)
   and puts a space into an IFSC code (`HDFC 0001234`) — both are joined back
   together. A label whose value stands in the line below it is read as well,
   and a label that stands alone does not steal the value of the next label.
5. Every value is shown with the text it was read from. An account number that
   does not have 9 to 18 digits is marked and has to be checked. The name of the
   account holder is shown too — the form has no field for it.

The photo itself is not stored, only the values that the user confirmed.

**Limits**

- The passbook is read with OCR, so the photo has to be sharp, straight and
  well lit. A photo of a screen is read worse than a photo of paper.
- The account holder name is not written into the form — there is no field for
  it.
- Handwritten passbooks cannot be read; the values have to be typed in.

### Print and PDF

The **Print report** button calls `window.print()`. This opens the browser's own
print dialog — the application does not create or download a PDF file itself. In
that dialog choose a printer, or pick **Save as PDF** as the destination.

The report preview on screen is the printed document: the page size and orientation
are applied through a runtime `@page` rule, navigation and controls are hidden via
`no-print`, table headers repeat on every page and employee cards are never split
across a page break.

The **Employees** tab prints a single employee: the print button of a row (or the
**Print details** button of the employee view) opens a preview of the
**New Joining Form** — the paper form of PEFCO Foundry Division (Bhosari) with
the values of the employee. The grid of the form, the row numbers (1 … 27) and
the position of the photo are the ones of the paper form; the Employee ID and
the time of the print are written below the title. Several employees can be
printed together by selecting the rows in the table and using **Print N
selected** — one employee per page. The preview waits for the photos to be
loaded, so the printed sheet never misses a picture.

### Backup and restore

**Import / Export → Download full backup** writes a single JSON archive that
contains the employee records, the settings *and* the photos (base64 encoded
inside the archive — the only place where an image blob is turned into a string).
The same page restores such an archive and replaces the current content of the
database in a single transaction.

The Excel export is a second, more portable backup: it contains the employee
records and the template fields, but **not** the photo attachments.

---

## Deployment

The build output is a plain static bundle in `dist/`. No server-side API routes,
no rewrite rules and no environment variables are required at runtime — the
[cloud reader](#cloud-reader) is optional and adds one small function.

The only build-time setting is `BASE_PATH`:

| Where the app is published | `BASE_PATH` |
| --- | --- |
| Root domain (`https://example.com/`) | `/` (default) |
| GitHub Pages project site (`https://user.github.io/repo/`) | `/repo/` |

Set it in a `.env.production` file (copy `.env.example`), or as a shell variable
before the build:

```bash
# Unix / macOS
BASE_PATH=/my-repo/ npm run build

# Windows PowerShell
$env:BASE_PATH = "/my-repo/"; npm run build
```

### GitHub Pages

The repository already contains `.github/workflows/deploy-pages.yml`, which builds
the project and publishes `dist/` to GitHub Pages.

1. Push the project to a GitHub repository (the default branch must be `main`).
2. Open **Settings → Pages** in the repository and set **Source** to
   **GitHub Actions**.
3. The workflow sets `BASE_PATH` automatically:
   `/<repository-name>/` for a project site, `/` for a `<user>.github.io` repository.
4. Open the **Actions** tab and run the *Deploy to GitHub Pages* workflow
   (it also runs on every push to `main`).
5. When the workflow finishes, the site is available at
   `https://<user>.github.io/<repository>/`.

If you build manually instead of using the workflow, remember the sub-path:

```bash
BASE_PATH=/<repository>/ npm run build
```

Notes:

- `public/.nojekyll` is included so GitHub Pages serves the built files verbatim
  instead of running them through Jekyll.
- The router uses **hash URLs** (`/#/records`). Every view is therefore a single
  static file, and no SPA fallback rewrite is needed. If you later switch to the
  history API, add a `404.html` that redirects to `index.html`.

### Vercel

`vercel.json` is included.

1. Import the repository at [vercel.com/new](https://vercel.com/new).
2. Framework preset: **Vite** — build command `npm run build`, output directory `dist`.
3. Deploy. `BASE_PATH` stays `/` for a custom domain or a Vercel subdomain.

### Netlify

`netlify.toml` is included.

1. Import the repository at [app.netlify.com](https://app.netlify.com).
2. Build command `npm run build`, publish directory `dist`.
3. Deploy. `BASE_PATH` stays `/`.

### Render

Render has no serverless functions, so the application is deployed as one
small **web service**: `server/render.ts` serves the built application out of
`dist` and answers the request of the cloud reader at `/api/ocr`.

`render.yaml` describes the service, so the deployment is one click:
[render.com/deploy](https://render.com/deploy) — it asks for the API key
while the blueprint is deployed. Or set the service up by hand:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check path | `/` |
| Environment | `GEMINI_API_KEY` (server), `GEMINI_MODEL` (optional) |

Set `GEMINI_API_KEY` as a secret environment variable in the Render service
settings (or enter it in Render's private blueprint prompt). Do not put the key
in `render.yaml`, `.env.example`, or any file committed to Git. If a key has
been pasted into a source file or shared chat, revoke it and create a new one
in Google AI Studio before deploying.
Set `GEMINI_MODEL` to `gemini-3.5-flash-lite` in the Render Environment settings
for an existing deployment that still has the older model configured, then
redeploy. Changes to `render.yaml` only affect the live service after its
blueprint configuration is applied.

The service listens on the port of the `PORT` variable, which Render sets, and
serves the application under the root of the address, so `BASE_PATH` stays
`/`.

Two things to know about the free plan:

- A free web service **sleeps** after a period without a request, so the first
  request after a pause takes a few seconds longer. Only the cloud reader is
  affected — the application and the OCR of a passbook are in the browser.
- The service is limited in the number of hours it runs per month. When the
  application is busy, the `starter` plan is the better choice.

When the application is published somewhere else and only the cloud reader
runs on Render, put the address of that application into
`OCR_ALLOWED_ORIGINS` (a comma separated list) and point the application at
the service with `VITE_OCR_PROXY_URL`.

### Any other static host

Upload the contents of `dist/` to the web root. For a sub-path installation set
`BASE_PATH` before building.

---

## The OCR engine

The application reads a photo of a passbook and a scanned PDF with
[Tesseract](https://tesseract.projectnaptha.com/), compiled to WebAssembly.

By default Tesseract downloads its worker, its WebAssembly core and the
English language data from a CDN the first time a photo is read. On a network
that cannot reach that CDN — a factory network, a locked down server, a
visitor without roaming — the OCR simply never starts.

**The engine is therefore served by the application itself.** The files are
copied out of the installed packages into `public/tesseract` before the build
and before the development server:

| File | From | Size |
| --- | --- | --- |
| `worker.min.js` | `tesseract.js` | 109 KB |
| `core/tesseract-core-relaxedsimd-lstm.wasm.js` | `tesseract.js-core` | 3.8 MB |
| `core/tesseract-core-simd-lstm.wasm.js` | `tesseract.js-core` | 3.8 MB |
| `core/tesseract-core-lstm.wasm.js` | `tesseract.js-core` | 3.8 MB |
| `lang/eng.traineddata.gz` | `@tesseract.js-data/eng` | 2.8 MB |

The three cores are the same engine for three levels of hardware support
(relaxed SIMD, SIMD, plain) — the browser picks the one it can run. The
folder is generated and therefore not in the repository; it is rebuilt by
`npm run predev` and `npm run prebuild`, which run automatically.

`src/lib/tesseract.ts` points Tesseract at these files. If they are missing,
the engine falls back to the CDN, so the application still works on a network
with an internet connection.

The result: **the whole application works without an internet connection** —
the data entry, the photos, the Excel import and export, the reports and the
OCR of a passbook or a scan.

---

## Cloud reader

The photo of a bank passbook is read in the browser with Tesseract. That read
is fast and free, but it often misreads a long number — a misread account
number or IFSC code is the main reason a passbook has to be typed by hand.

The **cloud reader** is an optional serverless function that sends the photo
to the Gemini API and gets the bank details back as JSON. It uses Gemini
Flash-Lite for low-latency multimodal extraction and asks for only the needed
values plus short evidence, rather than a full-page transcription.

### How it is used

- The photo is read in the browser first. Nothing is sent.
- Only when that read did not deliver a usable account number *and* IFSC code,
  the photo is sent to the cloud reader.
- The user can always ask for the cloud reader by hand ("Read again with the
  cloud reader").
- Every value is shown and can be corrected before it is written into the
  form, and the table says which reader found a value.

### The limit of cloud reads

Cloud reads are counted in the browser (IndexedDB), **10 per day and 25 per
month**, and the day rolls over at midnight Pacific time — the same moment
the daily limit of the model does. The counter is per device and per browser
profile.

| | Per call | 25 calls |
| --- | --- | --- |
See [current Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
and Google's [data-use terms](https://ai.google.dev/gemini-api/terms) for the
selected model and your account tier.

### Setting it up

1. Create an API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Set it as a **server** variable of the deployment — `GEMINI_API_KEY`. The
   name must not start with `VITE_`, otherwise the key would end up in the
   browser bundle.
3. Optionally set `GEMINI_MODEL` (default `gemini-3.5-flash-lite`). See
   [Gemini model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).
4. Deploy the function:

| Host | The function | The address |
| --- | --- | --- |
| Vercel | `api/ocr.ts` | `/api/ocr` |
| Netlify | `netlify/functions/ocr.ts` | `/api/ocr` (redirected by `netlify.toml`) |
| Render | `server/render.ts` (a web service) | `/api/ocr` |
| GitHub Pages | — | not available, the local reader is used |

5. When the function runs on another address, set the client variable
   `VITE_OCR_PROXY_URL` to that address.

Without a key the function answers with an error, the application says so and
keeps the values of the local reader. Nothing breaks.

---

## Testing checklist

Use this list to verify a deployment (or a local build).

**Employees**

- [ ] Create an employee with a name, joining date and category.
- [ ] The Employee ID is the next number of the sequence (`EMP-0138`) and can be changed.
- [ ] Submitting an empty name shows a validation message next to the field and
      does not save the employee.
- [ ] An invalid joining date is rejected.
- [ ] Editing an employee pre-fills the form and keeps the same Employee ID.
- [ ] Deleting an employee asks for confirmation and removes the row.
- [ ] Reload the page: the employee is still there (persistence).

**Field templates and sections**

- [ ] A fresh browser shows the sections of the paper form in the data entry
      form, without applying a template first.
- [ ] A new employee starts with the category *Casual*; the contractor is
      chosen by the user — changing the category does not change the
      contractor and changing the contractor does not change the category.
- [ ] Settings → Field templates → *New Joining Form* → *Apply template* →
      *Save settings*: the data entry form shows the sections of the paper form.
- [ ] "Name of Unit" is pre-filled with `PEFCO FOUNDRY DIVISION (BHOSARI)`.
- [ ] The addresses are long text inputs, the gender / blood group / marital
      status / vaccine name are drop-downs.
- [ ] The quantity and price block is gone from the form, the table, the
      dashboard and the reports.
- [ ] A value entered in a section is shown in the employee details and in the
      employee card report under the same section heading.
- [ ] The Excel export has one column per field of the list.

**Auto-fill from PDF**

- [ ] Upload a filled joining form: the values are listed with the label, the
      page and the field they belong to.
- [ ] Press *Fill the form*: the form is filled and the values can still be
      changed before the record is saved.
- [ ] A date printed as `12/05/1994` is written as `12.05.1994` in the date field.
- [ ] Correct a value in the list: the corrected value is written into the form.
- [ ] Send a value to another field: it is written into that field.
- [ ] Untick a value: it is not written into the form.
- [ ] Upload a scan without any text: the OCR option is offered and reads the page.
- [ ] Upload a file that is not a PDF: a clear error message is shown.
- [ ] A PDF that prints *Insurance On* fills the *ESIC No.* field.
- [ ] A PDF that prints *Date of Appointment* fills the *Date of Joining* field.
- [ ] A PDF that prints the *Date of Appointment* of the previous employer does
      not fill the joining date, the one of the current employer does.
- [ ] An address that is printed over several lines is filled as one text and
      ends with the line of the PIN code.
- [ ] An e-Pehchan card of the ESIC is recognised: the name, the insurance
      number, the date of birth, the gender, the UAN, the mobile number, the
      marital status, both addresses, the contractor and the date of joining
      are found.
- [ ] A PDF that prints *Name of IP* fills the *Employee Name* field and the
      first, middle and last name are derived from the number of words.
- [ ] The contractor is a drop-down with the two contractors of the plant.

**Auto-fill from a bank passbook**

- [ ] Upload a photo of a passbook: the account number, the IFSC code, the bank
      and the branch are listed with the text they were read from.
- [ ] Press *Fill the form*: the bank fields of the form are filled and the
      values can still be changed before the record is saved.
- [ ] An account number that the OCR split into groups (`5010 0234 5678 90`) is
      written as one number.
- [ ] An account number that does not have 9 to 18 digits is marked with a
      warning.
- [ ] The name of the account holder is shown, but not written into the form.
- [ ] Untick a value: it is not written into the form.
- [ ] The photo of the passbook is not stored with the employee.
- [ ] When a cloud reader is deployed, a photo that the local reader cannot
      make sense of is read again by the cloud reader and the table shows
      "cloud" in the column *Read by*.
- [ ] The line under the table shows how many cloud reads are left today and
      this month.
- [ ] Without a cloud reader the application still works and the photo is
      never sent anywhere.

**The web service of Render**

- [ ] `npm run build` builds `dist-server/render.js` and `npm start` serves
      the application.
- [ ] `GET /` answers with the application, `GET /tesseract/worker.min.js`
      answers with the OCR engine.
- [ ] `POST /api/ocr` answers with the bank details, or with an error when
      the key is missing.

**Photos**

- [ ] Upload a JPEG, a PNG and a WebP — all are accepted and previewed.
- [ ] Upload a GIF or a text file — it is rejected with a clear message.
- [ ] Upload a photo larger than 8 MB — it is rejected.
- [ ] The stored photo is resized to exactly 350 × 450 px and cropped to fill the frame.
- [ ] The photo is visible in the employee details and in the report preview.
- [ ] Replacing and deleting the photo works.

**Table**

- [ ] Search by Employee ID, name and remarks.
- [ ] Filter by category and by joining date range; the filtered-result count updates.
- [ ] Sort by joining date, name, category and the numeric columns.
- [ ] Pagination works and the page size can be changed.
- [ ] Select all rows of the current page, then delete them after confirming.

**Print employee details**

- [ ] The print button of a row opens the joining form of that employee.
- [ ] The form has the same grid, the same row numbers and the same photo box
      as the paper form; the values of the employee are written into the cells.
- [ ] The employee view has a **Print details** button that opens the same form.
- [ ] Select several employees and use **Print N selected**: one employee per page.
- [ ] Print: only the form is printed — the table, the filters and the buttons are hidden.
- [ ] The photo is on the printed page (the print waits for the picture to be loaded).

**Import / export**

- [ ] Export the filtered dataset and the full dataset to `.xlsx` and to `.csv`.
- [ ] Open the exported file: dates are real dates, numbers are numbers, the
      column order is stable and the internal `id` is not included.
- [ ] Import a valid `.xlsx`: the mapping preview appears, the row counts are
      correct and the employees are created after confirming.
- [ ] Import a file with an invalid row: the row is rejected, the reason is shown
      and the error report can be downloaded.
- [ ] Import a file that contains an existing Employee ID with the strategy
      *Add new employees only*: the employee is skipped, not overwritten.
- [ ] Import the same file with the strategy *Merge*: the employee is updated and
      its photo attachment is preserved.
- [ ] Import a file with the same Employee ID twice: the duplicate is reported.

**Reports**

- [ ] Generate the Employee list, the Employee card and the Employee directory layouts.
- [ ] All three layouts show the same employees.
- [ ] Change an employee: the next preview reflects the change immediately.
- [ ] Switch between A4 and Letter, and between portrait and landscape.
- [ ] Print: navigation, filters and buttons are hidden, headers repeat on the
      second page and no card is cut in half.
- [ ] Choose **Save as PDF** in the print dialog and check the result.

**Responsive layout**

- [ ] The navigation collapses into a menu on small screens.
- [ ] The table, the form and the report preview are usable at 375 px width.
- [ ] The layout is usable on a tablet and a desktop width.

**Deployment**

- [ ] The production build loads from the deployed URL.
- [ ] A hard refresh on a deep link (`/#/settings`) still works.
- [ ] The Employees, Import/Export, Reports and Settings views are reachable.

---

## Browser limitations

- **Page breaks and repeated table headers** are implemented with
  `page-break-inside` / `break-inside` and `display: table-header-group`.
  Chrome, Edge and Safari honour them; Firefox repeats `<thead>` but handles
  `break-inside` slightly differently, so a table row may occasionally be
  placed at the top of a page.
- **Background colours** are printed only when the browser is asked to print
  backgrounds. The stylesheet sets `print-color-adjust: exact`, but the user
  still has to enable "Background graphics" in the print dialog for the fills to
  appear. All text and borders stay readable in greyscale without it.
- **Photos** are printed at the size they occupy in the preview; very large
  photos are scaled down to their container. Browsers never print images that
  were never loaded, so a report must be opened once before printing.
- **`window.print()`** opens the browser's print dialog. It does not create a
  PDF file; "Save as PDF" is a destination of that dialog.
- **Private / incognito windows** and the clearing of site data remove the
  IndexedDB contents. Always keep a backup.
- **Firefox** applies a strict `DOMException` quota error when the storage quota
  is exceeded; the application shows the error and keeps the unsaved form, but
  the employee record is not stored.

---

## Security and privacy

- The sign-in screen is a **demo-only client-side gate**. Its credentials are
  fetched from the public `public/userauth.txt` file and are visible to anyone
  who can access the deployed app; a browser-only gate can also be bypassed.
  The sample login is `demo-user` with password `DemoOnly!2026`. Never put real
  credentials in this file or rely on this feature to protect employee records.
- A successful sign-in is remembered in this tab's `sessionStorage`, so
  refreshing the page does not sign the user out. Signing out clears the saved
  state; closing the tab normally ends the session.
- Real authentication requires server-side identity verification and access
  controls. This static/browser-based app does not provide those protections.
- Employee data and photos are stored **only in the browser** (IndexedDB) of the
  device and browser profile that created them. They are **not** synchronised
  between devices, browsers or profiles, and they are not backed up automatically.
- Imported spreadsheets and uploaded photos are processed locally; nothing is
  uploaded to a server.
- The only exception is the optional [cloud reader](#cloud-reader): when it is
  deployed, the photo of a bank passbook is sent to it, and from there to the
  Gemini API, where it is **not stored** (`store=false`). It is only sent when
  the local read was not good enough, at most 10 times a day and 25 times a
  month, and the user sees which reader found a value. A passbook photo
  contains an account number — treat the cloud reader as a transfer of
  personal data to a third party.
- There is **no analytics and no third-party tracking** in the application, and
  it makes no network requests after the page has loaded — apart from the
  optional cloud reader. The OCR engine is part of the application.
- Browser storage is **not encrypted at the application level**. Anyone with
  access to the device and the browser profile can read the stored data. Do not
  use the application as a secure repository for highly sensitive information
  such as Aadhaar, PAN or bank details.
- Imported files are validated (file type, size, schema) and user supplied text
  is rendered as text, never as HTML.
- Use the Excel/CSV export and the full backup archive to keep copies of the data
  outside the browser.

---

## Troubleshooting

**`npm install` fails with an ERESOLVE / peer dependency error**

```bash
npm install --legacy-peer-deps
```

**`Cannot find module './index.css'` or missing type definitions**

Make sure `src/vite-env.d.ts` exists and contains:

```ts
/// <reference types="vite/client" />
```

**`tsc -b` reports errors in `tsconfig.app.tsbuildinfo`**

Delete the stale build info files and rebuild:

```bash
rm tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo   # Windows: del / q
npm run build
```

**`Failed to resolve import "@/..."`**

The `@` alias is defined in `vite.config.ts` and in `tsconfig.app.json`
(`"baseUrl": "."`, `"paths": { "@/*": ["src/*"] }`). Make sure both files are
present and that the dev server was restarted after a change.

**The application is blank after deploying to a sub-path**

The build was made without the correct base path. Rebuild with
`BASE_PATH=/<sub-path>/` and deploy `dist/` again.

**The import does not find any rows**

The first row of the sheet must contain the column headers. If the file has a
title row above the headers, remove it or adjust the mapping in the import
preview.

**Nothing is stored / data disappears**

Check that the browser is not in a private window and that site data is not
being cleared automatically. Private windows discard the IndexedDB contents when
they are closed.

---

## License

Provided as-is for internal use.
