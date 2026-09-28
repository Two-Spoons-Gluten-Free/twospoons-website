# Google Apps Script Form Setup

The static GitHub Pages site sends newsletter, contact, and order requests to a Google Apps Script web app. That script stores them in separate tabs of one private Google Sheet.

## 1. Create the spreadsheet

1. Create a Google Sheet for Two Spoons submissions.
2. In the Sheet, choose **Extensions → Apps Script**.
3. Replace the default file contents with [`scripts/google-apps-script/Code.gs`](../scripts/google-apps-script/Code.gs).
4. Save the project.

The script creates these tabs and their headers the first time it receives each submission:

- `Newsletter`
- `Messages`
- `Order Requests`

## 2. Deploy the web app

1. In Apps Script, select **Deploy → New deployment**.
2. Select **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone**.
5. Deploy, authorize the project, and copy the URL ending in `/exec`.

The endpoint must be publicly reachable because a visitor's browser sends the form directly to it. The Sheet itself remains private to its owners and editors.

## 3. Add the endpoint to GitHub

1. Open the repository on GitHub.
2. Go to **Settings → Secrets and variables → Actions → Variables**.
3. Create a repository variable named `PUBLIC_FORMS_ENDPOINT`.
4. Paste the Apps Script `/exec` URL as its value.
5. Re-run the **Deploy to GitHub Pages** workflow, or push a new commit to `main`.

The endpoint URL is a public configuration value, not a credential. Do not add Google account keys or private Sheet credentials to GitHub.

## How Submission Delivery Works

Apps Script web apps do not provide browser-readable CORS responses for this use case. The website uses a CORS-safe `no-cors` request, validates fields in the browser, and then confirms that the request has been sent. The script independently validates submitted data before writing it to the Sheet.

Because the browser cannot read a success response from Apps Script, it cannot prove the final spreadsheet write succeeded. Review the Sheet periodically and consider adding Apps Script email notifications or a more capable backend if you need delivery acknowledgements, spam scoring, or a customer-visible reference number.