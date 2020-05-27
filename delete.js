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
  const submissionDoc = await getSubmissionDocumentById(uuid);

  if (submissionDoc) {
    if (submissionDoc.status !== SENT_STATUS) {

      await deleteLinkedFiles(submissionDoc);
      await deleteLinkedTTL(submissionDoc.URI);

      if (submissionDoc.taskURI) await deleteSubmissionResource(submissionDoc.taskURI);
      await deleteSubmissionResource(submissionDoc.formDataURI);
      await deleteSubmissionResource(submissionDoc.submissionURI);
      await deleteSubmissionResource(submissionDoc.URI);
      return {URI: submissionDoc.URI}
    }
    return {
      URI: submissionDoc.URI,
      error: {
        status: 409,
        message: `Could not delete submission-document <${submissionDoc.URI}>, has already been sent`
      }
    }
  }
  return {error: {status: 404, message: `Could not find a submission-document for uuid '${uuid}'`}}
}

/*
 * Private
 */

/**
 * Retrieves submission-documents details/properties based on the given uuid.
 *
 * @param uuid submission-document to retrieve
 */
async function getSubmissionDocumentById(uuid) {
  const result = await querySudo(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX prov: <http://www.w3.org/ns/prov#>

    SELECT ?URI ?submissionURI ?status ?formDataURI ?taskURI
    WHERE {
      GRAPH ?g {
        ?URI mu:uuid ${sparqlEscapeString(uuid)} .
        ?submissionURI dct:subject ?URI ;
                    adms:status ?status ;
                    prov:generated ?formDataURI .
        OPTIONAL { ?taskURI prov:generated ?submissionURI . }
      }
    }
  `);

  if (result.results.bindings.length) {
    return {
      URI: result.results.bindings[0]['URI'].value,
      submissionURI: result.results.bindings[0]['submissionURI'].value,
      status: result.results.bindings[0]['status'].value,
      formDataURI: result.results.bindings[0]['formDataURI'].value,
      taskURI: result.results.bindings[0]['taskURI'] ? result.results.bindings[0]['taskURI'].value : null
    };
  } else {
    return null;
  }
}

/**
 * Deletes all the linked files for the given submission-document.
 *
 * @param submissionDoc submission-document to delete the linked files for
 */
async function deleteLinkedFiles(submissionDoc) {
  // TODO does not seem correct
  const files = await getFileResources(submissionDoc.URI);
  for (let file of files) {
    await deleteFile(file);
  }
}

/**
 * Deletes all the linked ttl files for the given URI (submission-document).
 *
 * @param URI resource (submission-document) to delete the linked ttl files for
 */
async function deleteLinkedTTL(URI) {
  const additionsFile = await getTTLResource(URI, ADDITIONS_FILE_TYPE);
  const removalsFile = await getTTLResource(URI, REMOVALS_FILE_TYPE);
  const metaFile = await getTTLResource(URI, META_FILE_TYPE);
  const sourceFile = await getTTLResource(URI, FORM_DATA_FILE_TYPE);

  if (additionsFile) await deleteFile(additionsFile);
  if (removalsFile) await deleteFile(removalsFile);
  if (metaFile) await deleteFile(metaFile);
  if (sourceFile) await deleteFile(sourceFile);
}

/**
 * Retrieves all the file resources linked to the given resource.
 *
 * @param URI of the resource.
 */
async function getFileResources(URI) {
  const result = await querySudo(`
    PREFIX dct: <http://purl.org/dc/terms/>

    SELECT ?file
    WHERE {
     GRAPH ?g {
        ${sparqlEscapeUri(URI)} dct:hasPart ?file .
     }
    }
  `)

  if (result.results.bindings.length) {
    return result.results.bindings.map(binding => binding['file'].value);
  } else {
    console.log(`Could not find any linked files for submission-document <${URI}>`);
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
async function deleteSubmissionResource(URI) {
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