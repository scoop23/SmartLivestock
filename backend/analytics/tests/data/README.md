# Ask SmartLivestock parser evaluation set

`ask_smartlivestock_eval.json` contains 51 natural-language prompts with expected parser handling. It is a test fixture only; it contains no production or farmer records and is never loaded by the application. Added farmer names are fictional parser examples; database tests use separately created test accounts.

Run the focused evaluation and API tests from `backend/`:

```powershell
.\.venv\Scripts\python.exe manage.py test analytics.tests.test_nlp_query
```

The dataset test measures intent accuracy as exact `status` and `intent` matches. For each parsed case, parameter extraction accuracy is the share of expected parameter paths that match exactly (including period selection). Unsupported-query handling is the exact status match for unsupported and ambiguous cases. Result correctness and role scope are checked separately against controlled database fixtures in the same test module; the parser examples alone do not measure result correctness.

To review the dataset manually, compare each question with its expected parser response using the test's fixed livestock type and barangay vocabulary. Keep these prompts separate from livestock records when adding examples.
