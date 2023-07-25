import { sparqlEscapeUri } from 'mu';
import { updateSudo as update } from '@lblod/mu-auth-sudo';
import fs from 'fs/promises';
import * as env from 'env-var';

/**
 * Deletes a file in the triplestore and on disk
 */
export async function deleteFile(uri, graph) {
  const path = uri.replace('share://', '/share/');

  try {
    await fs.unlink(path);
  } catch (e) {
    console.log(`Failed to delete file <${uri}> on disk: \n ${e}`);
    throw e;
  }

  try {
    await update(`
      PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
      PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
      PREFIX dct: <http://purl.org/dc/terms/>
      PREFIX dbpedia: <http://dbpedia.org/ontology/>
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>

      DELETE WHERE {
        GRAPH ${sparqlEscapeUri(graph)} {
          ${sparqlEscapeUri(uri)} ?p ?o .
        }
      }`);
  } catch (e) {
    console.log(
      `Failed to delete TTL resource <${uri}> in triplestore: \n ${e}`,
    );
    throw e;
  }
}
