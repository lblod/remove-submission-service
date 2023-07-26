import { app, errorHandler } from 'mu';
import * as del from './delete';
import * as auth from './authentication';
import * as jsonld from 'jsonld';
import * as jli from './jsonld-input';
import * as err from './error';
import * as N3 from 'n3';
const { namedNode } = N3.DataFactory;

app.get('/', function (req, res) {
  res.send('Hello clean-up-submission-service');
});

app.delete('/submissions/:uuid', async function (req, res, next) {
  const uuid = req.params.uuid;
  console.log(
    `Received request to delete submission-document with uuid '${uuid}'`,
  );
  try {
    const { message, error } = await del.deleteSubmission(uuid);
    if (error) {
      return res.status(error.status).send(error);
    }
    return res.status(200).send(message);
  } catch (e) {
    console.log(
      `Something unexpected went wrong while deleting submission-document with uuid '${uuid}'`,
    );
    console.error(e);
    return next(e);
  }
});

app.post('/delete-melding', async function (req, res) {
  try {
    await ensureValidContentType(req.get('content-type'));
    const enrichedBody = await jli.enrichBodyForDelete(req.body);
    const store = await jsonLdToStore(enrichedBody);

    await ensureAuthorisation(store);

    const submissionUris = store.getObjects(
      undefined,
      namedNode('http://purl.org/dc/terms/subject'),
    );
    const submissionUri = submissionUris[0]?.value;
    if (!submissionUri)
      throw new Error('There was no submission URI in the request');

    const { message, error } = await del.deleteSubmissionViaUri(submissionUri);
    //TOT HIER
    //TODO error return in JSONLD
    if (error) {
      return res.status(error.status).send(error);
    }
    return res.status(200).send(message);
  } catch (error) {
    const message =
      'Something went wrong while fetching the status of the submitted resource and its associated Job';
    console.error(message, error.message);
    console.error(error);
    await err.sendErrorAlert({ message, detail: error.message });
    res.status(500).send(`${message}\n${error.message}`);
  }
});

///////////////////////////////////////////////////////////////////////////////
// Helpers
///////////////////////////////////////////////////////////////////////////////

function ensureValidContentType(contentType) {
  if (!/application\/(ld\+)?json/.test(contentType))
    throw new Error(
      'Content-Type not valid, only application/json or application/ld+json are accepted',
    );
}

async function ensureAuthorisation(store) {
  const authentication = jli.extractAuthentication(store);
  if (
    !(
      authentication.vendor &&
      authentication.key &&
      authentication.organisation
    )
  )
    throw new Error(
      'The authentication (or part of it) for this request is missing. Make sure to supply publisher (with vendor URI and key) and organization information to the request.',
    );
  const organisationID = await auth.verifyKeyAndOrganisation(
    authentication.vendor,
    authentication.key,
    authentication.organisation,
  );
  if (!organisationID) {
    const error = new Error(
      'Authentication failed, vendor does not have access to the organization or does not exist. If this should not be the case, please contact us at digitaalABB@vlaanderen.be for login credentials.',
    );
    error.reference = authentication.vendor;
    throw error;
  }
  return organisationID;
}

async function jsonLdToStore(jsonLdObject) {
  const requestQuads = await jsonld.default.toRDF(jsonLdObject, {});
  const store = new N3.Store();
  store.addQuads(requestQuads);
  return store;
}



app.use(errorHandler);
