import {sparqlEscapeString, sparqlEscapeUri} from 'mu';
import {querySudo} from '@lblod/mu-auth-sudo';
import {deleteFile, FILE_GRAPH} from "./file-helpers";

const SENT_STATUS = 'http://lblod.data.gift/concepts/9bd8d86d-bb10-4456-a84e-91e9507c374c';

const FORM_DATA_FILE_TYPE = 'http://data.lblod.gift/concepts/form-data-file-type';
const ADDITIONS_FILE_TYPE = 'http://data.lblod.gift/concepts/additions-file-type';
const REMOVALS_FILE_TYPE = 'http://data.lblod.gift/concepts/removals-file-type';
const META_FILE_TYPE = 'http://data.lblod.gift/concepts/meta-file-type';

/**
 * Delete a submission resources and properties. Deletes everything it encounters
 *
 * @param uuid - submission-document to be deleted
 */
export async function deleteSubmission(uuid) {
  const result = await getSubmissionById(uuid);

  if (result) {

    const {submissionDocumentURI, submissionURI, formDataURI, taskURI, status} = result;
    if (status !== SENT_STATUS) {

      // if not a auto-submission, nothing was harvested
      if(taskURI) await deleteHarvestedFiles(submissionURI);

      if(formDataURI) await deleteUploadedFiles(formDataURI);
      if(submissionDocumentURI) await deleteLinkedTTLFiles(submissionDocumentURI);

      // if not a auto-submission, no task was created
      if (taskURI) await deleteResource(taskURI);

      if(formDataURI) await deleteResource(formDataURI);
      if(submissionDocumentURI) await deleteResource(submissionDocumentURI);

      await deleteResource(submissionURI);
      return {message: `successfully deleted submission <${submissionURI}>.`};
    }
    return {
      uri: submissionDocumentURI,
      error: {
        status: 409,
        message: `Could not delete submission <${submissionURI}>, has already been sent`
      }
    };
  }
  return {error: {status: 404, message: `Could not find a submission for uuid '${uuid}'`}};
}

/*
 * Private
 */

async function deleteHarvestedFiles(uri){
  const files = await getHarvestedFiles(uri);
  for (let file of files) {
    await deleteFile(file.parent);
    await deleteFile(file.location);
    await deleteResource(file.location);
    await deleteResource(file.file);
  }
}

/**
 * Deletes all the linked files for the given resource.
 *
 * @param uri of the resource to delete the linked files for
 */
async function deleteUploadedFiles(uri) {
  const files = await getUploadedFiles(uri);
  for (let file of files) {
    await deleteFile(file.location);
    await deleteResource(file.file);
    await deleteResource(file.location);
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
 * Retrieves all the uploaded files linked to the given resource (form-data).
 *
 * @param uri of the resource.
 */
async function getUploadedFiles(uri) {
  const result = await querySudo(`
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

    SELECT DISTINCT ?file ?location ?parent
    WHERE {
        ${sparqlEscapeUri(uri)} dct:hasPart ?file .
        ?location nie:dataSource ?file .
        OPTIONAL {?parent nie:dataSource ?location .}
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
    console.log(`Could not find any uploaded files for resource <${uri}>`);
    return [];
  }
}

/**
 * Retrieves all the uploaded files linked to the given resource (submission).
 *
 * @param uri of the resource.
 */
async function getHarvestedFiles(uri) {
  const result = await querySudo(`
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

    SELECT DISTINCT ?file ?location ?parent
    WHERE {
        ${sparqlEscapeUri(uri)} nie:hasPart ?file .
        ?location nie:dataSource ?file .
        ?parent nie:dataSource ?location .
    }
  `)

  if (result.results.bindings.length) {
    return result.results.bindings.map(binding => {
      return {
        file: binding['file'].value,
        location: binding['location'].value,
        parent: binding['parent'].value
      }
    });
  } else {
    console.log(`Could not find any harvested files for resource <${uri}>`);
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

    SELECT DISTINCT ?file
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

async function getSubmissionById(submissionId){
  const q = `
    PREFIX meb: <http://rdf.myexperiment.org/ontologies/base/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX prov: <http://www.w3.org/ns/prov#>
    PREFIX melding: <http://lblod.data.gift/vocabularies/automatische-melding/>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX adms: <http://www.w3.org/ns/adms#>

    SELECT DISTINCT ?submission ?formData ?submissionTask ?submissionDocument ?status WHERE {

      GRAPH ?g {
       ?submission a meb:Submission;
          mu:uuid ${sparqlEscapeString(submissionId)};
          adms:status ?status.

       OPTIONAL {
         ?submission prov:generated ?formData.
         ?formData a melding:FormData.
       }

       OPTIONAL {
         ?submissionTask a melding:AutomaticSubmissionTask.
         ?submissionTask prov:generated ?submission.
       }

       OPTIONAL {
         ?submission dct:subject ?submissionDocument.
         ?submissionDocument a ext:SubmissionDocument.
       }
      }
    }
  `;

  const result = await querySudo(q);

  if (result.results.bindings.length) {
    return {
      submissionDocumentURI: (result.results.bindings[0]['submissionDocument'] || {}).value,
      submissionURI: (result.results.bindings[0]['submission'] || {}).value,
      formDataURI: (result.results.bindings[0]['formData'] || {}).value,
      status: (result.results.bindings[0]['status'] || {}).value,
      taskURI: (result.results.bindings[0]['submissionTask'] || {}).value
    };
  }
  else {
    return null;
  }
}
