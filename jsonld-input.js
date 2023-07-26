import { uuid } from 'mu';
import { SubmissionRegistrationContext } from './SubmissionRegistrationContext';
import * as N3 from 'n3';
const { namedNode } = N3.DataFactory;

export function enrichBodyForDelete(body) {
  if (!body['@context']) {
    body['@context'] = SubmissionRegistrationContext;
  }
  const requestId = uuid();
  if (!body['@id'])
    body[
      '@id'
    ] = `http://data.lblod.info/submission-delete-request/${requestId}`;
  if (!body['@type'])
    body['@type'] = 'http://data.lblod.info/submission-delete-request/Request';
  if (body.authentication) {
    body.authentication[
      '@id'
    ] = `http://data.lblod.info/authentications/${uuid()}`;
    body.authentication.configuration[
      '@id'
    ] = `http://data.lblod.info/configurations/${uuid()}`;
    body.authentication.credentials[
      '@id'
    ] = `http://data.lblod.info/credentials/${uuid()}`;
  }
  return body;
}

export function extractAuthentication(store) {
  const keys = store.getObjects(
    undefined,
    namedNode('http://mu.semte.ch/vocabularies/account/key'),
  );
  const vendors = store.getObjects(
    undefined,
    namedNode('http://purl.org/pav/providedBy'),
  );
  const organisations = store.getObjects(
    undefined,
    namedNode('http://purl.org/pav/createdBy'),
  );
  return {
    key: keys[0]?.value,
    vendor: vendors[0]?.value,
    organisation: organisations[0]?.value,
  };
}
