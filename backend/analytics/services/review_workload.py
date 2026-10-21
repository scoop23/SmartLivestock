"""Compact review-queue aggregates for Admin and assigned SIBAT dashboards."""

from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from diseases.models import DiseaseCase, MortalityRecord
from livestock.models import CensusSubmission, LivestockInventory, LivestockOwnershipTransfer
from movements.models import LivestockInspectionClearance
from production.models import (
    CalvingRecord,
    LiveAnimalSale,
    ProductionRecord,
    SlaughterRecord,
)


from smartlivestock.workflows import has_all_barangay_access, role_name, scope_reviewer_queryset


def _stage_age_filter(*, created_statuses, reviewed_statuses, start, end=None):
    """Build an age window using submission time or the latest reviewer handoff."""
    condition = Q(pk__in=[])
    if created_statuses:
        created_window = Q(status__in=created_statuses, created_at__gte=start)
        if end is not None:
            created_window &= Q(created_at__lt=end)
        condition |= created_window

    if reviewed_statuses:
        reviewed_window = Q(status__in=reviewed_statuses, reviewed_at__gte=start)
        missing_review_time = Q(status__in=reviewed_statuses, reviewed_at__isnull=True, created_at__gte=start)
        if end is not None:
            reviewed_window &= Q(reviewed_at__lt=end)
            missing_review_time &= Q(created_at__lt=end)
        condition |= reviewed_window | missing_review_time
    return condition


def _age_buckets(*, created_statuses, reviewed_statuses, now):
    """Return conditional-count filters so each model needs only one aggregate query."""
    windows = (
        ("under_3_days", now - timedelta(days=3), None),
        ("3_to_7_days", now - timedelta(days=7), now - timedelta(days=3)),
        ("over_7_days", None, now - timedelta(days=7)),
    )
    return {
        label: _stage_age_filter(
            created_statuses=created_statuses,
            reviewed_statuses=reviewed_statuses,
            start=start,
            end=end,
        ) if start is not None else _stage_age_before(
            created_statuses=created_statuses,
            reviewed_statuses=reviewed_statuses,
            end=end,
        )
        for label, start, end in windows
    }


def _stage_age_before(*, created_statuses, reviewed_statuses, end):
    condition = Q(pk__in=[])
    if created_statuses:
        condition |= Q(status__in=created_statuses, created_at__lt=end)
    if reviewed_statuses:
        condition |= Q(status__in=reviewed_statuses, reviewed_at__lt=end)
        condition |= Q(status__in=reviewed_statuses, reviewed_at__isnull=True, created_at__lt=end)
    return condition


def review_workload_summary(*, now=None, user=None):
    """Summarize open review queues without returning or aggregating record details."""
    now = now or timezone.now()
    user_role = role_name(user) if user else ""
    is_sibat = user_role == "SIBAT"
    is_cbat = user_role == "CBAT"
    assigned_only = (is_sibat or is_cbat) and not has_all_barangay_access(user)

    def scoped(queryset):
        if user is None:
            return queryset
        return scope_reviewer_queryset(queryset, user, assigned_only=assigned_only)
    # Most submissions pass through SIBAT, while these records are assigned
    # straight to MAO by the established workflow rules.
    standard_domains = [
        # Aggregated legacy rows cannot be independently verified as animals.
        ("inventory", "Livestock Inventory", scoped(LivestockInventory.objects.filter(entry_type=LivestockInventory.EntryType.INDIVIDUAL))),
        ("production", "Production", scoped(ProductionRecord.objects.all())),
        ("disease", "Disease Reports", scoped(DiseaseCase.objects.all())),
        ("mortality", "Mortality", scoped(MortalityRecord.objects.all())),
        ("calving", "Calving", scoped(CalvingRecord.objects.all())),
        ("slaughter", "Slaughter", scoped(SlaughterRecord.objects.all())),
        ("sales", "Auction Sales", scoped(LiveAnimalSale.objects.all())),
    ]
    direct_mao_domains = [
        ("ownership_transfers", "Ownership Transfers", scoped(LivestockOwnershipTransfer.objects.all())),
        ("inspection_clearances", "Inspection Clearances", scoped(LivestockInspectionClearance.objects.all())),
    ]
    domains = []
    overall = {
        "sibat": {"count": 0, "aging": {"under_3_days": 0, "3_to_7_days": 0, "over_7_days": 0}},
        "cbat": {"count": 0, "aging": {"under_3_days": 0, "3_to_7_days": 0, "over_7_days": 0}},
        "mao": {"count": 0, "aging": {"under_3_days": 0, "3_to_7_days": 0, "over_7_days": 0}},
        "returned": 0,
    }

    def add_domain(key, label, queryset, *, sibat_statuses, mao_created_statuses, mao_reviewed_statuses):
        if key == "production":
            sibat_base = Q(status="PENDING") & ~Q(next_review_queue__in=["CBAT", "MAO"])
            cbat_base = Q(status="PENDING", next_review_queue="CBAT")
            mao_base = Q(status="VERIFIED") | Q(status="PENDING", next_review_queue="MAO")
            sibat_ages = {
                bucket: sibat_base & cond
                for bucket, cond in _age_buckets(created_statuses=("PENDING",), reviewed_statuses=(), now=now).items()
            }
            cbat_ages = {
                bucket: cbat_base & cond
                for bucket, cond in _age_buckets(created_statuses=("PENDING",), reviewed_statuses=(), now=now).items()
            }
            mao_ages = {
                bucket: (
                    (Q(status="PENDING", next_review_queue="MAO") & _age_buckets(created_statuses=("PENDING",), reviewed_statuses=(), now=now)[bucket])
                    | (Q(status="VERIFIED") & _age_buckets(created_statuses=(), reviewed_statuses=("VERIFIED",), now=now)[bucket])
                )
                for bucket in ("under_3_days", "3_to_7_days", "over_7_days")
            }
            counts = queryset.aggregate(
                sibat_count=Count("pk", filter=sibat_base),
                cbat_count=Count("pk", filter=cbat_base),
                mao_count=Count("pk", filter=mao_base),
                returned_count=Count("pk", filter=Q(status="SUBJECT_TO_REVISION")),
                **{f"sibat_{bucket}": Count("pk", filter=cond) for bucket, cond in sibat_ages.items()},
                **{f"cbat_{bucket}": Count("pk", filter=cond) for bucket, cond in cbat_ages.items()},
                **{f"mao_{bucket}": Count("pk", filter=cond) for bucket, cond in mao_ages.items()},
            )
            sibat_aging = {bucket: counts[f"sibat_{bucket}"] for bucket in sibat_ages}
            cbat_aging = {bucket: counts[f"cbat_{bucket}"] for bucket in cbat_ages}
            mao_aging = {bucket: counts[f"mao_{bucket}"] for bucket in mao_ages}
            row = {
                "key": key,
                "label": label,
                "sibat_count": counts["sibat_count"],
                "cbat_count": counts["cbat_count"],
                "mao_count": counts["mao_count"],
                "returned_count": counts["returned_count"],
                "sibat_aging": sibat_aging,
                "cbat_aging": cbat_aging,
                "mao_aging": mao_aging,
            }
            domains.append(row)
            overall["sibat"]["count"] += row["sibat_count"]
            overall["cbat"]["count"] += row["cbat_count"]
            overall["mao"]["count"] += row["mao_count"]
            overall["returned"] += row["returned_count"]
            for bucket in overall["sibat"]["aging"]:
                overall["sibat"]["aging"][bucket] += sibat_aging[bucket]
                overall["cbat"]["aging"][bucket] += cbat_aging[bucket]
                overall["mao"]["aging"][bucket] += mao_aging[bucket]
            return

        sibat_ages = _age_buckets(created_statuses=sibat_statuses, reviewed_statuses=(), now=now)
        mao_ages = _age_buckets(
            created_statuses=mao_created_statuses,
            reviewed_statuses=mao_reviewed_statuses,
            now=now,
        )
        counts = queryset.aggregate(
            sibat_count=Count("pk", filter=Q(status__in=sibat_statuses)),
            mao_count=Count("pk", filter=Q(status__in=set(mao_created_statuses) | set(mao_reviewed_statuses))),
            returned_count=Count("pk", filter=Q(status="SUBJECT_TO_REVISION")),
            **{
                f"sibat_{bucket}": Count("pk", filter=condition)
                for bucket, condition in sibat_ages.items()
            },
            **{
                f"mao_{bucket}": Count("pk", filter=condition)
                for bucket, condition in mao_ages.items()
            },
        )
        sibat_aging = {bucket: counts[f"sibat_{bucket}"] for bucket in sibat_ages}
        mao_aging = {bucket: counts[f"mao_{bucket}"] for bucket in mao_ages}
        row = {
            "key": key,
            "label": label,
            "sibat_count": counts["sibat_count"],
            "cbat_count": 0,
            "mao_count": counts["mao_count"],
            "returned_count": counts["returned_count"],
            "sibat_aging": sibat_aging,
            "cbat_aging": {"under_3_days": 0, "3_to_7_days": 0, "over_7_days": 0},
            "mao_aging": mao_aging,
        }
        domains.append(row)
        overall["sibat"]["count"] += row["sibat_count"]
        overall["mao"]["count"] += row["mao_count"]
        overall["returned"] += row["returned_count"]
        for bucket in overall["sibat"]["aging"]:
            overall["sibat"]["aging"][bucket] += sibat_aging[bucket]
            overall["mao"]["aging"][bucket] += mao_aging[bucket]

    for key, label, queryset in standard_domains:
        if (is_sibat or is_cbat) and key == "sales":
            continue
        add_domain(
            key,
            label,
            queryset,
            sibat_statuses=("PENDING",),
            mao_created_statuses=(),
            mao_reviewed_statuses=("VERIFIED",),
        )

    # Census is encoded by SIBAT, so its VERIFIED submissions are MAO's queue.
    add_domain(
        "census",
        "Quarterly Census",
        scoped(CensusSubmission.objects.all()),
        sibat_statuses=(),
        mao_created_statuses=(),
        mao_reviewed_statuses=("VERIFIED",),
    )
    for key, label, queryset in direct_mao_domains:
        add_domain(
            key,
            label,
            queryset,
            sibat_statuses=(),
            mao_created_statuses=("PENDING",),
            mao_reviewed_statuses=("VERIFIED",),
        )

    return {
        "as_of": now.isoformat(),
        "aging_basis": "SIBAT queues use submission time; MAO queues use the last review handoff when available.",
        "overall": overall,
        "by_domain": domains,
    }
