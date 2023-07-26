import { sparqlEscapeUri, sparqlEscapeString } from 'mu';
import { querySudo } from '@lblod/mu-auth-sudo';

export async function verifyKeyAndOrganisation(vendor, key, organisation) {
  const result = await querySudo(`
    PREFIX muAccount: <http://mu.semte.ch/vocabularies/account/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

    SELECT DISTINCT ?organisationID WHERE  {
      GRAPH <http://mu.semte.ch/graphs/automatic-submission> {
        ${sparqlEscapeUri(vendor)}
          a foaf:Agent;
          muAccount:key ${sparqlEscapeString(key)};
          muAccount:canActOnBehalfOf ${sparqlEscapeUri(organisation)}.
      }
      ${sparqlEscapeUri(organisation)}
        mu:uuid ?organisationID.
    }`);
  if (result.results.bindings.length === 1) {
    return result.results.bindings[0].organisationID.value;
  }
}
