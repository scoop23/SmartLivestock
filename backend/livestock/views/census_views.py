from rest_framework.decorators import api_view
from rest_framework.response import Response
from livestock.serializer import CensusSubmissionSerializer
from livestock.models import CensusSubmission
from livestock.services import CensusService


@api_view(["POST"])
def create_census_submission(request):
    serializer = CensusSubmissionSerializer(
        data=request.data, context={"request": request}
    )

    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=201)


@api_view(["GET"])
def get_census_submissions(request):
    submissions = CensusSubmission.objects.all().order_by(
        "-submission_date"
    )  # '-' meaning in descending order
    serializer = CensusSubmissionSerializer(
        submissions, many=True
    )  # serialize submissions
    return Response(serializer.data)
