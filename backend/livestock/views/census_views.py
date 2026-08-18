from rest_framework.decorators import api_view
from rest_framework.response import Response
from livestock.serializer import CensusSubmissionSerializer


@api_view(["POST"])
def create_census_submission(request):
    serializer = CensusSubmissionSerializer(
        data=request.data,
        context={"request": request}
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=201)
