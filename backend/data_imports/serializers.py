from rest_framework import serializers
from .models import DataImportBatch


class DataImportBatchSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    dataset_type_display = serializers.CharField(source="get_dataset_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = DataImportBatch
        fields = [
            "id",
            "dataset_type",
            "dataset_type_display",
            "file_name",
            "uploaded_by",
            "uploaded_by_name",
            "uploaded_at",
            "status",
            "status_display",
            "target_status",
            "total_rows",
            "valid_rows",
            "imported_rows",
            "skipped_rows",
            "error_rows",
            "error_log",
            "completed_at",
            "duration_seconds",
            "notes",
        ]
        read_only_fields = fields

    def get_uploaded_by_name(self, obj) -> str:
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return "Unknown"


class ValidateImportRequestSerializer(serializers.Serializer):
    dataset_type = serializers.ChoiceField(choices=DataImportBatch.DatasetType.choices)
    file = serializers.FileField()


class ExecuteImportRequestSerializer(serializers.Serializer):
    dataset_type = serializers.ChoiceField(choices=DataImportBatch.DatasetType.choices)
    file = serializers.FileField()
    skip_duplicates = serializers.BooleanField(default=True)
    target_status = serializers.ChoiceField(
        choices=DataImportBatch.TargetStatus.choices,
        default=DataImportBatch.TargetStatus.APPROVED,
    )
