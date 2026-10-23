# Browser push and monthly MAO reports

## Browser push

Browser push is opt-in per signed-in browser. The Notifications page registers
`frontend/public/sw.js` and stores the browser subscription against the current
user. Push alerts mirror saved in-app notifications; push delivery failures do
not undo a livestock record or its in-app notification.

Set these backend environment variables before enabling push:

```text
WEB_PUSH_VAPID_PUBLIC_KEY=<VAPID public key>
WEB_PUSH_VAPID_PRIVATE_KEY=<VAPID private key>
WEB_PUSH_VAPID_SUBJECT=mailto:<monitored contact email>
```

Keep the private key secret. Browsers require HTTPS in deployment (localhost is
allowed for development). Apply the users migration before enabling the UI.
Push provider availability and delivery still need to be verified in the target
deployment.

## Monthly MAO summary

The management command `python manage.py send_monthly_report` builds a single
workbook for the previous calendar month. It uses the same authorized report
service as manual reports and includes approved-record summaries for inventory,
production, disease and mortality, slaughter, movement, and inspection. By
default it emails active, approved MAO accounts with an email address. Set
`AUTOMATED_REPORT_RECIPIENTS` to a comma-separated recipient list when the
municipality uses a dedicated distribution address.

Configure the deployment scheduler to run this command on the first day of each
month, after migrations have been applied. For example, run it at 01:00 in the
`Asia/Manila` timezone. The command records a delivery row per report month and
skips a month already marked sent. Configure the deployment's SMTP variables
and `DEFAULT_FROM_EMAIL`; a successful local console email is not proof of
external delivery.

The report command is scheduler-invokable; a scheduler entry must still be
configured in the chosen deployment environment.

## Mortality weather context

Predictive Analytics already forecasts monthly approved death counts and shows
an empirical recent-versus-baseline municipal indicator. The weather panel adds
Open-Meteo observed weather for the previous 30 days and a seven-day weather
forecast at an average of official barangay centroids (or the assigned barangay
centroid for a scoped field reviewer). The panel is context only; it does not
change the mortality forecast or its surveillance level. Current source records
do not provide the longitudinal, animal-level outcomes needed to defend
individual mortality probabilities. An individual model should only be added
after approved animal-linked outcomes and retrospective validation support it.
