import { updateSudo } from '@lblod/mu-auth-sudo';
import {
  uuid,
  sparqlEscapeString,
  sparqlEscapeDateTime,
  sparqlEscapeUri,
} from 'mu';

const CREATOR = 'http://lblod.data.gift/services/clean-up-submission-service';

export async function sendErrorAlert({ message, detail, reference }) {
  if (!message) throw 'Error needs a message describing what went wrong.';
  const id = uuid();
  const uri = `http://data.lblod.info/errors/${id}`;
  const referenceTriple = reference
    ? `${sparqlEscapeUri(uri)}
         dct:references ${sparqlEscapeUri(reference)} .`
    : '';
  const detailTriple = detail
    ? `${sparqlEscapeUri(uri)}
         oslc:largePreview ${sparqlEscapeString(detail)} .`
    : '';
  const q = `
    PREFIX mu:   <http://mu.semte.ch/vocabularies/core/>
    PREFIX oslc: <http://open-services.net/ns/core#>      
    PREFIX dct:  <http://purl.org/dc/terms/>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    
    INSERT DATA {
      GRAPH <http://mu.semte.ch/graphs/error> {
        ${sparqlEscapeUri(uri)}
          a oslc:Error ;
          mu:uuid ${sparqlEscapeString(id)} ;
          dct:subject ${sparqlEscapeString('Automatic Submission Service')} ;
          oslc:message ${sparqlEscapeString(message)} ;
          dct:created ${sparqlEscapeDateTime(new Date().toISOString())} ;
          dct:creator ${sparqlEscapeUri(CREATOR)} .
        ${referenceTriple}
        ${detailTriple}
      }
    }`;
  try {
    await updateSudo(q);
    return uri;
  } catch (e) {
    console.warn(
      `[WARN] Something went wrong while trying to store an error.\nMessage: ${e}\nQuery: ${q}`,
    );
  }
}
