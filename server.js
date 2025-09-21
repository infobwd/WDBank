const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.post('/proxy', (req, res) => {
  const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbwnz_5Nsuh4bkG6KjV9WS5-ce525fOYxKlP9MlzauO6__4Ogy3moSBSpFKb4VvAaaWM/exec';

  request.post({
    url: googleScriptUrl,
    json: req.body,
  }, (error, response, body) => {
    if (error) {
      res.status(500).send(error);
    } else {
      res.status(response.statusCode).send(body);
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
