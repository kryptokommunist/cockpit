# Local testing

For local tests with Postman it is required to set up the test certificate in the Postman Environment:
File: `BG PSD2 XS2A Server.postman_environment.json` and Key `SSL_CLIENT_CERT`

The `QWAC1.p12` file has to be encoded as a Base64 string.

The `SSL_CLIENT_CERT` value must start with `-----BEGIN CERTIFICATE-----`.
After this add the Base64 encoded `QWAC1.p12` value and then add `-----END CERTIFICATE-----` to mark the end of the
certificate.

Example:
```
-----BEGIN CERTIFICATE-----TheEncodedBase64QwacCertifacte-----END CERTIFICATE-----
```

