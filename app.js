import {app, errorHandler} from 'mu';
import {deleteSubmissionDocument} from "./delete";


app.get('/', function (req, res) {
  res.send('Hello clean-up-submission-service');
});

app.delete('/submission-documents/:uuid', async function (req, res, next) {
  const uuid = req.params.uuid;
  console.log(`Received request to delete submission-document with uuid '${uuid}'`);
  try{
    const {message, error} = await deleteSubmissionDocument(uuid);
    if(error) {
      return res.status(error.status).send(error);
    }
    return res.status(200).send(message)
  } catch (e) {
    console.log(`Something unexpected went wrong while deleting submission-document with uuid '${uuid}'`);
    console.error(e);
    return next(e);
  }
})

app.use(errorHandler);