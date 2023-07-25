import { sparqlEscapeString, sparqlEscapeUri } from 'mu';
import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';
import { deleteFile } from './file-helpers';
import { SparqlJsonParser } from 'sparqljson-parse';
import * as env from 'env-var';

const GRAPH_TEMPLATE = env
  .get('GRAPH_TEMPLATE')
  .example(
    'http://mu.semte.ch/graphs/organizations/~ORGANIZATION_ID~/LoketLB-toezichtGebruiker',
  )
  .default(
    'http://mu.semte.ch/graphs/organizations/~ORGANIZATION_ID~/LoketLB-toezichtGebruiker',
  )
  .asUrlString();

(function checkEnvVars() {
  if (!/~ORGANIZATION_ID~/g.test(GRAPH_TEMPLATE))
    throw new Error(
      `The GRAPH_TEMPLATE environment variable ${GRAPH_TEMPLATE} does not contain a ~ORGANIZATION_ID~.`,
    );
})();

const SENT_STATUS =
  'http://lblod.data.gift/concepts/9bd8d86d-bb10-4456-a84e-91e9507c374c';

const FORM_DATA_FILE_TYPE =
  'http://data.lblod.gift/concepts/form-data-file-type';
const ADDITIONS_FILE_TYPE =
  'http://data.lblod.gift/concepts/additions-file-type';
const REMOVALS_FILE_TYPE = 'http://data.lblod.gift/concepts/removals-file-type';
const META_FILE_TYPE = 'http://data.lblod.gift/concepts/meta-file-type';

/**
 * Delete a submission resources and properties. Deletes everything it
 * encounters
 *
 * @public
 * @async
 * @function
 * @param {String} uuid - submission-document to be deleted
 * @returns {Object} Object with optional `message` (string), `uri` (string)
 * and `error` (object). The `error` object has `status` (integer) and
 * `message` (string) properties.
 */
export async function deleteSubmission(uuid) {
  const organisationId = await getOrganisationIdFromSubmission(uuid);
  const submissionGraph = GRAPH_TEMPLATE.replace(
    '~ORGANIZATION_ID~',
    organisationId,
  );
  const submissionInfo = await getSubmissionById(uuid, submissionGraph);

  if (submissionInfo) {
    const {
      submissionDocumentURI,
      submissionURI,
      formDataURI,
      taskURI,
      status,
    } = submissionInfo;
    if (status !== SENT_STATUS) {
      // if not a auto-submission, nothing was harvested
      if (taskURI) await deleteHarvestedFiles(submissionURI, submissionGraph);

      if (formDataURI) await deleteUploadedFiles(formDataURI, submissionGraph);
      if (submissionDocumentURI)
        await deleteLinkedTTLFiles(submissionDocumentURI, submissionGraph);

      // if not a auto-submission, no task was created
      if (taskURI) await deleteTaskwithJob(taskURI, submissionGraph);

      if (formDataURI) await deleteResource(formDataURI, submissionGraph);
      if (submissionDocumentURI)
        await deleteResource(submissionDocumentURI, submissionGraph);

      await deleteResource(submissionURI, submissionGraph);
      return { message: `successfully deleted submission <${submissionURI}>.` };
    }
    return {
      uri: submissionDocumentURI,
      error: {
        status: 409,
        message: `Could not delete submission <${submissionURI}>, has already been sent`,
      },
    };
  }
  return {
    error: {
      status: 404,
      message: `Could not find a submission for uuid '${uuid}'`,
    },
  };
}

/*
 * Private
 */

async function deleteHarvestedFiles(uri, graph) {
  const files = await getHarvestedFiles(uri, graph);
  for (const file of files) {
    await deleteFile(file.parent, graph);
    await deleteFile(file.location, graph);
    await deleteResource(file.location, graph);
    await deleteResource(file.file, graph);
  }
}

/**
 * Deletes all the linked files for the given resource.
 *
 * @param uri of the resource to delete the linked files for
 */
async function deleteUploadedFiles(uri, graph) {
  const files = await getUploadedFiles(uri, graph);
  for (const file of files) {
    await deleteFile(file.location, graph);
    await deleteResource(file.file, graph);
    await deleteResource(file.location, graph);
  }
}

/**
 * Deletes all the linked ttl files for the given URI (submission-document).
 *
 * @param uri resource (submission-document) to delete the linked ttl files for
 */
async function deleteLinkedTTLFiles(uri, graph) {
  const additionsFile = await getTTLResource(uri, ADDITIONS_FILE_TYPE, graph);
  const removalsFile = await getTTLResource(uri, REMOVALS_FILE_TYPE, graph);
  const metaFile = await getTTLResource(uri, META_FILE_TYPE, graph);
  const sourceFile = await getTTLResource(uri, FORM_DATA_FILE_TYPE, graph);

  if (additionsFile) await deleteFile(additionsFile, graph);
  if (removalsFile) await deleteFile(removalsFile, graph);
  if (metaFile) await deleteFile(metaFile, graph);
  if (sourceFile) await deleteFile(sourceFile, graph);
}

/**
 * Retrieves all the uploaded files linked to the given resource (form-data).
 *
 * @param uri of the resource.
 */
async function getUploadedFiles(uri, graph) {
  const response = await querySudo(`
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

    SELECT DISTINCT ?file ?location ?parent
    WHERE {
      GRAPH ${sparqlEscapeUri(graph)} {
        ${sparqlEscapeUri(uri)} dct:hasPart ?file .
        ?location nie:dataSource ?file .
        OPTIONAL {?parent nie:dataSource ?location .}
      }
    }
  `);

  const parser = new SparqlJsonParser();
  const parsedResults = parser.parseJsonResults(response);
  if (parsedResults.length < 1)
    console.log(`Could not find any uploaded files for resource <${uri}>`);
  return parsedResults.map((binding) => {
    return {
      file: binding?.file?.value,
      location: binding?.location?.value,
    };
  });
}

/**
 * Retrieves all the uploaded files linked to the given resource (submission).
 *
 * @param uri of the resource.
 */
async function getHarvestedFiles(uri, graph) {
  const response = await querySudo(`
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

    SELECT DISTINCT ?file ?location ?parent
    WHERE {
      GRAPH ${sparqlEscapeUri(graph)} {
        ${sparqlEscapeUri(uri)} nie:hasPart ?file .
        ?location nie:dataSource ?file .
        ?parent nie:dataSource ?location .
      }
    }
  `);

  const parser = new SparqlJsonParser();
  const parsedResults = parser.parseJsonResults(response);
  if (parsedResults.length < 1)
    console.log(`Could not find any harvested files for resource <${uri}>`);
  return parsedResults.map((binding) => {
    return {
      file: binding?.file?.value,
      location: binding?.location?.value,
      parent: binding?.parent?.value,
    };
  });
}

/**
 * Get the file resource in the triplestore of the given file type that is related to the given submission document
 *
 * @param {string} submissionDocument URI of the submitted document to get the related file for
 * @param {string} fileType URI of the type of the related file
 */
async function getTTLResource(submissionDocument, fileType, graph) {
  const response = await querySudo(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

    SELECT DISTINCT ?file
    WHERE {
      GRAPH ${sparqlEscapeUri(graph)} {
        ${sparqlEscapeUri(submissionDocument)} dct:source ?file .
        ?file dct:type ${sparqlEscapeUri(fileType)} .
      }
    } LIMIT 1
  `);

  const parser = new SparqlJsonParser();
  const parsedResults = parser.parseJsonResults(response);
  if (parsedResults.length < 1)
    console.log(
      `Part of type ${fileType} for submission document ${submissionDocument} not found`,
    );
  return parsedResults[0]?.file?.value;
}

/**
 * Delete submission resource
 *
 * @param {string} URI of the resource to delete the related files for
 */
async function deleteResource(uri, graph) {
  return updateSudo(`
    DELETE {
      GRAPH ${sparqlEscapeUri(graph)} {
        ${sparqlEscapeUri(uri)} ?p ?o .
      }
    }
    WHERE {
      GRAPH ${sparqlEscapeUri(graph)} {
        ${sparqlEscapeUri(uri)} ?p ?o .
      }
    }
  `);
}

async function deleteTaskwithJob(taskUri, graph) {
  return updateSudo(`
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>

    DELETE {
      GRAPH ${sparqlEscapeUri(graph)} {
        ?hc2 ?hp2 ?ho2 .
        ?hc ?hp ?ho .
        ?rc ?rp ?ro .
        ?ic ?ip ?io .
        ?task ?tp ?to .
        ?job ?jp ?jo .
      }
    } WHERE {
      GRAPH ${sparqlEscapeUri(graph)} {
        ${sparqlEscapeUri(taskUri)} dct:isPartOf ?job .
        ?job ?jp ?jo .
        ?task
          dct:isPartOf ?job ;
          ?tp ?to .

        OPTIONAL {
          ?task task:inputContainer ?ic .
          ?ic ?ip ?io .
        }
        OPTIONAL {
          ?task task:resultsContainer ?rc .
          ?rc ?rp ?ro .
        }

        OPTIONAL {
          ?ic task:hasHarvestingCollection ?hc .
          ?hc ?hp ?ho .
        }

        OPTIONAL {
          ?rc task:hasHarvestingCollection ?hc2 .
          ?hc2 ?hp2 ?ho2 .
        }
      }
    }
  `);
}

async function getSubmissionById(submissionId, graph) {
  const infoQuery = `
    PREFIX meb: <http://rdf.myexperiment.org/ontologies/base/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX prov: <http://www.w3.org/ns/prov#>
    PREFIX melding: <http://lblod.data.gift/vocabularies/automatische-melding/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>
    PREFIX taskO: <http://lblod.data.gift/id/jobs/concept/TaskOperation/>

    SELECT DISTINCT ?submission ?formData ?submissionTask ?submissionDocument ?status
    WHERE {
      GRAPH ${sparqlEscapeUri(graph)} {
        ?submission a meb:Submission;
           mu:uuid ${sparqlEscapeString(submissionId)};
           adms:status ?status.

        OPTIONAL {
          ?submission prov:generated ?formData.
          ?formData a melding:FormData.
        }

        OPTIONAL {
          ?submissionTask
            a task:Task ;
            task:operation taskO:register ;
            dct:isPartOf ?job .
          ?job prov:generated ?submission.
        }

        OPTIONAL {
          ?submission dct:subject ?submissionDocument.
          ?submissionDocument a ext:SubmissionDocument.
        }
      }
    } LIMIT 1
  `;

  const response = await querySudo(infoQuery);
  const parser = new SparqlJsonParser();
  const parsedResults = parser.parseJsonResults(response);
  if (parsedResults.length > 0) {
    const firstResult = parsedResults[0];
    return {
      submissionDocumentURI: firstResult?.submissionDocument?.value,
      submissionURI: firstResult?.submission?.value,
      formDataURI: firstResult?.formData?.value,
      status: firstResult?.status?.value,
      taskURI: firstResult?.submissionTask?.value,
    };
  }
}

async function getOrganisationIdFromSubmission(submissionUuid) {
  const response = await querySudo(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX prov: <http://www.w3.org/ns/prov#>
    PREFIX pav:  <http://purl.org/pav/>

    SELECT DISTINCT ?organisationId WHERE {
      ?submission mu:uuid ${sparqlEscapeString(submissionUuid)} .
      ?job prov:generated ?submission .
      ?submission pav:createdBy ?bestuurseenheid .
      ?bestuurseenheid mu:uuid ?organisationId .
    }
    LIMIT 1
  `);
  return response?.results?.bindings[0]?.organisationId?.value;
}
