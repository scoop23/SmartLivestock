# XLM-RoBERTa intent experiment

This is an optional, offline comparison for Ask SmartLivestock. It fine-tunes
`FacebookAI/xlm-roberta-base` on synthetic English, Tagalog, and Taglish
questions, then compares held-out intent predictions with the deterministic
parser. It does not receive production questions, read database rows, or run
inside the live API.

## Corpus and labels

The experiment uses `ask_smartlivestock_candidates.json`, which contains 1,296
AI-authored candidate questions across nine intents. It combines them with
`ask_smartlivestock_intent_xlmr_extension.json`, which now contains 336 examples
for `forecast`, `sales_summary`, and `mortality_rate`. The combined corpus has
1,632 questions: 1,230 train, 120 validation, and 282 test across 12 intents.
The new intents now have 104 training questions each, close to 102 for each
base intent. Their validation and test splits remain small at four examples
each, so per-intent scores for them remain uncertain.

The 1,296 base questions and the added extension questions are marked as
candidate data; their labels have not been human-reviewed. The base corpus
audit found no schema or split errors, but flagged seven likely near-duplicate
pairs within its training split. The extension loader checks normalized exact
duplicates and family split boundaries; the added training examples had no
cross-split near duplicates in the targeted check. Training uses class-weighted
loss and reports per-intent metrics. These safeguards do not replace human
review or establish real Taglish accuracy. Paraphrase families stay within
their assigned split; validation selects checkpoints and test remains held out.

The model predicts only an intent label. It does not extract trusted species,
dates, barangays, or authorization. The live parser and fixed Django handlers
remain authoritative. The model's softmax score is reported as an uncalibrated
diagnostic.

## Pilot result

Before the 288-question training augmentation, a three-epoch CPU run
(`--batch-size 16 --max-length 96`) scored 73.4% accuracy and 0.617 macro-F1
on the held-out synthetic test split. The deterministic parser scored 63.5%
accuracy and 0.659 macro-F1 on the same examples. XLM-R
recognized 0/4 `forecast`, 3/4 `sales_summary`, and 1/4 `mortality_rate` test
examples; it also recognized only 1/30 `clarification` examples. These small,
AI-authored test slices are too limited to show production accuracy. The pilot
showed weaker minority-intent and clarification coverage. The expanded training
corpus has not yet been retrained and evaluated; do not treat those earlier
scores as results for the current corpus version.

## Run the experiment

From `backend/`, create an isolated Python 3.13 environment outside the
repository so the optional ML packages do not enter the project's production
Pipfile, Docker image, or working tree:

```powershell
$xlmrVenv = Join-Path $env:LOCALAPPDATA "SmartLivestock\xlmr-venv"
py -3.13 -m venv $xlmrVenv
& "$xlmrVenv\Scripts\python.exe" -m pip install -r requirements.txt -r analytics/requirements-nlp-xlmr.txt
& "$xlmrVenv\Scripts\python.exe" manage.py evaluate_ask_smartlivestock_xlmr
```

The first run downloads the pretrained XLM-RoBERTa weights from Hugging Face
and caches them outside the repository. Set `HF_HOME` first if you want to
choose a different cache location. Training then fits a new intent head
and updates the model for three epochs by default. The command reports model
and rules metrics on the same held-out examples, with language and typo slices,
and validation history. Add `--include-examples` to print question-level
disagreements. Adjust `--epochs`,
`--batch-size`, `--max-length`, or `--learning-rate` for a controlled follow-up.

## Limitations

- The corpus is synthetic and intentionally small; each intent has few
  independent paraphrase families. Treat metrics as a pilot, not a deployment
  decision.
- Repeated training runs and CPU/GPU execution can produce different results.
- No fine-tuned model artifact is saved or used by the app.
- Production installation, endpoint behavior, database values, and deployment
  performance are unchanged.
- XLM-R predictions cannot authorize a role, select ORM fields, create SQL, or
  override a deterministic clarification/refusal.
