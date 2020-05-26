import {app, errorHandler} from 'mu';


app.get('/', function (req, res) {
  res.send('Hello remove-submission-service');
});

app.use(errorHandler);