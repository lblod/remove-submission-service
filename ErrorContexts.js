export const ErrorResponseContext = {
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  oslc: 'http://open-services.net/ns/core#',
  mu: 'http://mu.semte.ch/vocabularies/core/',
  uuid: {
    '@id': 'mu:uuid',
  },
  errorMessage: {
    '@id': 'oslc:message',
  },
};

export const ErrorResponseFrame = {
  '@context': ErrorResponseContext,
  //'@type': 'oslc:Error',
  uuid: {
    '@embed': '@always',
  },
  errorMessage: {
    '@embed': '@always',
  },
};
