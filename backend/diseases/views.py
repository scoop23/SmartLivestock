from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import PermissionDenied

from users.models import User, Notification
from users.notification_views import create_notification
from .models import DiseaseCase, MortalityRecord
from .serializer import DiseaseCaseSerializer, MortalityRecordSerializer


def _notify_disease_case_review(record, new_status, remarks, reviewer_user, role_name):
    try:
        target_farmers = set()
        if record.created_by:
            target_farmers.add(record.created_by)
        if record.livestock and getattr(record.livestock, "farmer", None) and getattr(record.livestock.farmer, "user", None):
            target_farmers.add(record.livestock.farmer.user)
        if record.batch and getattr(record.batch, "farmer", None) and getattr(record.batch.farmer, "user", None):
            target_farmers.add(record.batch.farmer.user)

        if record.livestock:
            tag_str = record.livestock.tag_number or f"Animal #{record.livestock.id}"
            species_str = getattr(record.livestock.livestock_type, "name", "Livestock")
            animal_desc = f"{species_str} [{tag_str}]"
        elif record.batch:
            animal_desc = f"Batch [{record.batch.batch_code}]"
        else:
            animal_desc = "Livestock"

        condition_name = record.name or "Health Observation"

        if role_name == "SIBAT":
            if new_status == DiseaseCase.DiseaseStatus.SUBJECT_TO_REVISION:
                for farmer_user in target_farmers:
                    create_notification(
                        user=farmer_user,
                        notification_type=Notification.NotificationType.DISEASE,
                        priority=Notification.Priority.HIGH,
                        title=f"Alert DIS-{record.id}: Flagged for Emergency Vet Review",
                        message=f"SIBAT on-farm examination flagged {animal_desc} ({condition_name}) for emergency veterinary review and lab sampling.{f' Remarks: {remarks}' if remarks else ''}",
                        link="/report-observation",
                    )
                for mao in User.objects.filter(role__role_name="MAO"):
                    create_notification(
                        user=mao,
                        notification_type=Notification.NotificationType.DISEASE,
                        priority=Notification.Priority.HIGH,
                        title=f"Urgent: Alert DIS-{record.id} Flagged for Emergency Vet Review",
                        message=f"SIBAT field inspection flagged {animal_desc} ({condition_name}) for emergency veterinary review & lab sampling.{f' Remarks: {remarks}' if remarks else ''}",
                        link="/data-validation",
                    )
            elif new_status == DiseaseCase.DiseaseStatus.VERIFIED:
                for farmer_user in target_farmers:
                    create_notification(
                        user=farmer_user,
                        notification_type=Notification.NotificationType.SIBAT,
                        priority=Notification.Priority.MEDIUM,
                        title=f"Disease Observation DIS-{record.id} Verified",
                        message=f"SIBAT field examination completed for {animal_desc}. Record certified and forwarded to MAO.{f' Remarks: {remarks}' if remarks else ''}",
                        link="/report-observation",
                    )
                for mao in User.objects.filter(role__role_name="MAO"):
                    create_notification(
                        user=mao,
                        notification_type=Notification.NotificationType.SIBAT,
                        priority=Notification.Priority.MEDIUM,
                        title=f"Verified Disease Report: DIS-{record.id}",
                        message=f"SIBAT field inspection certified for {animal_desc} ({condition_name}). Awaiting MAO final approval.",
                        link="/data-validation",
                    )
        elif role_name == "MAO":
            if new_status == DiseaseCase.DiseaseStatus.APPROVED:
                for farmer_user in target_farmers:
                    create_notification(
                        user=farmer_user,
                        notification_type=Notification.NotificationType.DISEASE,
                        priority=Notification.Priority.MEDIUM,
                        title=f"Disease Report DIS-{record.id} Approved by MAO",
                        message=f"Official municipal veterinary certification approved for {animal_desc}.{f' Directives: {remarks}' if remarks else ''}",
                        link="/report-observation",
                    )
            elif new_status == DiseaseCase.DiseaseStatus.SUBJECT_TO_REVISION:
                for farmer_user in target_farmers:
                    create_notification(
                        user=farmer_user,
                        notification_type=Notification.NotificationType.DISEASE,
                        priority=Notification.Priority.HIGH,
                        title=f"Revision Required on Disease Report DIS-{record.id}",
                        message=f"MAO veterinary office requested revisions for {animal_desc}.{f' Directives: {remarks}' if remarks else ''}",
                        link="/report-observation",
                    )
    except Exception as e:
        print(f"Error creating disease review notification: {e}")


def _notify_disease_case_created(instance, user):
    try:
        reporter_name = f"{user.first_name} {user.last_name}".strip() or user.username
        animal_tag = instance.livestock.tag_number if instance.livestock else (instance.batch.batch_code if instance.batch else "Livestock")
        for staff in User.objects.filter(role__role_name__in=["SIBAT", "MAO"]):
            role_val = getattr(getattr(staff, "role", None), "role_name", "")
            create_notification(
                user=staff,
                notification_type=Notification.NotificationType.DISEASE,
                priority=Notification.Priority.HIGH,
                title=f"New Disease Case Reported: DIS-{instance.id}",
                message=f"Farmer {reporter_name} reported '{instance.name}' for {animal_tag}. Requires on-farm verification.",
                link="/sibat-alerts" if role_val == "SIBAT" else "/data-validation",
            )
    except Exception as e:
        print(f"Error creating disease reported notification: {e}")


def _notify_mortality_record_review(record, new_status, remarks, reviewer_user, role_name):
    try:
        target_farmers = set()
        if record.created_by:
            target_farmers.add(record.created_by)
        if record.livestock and getattr(record.livestock, "farmer", None) and getattr(record.livestock.farmer, "user", None):
            target_farmers.add(record.livestock.farmer.user)
        if record.batch and getattr(record.batch, "farmer", None) and getattr(record.batch.farmer, "user", None):
            target_farmers.add(record.batch.farmer.user)

        if record.livestock:
            tag_str = record.livestock.tag_number or f"Animal #{record.livestock.id}"
            species_str = getattr(record.livestock.livestock_type, "name", "Livestock")
            animal_desc = f"{species_str} [{tag_str}]"
        elif record.batch:
            animal_desc = f"Batch [{record.batch.batch_code}]"
        else:
            animal_desc = "Livestock"

        if role_name == "SIBAT":
            if new_status == MortalityRecord.MortalityRecordStatus.SUBJECT_TO_REVISION:
                for farmer_user in target_farmers:
                    create_notification(
                        user=farmer_user,
                        notification_type=Notification.NotificationType.DISEASE,
                        priority=Notification.Priority.HIGH,
                        title=f"Mortality Record MOR-{record.id} Flagged for Review",
                        message=f"SIBAT on-site inspection flagged mortality report for {animal_desc}.{f' Remarks: {remarks}' if remarks else ''}",
                        link="/report-observation",
                    )
                for mao in User.objects.filter(role__role_name="MAO"):
                    create_notification(
                        user=mao,
                        notification_type=Notification.NotificationType.DISEASE,
                        priority=Notification.Priority.HIGH,
                        title=f"Urgent: Mortality MOR-{record.id} Flagged by SIBAT",
                        message=f"Mortality report for {animal_desc} returned for veterinary review.{f' Remarks: {remarks}' if remarks else ''}",
                        link="/data-validation",
                    )
            elif new_status == MortalityRecord.MortalityRecordStatus.VERIFIED:
                for farmer_user in target_farmers:
                    create_notification(
                        user=farmer_user,
                        notification_type=Notification.NotificationType.SIBAT,
                        priority=Notification.Priority.MEDIUM,
                        title=f"Mortality Record MOR-{record.id} Verified",
                        message=f"SIBAT on-farm carcass and disposal verification completed for {animal_desc}. Forwarded to MAO.{f' Remarks: {remarks}' if remarks else ''}",
                        link="/report-observation",
                    )
                for mao in User.objects.filter(role__role_name="MAO"):
                    create_notification(
                        user=mao,
                        notification_type=Notification.NotificationType.SIBAT,
                        priority=Notification.Priority.MEDIUM,
                        title=f"Verified Mortality Record: MOR-{record.id}",
                        message=f"SIBAT field inspection certified carcass disposal for {animal_desc}. Awaiting MAO certification.",
                        link="/data-validation",
                    )
        elif role_name == "MAO":
            if new_status == MortalityRecord.MortalityRecordStatus.APPROVED:
                for farmer_user in target_farmers:
                    create_notification(
                        user=farmer_user,
                        notification_type=Notification.NotificationType.GENERAL,
                        priority=Notification.Priority.MEDIUM,
                        title=f"Mortality Record MOR-{record.id} Certified by MAO",
                        message=f"Official municipal mortality certification issued for {animal_desc}. Herd census updated.{f' Directives: {remarks}' if remarks else ''}",
                        link="/report-observation",
                    )
            elif new_status == MortalityRecord.MortalityRecordStatus.SUBJECT_TO_REVISION:
                for farmer_user in target_farmers:
                    create_notification(
                        user=farmer_user,
                        notification_type=Notification.NotificationType.DISEASE,
                        priority=Notification.Priority.HIGH,
                        title=f"Revision Required on Mortality Record MOR-{record.id}",
                        message=f"MAO office requested revisions for {animal_desc}.{f' Directives: {remarks}' if remarks else ''}",
                        link="/report-observation",
                    )
    except Exception as e:
        print(f"Error creating mortality review notification: {e}")


def _notify_mortality_record_created(instance, user):
    try:
        reporter_name = f"{user.first_name} {user.last_name}".strip() or user.username
        animal_tag = instance.livestock.tag_number if instance.livestock else (instance.batch.batch_code if instance.batch else "Livestock")
        for staff in User.objects.filter(role__role_name__in=["SIBAT", "MAO"]):
            role_val = getattr(getattr(staff, "role", None), "role_name", "")
            create_notification(
                user=staff,
                notification_type=Notification.NotificationType.DISEASE,
                priority=Notification.Priority.HIGH,
                title=f"New Mortality Reported: MOR-{instance.id}",
                message=f"Farmer {reporter_name} reported {instance.death_count} death(s) for {animal_tag}. Cause: '{instance.cause}'. Requires on-site verification.",
                link="/sibat-alerts" if role_val == "SIBAT" else "/data-validation",
            )
    except Exception as e:
        print(f"Error creating mortality reported notification: {e}")


# ==============================================================================
# DISEASE CASE ENDPOINTS
# ==============================================================================

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def disease_case_list_create(request):
    """
    GET  /diseases/cases/ -> List disease cases (filtered by role)
    POST /diseases/cases/ -> Submit a new disease case report
    """
    if request.method == "POST":
        serializer = DiseaseCaseSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        _notify_disease_case_created(instance, request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # GET
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        records = DiseaseCase.objects.filter(
            Q(created_by=user) | Q(livestock__farmer__user=user)
        ).distinct()
    else:
        # MAO, SIBAT: list all municipal disease cases
        records = DiseaseCase.objects.all()

    # Apply optional query param filters
    status_param = request.query_params.get("status")
    if status_param and status_param.upper() != "ALL":
        records = records.filter(status__iexact=status_param)

    livestock_param = request.query_params.get("livestock")
    if livestock_param:
        records = records.filter(livestock_id=livestock_param)

    records = records.select_related(
        "livestock__farmer__user",
        "livestock__farmer__barangay",
        "livestock__livestock_type",
        "created_by",
        "reviewed_by",
    ).order_by("-record_date", "-created_at")

    serializer = DiseaseCaseSerializer(records, many=True, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def disease_case_detail(request, pk):
    """
    GET    /diseases/cases/<pk>/ -> Retrieve single disease case
    PUT    /diseases/cases/<pk>/ -> Full update
    PATCH  /diseases/cases/<pk>/ -> Partial update
    DELETE /diseases/cases/<pk>/ -> Delete case (only PENDING allowed)
    """
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        record = get_object_or_404(DiseaseCase, pk=pk, created_by=user)
    else:
        record = get_object_or_404(DiseaseCase, pk=pk)

    if request.method == "DELETE":
        if record.status != DiseaseCase.DiseaseStatus.PENDING:
            return Response(
                {
                    "error": f"Cannot delete a disease case with status '{record.status}'. "
                    "Only PENDING records can be deleted."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        record.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if request.method in ["PUT", "PATCH"]:
        if record.status == DiseaseCase.DiseaseStatus.APPROVED:
            return Response(
                {"error": "Cannot modify a disease case that has already been approved."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = DiseaseCaseSerializer(
            record,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    # GET
    serializer = DiseaseCaseSerializer(record, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def review_disease_case(request, pk):
    """
    POST /diseases/cases/<pk>/review/
    Review and update the status of a disease case:
    - SIBAT: Can verify (status = VERIFIED)
    - MAO: Final municipal approval (status = APPROVED or SUBJECT_TO_REVISION)
    """
    record = get_object_or_404(DiseaseCase, pk=pk)
    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (VERIFIED, APPROVED, or SUBJECT_TO_REVISION)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", "")

    if role_name == "FARMER":
        raise PermissionDenied("Farmers are not authorized to review disease cases.")

    if role_name == "SIBAT":
        if new_status == DiseaseCase.DiseaseStatus.APPROVED:
            raise PermissionDenied(
                "SIBAT cooperative officers can only verify (status=VERIFIED). Final approval is reserved for MAO."
            )
        if new_status not in [DiseaseCase.DiseaseStatus.VERIFIED, DiseaseCase.DiseaseStatus.SUBJECT_TO_REVISION]:
            return Response(
                {"error": "Invalid status for SIBAT review. Valid choices are VERIFIED or SUBJECT_TO_REVISION."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    elif role_name == "MAO":
        if new_status not in DiseaseCase.DiseaseStatus.values:
            return Response(
                {"error": f"Invalid status '{new_status}'. Valid choices are: {list(DiseaseCase.DiseaseStatus.values)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        raise PermissionDenied("You do not have permission to review disease cases.")

    if "inspector_photo" in request.FILES:
        record.inspector_photo = request.FILES["inspector_photo"]
    record.status = new_status
    record.reviewed_by = user
    record.review_remarks = remarks
    record.reviewed_at = timezone.now()
    record.save()

    _notify_disease_case_review(record, new_status, remarks, user, role_name)

    serializer = DiseaseCaseSerializer(record, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


# ==============================================================================
# MORTALITY RECORD ENDPOINTS
# ==============================================================================

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def mortality_record_list_create(request):
    """
    GET  /diseases/mortality/ -> List mortality records (filtered by role)
    POST /diseases/mortality/ -> Log a new livestock mortality record
    """
    if request.method == "POST":
        serializer = MortalityRecordSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        _notify_mortality_record_created(instance, request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # GET
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        records = MortalityRecord.objects.filter(
            Q(created_by=user) | Q(livestock__farmer__user=user)
        ).distinct()
    else:
        # MAO, SIBAT: list all municipal mortality records
        records = MortalityRecord.objects.all()

    # Apply optional query param filters
    status_param = request.query_params.get("status")
    if status_param and status_param.upper() != "ALL":
        records = records.filter(status__iexact=status_param)

    livestock_param = request.query_params.get("livestock")
    if livestock_param:
        records = records.filter(livestock_id=livestock_param)

    disease_param = request.query_params.get("disease_case")
    if disease_param:
        records = records.filter(source_disease_case_id=disease_param)

    records = records.select_related(
        "livestock__farmer__user",
        "livestock__farmer__barangay",
        "livestock__livestock_type",
        "source_disease_case",
        "created_by",
        "reviewed_by",
    ).order_by("-record_date", "-created_at")

    serializer = MortalityRecordSerializer(records, many=True, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def mortality_record_detail(request, pk):
    """
    GET    /diseases/mortality/<pk>/ -> Retrieve single mortality record
    PUT    /diseases/mortality/<pk>/ -> Full update
    PATCH  /diseases/mortality/<pk>/ -> Partial update
    DELETE /diseases/mortality/<pk>/ -> Delete record (only PENDING allowed)
    """
    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", None)

    if role_name == "FARMER":
        record = get_object_or_404(MortalityRecord, pk=pk, created_by=user)
    else:
        record = get_object_or_404(MortalityRecord, pk=pk)

    if request.method == "DELETE":
        if record.status != MortalityRecord.MortalityRecordStatus.PENDING:
            return Response(
                {
                    "error": f"Cannot delete a mortality record with status '{record.status}'. "
                    "Only PENDING records can be deleted."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        record.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if request.method in ["PUT", "PATCH"]:
        if record.status == MortalityRecord.MortalityRecordStatus.APPROVED:
            return Response(
                {"error": "Cannot modify a mortality record that has already been approved."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = MortalityRecordSerializer(
            record,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    # GET
    serializer = MortalityRecordSerializer(record, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def review_mortality_record(request, pk):
    """
    POST /diseases/mortality/<pk>/review/
    Review and update the status of a mortality record:
    - SIBAT: Can verify on-farm (status = VERIFIED)
    - MAO: Final municipal approval (status = APPROVED or SUBJECT_TO_REVISION)
    """
    record = get_object_or_404(MortalityRecord, pk=pk)
    new_status = request.data.get("status")
    remarks = request.data.get("remarks", "")

    if not new_status:
        return Response(
            {"error": "status is required (VERIFIED, APPROVED, or SUBJECT_TO_REVISION)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user
    role_name = getattr(getattr(user, "role", None), "role_name", "")

    if role_name == "FARMER":
        raise PermissionDenied("Farmers are not authorized to review mortality records.")

    if role_name == "SIBAT":
        if new_status == MortalityRecord.MortalityRecordStatus.APPROVED:
            raise PermissionDenied(
                "SIBAT cooperative officers can only verify (status=VERIFIED). Final approval is reserved for MAO."
            )
        if new_status not in [MortalityRecord.MortalityRecordStatus.VERIFIED, MortalityRecord.MortalityRecordStatus.SUBJECT_TO_REVISION]:
            return Response(
                {"error": "Invalid status for SIBAT review. Valid choices are VERIFIED or SUBJECT_TO_REVISION."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    elif role_name == "MAO":
        if new_status not in MortalityRecord.MortalityRecordStatus.values:
            return Response(
                {"error": f"Invalid status '{new_status}'. Valid choices are: {list(MortalityRecord.MortalityRecordStatus.values)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        raise PermissionDenied("You do not have permission to review mortality records.")

    if "inspector_photo" in request.FILES:
        record.inspector_photo = request.FILES["inspector_photo"]
    record.status = new_status
    record.reviewed_by = user
    record.review_remarks = remarks
    record.reviewed_at = timezone.now()
    record.save()

    _notify_mortality_record_review(record, new_status, remarks, user, role_name)

    serializer = MortalityRecordSerializer(record, context={"request": request})
    return Response(serializer.data, status=status.HTTP_200_OK)
