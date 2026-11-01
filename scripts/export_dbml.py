"""
SmartLivestock DBML Generator
Generates a comprehensive, 100% syntactically valid DBML schema directly
from the authoritative Django ORM models across all 7 domain apps.
"""

import os
import sys

# Setup Django environment
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'smartlivestock.settings')

# Ensure dummy DATABASE_URL if not present so settings can load
if 'DATABASE_URL' not in os.environ:
    os.environ['DATABASE_URL'] = 'sqlite:///fakedb.sqlite3'

import django
django.setup()

from django.apps import apps
from django.db import models

SUBSYSTEMS = [
    {
        'title': '1. Users, Roles, Identity Verification & Programs',
        'group': 'Users_Identity_And_Programs',
        'description': 'Authentication, role-based access control, RSBSA / ID verification, push notifications, announcements, and municipal extension schedules/bookings.',
        'models': [
            ('users.Role', 'roles', 'System roles: FARMER, MAO, SIBAT, AUCTION, SLAUGHTERHOUSESTAFF, etc.'),
            ('users.User', 'users', 'Central user accounts with authentication and authorization scope.'),
            ('users.UserDocument', 'user_documents', 'Uploaded documents for RSBSA, IDs, and barangay certificates for verification.'),
            ('users.IdentityVerificationAttempt', 'identity_verification_attempts', 'Automated and manual KYC identity verification attempts.'),
            ('users.IdentityVerificationEvent', 'identity_verification_events', 'Audit events and state transitions during identity verification.'),
            ('users.Notification', 'notifications', 'In-app notifications sent to platform users.'),
            ('users.PushSubscription', 'push_subscriptions', 'Browser Web Push subscriptions for mobile/desktop alerts.'),
            ('users.Announcement', 'announcements', 'Municipal Agriculture announcements and news bulletin.'),
            ('users.AnnouncementPhoto', 'announcement_photos', 'Photo attachments for published announcements.'),
            ('users.ProgramSchedule', 'program_schedules', 'Municipal extension services, seminars, and vaccination drive schedules.'),
            ('users.ProgramSchedulePhoto', 'program_schedule_photos', 'Photo attachments for program schedules.'),
            ('users.ProgramBooking', 'program_bookings', 'Farmer reservations and attendance bookings for scheduled programs.'),
        ]
    },
    {
        'title': '2. Geography, Livestock Registry, Batches & Transfers',
        'group': 'Geography_And_Livestock_Registry',
        'description': 'Spatial barangay centroids, farmer registrations, livestock species, individual & batch herd registry, gate verification, and ownership transfers.',
        'models': [
            ('livestock.Barangay', 'barangays', 'Municipal barangays in Padre Garcia with geographic coordinates.'),
            ('livestock.Farmer', 'farmers', 'Registered farmer profiles linked to user accounts and barangays.'),
            ('livestock.LivestockType', 'livestock_types', 'Livestock species / categories (Cattle, Carabao, Swine, Goat, etc.).'),
            ('livestock.LivestockBatch', 'livestock_batches', 'Herd/batch groupings for poultry, swine, or large ruminants.'),
            ('livestock.LivestockBatchPhoto', 'livestock_batch_photos', 'Photographic logs for livestock batch monitoring.'),
            ('livestock.LivestockInventory', 'livestock_inventory', 'Authoritative individual animal and batch inventory registry.'),
            ('livestock.LivestockInventoryReviewHistory', 'livestock_inventory_review_history', 'Immutable audit trail of livestock registration approvals and revisions.'),
            ('livestock.LivestockHerdMembershipHistory', 'livestock_herd_membership_history', 'Audit history of herd/batch reassignments.'),
            ('livestock.LivestockGateVerification', 'livestock_gate_verifications', 'Auction gate check-in and duplicate ear-tag scan prevention sessions.'),
            ('livestock.LivestockOwnershipTransfer', 'livestock_ownership_transfers', 'Transfer certificates of livestock ownership (Farmer-to-Farmer or External).'),
            ('livestock.CensusSubmission', 'census_submissions', 'Quarterly municipal livestock census submissions by barangay.'),
            ('livestock.CensusSubmissionItem', 'census_submission_items', 'Headcount item breakdown per farmer and species for census.'),
        ]
    },
    {
        'title': '3. Production, Breeding, Feeding, Treatments & Sales',
        'group': 'Production_Breeding_And_Trade',
        'description': 'Dairy and agricultural yield tracking, live auctions, slaughterhouse operations, AI breeding, veterinary clinical treatments, and feed monitoring.',
        'models': [
            ('production.ProductionRecord', 'production_records', 'Recorded agricultural yields (milk, meat, eggs, wool) with anomaly validation.'),
            ('production.ProductionRecordWorkflowEvent', 'production_record_workflow_events', 'Audit trail for production yield flagging and verification.'),
            ('production.SlaughterRecord', 'slaughter_records', 'Authoritative municipal slaughterhouse intake and dressed yield records.'),
            ('production.SlaughterAnimal', 'slaughter_animals', 'Individual animal items included within a slaughterhouse record.'),
            ('production.LiveAnimalSale', 'live_animal_sales', 'Live animal transactions and auction sales records.'),
            ('production.WeightRecord', 'weight_records', 'Periodic animal scale weighings for growth tracking.'),
            ('production.CalvingRecord', 'calving_records', 'Birth events, calving ease, and calf inventory linkage.'),
            ('production.AnimalDisposition', 'animal_dispositions', 'Farmer declarations of intent (sale, slaughter, transfer).'),
            ('production.BreedingRecord', 'breeding_records', 'Artificial insemination, sire tracking, gestation, and expected due dates.'),
            ('production.LivestockTreatmentRecord', 'livestock_treatment_records', 'Veterinary treatments, medication logs, and clinical follow-up dates.'),
            ('production.FeedingRecord', 'feeding_records', 'Daily feeding logs, feed types, quantities, and cost tracking.'),
            ('production.PSACommodityMapping', 'psa_commodity_mappings', 'Mapping between livestock production types and official PSA commodities.'),
            ('production.PSAReferencePrice', 'psa_reference_prices', 'PSA market benchmark prices for valuation snapshots.'),
            ('production.MilkAnomalyDemoOwnership', 'milk_anomaly_demo_ownerships', 'Synthetic demonstration isolation table for milk yield anomaly models.'),
        ]
    },
    {
        'title': '4. Animal Health, Disease Surveillance & Mortality',
        'group': 'Animal_Health_And_Surveillance',
        'description': 'Clinical disease incident reporting, veterinary inspection follow-ups, and confirmed animal mortality logs.',
        'models': [
            ('diseases.DiseaseCase', 'disease_cases', 'Reported animal health issues, symptoms, and outbreak investigations.'),
            ('diseases.DiseaseCaseFollowUp', 'disease_case_follow_ups', 'Veterinary clinical progression notes and post-treatment follow-up logs.'),
            ('diseases.MortalityRecord', 'mortality_records', 'Deceased animal records, verified causes of death, and inventory reconciliation.'),
        ]
    },
    {
        'title': '5. Inspections, Clearances & Meat Movement',
        'group': 'Inspections_And_Movements',
        'description': 'Livestock transit inspection, handler licensing, movement clearances, and post-slaughter meat transport documentation.',
        'models': [
            ('movements.LivestockInspection', 'livestock_inspections', 'Origin and transit inspection of livestock shipments.'),
            ('movements.LivestockInspectionItem', 'livestock_inspection_items', 'Itemized animals included in a transport inspection.'),
            ('movements.LivestockInspectionClearance', 'livestock_inspection_clearances', 'Official movement clearance certificate with QR verification.'),
            ('movements.MeatMovementRecord', 'meat_movement_records', 'Dressed meat movement and inter-barangay shipping clearances.'),
        ]
    },
    {
        'title': '6. Analytics, Forecast Demos & Operations',
        'group': 'Analytics_And_Operations',
        'description': 'Predictive ML isolated datasets, scheduled monthly PDF delivery records, and batch data imports.',
        'models': [
            ('analytics.IndividualMilkDemoCow', 'individual_milk_demo_cows', 'Isolated synthetic cows for predictive 7-day milk production forecasting.'),
            ('analytics.IndividualMilkDemoObservation', 'individual_milk_demo_observations', 'Isolated daily milk production series with THI weather context.'),
            ('analytics.MonthlyReportDelivery', 'monthly_report_deliveries', 'Municipal monthly summary report generation and delivery logs.'),
            ('analytics.SurveillanceDemoOwnership', 'surveillance_demo_ownerships', 'Synthetic demonstration isolation table for disease surveillance analytics.'),
            ('analytics.NLPExampleReviewEvent', 'nlp_example_review_events', 'NLP query feedback and review annotation audit logs.'),
            ('data_imports.DataImportBatch', 'data_import_batches', 'Bulk tabular dataset upload and import batches.'),
        ]
    }
]

# Build lookup mapping
MODEL_TABLE_MAP = {}
for sub in SUBSYSTEMS:
    for model_key, tbl, _ in sub['models']:
        MODEL_TABLE_MAP[model_key] = tbl

def get_field_type(f):
    internal = f.get_internal_type()
    if f.is_relation and f.remote_field and f.remote_field.model:
        target_pk = f.remote_field.model._meta.pk
        return get_field_type(target_pk)
    if internal in ['AutoField', 'SmallAutoField', 'IntegerField', 'PositiveIntegerField', 'SmallIntegerField', 'PositiveSmallIntegerField']:
        return 'integer'
    if internal in ['BigAutoField', 'BigIntegerField']:
        return 'bigint'
    if internal in ['DecimalField', 'FloatField']:
        return 'decimal'
    if internal in ['CharField', 'SlugField', 'EmailField', 'FileField', 'ImageField']:
        return 'varchar'
    if internal == 'TextField':
        return 'text'
    if internal == 'BooleanField':
        return 'boolean'
    if internal == 'DateField':
        return 'date'
    if internal == 'DateTimeField':
        return 'timestamp'
    if internal == 'TimeField':
        return 'time'
    if internal == 'UUIDField':
        return 'uuid'
    if internal == 'JSONField':
        return 'json'
    return 'varchar'

def format_default(val):
    if callable(val):
        return None
    if isinstance(val, bool):
        return 'true' if val else 'false'
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, str):
        val_clean = val.replace("'", "\\'")
        return f"'{val_clean}'"
    return None

def generate_dbml():
    lines = []
    lines.append('// ===========================================================================')
    lines.append('// SmartLivestock Database Schema (DBML)')
    lines.append('// Municipal Agriculture Office — Padre Garcia, Batangas')
    lines.append('// Comprehensive relational schema generated directly from Django ORM Models')
    lines.append('// ===========================================================================\n')

    refs = []

    for sub in SUBSYSTEMS:
        lines.append('// ---------------------------------------------------------------------------')
        lines.append(f"// {sub['title']}")
        lines.append(f"// {sub['description']}")
        lines.append('// ---------------------------------------------------------------------------\n')

        for model_key, tbl, doc in sub['models']:
            app_label, mname = model_key.split('.')
            model = apps.get_model(app_label, mname)

            table_note = f"{doc} (Django: {app_label}.{mname}, table: {model._meta.db_table})"
            table_note_escaped = table_note.replace("'", "\\'")
            lines.append(f"Table {tbl} [note: '{table_note_escaped}'] {{")

            # Collect columns
            for f in model._meta.fields:
                col_name = f.attname
                col_type = get_field_type(f)

                modifiers = []
                if f.primary_key:
                    modifiers.append('pk')
                    if f.get_internal_type() in ['AutoField', 'BigAutoField', 'SmallAutoField']:
                        modifiers.append('increment')
                else:
                    if f.unique:
                        modifiers.append('unique')
                    if not f.null:
                        modifiers.append('not null')

                # default
                if f.has_default():
                    d = format_default(f.default)
                    if d:
                        modifiers.append(f'default: {d}')

                # note / choices
                note_parts = []
                if f.choices:
                    choices_list = [str(c[0]) for c in f.choices]
                    if len(choices_list) <= 12:
                        note_parts.append(f"Choices: {', '.join(choices_list)}")
                    else:
                        note_parts.append(f"Choices: {', '.join(choices_list[:10])}... ({len(choices_list)} total)")

                if f.help_text:
                    clean_help = str(f.help_text).strip().replace("'", "\\'")
                    if clean_help:
                        note_parts.append(clean_help)

                if note_parts:
                    combined_note = '; '.join(note_parts).replace("'", "\\'")
                    modifiers.append(f"note: '{combined_note}'")

                mod_str = f" [{', '.join(modifiers)}]" if modifiers else ""
                lines.append(f"  {col_name} {col_type}{mod_str}")

                # Collect reference if foreign key or one-to-one
                if f.is_relation and f.remote_field and f.remote_field.model:
                    rel_model = f.remote_field.model
                    rel_key = f"{rel_model._meta.app_label}.{rel_model.__name__}"
                    if rel_key in MODEL_TABLE_MAP:
                        target_tbl = MODEL_TABLE_MAP[rel_key]
                        target_col = rel_model._meta.pk.name
                        rel_op = '-' if isinstance(f, models.OneToOneField) else '>'
                        refs.append({
                            'subsystem': sub['title'],
                            'from_tbl': tbl,
                            'from_col': col_name,
                            'op': rel_op,
                            'to_tbl': target_tbl,
                            'to_col': target_col,
                            'field_name': f.name
                        })

            # Indexes / unique constraints
            unique_sets = []
            if model._meta.unique_together:
                for ut in model._meta.unique_together:
                    unique_sets.append([model._meta.get_field(fn).attname for fn in ut])

            for c in model._meta.constraints:
                if hasattr(c, 'fields') and c.fields:
                    unique_sets.append([model._meta.get_field(fn).attname for fn in c.fields])

            if unique_sets:
                lines.append('\n  indexes {')
                for us in unique_sets:
                    cols_csv = ', '.join(us)
                    lines.append(f"    ({cols_csv}) [unique]")
                lines.append('  }')

            lines.append('}\n')

    # Foreign Key Relationships
    lines.append('// ===========================================================================')
    lines.append('// Foreign Key Relationships (Refs)')
    lines.append('// ===========================================================================\n')

    # Group refs by subsystem of origin
    current_sub = None
    for r in refs:
        if r['subsystem'] != current_sub:
            current_sub = r['subsystem']
            lines.append(f"// Refs for {current_sub}")
        lines.append(f"Ref: {r['from_tbl']}.{r['from_col']} {r['op']} {r['to_tbl']}.{r['to_col']}")
    lines.append('')

    # Table Groups for dbdiagram.io
    lines.append('// ===========================================================================')
    lines.append('// Visual Table Groups (for dbdiagram.io)')
    lines.append('// ===========================================================================\n')

    for sub in SUBSYSTEMS:
        lines.append(f"TableGroup {sub['group']} {{")
        for _, tbl, _ in sub['models']:
            lines.append(f"  {tbl}")
        lines.append('}\n')

    return '\n'.join(lines)

if __name__ == '__main__':
    content = generate_dbml()
    out_path = os.path.join(os.path.dirname(__file__), '..', 'backend', 'databaseschema.dbml')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Successfully wrote updated DBML to {out_path}')
    print(f'Total lines generated: {len(content.splitlines())}')
