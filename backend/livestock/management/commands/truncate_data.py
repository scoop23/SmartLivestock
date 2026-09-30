"""
Truncates SmartLivestock application data from the configured database.

This is a destructive maintenance command. It performs a dry run and prints a
plan unless --yes is passed.

Why TRUNCATE instead of queryset.delete():
  - one statement instead of thousands of individual DELETEs
  - RESTART IDENTITY resets primary key sequences so new rows start at 1
  - TRUNCATE ignores Django's on_delete rules entirely and relies on the
    database's own foreign key constraints, so the table list must be explicit

Why django_content_type / auth_permission are preserved:
  - they are Django's auto-generated reference data, recreated by post_migrate
  - admin.logentry rows reference contenttypes by natural key, so dropping
    django_content_type breaks loaddata of any dump created with
    --exclude contenttypes
"""

from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, models, transaction

# Schema state plus Django's auto-generated reference rows. Never truncated.
PRESERVE = {
    "contenttypes.ContentType",
    "auth.Permission",
    "auth.Group",
}

# Only preserved when --keep-users / --keep-reference is passed.
KEEP_REFERENCE = {
    "users.User",
    "users.Role",
    "livestock.Barangay",
    "livestock.LivestockType",
}

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", ""}


class Command(BaseCommand):
    help = "Truncates all SmartLivestock application data. Dry-run unless --yes is given."

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Actually delete the rows. Without this flag nothing is modified.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Allow running against a host that is not localhost.",
        )
        parser.add_argument(
            "--keep-users",
            action="store_true",
            help="Also keep users, roles, barangays and livestock types.",
        )
        parser.add_argument(
            "--keep-reference",
            action="store_true",
            help="Keep roles, barangays and livestock types, but still wipe users.",
        )

    def handle(self, *args, **options):
        settings = connection.settings_dict
        host = settings.get("HOST") or ""
        name = settings.get("NAME")

        if host not in LOCAL_HOSTS and not options["force"]:
            raise CommandError(
                f"Refusing to truncate non-local database {name!r} on host {host!r}.\n"
                f"Re-run with --force only if you really mean to wipe it."
            )

        preserved = set(PRESERVE)
        if options["keep_users"]:
            preserved |= KEEP_REFERENCE
        elif options["keep_reference"]:
            preserved |= KEEP_REFERENCE - {"users.User"}

        existing = set(connection.introspection.table_names())
        targets = [
            model
            for model in apps.get_models()
            if model._meta.managed
            and model._meta.label not in preserved
            and model._meta.db_table in existing
        ]

        truncated_labels = {model._meta.label for model in targets}

        # RESTART IDENTITY CASCADE silently truncates any table that holds a
        # foreign key to a truncated table. Refuse if that would reach a table
        # we promised to preserve, otherwise the scope would quietly widen.
        collisions = []
        for model in apps.get_models():
            if model._meta.label not in preserved:
                continue
            for field in model._meta.fields:
                if isinstance(field, models.ForeignKey):
                    if field.related_model._meta.label in truncated_labels:
                        collisions.append(
                            f"{model._meta.label}.{field.name} -> {field.related_model._meta.label}"
                        )
        if collisions:
            raise CommandError(
                "Refusing to run: preserved tables are referenced by truncated tables, "
                "so CASCADE would widen the blast radius:\n  "
                + "\n  ".join(collisions)
            )

        counts_before = {model._meta.db_table: model.objects.count() for model in targets}
        tables = sorted(counts_before)

        self.stdout.write(self.style.MIGRATE_HEADING("=== truncate_data plan ==="))
        self.stdout.write(f"  database : {name}")
        self.stdout.write(f"  host     : {host or 'local socket'}")
        self.stdout.write(f"  vendor   : {settings.get('ENGINE')}")
        self.stdout.write(f"  tables   : {len(tables)} to wipe")
        self.stdout.write(
            f"  preserved: {', '.join(sorted(p.split('.')[-1] for p in preserved))}"
        )
        self.stdout.write("")
        self.stdout.write("  %-42s %10s" % ("table", "rows"))
        self.stdout.write("  " + "-" * 53)
        for table in tables:
            self.stdout.write("  %-42s %10d" % (table, counts_before[table]))
        self.stdout.write("  " + "-" * 53)
        self.stdout.write(
            "  %-42s %10d" % ("TOTAL", sum(counts_before.values()))
        )
        self.stdout.write("")

        if not options["yes"]:
            self.stdout.write(
                self.style.WARNING(
                    "DRY RUN - no rows were deleted. Re-run with --yes to execute."
                )
            )
            return

        quote = connection.ops.quote_name
        statement = "TRUNCATE TABLE {} RESTART IDENTITY CASCADE".format(
            ", ".join(quote(table) for table in tables)
        )

        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(statement)
        except Exception as exc:
            raise CommandError(f"TRUNCATE failed and was rolled back: {exc}") from exc

        after = 0
        for table in tables:
            with connection.cursor() as cursor:
                cursor.execute('SELECT COUNT(*) FROM {}'.format(quote(table)))
                after += cursor.fetchone()[0]

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"TRUNCATE complete. Deleted {sum(counts_before.values())} rows "
                f"across {len(tables)} tables; {after} rows remain in those tables.\n"
                f"Primary key sequences were reset (RESTART IDENTITY)."
            )
        )
        self.stdout.write(
            "  Note: uploaded files in media/ are NOT removed by TRUNCATE."
        )
