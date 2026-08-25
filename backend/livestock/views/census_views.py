from rest_framework.decorators import api_view
from rest_framework.response import Response
from livestock.serializer import CensusSubmissionSerializer
from livestock.models import CensusSubmission
from livestock.services import CensusService


@api_view(["POST"])
def create_census_submission(request):
    serializer = CensusSubmissionSerializer(
        data=request.data,
    )

    serializer.is_valid(raise_exception=True)
    validated_data = serializer.validated_data
    assert isinstance(
        validated_data, dict
    )  # because pyright have no knowledge if validated_data is dict, it could be list or empty

    submission = CensusService.create_census_submission(
        user=request.user,
        barangay=validated_data["barangay"],
        report_year=validated_data["report_year"],
        report_quarter=validated_data["report_quarter"],
        items=validated_data.get("items", []),
    )

    response_serializer = CensusSubmissionSerializer(submission)

    return Response(response_serializer.data, status=201)


@api_view(["GET"])
def get_census_submissions(request):
    submissions = CensusSubmission.objects.all().order_by(
        "-submission_date"
    )  # '-' meaning in descending order
    serializer = CensusSubmissionSerializer(
        submissions, many=True
    )  # serialize submissions
    return Response(serializer.data, status=200)
