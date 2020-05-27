import {sparqlEscapeString, sparqlEscapeUri} from 'mu';
import {querySudo} from '@lblod/mu-auth-sudo';
import {deleteFile, FILE_GRAPH} from "./file-helpers";

const SENT_STATUS = 'http://lblod.data.gift/concepts/9bd8d86d-bb10-4456-a84e-91e9507c374c';

const FORM_DATA_FILE_TYPE = 'http://data.lblod.gift/concepts/form-data-file-type';
const ADDITIONS_FILE_TYPE = 'http://data.lblod.gift/concepts/additions-file-type';
const REMOVALS_FILE_TYPE = 'http://data.lblod.gift/concepts/removals-file-type';
const META_FILE_TYPE = 'http://data.lblod.gift/concepts/meta-file-type';

/**
 * Delete a submission-documents resources and properties.
 *
 * @param uuid - submission-document to be deleted
 */
export async function deleteSubmissionDocument(uuid) {
  const result = await getSubmissionResourcesById(uuid);

  if (result) {
    const {submissionDocumentURI, submissionURI, formDataURI, taskURI, status} = result;
    if (status !== SENT_STATUS) {
      // TODO if task, delete harvested
      await deleteUploadedFiles(formDataURI);
      await deleteLinkedTTLFiles(submissionDocumentURI);

      // if not a auto-submission, no task was created
      if (taskURI) await deleteResource(taskURI);

      await deleteResource(formDataURI);
      await deleteResource(submissionURI);
      await deleteResource(submissionDocumentURI);
      return {message: `successfully deleted submission-document <${submissionDocumentURI}>.`};
    }
    return {
      uri: submissionDocumentURI,
      error: {
        status: 409,
        message: `Could not delete submission-document <${submissionDocumentURI}>, has already been sent`
      }
    }
  }
  return {error: {status: 404, message: `Could not find a submission-document for uuid '${uuid}'`}}
}

/*
 * Private
 */

/**
 * Retrieves all the submission resources (URI's) that should be processed for deletion.
 *
 * @param uuid of a submission-document to be deleted
 */
async function getSubmissionResourcesById(uuid) {
  const result = await querySudo(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX prov: <http://www.w3.org/ns/prov#>

    SELECT ?submissionDocumentURI ?submissionURI ?formDataURI ?taskURI ?status
    WHERE {
      GRAPH ?g {
        ?submissionDocumentURI mu:uuid ${sparqlEscapeString(uuid)} .
        ?submissionURI dct:subject ?submissionDocumentURI ;
                    adms:status ?status ;
                    prov:generated ?formDataURI .
        OPTIONAL { ?taskURI prov:generated ?submissionURI . }
      }
    }
  `);

  if (result.results.bindings.length) {
    return {
      submissionDocumentURI: result.results.bindings[0]['submissionDocumentURI'].value,
      submissionURI: result.results.bindings[0]['submissionURI'].value,
      formDataURI: result.results.bindings[0]['formDataURI'].value,
      status: result.results.bindings[0]['status'].value,
      taskURI: result.results.bindings[0]['taskURI'] ? result.results.bindings[0]['taskURI'].value : null
    };
  } else {
    return null;
  }
}

/**
 * Deletes all the linked files for the given resource.
 *
 * @param uri of the resource to delete the linked files for
 */
async function deleteUploadedFiles(uri) {
  const files = await getFileResources(uri);
  for (let file of files) {
    await deleteFile(file.location);
    await deleteResource(file.file);
  }
}

/**
 * Deletes all the linked ttl files for the given URI (submission-document).
 *
 * @param uri resource (submission-document) to delete the linked ttl files for
 */
async function deleteLinkedTTLFiles(uri) {
  const additionsFile = await getTTLResource(uri, ADDITIONS_FILE_TYPE);
  const removalsFile = await getTTLResource(uri, REMOVALS_FILE_TYPE);
  const metaFile = await getTTLResource(uri, META_FILE_TYPE);
  const sourceFile = await getTTLResource(uri, FORM_DATA_FILE_TYPE);

  if (additionsFile) await deleteFile(additionsFile);
  if (removalsFile) await deleteFile(removalsFile);
  if (metaFile) await deleteFile(metaFile);
  if (sourceFile) await deleteFile(sourceFile);
}

/**
 * Retrieves all the file resources linked to the given resource.
 *
 * @param uri of the resource.
 */
async function getFileResources(uri) {
  // TODO this does not work, for some reason after opening a form in the front-end this link is removed in the db
  const result = await querySudo(`
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

    SELECT ?file ?location
    WHERE {
        ${sparqlEscapeUri(uri)} dct:hasPart ?file .
        ?location nie:dataSource ?file .
    }
  `)

  if (result.results.bindings.length) {
    return result.results.bindings.map(binding => {
      return {
        file: binding['file'].value,
        location: binding['location'].value
      }
    });
  } else {
    console.log(`Could not find any linked files for submission-document <${uri}>`);
    return [];
  }
}

/**
 * Get the file resource in the triplestore of the given file type that is related to the given submission document
 *
 * @param {string} submissionDocument URI of the submitted document to get the related file for
 * @param {string} fileType URI of the type of the related file
 */
async function getTTLResource(submissionDocument, fileType) {
  const result = await querySudo(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

    SELECT ?file
    WHERE {
      GRAPH ?g {
        ${sparqlEscapeUri(submissionDocument)} dct:source ?file .
      }
      GRAPH ${sparqlEscapeUri(FILE_GRAPH)} {
        ?file dct:type ${sparqlEscapeUri(fileType)} .
      }
    }
  `);

  if (result.results.bindings.length) {
    return result.results.bindings[0]['file'].value;
  } else {
    console.log(`Part of type ${fileType} for submission document ${submissionDocument} not found`);
    return null;
  }
}

/**
 * Delete submission resource
 *
 * @param {string} URI of the resource to delete the related files for
 */
async function deleteResource(URI) {
  const result = await querySudo(`
    DELETE {
      GRAPH ?g {
        ${sparqlEscapeUri(URI)} ?p ?o .
      }
    }
    WHERE {
      GRAPH ?g {
        ${sparqlEscapeUri(URI)} ?p ?o .
      }
    }
  `);
}