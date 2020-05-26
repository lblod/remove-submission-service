import {querySudo, updateSudo} from '@lblod/mu-auth-sudo';
import {deleteTTL} from "./file-helpers";

const SENT_STATUS = 'http://lblod.data.gift/concepts/9bd8d86d-bb10-4456-a84e-91e9507c374c';

const FORM_DATA_FILE_TYPE = 'http://data.lblod.gift/concepts/form-data-file-type';
const ADDITIONS_FILE_TYPE = 'http://data.lblod.gift/concepts/additions-file-type';
const REMOVALS_FILE_TYPE = 'http://data.lblod.gift/concepts/removals-file-type';
const META_FILE_TYPE = 'http://data.lblod.gift/concepts/meta-file-type';

// TODO
export async function deleteSubmissionDocument(uuid) {
  const submissionDoc = await getSubmissionDocumentById(uuid);

  if (submissionDoc) {
    if (submissionDoc.status !== SENT_STATUS) {
      // TODO delete all files on the predicate "dct:hasPart"

      // TODO delete all (meta)-files on predicate "dct:source"
      await deleteLinkedTTL(submissionDoc.URI);

      // TODO delete linked AutoSubmissionTask -> Submission

      // TODO delete the SubmittedDocument
    }
    return {status: 409, message: `Could not delete submission-document <${submissionDoc.URI}>, has already been sent`}
  }
  return {status: 404, message: `Could not find a submission-document for uuid '${uuid}'`}
}

/*
 * Private
 */

// TODO
async function getSubmissionDocumentById(uuid) {
  const result = await querySudo(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX adms: <http://www.w3.org/ns/adms#>

    SELECT ?submissionDocument ?status
    WHERE {
      GRAPH ?g {
        ?submissionDocument mu:uuid ${sparqlEscapeString(uuid)} .
        ?submission dct:subject ?submissionDocument ;
                    adms:status ?status .
      }
    }
  `);

  if (result.results.bindings.length) {
    return {
      URI: result.results.bindings[0]['submissionDocument'].value,
      status: result.results.bindings[0]['status'].value
    };
  } else {
    return null;
  }
}

// TODO
async function deleteLinkedTTL(URI) {
  const additionsFile = await getFileResource(URI, ADDITIONS_FILE_TYPE);
  const removalsFile = await getFileResource(URI, REMOVALS_FILE_TYPE);
  const metaFile = await getFileResource(URI, META_FILE_TYPE);
  const sourceFile = await getFileResource(URI, FORM_DATA_FILE_TYPE);

  if (additionsFile) await deleteTTL(additionsFile);
  if (removalsFile) await deleteTTL(removalsFile);
  if (metaFile) await deleteTTL(metaFile);
  if (sourceFile) await deleteTTL(sourceFile);
}

/**
 * Get the file resource in the triplestore of the given file type that is related to the given submission document
 *
 * @param {string} submissionDocument URI of the submitted document to get the related file for
 * @param {string} fileType URI of the type of the related file
 * @return {string} File full name (path, name and extention)
 */
async function getFileResource(submissionDocument, fileType) {
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