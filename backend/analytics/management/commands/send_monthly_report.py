"""Email the previous month's approved-record summary to MAO users."""

import calendar
import logging
import os
from datetime import datetime, timedelta
from io import BytesIO

from django.core.management.base import BaseCommand, CommandError
from django.core.mail import EmailMessage
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

from analytics.models import MonthlyReportDelivery
from analytics.services.reports import build_report
from users.models import User

logger = logging.getLogger(__name__)
REPORT_TYPES = ("inventory", "production", "disease_mortality", "slaughter", "movement", "inspection")


def previous_month_period(today=None):
    today = today or timezone.localdate()
    first_of_this_month = today.replace(day=1)
    end = first_of_this_month - timedelta(days=1)
    return end.replace(day=1), end


def _monthly_summary_workbook(reports):
    workbook = Workbook()
    workbook.remove(workbook.active)
    for report in reports:
        sheet = workbook.create_sheet(report["report_type"][:31])
        sheet.append(["SMARTLIVESTOCK-BATANGAS"])
        sheet.append([report["title"]])
        sheet.append([f"Period: {report['period']['date_from']} to {report['period']['date_to']}"])
        sheet.append([f"Source: {report['analysis']['data_status']}"])
        sheet.append([])
        sheet.append(["SUMMARY", "VALUE"])
        for cell in sheet[sheet.max_row]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="1E4D2B")
        for key, value in report["summary"].items():
            if isinstance(value, dict):
                for label, amount in value.items():
                    sheet.append([f"{key.replace('_', ' ').title()} - {label}", amount])
            else:
                sheet.append([key.replace("_", " ").title(), value])
        sheet.append([])
        sheet.append(["KEY FINDINGS"])
        sheet.cell(sheet.max_row, 1).font = Font(bold=True, color="1E4D2B")
        findings = report["analysis"].get("key_findings") or ["No findings for this period."]
        for finding in findings:
            sheet.append([finding])
        sheet.append([])
        sheet.append(["Methodology", report["analysis"].get("methodology", "")])
        sheet.append(["Records included", report["record_count"]])
        sheet.column_dimensions["A"].width = 54
        sheet.column_dimensions["B"].width = 34
        sheet.freeze_panes = "A7"
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


class Command(BaseCommand):
    help = "Generate and email one monthly summary workbook from approved records."

    def add_arguments(self, parser):
        parser.add_argument("--month", help="Reporting month in YYYY-MM format; defaults to the previous month.")

    def handle(self, *args, **options):
        try:
            if options["month"]:
                first = datetime.strptime(options["month"], "%Y-%m").date().replace(day=1)
                last = first.replace(day=calendar.monthrange(first.year, first.month)[1])
            else:
                first, last = previous_month_period()
        except ValueError as exc:
            raise CommandError("--month must use YYYY-MM format.") from exc

        recipients_env = os.environ.get("AUTOMATED_REPORT_RECIPIENTS", "")
        if recipients_env.strip():
            recipients = sorted({email.strip() for email in recipients_env.split(",") if email.strip()})
        else:
            recipients = sorted(set(User.objects.filter(
                role__role_name__in=("MAO", "ADMIN"),
                account_status=User.AccountStatus.APPROVED,
                is_active=True,
            ).exclude(email="").values_list("email", flat=True)))
        if not recipients:
            raise CommandError("No MAO report recipients found. Configure AUTOMATED_REPORT_RECIPIENTS or approved MAO accounts with email addresses.")
        mao_user = User.objects.filter(
            role__role_name="MAO", account_status=User.AccountStatus.APPROVED, is_active=True,
        ).order_by("pk").first()
        if mao_user is None:
            raise CommandError("An approved MAO account is required to apply the report authorization rules.")
        if settings.EMAIL_BACKEND.endswith("console.EmailBackend"):
            raise CommandError("Configure an SMTP email backend before sending the monthly MAO report.")

        now = timezone.now()
        with transaction.atomic():
            delivery, created = MonthlyReportDelivery.objects.select_for_update().get_or_create(
                period_start=first,
                defaults={"period_end": last, "status": MonthlyReportDelivery.Status.GENERATING},
            )
            if delivery.status == MonthlyReportDelivery.Status.SENT:
                self.stdout.write(self.style.WARNING(f"Monthly report for {first:%Y-%m} was already sent."))
                return
            # A new row is our own claim. Only an existing fresh claim means
            # another worker is already generating this month's report.
            if (not created and delivery.status == MonthlyReportDelivery.Status.GENERATING
                    and delivery.started_at > now - timedelta(hours=1)):
                raise CommandError(f"A report for {first:%Y-%m} is already being generated.")
            delivery.period_end = last
            delivery.status = MonthlyReportDelivery.Status.GENERATING
            delivery.recipients = recipients
            delivery.error_summary = ""
            delivery.started_at = now
            delivery.save(update_fields=["period_end", "status", "recipients", "error_summary", "started_at"])

        try:
            period = {"date_from": first.isoformat(), "date_to": last.isoformat()}
            reports = [build_report(kind, period, mao_user) for kind in REPORT_TYPES]
            content = _monthly_summary_workbook(reports)
            subject = f"SmartLivestock monthly MAO summary — {first:%B %Y}"
            message = (
                f"Attached is the monthly SmartLivestock summary for {first:%B %Y}. "
                "It includes farmer-recorded production and approved-record summaries for inventory, disease and mortality, "
                "slaughter, movement, and inspection. Please use the methodology and source notes in each sheet."
            )
            email = EmailMessage(subject, message, to=recipients)
            email.attach(f"smartlivestock_summary_{first:%Y_%m}.xlsx", content,
                         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            if email.send(fail_silently=False) != 1:
                raise RuntimeError("The configured email backend did not accept the report message.")
        except Exception as exc:
            logger.exception("Monthly SmartLivestock report failed for %s", first)
            MonthlyReportDelivery.objects.filter(pk=delivery.pk).update(
                status=MonthlyReportDelivery.Status.FAILED,
                error_summary=type(exc).__name__,
            )
            raise CommandError(f"Could not generate or send the {first:%Y-%m} report ({type(exc).__name__}).") from exc

        MonthlyReportDelivery.objects.filter(pk=delivery.pk).update(
            status=MonthlyReportDelivery.Status.SENT,
            sent_at=timezone.now(),
            error_summary="",
        )
        self.stdout.write(self.style.SUCCESS(
            f"Generated and emailed the {first:%Y-%m} monthly report to {len(recipients)} recipient(s)."
        ))
