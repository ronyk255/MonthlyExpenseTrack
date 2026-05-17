# Monthly Expense Tracker

A local-first salary month expense tracker. The app uses salary cycles from the 25th of each month, tracks standard debit orders, manual salary-account expenses, manual credit-card expenses, extra income, credit-card payoff, and the last 3 salary months.

## Run

Open `index.html` in a browser, or serve the folder with:

```text
python -m http.server 8891
```

Then open:

```text
http://127.0.0.1:8891/
```

## Phone Install

When hosted online, this works as a PWA. On Android Chrome, open the site menu and choose **Add to Home screen** or **Install app**.

## Data

Data is saved in the browser with `localStorage`. The app keeps records for the current salary month and the previous 2 salary months. Older manual records are deleted automatically on save.

