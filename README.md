# clean-up-submission-service

Microservice responsible for removing/cleaning-up submissions

## Installation

To add the service to your stack, add the following snippet to docker-compose.yml:

```
services:
  remove-submission:
    image: lblod/remoce-submission-service:x.x.x
  volumes:
    - ./data/files:/share
```
The volume mounted in /share must contain the cached downloads of the published documents.

## Configuration

### Environment variables

- FILE_GRAPH: graph that contains the files. Default to http://mu.semte.ch/graphs/public'.
   
## REST API

### DELETE /submission-documents/:uuid

Deletes the given submission-document.

Return 200 OK when the submission-document was deleted.

Returns 409 CONFLICT when the submission-document could not be removed.

Return 404 NOT FOUND when the submission-document could not be found.

Returns 500 INTERNAL SERVER ERROR when something unexpected happened while processing the submission-document.
