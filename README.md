# clean-up-submission-service

Microservice responsible for removing/cleaning-up submissions

## Installation

To add the service to your stack, add the following snippet to
docker-compose.yml:

```
services:
  remove-submission:
    image: lblod/clean-up-submission-service:x.x.x
  volumes:
    - ./data/files:/share
```

The volume mounted in `/share` must contain the cached downloads of the published
documents.

## Configuration

## REST API

### DELETE /submissions/:uuid

Deletes/cleans-up the given submission.

* `200 OK` when the submission-document was deleted.

* `409 CONFLICT` when the submission-document could not be removed.

* `404 NOT FOUND` when the submission-document could not be found.

* `500 INTERNAL SERVER ERROR` when something unexpected happened while
  processing the submission-document.
