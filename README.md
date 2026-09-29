# Adoption Dashboard

A browser-based analytics tool for Cisco partners to track and optimize **CPI Adopt** rebate performance by analyzing software adoption data from Workspan.

> ⚠️ This tool is independently developed and is **not an official Cisco product**. Provided "as is" without warranty. Partners are responsible for verifying all data and results.

---

## What It Does

The Adoption Dashboard helps Cisco partners:

- Identify **eligible use cases** for CPI Adopt rebates
- Track **opt-in status** and incentive performance across deals
- Analyze **earned, potential, and missed incentives** by portfolio
- Monitor **monthly adoption trends** and lifecycle progression
- Calculate **Partner Value Index (PVI)** Engagement scores

---

## Features

| Tab | Description |
|-----|-------------|
| **Overview** | Summary pivot by Portfolio → Offer → Use Case |
| **Details** | Row-level deal view with inline definitions. Total Missed groups deals by CR Party ID and offer: when any deal earned incentives, it sums missed incentives only from deals that earned; otherwise it counts the highest missed amount in the group. |
| **PVI** | Partner Value Index Engagement score calculator |
| **Insights** | Analytics hub with four sub-tabs: |
| &nbsp;&nbsp;↳ **CPI Adopt** | Incentive performance charts — earned, potential, missed, and not opted-in by portfolio, with fiscal-year filtering |
| &nbsp;&nbsp;↳ **Customer Analysis** | Pareto-style breakdown of customers by incentive opportunity |
| &nbsp;&nbsp;↳ **UC Health** | Drill-down stage distribution (Portfolio → Offer → Use Case) with donut chart, KPIs, and pending task analysis |
| &nbsp;&nbsp;↳ **Lifecycle** | Offer lifecycle progression charts (last 18 months) |

---

## Accessing the App via GitHub Pages

The easiest way to use the Adoption Dashboard is directly through its GitHub Pages URL:

**[marckhayat.github.io/AdoptDash](https://marckhayat.github.io/AdoptDash/)**

No installation, no download — just open the link and you're always on the latest version.

### How your data is handled

When you load a Workspan export into the dashboard, **all data processing happens entirely within your browser**. The file you upload is read directly into your browser's memory using standard browser APIs (the JavaScript `FileReader` and `SheetJS` library). It is never uploaded, transmitted, or sent anywhere — not to GitHub, not to any third-party service, and not to Cisco.

GitHub Pages is a **static file host**: it serves the HTML, CSS, and JavaScript files that make up the app, in the same way a web server would deliver a webpage. Once those files are loaded in your browser, GitHub's involvement ends entirely. GitHub has no access to anything that happens inside the app after that point — including any data you load.

The only outbound network call the app makes is a lightweight version check against the GitHub Releases API (to notify you when an update is available). This call contains **no user data, no file contents, and no identifiable information**.

> In short: GitHub hosts the app, not your data. Your Workspan data never leaves your machine.

> **Note:** When accessing the app via GitHub Pages, the **Load via API** option is unavailable. The API feature requires a local proxy running on your machine, which is only possible when running the app locally. See [Getting Started](#getting-started) for download options.

---

## Getting Started

1. **Open the app** at [marckhayat.github.io/AdoptDash](https://marckhayat.github.io/AdoptDash/) — always the latest version, no install needed
2. **Or download** the latest release from the [Releases](https://github.com/marckhayat/AdoptDash/releases/latest) page and open `index.html` locally
3. **Load your CPI data file** — a Workspan export (report 19849 for Partners, 21766 for Distributors)
4. Explore your data across the dashboard tabs

> The app runs entirely in your browser. No data is sent to any server.

---

## Data Source

The dashboard loads data from a **Workspan export** (report 19849 for Partners, 21766 for Distributors). Data can be loaded by:

- **File upload** — drag and drop or browse for a CSV/Excel Workspan export
- **API** — connect directly to Workspan APIs to pull data without manual exports

---

## Requirements

- A modern browser (Chrome recommended for the best experience)
- The app loads several libraries from CDN (Bootstrap, Chart.js, SheetJS, xlsx-js-style, PapaParse). Without internet, the app will not load.

---

## Releases & Updates

The app automatically checks for new versions on load and notifies you if an update is available. This check only queries the public GitHub Releases API to compare version numbers — no usage data, user information, or IP addresses are ever collected or transmitted.

All releases are available on the [Releases](https://github.com/marckhayat/AdoptDash/releases) page, each with a downloadable ZIP of the full app.

---

## Disclaimer

This tool is independently developed by a Cisco employee and is **not an official Cisco product**. It is not supported by Cisco TAC. Use it at your own discretion and always verify results against official Workspan data.

---

## Community & Support

- 💬 **Community page:** [cs.co/AdoptDash](https://cs.co/AdoptDash)
- 📝 **Feedback & Support:** [cs.co/PartnerCSS](http://cs.co/PartnerCSS)
